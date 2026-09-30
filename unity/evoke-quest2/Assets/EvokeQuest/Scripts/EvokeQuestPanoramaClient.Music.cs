using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Text;
using System.Threading.Tasks;
using UnityEngine;
using UnityEngine.Networking;
using UnityEngine.UI;

namespace EvokeQuest
{
    public sealed partial class EvokeQuestPanoramaClient
    {
        private const int MaxMusicUploadBytes = 25 * 1024 * 1024;
        private AudioSource musicSource;
        private AudioClip musicClip;
        private readonly List<MusicTrack> musicTracks = new List<MusicTrack>();
        private readonly List<string> shuffleQueue = new List<string>();
        private readonly HashSet<string> failedMusicTracks = new HashSet<string>();
        private readonly List<GameObject> musicRows = new List<GameObject>();
        private Transform musicListContent;
        private ScrollRect musicScroll;
        private Text musicStatus;
        private Text musicTrackName;
        private Text musicPlaybackStatus;
        private Text musicTime;
        private Button musicPlayButton;
        private Slider musicSeek;
        private Slider musicVolume;
        private bool changingSeek;
        private bool musicLoading;
        private bool musicUploading;
        private bool musicLoaded;
        private bool musicAutoStarted;
        private bool musicWasPlaying;
        private int musicRequestId;
        private int musicListRequestId;
        private float musicVolumeValue = 0.7f;
        private string pendingPickerPath;
        private string currentMusicId;
        private string lastMusicError;

        [Serializable] private sealed class MusicTrackList { public MusicTrack[] tracks; }
        [Serializable] private sealed class MusicTrackPayload { public MusicTrack track; }
        [Serializable] private sealed class MusicTrack
        {
            public string id;
            public string name;
            public long byte_size;
            public string created_at;
        }
        [Serializable] private sealed class SignedMusicUrl { public string signed_url; }
        [Serializable] private sealed class PickerResult { public string status; public string path; public string name; public string error; public int session_generation; }
        private sealed class MusicFileReadResult { public byte[] bytes; public string error; }

