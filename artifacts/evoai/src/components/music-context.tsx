import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

export type MusicTrack = { id: string; name: string; byte_size: number; created_at: string };
type MusicContextValue = {
  tracks: MusicTrack[];
  loading: boolean;
  listError: string;
  uploadError: string;
  uploading: boolean;
  playbackError: string;
  current: MusicTrack | null;
  playing: boolean;
  starting: boolean;
  position: number;
  duration: number;
  volume: number;
  reload: () => Promise<void>;
  upload: (file: File) => Promise<void>;
  select: (track: MusicTrack) => void;
  toggle: () => void;
  next: () => void;
  seek: (time: number) => void;
  setVolume: (volume: number) => void;
};

const MusicContext = createContext<MusicContextValue | null>(null);
const shuffle = (ids: string[]) => {
  const result = [...ids];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};

async function payload(response: Response): Promise<Record<string, unknown>> {
  try {
    return (await response.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function apiError(data: Record<string, unknown>, fallback: string) {
  return typeof data.error === 'string' ? data.error : fallback;
}

export function MusicProvider({ children, userId, accessToken }: {
  children: ReactNode;
  userId: string | null;
  accessToken: string | null;
}) {
  const [tracks, setTracks] = useState<MusicTrack[]>([]);
  const [loading, setLoading] = useState(Boolean(userId));
  const [listError, setListError] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [playbackError, setPlaybackError] = useState('');
  const [current, setCurrent] = useState<MusicTrack | null>(null);
  const [playing, setPlaying] = useState(false);
  const [starting, setStarting] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(.7);
  const tokenRef = useRef(accessToken);
  tokenRef.current = accessToken;
  const accountRef = useRef(userId);
  accountRef.current = userId;
  const listRequestRef = useRef(0);
  const tracksRef = useRef(tracks);
  tracksRef.current = tracks;
  const currentRef = useRef<MusicTrack | null>(null);
  const queueRef = useRef<string[]>([]);
  const consumedRef = useRef<Set<string>>(new Set());
  const failedIdsRef = useRef<Set<string>>(new Set());
  const failedRequestRef = useRef<number | null>(null);
  const activeAttemptRef = useRef<{ request: number; track: MusicTrack; direct: boolean } | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const requestRef = useRef(0);
  const nextRef = useRef<() => void>(() => {});
  const startRef = useRef<(track: MusicTrack, direct?: boolean) => void>(() => {});
  const failRef = useRef<(request: number, track: MusicTrack, direct: boolean, message: string) => void>(() => {});

  const fail = useCallback((request: number, track: MusicTrack, direct: boolean, message: string) => {
    if (request !== requestRef.current || failedRequestRef.current === request) return;
    failedRequestRef.current = request;
    setStarting(false);
    setPlaying(false);
    failedIdsRef.current.add(track.id);
    if (direct) setPlaybackError(`Could not play ${track.name}: ${message} Trying another song.`);
    if (failedIdsRef.current.size >= tracksRef.current.length) {
      setPlaybackError('None of the songs in your library could be played. Check the files or try a song again.');
      return;
    }
    // Queue the transition so audio error events and rejected play promises cannot
    // recursively restart a broken song in the same call stack.
    queueMicrotask(() => {
      if (request === requestRef.current && audioRef.current) nextRef.current();
    });
  }, []);
  failRef.current = fail;

  useEffect(() => {
    if (!userId) return;
    accountRef.current = userId;
    const audio = new Audio();
    audio.preload = 'auto';
    audio.volume = .7;
    audioRef.current = audio;
    const onTime = () => setPosition(audio.currentTime);
    const onDuration = () => setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnded = () => {
      failedIdsRef.current.clear();
      nextRef.current();
    };
    const onError = () => {
      const attempt = activeAttemptRef.current;
      if (attempt) failRef.current(attempt.request, attempt.track, attempt.direct, 'The audio file could not be opened.');
    };
    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('loadedmetadata', onDuration);
    audio.addEventListener('durationchange', onDuration);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);
    return () => {
      accountRef.current = null;
      listRequestRef.current++;
      requestRef.current++;
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      audioRef.current = null;
      queueRef.current = [];
      consumedRef.current.clear();
      failedIdsRef.current.clear();
      activeAttemptRef.current = null;
      currentRef.current = null;
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('loadedmetadata', onDuration);
      audio.removeEventListener('durationchange', onDuration);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
    };
  }, [userId]);

  const start = useCallback(async (track: MusicTrack, direct = false) => {
    const audio = audioRef.current;
    const token = tokenRef.current;
    if (!audio || !token) return;
    const request = ++requestRef.current;
    activeAttemptRef.current = null;
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    activeAttemptRef.current = { request, track, direct };
    consumedRef.current.add(track.id);
    queueRef.current = queueRef.current.filter((id) => id !== track.id);
    currentRef.current = track;
    setCurrent(track);
    setPosition(0);
    setDuration(0);
    setPlaying(false);
    if (direct) setPlaybackError('');
    setStarting(true);
    try {
      const response = await fetch(`/api/music/${encodeURIComponent(track.id)}/play`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await payload(response);
      if (!response.ok) throw new Error(apiError(data, 'Could not get a playback link.'));
      if (typeof data.signed_url !== 'string' || !data.signed_url) throw new Error('No playback link was returned.');
      if (request !== requestRef.current || audioRef.current !== audio) return;
      audio.src = data.signed_url;
      await audio.play();
      if (request !== requestRef.current) return;
      setStarting(false);
    } catch (error) {
      if (request !== requestRef.current) return;
      failRef.current(request, track, direct, error instanceof Error && error.name === 'NotAllowedError'
        ? 'The browser did not allow playback.'
        : error instanceof Error ? error.message : 'This track could not be played.');
    }
  }, []);
  startRef.current = (track, direct) => { void start(track, direct); };

  const next = useCallback(() => {
    const library = tracksRef.current;
    if (!library.length) return;
    if (!queueRef.current.length) {
      consumedRef.current.clear();
      const previous = currentRef.current?.id;
      const shuffled = shuffle(library.map((track) => track.id));
      if (shuffled.length > 1 && shuffled[0] === previous) {
        const swap = shuffled[0];
        shuffled[0] = shuffled[1];
        shuffled[1] = swap;
      }
      queueRef.current = shuffled;
    }
    const id = queueRef.current.shift();
    const track = library.find((item) => item.id === id);
    if (track) startRef.current(track);
  }, []);
  nextRef.current = next;

  const updateLibrary = useCallback((library: MusicTrack[]) => {
    const previousIds = new Set(tracksRef.current.map((track) => track.id));
    const availableIds = new Set(library.map((track) => track.id));
    consumedRef.current = new Set([...consumedRef.current].filter((id) => availableIds.has(id)));
    failedIdsRef.current = new Set([...failedIdsRef.current].filter((id) => availableIds.has(id)));
    const remainder = queueRef.current.filter((id) => availableIds.has(id) && !consumedRef.current.has(id));
    const discovered = library.filter((track) => !previousIds.has(track.id) && !consumedRef.current.has(track.id)).map((track) => track.id);
    // Mix discoveries into the unplayed portion, rather than appending at the end.
    queueRef.current = shuffle([...new Set([...remainder, ...discovered])]);
    tracksRef.current = library;
    setTracks(library);
    if (!currentRef.current && library.length) {
      if (!queueRef.current.length) queueRef.current = shuffle(library.map((track) => track.id));
      nextRef.current();
    }
  }, []);

  const reload = useCallback(async () => {
    const token = tokenRef.current;
    const account = accountRef.current;
    if (!token || !account) return;
    const request = ++listRequestRef.current;
    setLoading(true);
    setListError('');
    try {
      const response = await fetch('/api/music', { headers: { Authorization: `Bearer ${token}` } });
      const data = await payload(response);
      if (request !== listRequestRef.current || account !== accountRef.current) return;
      if (!response.ok) throw new Error(apiError(data, 'Could not load your music.'));
      const library = Array.isArray(data.tracks) ? data.tracks as MusicTrack[] : [];
      updateLibrary(library);
    } catch (error) {
      if (request === listRequestRef.current && account === accountRef.current) {
        setListError(error instanceof Error ? error.message : 'Could not load your music.');
      }
    } finally {
      if (request === listRequestRef.current && account === accountRef.current) setLoading(false);
    }
  }, [updateLibrary]);

  useEffect(() => {
    if (userId && accessToken) void reload();
  // Access token renewal should not restart the library or playback.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, reload]);

  const upload = useCallback(async (file: File) => {
    if (!/\.mp3$/i.test(file.name) && file.type !== 'audio/mpeg') {
      setUploadError('Choose an MP3 audio file.');
      return;
    }
    if (!file.size) {
      setUploadError('This file is empty. Choose another MP3.');
      return;
    }
    const token = tokenRef.current;
    const account = accountRef.current;
    if (!token || !account) {
      setUploadError('Your session has ended. Sign in again to upload music.');
      return;
    }
    setUploading(true);
    setUploadError('');
    try {
      const response = await fetch('/api/music', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'audio/mpeg',
          'X-File-Name': encodeURIComponent(file.name),
        },
        body: file,
      });
      const data = await payload(response);
      if (account !== accountRef.current) return;
      if (!response.ok) throw new Error(apiError(data, 'Could not upload this MP3.'));
      if (!data.track || typeof data.track !== 'object') throw new Error('The upload finished, but no track was returned.');
      const track = data.track as MusicTrack;
      // An older list response must not replace this newly uploaded track.
      listRequestRef.current++;
      updateLibrary([...tracksRef.current.filter((item) => item.id !== track.id), track]);
      setLoading(false);
      setListError('');
    } catch (error) {
      if (account === accountRef.current) {
        setUploadError(error instanceof Error ? error.message : 'Could not upload this MP3.');
      }
    } finally {
      if (account === accountRef.current) setUploading(false);
    }
  }, [updateLibrary]);

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!currentRef.current) { failedIdsRef.current.clear(); nextRef.current(); return; }
    if (audio.paused) {
      failedIdsRef.current.clear();
      setPlaybackError('');
      if (!audio.src || audio.error) { startRef.current(currentRef.current, true); return; }
      const request = ++requestRef.current;
      activeAttemptRef.current = { request, track: currentRef.current, direct: true };
      void audio.play().catch((error: unknown) => {
        const attempt = activeAttemptRef.current;
        if (attempt?.request === request) failRef.current(request, attempt.track, true,
          error instanceof Error ? error.message : 'Playback could not resume.');
      });
    } else audio.pause();
  }, []);
  const select = useCallback((track: MusicTrack) => {
    if (currentRef.current?.id === track.id) {
      toggle();
      return;
    }
    failedIdsRef.current.clear();
    startRef.current(track, true);
  }, [toggle]);
  const skip = useCallback(() => {
    setPlaybackError('');
    nextRef.current();
  }, []);
  const seek = useCallback((time: number) => {
    const audio = audioRef.current;
    if (audio && Number.isFinite(audio.duration)) {
      audio.currentTime = Math.max(0, Math.min(time, audio.duration));
      setPosition(audio.currentTime);
    }
  }, []);
  const changeVolume = useCallback((value: number) => {
    const safe = Math.max(0, Math.min(1, value));
    if (audioRef.current) audioRef.current.volume = safe;
    setVolumeState(safe);
  }, []);

  return (
    <MusicContext.Provider value={{
      tracks, loading, listError, uploadError, uploading, playbackError,
      current, playing, starting, position, duration, volume, reload, upload,
      select, toggle, next: skip, seek, setVolume: changeVolume,
    }}>
      {children}
    </MusicContext.Provider>
  );
}

export function useMusic() {
  const context = useContext(MusicContext);
  if (!context) throw new Error('useMusic must be used inside MusicProvider');
  return context;
}