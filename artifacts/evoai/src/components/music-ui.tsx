import { Disc3, Music2, Pause, Play, SkipForward, Upload, Volume2 } from 'lucide-react';
import { useRef, type ChangeEvent } from 'react';
import { useMusic } from './music-context';

function time(value: number) {
  if (!Number.isFinite(value)) return '0:00';
  return `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, '0')}`;
}

export function MusicPlayer({ viewer = false }: { viewer?: boolean }) {
  const { current, playing, starting, playbackError, position, duration, volume, toggle, next, seek, setVolume } = useMusic();
  if (!current) return null;
  return (
    <aside className={`music-player${viewer ? ' viewer-placement' : ''}`} aria-label="Music player" data-testid="music-player">
      <div className="music-player-top">
        <span className="music-player-note" aria-hidden="true"><Music2 size={17} /></span>
        <div className="music-player-info">
          <small>{starting ? 'opening track' : playing ? 'now playing' : 'paused'}</small>
          <strong title={current.name} data-testid="text-current-song">{current.name}</strong>
        </div>
        <div className="music-player-buttons">
          <button type="button" onClick={toggle} aria-label={playing ? 'Pause music' : 'Play music'} disabled={starting} data-testid="button-toggle-music">
            {playing ? <Pause size={17} fill="currentColor" /> : <Play size={17} fill="currentColor" />}
          </button>
          <button type="button" onClick={next} aria-label="Skip to next song" data-testid="button-next-song"><SkipForward size={18} /></button>
        </div>
      </div>
      <div className="music-player-progress">
        <span>{time(position)}</span>
        <input type="range" min={0} max={duration || 1} step={.1} value={Math.min(position, duration || 1)}
          onChange={(event) => seek(Number(event.target.value))} disabled={!duration}
          aria-label="Seek through song" data-testid="input-music-seek" />
        <span>{time(duration)}</span>
      </div>
      <label className="music-player-volume">
        <Volume2 size={13} aria-hidden="true" />
        <span className="sr-only">Volume</span>
        <input type="range" min={0} max={1} step={.01} value={volume}
          onChange={(event) => setVolume(Number(event.target.value))} aria-label="Volume" data-testid="input-music-volume" />
      </label>
      {playbackError ? <p className="music-player-error" role="alert" data-testid="status-music-playback-error">
        {playbackError} <button type="button" onClick={toggle} data-testid="button-retry-music">Try play</button>
      </p> : null}
    </aside>
  );
}

export function MusicLibrary() {
  const inputRef = useRef<HTMLInputElement>(null);
  const { tracks, loading, listError, uploadError, uploading, current, playing, starting, playbackError, reload, upload, select } = useMusic();
  const onFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) void upload(file);
    event.target.value = '';
  };
  return (
    <section className="music-room" aria-label="Your music library">
      <div className="music-room-head">
        <div>
          <span className="panel-label">your listening room</span>
          <h2>The sounds you brought.</h2>
          <p>Your own MP3s, ready to follow you from one world to the next.</p>
        </div>
        <label className="music-upload" htmlFor="music-upload-input">
          <Upload size={17} aria-hidden="true" />
          {uploading ? 'Adding music…' : 'Add an MP3'}
          <input ref={inputRef} id="music-upload-input" type="file" accept=".mp3,audio/mpeg" disabled={uploading}
            onChange={onFile} aria-label="Upload an MP3" data-testid="input-upload-mp3" />
        </label>
      </div>
      {uploadError ? <p className="music-feedback" role="alert" data-testid="status-upload-error">{uploadError}</p> : null}
      {playbackError && !current ? <p className="music-feedback" role="alert">{playbackError}</p> : null}
      {loading ? (
        <div className="music-room-state" aria-label="Loading your music">
          <div className="music-skeleton" /><div className="music-skeleton" /><div className="music-skeleton" />
          <p>Gathering your music…</p>
        </div>
      ) : listError ? (
        <div className="music-room-state" role="alert">
          <Disc3 size={30} strokeWidth={1.3} aria-hidden="true" />
          <h3>We couldn’t find your music.</h3>
          <p data-testid="status-music-list-error">{listError}</p>
          <button className="viewer-back-button" type="button" onClick={() => void reload()} data-testid="button-retry-music-list">Try again</button>
        </div>
      ) : tracks.length === 0 ? (
        <div className="music-room-state">
          <Disc3 size={34} strokeWidth={1.3} aria-hidden="true" />
          <h3>A little room for sound.</h3>
          <p>Add your first MP3 and it can play while you explore. Your music stays in your library.</p>
          <button className="viewer-back-button" type="button" onClick={() => inputRef.current?.click()} data-testid="button-add-first-mp3">Choose an MP3</button>
        </div>
      ) : (
        <ul className="music-list" data-testid="list-music-tracks">
          {tracks.map((track) => {
            const active = current?.id === track.id;
            return <li key={track.id}>
              <button className={`music-track${active ? ' active' : ''}`} type="button"
                onClick={() => select(track)} aria-label={`${active ? playing ? 'Pause' : 'Resume' : 'Play'} ${track.name}`}
                data-testid={`button-play-track-${track.id}`}>
                <span className="music-track-icon" aria-hidden="true">{active && playing ? <Pause size={15} /> : <Play size={15} />}</span>
                <span className="music-track-copy">
                  <strong>{track.name}</strong>
                  <small>{new Date(track.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</small>
                </span>
                <span className="music-track-meta">{(track.byte_size / 1024 / 1024).toFixed(1)} MB</span>
                <span className="music-track-status">{active ? starting ? 'opening' : playing ? 'pause' : 'resume' : 'play'}</span>
              </button>
            </li>;
          })}
        </ul>
      )}
    </section>
  );
}