        private void BuildMusic()
        {
            musicPanel = NewPanel("MusicPanel");
            CreateText(musicPanel.transform, "MusicTitle", "Your listening room.", 36, TextAnchor.MiddleLeft, new Vector2(-410f, 180f), new Vector2(700f, 54f));
            CreateText(musicPanel.transform, "MusicDescription", "Your MP3s follow you from one world to the next.", 21, TextAnchor.MiddleLeft, new Vector2(-410f, 135f), new Vector2(700f, 40f));
            CreateButton(musicPanel.transform, "ReloadMusic", "RELOAD", new Vector2(300f, 180f), new Vector2(170f, 60f), ReloadMusic);
            CreateButton(musicPanel.transform, "UploadMusic", "ADD AN MP3", new Vector2(300f, 110f), new Vector2(220f, 60f), PickMusicFile);
            musicStatus = CreateText(musicPanel.transform, "MusicStatus", "Sign in to load your music.", 19, TextAnchor.MiddleLeft, new Vector2(-410f, 92f), new Vector2(620f, 38f));

            GameObject scrollObject = new GameObject("MusicList");
            scrollObject.transform.SetParent(musicPanel.transform, false);
            RectTransform scrollRect = scrollObject.AddComponent<RectTransform>();
            scrollRect.anchorMin = scrollRect.anchorMax = new Vector2(0.5f, 0.5f);
            scrollRect.pivot = new Vector2(0.5f, 0.5f);
            scrollRect.anchoredPosition = new Vector2(-210f, -88f);
            scrollRect.sizeDelta = new Vector2(540f, 300f);
            Image viewportImage = scrollObject.AddComponent<Image>();
            viewportImage.sprite = GetUiSprite();
            viewportImage.color = new Color(1f, 1f, 1f, 0.02f);
            Mask mask = scrollObject.AddComponent<Mask>();
            mask.showMaskGraphic = false;
            musicScroll = scrollObject.AddComponent<ScrollRect>();
            musicScroll.horizontal = false;
            GameObject content = new GameObject("Content");
            content.transform.SetParent(scrollObject.transform, false);
            RectTransform contentRect = content.AddComponent<RectTransform>();
            contentRect.anchorMin = new Vector2(0f, 1f);
            contentRect.anchorMax = new Vector2(1f, 1f);
            contentRect.pivot = new Vector2(0.5f, 1f);
            VerticalLayoutGroup layout = content.AddComponent<VerticalLayoutGroup>();
            layout.spacing = 8f;
            layout.padding = new RectOffset(6, 6, 6, 6);
            layout.childControlHeight = true;
            layout.childControlWidth = true;
            layout.childForceExpandHeight = false;
            layout.childForceExpandWidth = true;
            ContentSizeFitter fitter = content.AddComponent<ContentSizeFitter>();
            fitter.verticalFit = ContentSizeFitter.FitMode.PreferredSize;
            musicListContent = content.transform;
            musicScroll.viewport = scrollRect;
            musicScroll.content = contentRect;

            musicTrackName = CreateText(musicPanel.transform, "CurrentTrack", "Nothing playing yet", 20, TextAnchor.MiddleCenter, new Vector2(300f, 55f), new Vector2(390f, 48f));
            musicPlaybackStatus = CreateText(musicPanel.transform, "PlaybackStatus", "Choose a song to begin.", 16, TextAnchor.MiddleCenter, new Vector2(300f, 22f), new Vector2(390f, 36f));
            musicPlayButton = CreateButton(musicPanel.transform, "PlayPauseMusic", "PLAY", new Vector2(180f, -28f), new Vector2(120f, 55f), ToggleMusic);
            CreateButton(musicPanel.transform, "SkipMusic", "SKIP", new Vector2(315f, -28f), new Vector2(120f, 55f), SkipMusic);
            CreateButton(musicPanel.transform, "RetryMusic", "RETRY", new Vector2(450f, -28f), new Vector2(120f, 55f), RetryMusic);
            musicTime = CreateText(musicPanel.transform, "MusicTime", "0:00 / 0:00", 16, TextAnchor.MiddleCenter, new Vector2(335f, -78f), new Vector2(390f, 32f));
            CreateButton(musicPanel.transform, "SeekBack", "-15 SEC", new Vector2(115f, -112f), new Vector2(85f, 48f), () => NudgeSeek(-15f));
            musicSeek = CreateSlider(musicPanel.transform, "MusicSeek", new Vector2(335f, -112f), new Vector2(300f, 25f));
            CreateButton(musicPanel.transform, "SeekForward", "+15 SEC", new Vector2(555f, -112f), new Vector2(85f, 48f), () => NudgeSeek(15f));
            musicSeek.minValue = 0f;
            musicSeek.maxValue = 1f;
            musicSeek.onValueChanged.AddListener(value =>
            {
                if (!changingSeek && musicSource != null && musicSource.clip != null)
                    musicSource.time = value * musicSource.clip.length;
            });
            CreateButton(musicPanel.transform, "VolumeDown", "VOL −", new Vector2(205f, -165f), new Vector2(82f, 48f), () => NudgeVolume(-0.1f));
            musicVolume = CreateSlider(musicPanel.transform, "MusicVolume", new Vector2(375f, -165f), new Vector2(220f, 25f));
            musicVolume.value = musicVolumeValue;
            musicVolume.onValueChanged.AddListener(value =>
            {
                musicVolumeValue = Mathf.Clamp01(value);
                if (musicSource != null) musicSource.volume = musicVolumeValue;
            });
            CreateButton(musicPanel.transform, "VolumeUp", "VOL +", new Vector2(545f, -165f), new Vector2(82f, 48f), () => NudgeVolume(0.1f));
        }

        private Slider CreateSlider(Transform parent, string name, Vector2 position, Vector2 size)
        {
            GameObject sliderObject = new GameObject(name);
            sliderObject.transform.SetParent(parent, false);
            RectTransform rect = sliderObject.AddComponent<RectTransform>();
            rect.anchorMin = rect.anchorMax = new Vector2(0.5f, 0.5f);
            rect.anchoredPosition = position;
            rect.sizeDelta = size;
            Image background = sliderObject.AddComponent<Image>();
            background.sprite = GetUiSprite();
            background.color = new Color(0.16f, 0.24f, 0.22f, 1f);
            GameObject fill = new GameObject("Fill");
            fill.transform.SetParent(sliderObject.transform, false);
            RectTransform fillRect = fill.AddComponent<RectTransform>();
            fillRect.anchorMin = new Vector2(0f, 0.25f);
            fillRect.anchorMax = new Vector2(1f, 0.75f);
            fillRect.offsetMin = new Vector2(3f, 0f);
            fillRect.offsetMax = new Vector2(-3f, 0f);
            Image fillImage = fill.AddComponent<Image>();
            fillImage.sprite = GetUiSprite();
            fillImage.color = new Color(0.24f, 0.82f, 0.58f, 1f);
            GameObject handle = new GameObject("Handle");
            handle.transform.SetParent(sliderObject.transform, false);
            RectTransform handleRect = handle.AddComponent<RectTransform>();
            handleRect.sizeDelta = new Vector2(22f, 22f);
            Image handleImage = handle.AddComponent<Image>();
            handleImage.sprite = GetUiSprite();
            handleImage.color = new Color(0.34f, 0.62f, 1f, 1f);
            Slider slider = sliderObject.AddComponent<Slider>();
            slider.targetGraphic = handleImage;
            slider.fillRect = fillRect;
            slider.handleRect = handleRect;
            slider.direction = Slider.Direction.LeftToRight;
            return slider;
        }

        private void SelectTab(string tab)
        {
            if (string.IsNullOrEmpty(accessToken)) return;
            activeTab = tab;
            panelBackground.enabled = true;
            brandText.gameObject.SetActive(true);
            statusText.gameObject.SetActive(false);
            loginPanel.SetActive(false);
            viewerPanel.SetActive(false);
            tabsPanel.SetActive(true);
            worldsPanel.SetActive(tab == "immerse");
            howPanel.SetActive(tab == "how");
            musicPanel.SetActive(tab == "music");
            if (tab == "music" && !musicLoaded && !musicLoading)
                ReloadMusic();
        }

        private void EnsureMusicSource()
        {
            if (musicSource == null)
            {
                musicSource = GetComponent<AudioSource>();
                if (musicSource == null) musicSource = gameObject.AddComponent<AudioSource>();
                musicSource.playOnAwake = false;
                musicSource.loop = false;
                musicSource.spatialBlend = 0f;
                musicSource.volume = musicVolumeValue;
            }
        }

        private void ReloadMusic()
        {
            if (string.IsNullOrEmpty(accessToken) || musicLoading) return;
            int requestId = ++musicListRequestId;
            StartCoroutine(LoadMusicLibrary(authSessionGeneration, requestId));
        }

        private IEnumerator LoadMusicLibrary(int generation, int requestId)
        {
            musicLoading = true;
            musicStatus.text = "Loading your music…";
            string response = null;
            string error = null;
            yield return MusicApiRequest(generation, "GET", "/api/music", null, null, value => response = value, value => error = value);
            if (generation != authSessionGeneration || requestId != musicListRequestId) yield break;
            musicLoading = false;
            if (error != null)
            {
                musicStatus.text = error;
                musicLoaded = false;
                yield break;
            }
            MusicTrackList payload = null;
            try { payload = JsonUtility.FromJson<MusicTrackList>(response); }
            catch (Exception)
            {
                musicLoaded = false;
                musicStatus.text = "The music library response could not be read.";
                yield break;
            }
            if (payload == null)
            {
                musicLoaded = false;
                musicStatus.text = "The music library response was empty.";
                yield break;
            }
            HashSet<string> previousIds = new HashSet<string>(musicTracks.ConvertAll(track => track.id));
            List<MusicTrack> refreshedTracks = new List<MusicTrack>();
            if (payload != null && payload.tracks != null)
            {
                foreach (MusicTrack track in payload.tracks)
                    if (track != null && !string.IsNullOrEmpty(track.id))
                        refreshedTracks.Add(track);
            }
            HashSet<string> availableIds = new HashSet<string>(refreshedTracks.ConvertAll(track => track.id));
            shuffleQueue.RemoveAll(id => !availableIds.Contains(id));
            failedMusicTracks.RemoveWhere(id => !availableIds.Contains(id));
            List<string> newlyDiscovered = refreshedTracks.FindAll(track => !previousIds.Contains(track.id) &&
                track.id != currentMusicId && !failedMusicTracks.Contains(track.id)).ConvertAll(track => track.id);
            ShuffleIds(newlyDiscovered);
            shuffleQueue.AddRange(newlyDiscovered);
            musicTracks.Clear();
            musicTracks.AddRange(refreshedTracks);
            musicLoaded = true;
            RebuildMusicRows();
            musicStatus.text = musicTracks.Count == 0 ? "Your library is empty. Add an MP3 to start listening." : musicTracks.Count + " track" + (musicTracks.Count == 1 ? "" : "s") + " in your private library.";
            if (musicTracks.Count > 0 && !musicAutoStarted)
            {
                musicAutoStarted = true;
                StartCoroutine(PlayNextMusic(generation));
            }
        }

        private void RebuildMusicRows()
        {
            foreach (GameObject row in musicRows)
                if (row != null) Destroy(row);
            musicRows.Clear();
            for (int i = 0; i < musicTracks.Count; i++)
            {
                MusicTrack track = musicTracks[i];
                Button button = CreateButton(musicListContent, "Track_" + track.id, track.name ?? "Untitled MP3",
                    Vector2.zero, new Vector2(590f, 62f), () => SelectMusic(track));
                RectTransform rect = button.GetComponent<RectTransform>();
                rect.anchorMin = new Vector2(0f, 1f);
                rect.anchorMax = new Vector2(1f, 1f);
                rect.pivot = new Vector2(0.5f, 1f);
                rect.sizeDelta = new Vector2(0f, 62f);
                LayoutElement element = button.gameObject.AddComponent<LayoutElement>();
                element.preferredHeight = 62f;
                element.minHeight = 62f;
                musicRows.Add(button.gameObject);
            }
        }

        private void SelectMusic(MusicTrack track)
        {
            if (track == null || string.IsNullOrEmpty(accessToken)) return;
            musicAutoStarted = true;
            failedMusicTracks.Remove(track.id);
            shuffleQueue.Remove(track.id);
            StartCoroutine(PlayMusicTrack(track, authSessionGeneration));
        }

        private IEnumerator PlayMusicTrack(MusicTrack track, int generation)
        {
            if (generation != authSessionGeneration || track == null || string.IsNullOrEmpty(accessToken)) yield break;
            int requestId = ++musicRequestId;
            EnsureMusicSource();
            if (musicClip != null)
            {
                musicSource.Stop();
                musicSource.clip = null;
                Destroy(musicClip);
                musicClip = null;
            }
            currentMusicId = track.id;
            musicTrackName.text = track.name ?? "Untitled MP3";
            musicPlaybackStatus.text = "Opening track…";
            if (musicPlayButton != null) musicPlayButton.GetComponentInChildren<Text>().text = "WAIT";
            string response = null;
            string error = null;
            yield return MusicApiRequest(generation, "GET", "/api/music/" + UnityWebRequest.EscapeURL(track.id) + "/play", null, null,
                value => response = value, value => error = value);
            if (requestId != musicRequestId || generation != authSessionGeneration) yield break;
            if (error != null)
            {
                HandleMusicFailure(track, error, generation);
                yield break;
            }
            SignedMusicUrl signed = null;
            try { signed = JsonUtility.FromJson<SignedMusicUrl>(response); } catch (Exception) { }
            if (signed == null || string.IsNullOrEmpty(signed.signed_url))
            {
                HandleMusicFailure(track, "No playback link was returned.", generation);
                yield break;
            }
            using (UnityWebRequest request = UnityWebRequestMultimedia.GetAudioClip(signed.signed_url, AudioType.MPEG))
            {
                request.timeout = 60;
                yield return request.SendWebRequest();
                if (requestId != musicRequestId || generation != authSessionGeneration) yield break;
                if (request.result != UnityWebRequest.Result.Success)
                {
                    HandleMusicFailure(track, "The MP3 download failed: " + request.error, generation);
                    yield break;
                }
                AudioClip downloaded = DownloadHandlerAudioClip.GetContent(request);
                if (downloaded == null)
                {
                    HandleMusicFailure(track, "The MP3 could not be decoded on this device.", generation);
                    yield break;
                }
                if (requestId != musicRequestId)
                {
                    Destroy(downloaded);
                    yield break;
                }
                musicClip = downloaded;
                musicSource.clip = downloaded;
                musicSource.volume = musicVolumeValue;
                musicSource.time = 0f;
                musicSource.Play();
                musicWasPlaying = true;
                musicPlaybackStatus.text = "Now playing";
                lastMusicError = null;
                if (musicPlayButton != null) musicPlayButton.GetComponentInChildren<Text>().text = "PAUSE";
            }
        }

        private void HandleMusicFailure(MusicTrack track, string message, int generation)
        {
            if (generation != authSessionGeneration) return;
            lastMusicError = "Could not play " + (track.name ?? "this track") + ": " + message;
            musicPlaybackStatus.text = lastMusicError;
            musicStatus.text = lastMusicError + " Skipping to another track.";
            if (musicPlayButton != null) musicPlayButton.GetComponentInChildren<Text>().text = "RETRY";
            failedMusicTracks.Add(track.id);
            shuffleQueue.RemoveAll(id => failedMusicTracks.Contains(id));
            if (musicTracks.Count > failedMusicTracks.Count)
                StartCoroutine(PlayNextMusic(generation, true));
            else
                musicStatus.text = "None of your tracks could be played. Check the MP3 files, then retry a track.";
        }

        private void ToggleMusic()
        {
            if (musicSource == null || musicClip == null)
            {
                RetryMusic();
                return;
            }
            if (musicSource.isPlaying)
            {
                musicSource.Pause();
                musicWasPlaying = false;
                musicPlaybackStatus.text = "Paused";
                musicPlayButton.GetComponentInChildren<Text>().text = "PLAY";
            }
            else
            {
                musicSource.UnPause();
                musicWasPlaying = true;
                musicPlaybackStatus.text = "Now playing";
                musicPlayButton.GetComponentInChildren<Text>().text = "PAUSE";
            }
        }

        private void SkipMusic()
        {
            if (musicTracks.Count == 0) return;
            musicAutoStarted = true;
            musicRequestId++;
            if (musicClip != null)
            {
                musicSource.Stop();
                musicSource.clip = null;
                Destroy(musicClip);
                musicClip = null;
            }
            StartCoroutine(PlayNextMusic(authSessionGeneration));
        }

        private void RetryMusic()
        {
            MusicTrack track = musicTracks.Find(item => item.id == currentMusicId);
            if (track == null)
            {
                if (musicTracks.Count > 0) SelectMusic(musicTracks[0]);
                return;
            }
            failedMusicTracks.Remove(track.id);
            lastMusicError = null;
            musicAutoStarted = true;
            StartCoroutine(PlayMusicTrack(track, authSessionGeneration));
        }

        private void NudgeSeek(float amount)
        {
            if (musicSource == null || musicClip == null) return;
            musicSource.time = Mathf.Clamp(musicSource.time + amount, 0f, musicClip.length);
        }

        private void NudgeVolume(float amount)
        {
            musicVolume.value = Mathf.Clamp01(musicVolume.value + amount);
        }

        private IEnumerator PlayNextMusic(int generation, bool afterFailure = false)
        {
            if (generation != authSessionGeneration || musicTracks.Count == 0) yield break;
            shuffleQueue.RemoveAll(id => !musicTracks.Exists(track => track.id == id) || failedMusicTracks.Contains(id));
            if (shuffleQueue.Count == 0)
            {
                if (afterFailure && failedMusicTracks.Count >= musicTracks.Count)
                    yield break;
                failedMusicTracks.Clear();
                List<string> nextIds = musicTracks.ConvertAll(track => track.id);
                ShuffleIds(nextIds);
                if (nextIds.Count > 1)
                    nextIds.Remove(currentMusicId);
                shuffleQueue.AddRange(nextIds);
                if (shuffleQueue.Count == 0 && nextIds.Count == 0 && musicTracks.Count == 1)
                    shuffleQueue.Add(musicTracks[0].id);
            }
            if (shuffleQueue.Count == 0) yield break;
            string id = shuffleQueue[0];
            shuffleQueue.RemoveAt(0);
            MusicTrack selected = musicTracks.Find(track => track.id == id);
            if (selected != null)
                yield return PlayMusicTrack(selected, generation);
        }

        private static void ShuffleIds(List<string> ids)
        {
            for (int i = ids.Count - 1; i > 0; i--)
            {
                int j = UnityEngine.Random.Range(0, i + 1);
                string swap = ids[i];
                ids[i] = ids[j];
                ids[j] = swap;
            }
        }

        private void UpdateMusicUi()
        {
            if (musicSource == null || musicClip == null || musicPanel == null) return;
            float length = musicClip.length;
            changingSeek = true;
            musicSeek.SetValueWithoutNotify(length > 0f ? musicSource.time / length : 0f);
            changingSeek = false;
            musicTime.text = FormatMusicTime(musicSource.time) + " / " + FormatMusicTime(length);
            if (musicWasPlaying && !musicSource.isPlaying)
            {
                musicWasPlaying = false;
                StartCoroutine(PlayNextMusic(authSessionGeneration));
            }
        }

        private static string FormatMusicTime(float value)
        {
            int seconds = Mathf.Max(0, Mathf.FloorToInt(value));
            return (seconds / 60).ToString() + ":" + (seconds % 60).ToString("00");
        }

        private void StopAndClearMusic()
        {
#if UNITY_ANDROID && !UNITY_EDITOR
            try
            {
                using (AndroidJavaClass picker = new AndroidJavaClass("com.evoke.quest.Mp3Picker"))
                    picker.CallStatic("invalidate");
            }
            catch (Exception) { }
#endif
            musicRequestId++;
            musicListRequestId++;
            if (musicSource != null)
            {
                musicSource.Stop();
                musicSource.clip = null;
            }
            if (musicClip != null) Destroy(musicClip);
            musicClip = null;
            currentMusicId = null;
            musicWasPlaying = false;
            musicTracks.Clear();
            shuffleQueue.Clear();
            failedMusicTracks.Clear();
            musicLoaded = false;
            musicAutoStarted = false;
            musicLoading = false;
            musicUploading = false;
            foreach (GameObject row in musicRows)
                if (row != null)
                {
                    row.SetActive(false);
                    Destroy(row);
                }
            musicRows.Clear();
            if (musicScroll != null) musicScroll.verticalNormalizedPosition = 1f;
            if (musicTrackName != null) musicTrackName.text = "Nothing playing yet";
            if (musicPlaybackStatus != null) musicPlaybackStatus.text = "Choose a song to begin.";
            if (musicTime != null) musicTime.text = "0:00 / 0:00";
            if (musicPlayButton != null) musicPlayButton.GetComponentInChildren<Text>().text = "PLAY";
            if (musicStatus != null) musicStatus.text = "Sign in to load your music.";
            lastMusicError = null;
            if (!string.IsNullOrEmpty(pendingPickerPath))
            {
                try { File.Delete(pendingPickerPath); } catch (Exception) { }
                pendingPickerPath = null;
            }
        }

        private void PickMusicFile()
        {
            if (string.IsNullOrEmpty(accessToken))
            {
                musicStatus.text = "Sign in before adding music.";
                return;
            }
            if (musicUploading) return;
#if UNITY_ANDROID && !UNITY_EDITOR
            musicUploading = true;
            int generation = authSessionGeneration;
            try
            {
                using (AndroidJavaClass picker = new AndroidJavaClass("com.evoke.quest.Mp3Picker"))
                    picker.CallStatic("open", gameObject.name, generation);
                musicStatus.text = "Choose an MP3 from your device.";
            }
            catch (Exception exception)
            {
                musicUploading = false;
                musicStatus.text = "The Quest MP3 picker could not open: " + exception.Message;
            }
#else
            musicStatus.text = "MP3 file picking is supported only in the Android Quest build.";
#endif
        }

        public void OnQuestMp3Picked(string json)
        {
            PickerResult result = null;
            try { result = JsonUtility.FromJson<PickerResult>(json); } catch (Exception) { }
            if (result != null && result.session_generation != authSessionGeneration)
            {
                if (!string.IsNullOrEmpty(result.path))
                    try { File.Delete(result.path); } catch (Exception) { }
                return;
            }
            if (result == null || result.status == "cancelled")
            {
                musicUploading = false;
                musicStatus.text = "No MP3 selected.";
                return;
            }
            if (result.status != "selected" || string.IsNullOrEmpty(result.path))
            {
                musicUploading = false;
                musicStatus.text = result.error ?? "The selected file could not be read.";
                return;
            }
            if (string.IsNullOrEmpty(accessToken))
            {
                musicUploading = false;
                try { File.Delete(result.path); } catch (Exception) { }
                musicStatus.text = "Sign in again before adding music.";
                return;
            }
            if (string.IsNullOrEmpty(result.name) || !result.name.EndsWith(".mp3", StringComparison.OrdinalIgnoreCase))
            {
                musicUploading = false;
                musicStatus.text = "Choose an MP3 file with a .mp3 filename.";
                try { File.Delete(result.path); } catch (Exception) { }
                return;
            }
            pendingPickerPath = result.path;
            StartCoroutine(UploadPickedMusic(result.path, result.name, result.session_generation));
        }

        private IEnumerator UploadPickedMusic(string path, string filename, int generation)
        {
            if (generation != authSessionGeneration)
            {
                FinishMusicUpload(path);
                yield break;
            }
            musicUploading = true;
            musicStatus.text = "Adding " + filename + "…";
            Task<MusicFileReadResult> readTask = Task.Run(() => ReadMusicFile(path));
            while (!readTask.IsCompleted)
                yield return null;
            if (generation != authSessionGeneration)
            {
                FinishMusicUpload(path);
                musicUploading = false;
                yield break;
            }
            MusicFileReadResult file = readTask.Result;
            if (file.bytes == null)
            {
                musicStatus.text = "Could not read the selected MP3: " + file.error;
                FinishMusicUpload(path);
                musicUploading = false;
                yield break;
            }
            byte[] bytes = file.bytes;
            if (bytes.Length == 0 || bytes.Length > MaxMusicUploadBytes)
            {
                musicStatus.text = bytes.Length == 0 ? "This MP3 is empty." : "MP3 uploads must be 25 MiB or smaller.";
                FinishMusicUpload(path);
                musicUploading = false;
                yield break;
            }
            if (generation != authSessionGeneration)
            {
                FinishMusicUpload(path);
                yield break;
            }
            string response = null;
            string error = null;
            Dictionary<string, string> headers = new Dictionary<string, string>
            {
                { "Content-Type", "audio/mpeg" },
                { "X-File-Name", Uri.EscapeDataString(filename) },
            };
            yield return MusicApiRequest(generation, "POST", "/api/music", bytes, headers, value => response = value, value => error = value);
            FinishMusicUpload(path);
            if (generation != authSessionGeneration) yield break;
            if (error != null)
            {
                musicUploading = false;
                musicStatus.text = "Upload failed: " + error;
                yield break;
            }
            MusicTrackPayload payload = null;
            try { payload = JsonUtility.FromJson<MusicTrackPayload>(response); }
            catch (Exception) { }
            if (payload == null || payload.track == null || string.IsNullOrEmpty(payload.track.id))
            {
                musicUploading = false;
                musicStatus.text = "Upload finished, but the API response did not include a readable track.";
                yield break;
            }
            bool hadCompleteLibrary = musicLoaded;
            musicListRequestId++;
            musicLoading = false;
            musicTracks.Insert(0, payload.track);
            if (payload.track.id != currentMusicId && !shuffleQueue.Contains(payload.track.id))
                shuffleQueue.Insert(UnityEngine.Random.Range(0, shuffleQueue.Count + 1), payload.track.id);
            musicLoaded = true;
            RebuildMusicRows();
            musicUploading = false;
            musicStatus.text = "Added " + (payload.track.name ?? filename) + " to your private library.";
            if (!musicAutoStarted && string.IsNullOrEmpty(currentMusicId))
            {
                musicAutoStarted = true;
                StartCoroutine(PlayNextMusic(generation));
            }
            if (!hadCompleteLibrary)
            {
                musicLoaded = false;
                ReloadMusic();
            }
        }

        private static MusicFileReadResult ReadMusicFile(string path)
        {
            try { return new MusicFileReadResult { bytes = File.ReadAllBytes(path) }; }
            catch (Exception exception) { return new MusicFileReadResult { error = exception.Message }; }
        }

        private void FinishMusicUpload(string path)
        {
            try { if (File.Exists(path)) File.Delete(path); } catch (Exception) { }
            if (pendingPickerPath == path) pendingPickerPath = null;
        }

        private IEnumerator MusicApiRequest(int generation, string method, string path, byte[] body, Dictionary<string, string> headers,
            Action<string> success, Action<string> failure)
        {
            if (generation != authSessionGeneration)
                yield break;
            if (string.IsNullOrEmpty(accessToken))
            {
                failure("Sign in to use your music library.");
                yield break;
            }
            if (tokenExpiresAt > 0f && Time.realtimeSinceStartup >= tokenExpiresAt - 15f)
            {
                bool refreshed = false;
                bool invalid = false;
                string refreshError = null;
                yield return RefreshSession(value => refreshed = value, value => refreshError = value, value => invalid = value);
                if (generation != authSessionGeneration) yield break;
                if (!refreshed)
                {
                    string message = refreshError ?? "Could not refresh your session.";
                    failure(message);
                    if (invalid)
                    {
                        Logout(false);
                        statusText.text = message;
                    }
                    yield break;
                }
            }
            for (int attempt = 0; attempt < 2; attempt++)
            {
                using (UnityWebRequest request = new UnityWebRequest(config.apiBaseUrl + path, method))
                {
                    request.downloadHandler = new DownloadHandlerBuffer();
                    if (body != null) request.uploadHandler = new UploadHandlerRaw(body);
                    request.SetRequestHeader("Authorization", "Bearer " + accessToken);
                    if (headers != null)
                        foreach (KeyValuePair<string, string> header in headers)
                            request.SetRequestHeader(header.Key, header.Value);
                    yield return request.SendWebRequest();
                    if (generation != authSessionGeneration) yield break;
                    if (request.result == UnityWebRequest.Result.Success)
                    {
                        success(request.downloadHandler.text);
                        yield break;
                    }
                    if ((request.responseCode == 401 || request.responseCode == 403) && attempt == 0)
                    {
                        bool refreshed = false;
                        bool invalid = false;
                        string refreshError = null;
                        yield return RefreshSession(value => refreshed = value, value => refreshError = value, value => invalid = value);
                        if (generation != authSessionGeneration) yield break;
                        if (refreshed) continue;
                        string message = refreshError ?? "Could not refresh your session.";
                        failure(message);
                        if (invalid)
                        {
                            Logout(false);
                            statusText.text = message;
                        }
                        yield break;
                    }
                    failure(ReadError(request, "Music request failed (" + request.responseCode + ")."));
                    yield break;
                }
            }
            failure("The music request could not be completed.");
        }
    }
}