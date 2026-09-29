using System;
using System.Collections;
using System.Collections.Generic;
using System.Text;
using UnityEngine;
using UnityEngine.Networking;
using UnityEngine.UI;

namespace EvokeQuest
{
    public sealed partial class EvokeQuestPanoramaClient
    {
        [Serializable] private sealed class DictionaryJson
        {
            public string email;
            public string password;
            public string refresh_token;
        }

        private void Login()
        {
            if (busy) return;
            string email = emailField.text.Trim();
            string password = passwordField.text;
            if (string.IsNullOrEmpty(email) || string.IsNullOrEmpty(password))
            {
                statusText.text = "Enter your email and password.";
                return;
            }
            StartCoroutine(SignIn(email, password));
        }

        private IEnumerator SignIn(string email, string password)
        {
            busy = true;
            statusText.text = "Signing in…";
            string body = JsonUtility.ToJson(new DictionaryJson { email = email, password = password });
            using (UnityWebRequest request = CreateJsonRequest(config.supabaseUrl + "/auth/v1/token?grant_type=password", body))
            {
                request.SetRequestHeader("apikey", config.supabaseAnonKey);
                yield return request.SendWebRequest();
                if (request.result != UnityWebRequest.Result.Success)
                {
                    statusText.text = ReadError(request, "Sign-in failed. Check your credentials and connection.");
                    busy = false;
                    yield break;
                }
                if (!AcceptAuth(request.downloadHandler.text))
                {
                    statusText.text = "Supabase returned an incomplete sign-in session.";
                    busy = false;
                    yield break;
                }
            }
            passwordField.text = string.Empty;
            busy = false;
            LoadWorlds();
        }

        private bool AcceptAuth(string json)
        {
            AuthPayload payload = JsonUtility.FromJson<AuthPayload>(json);
            if (payload == null || string.IsNullOrEmpty(payload.access_token) || string.IsNullOrEmpty(payload.refresh_token))
                return false;
            accessToken = payload.access_token;
            refreshToken = payload.refresh_token;
            tokenExpiresAt = Time.realtimeSinceStartup + Mathf.Max(60, payload.expires_in);
            return true;
        }

        private void LoadWorlds()
        {
            if (busy) return;
            panelBackground.enabled = true;
            brandText.gameObject.SetActive(true);
            statusText.gameObject.SetActive(true);
            loginPanel.SetActive(false);
            viewerPanel.SetActive(false);
            worldsPanel.SetActive(true);
            statusText.text = "Loading your saved worlds…";
            StartCoroutine(FetchWorldList());
        }

        private IEnumerator FetchWorldList()
        {
            busy = true;
            string response = null;
            string error = null;
            yield return ApiGet("/api/worlds", value => response = value, value => error = value);
            ClearWorldRows();
            if (error != null)
            {
                statusText.text = error;
                busy = false;
                yield break;
            }

            WorldListPayload payload = JsonUtility.FromJson<WorldListPayload>(response);
            int readyCount = 0;
            if (payload != null && payload.worlds != null)
            {
                foreach (World world in payload.worlds)
                {
                    if (world == null || !string.Equals(world.status, "ready", StringComparison.OrdinalIgnoreCase))
                        continue;
                    AddWorldRow(world);
                    readyCount++;
                }
            }
            statusText.text = readyCount == 0 ? "No ready worlds yet." : readyCount + " ready panorama" + (readyCount == 1 ? "" : "s") + ".";
            busy = false;
        }

        private void AddWorldRow(World world)
        {
            Button button = CreateButton(worldListContent, "World_" + world.id, world.display_name ?? "Untitled panorama",
                Vector2.zero, new Vector2(800f, 72f), () => OpenWorld(world.id, world.display_name));
            RectTransform rect = button.GetComponent<RectTransform>();
            rect.anchorMin = new Vector2(0f, 1f);
            rect.anchorMax = new Vector2(1f, 1f);
            rect.pivot = new Vector2(0.5f, 1f);
            rect.sizeDelta = new Vector2(0f, 72f);
            LayoutElement layout = button.gameObject.AddComponent<LayoutElement>();
            layout.preferredHeight = 72f;
            layout.minHeight = 72f;
        }

        private void ClearWorldRows()
        {
            for (int i = worldListContent.childCount - 1; i >= 0; i--)
                Destroy(worldListContent.GetChild(i).gameObject);
        }

        private void OpenWorld(string id, string displayName)
        {
            if (busy) return;
            panelBackground.enabled = false;
            brandText.gameObject.SetActive(false);
            statusText.gameObject.SetActive(false);
            worldsPanel.SetActive(false);
            viewerPanel.SetActive(true);
            viewerStatus.gameObject.SetActive(true);
            viewerStatus.text = "Requesting a fresh panorama URL…";
            StartCoroutine(LoadWorld(id, displayName));
        }

        private IEnumerator LoadWorld(string id, string displayName)
        {
            busy = true;
            string response = null;
            string error = null;
            yield return ApiGet("/api/worlds/" + UnityWebRequest.EscapeURL(id), value => response = value, value => error = value);
            if (error != null)
            {
                ShowViewerError(error);
                yield break;
            }

            WorldPayload payload = JsonUtility.FromJson<WorldPayload>(response);
            if (payload == null || payload.world == null)
            {
                ShowViewerError("The API did not return this saved world.");
                yield break;
            }
            Asset panorama = FindPanorama(payload.world.assets);
            if (panorama == null || string.IsNullOrEmpty(panorama.signed_url))
            {
                ShowViewerError("This ready world has no signed panorama JPG asset.");
                yield break;
            }
            yield return DownloadPanorama(id, panorama.signed_url, false);
        }

        private static Asset FindPanorama(Asset[] assets)
        {
            if (assets == null) return null;
            foreach (Asset asset in assets)
            {
                if (asset == null) continue;
                string kind = (asset.kind ?? string.Empty).ToLowerInvariant();
                string format = (asset.format ?? string.Empty).ToLowerInvariant();
                bool panoramaKind = kind.Contains("panorama") || kind.Contains("equirect");
                bool jpeg = format.Contains("jpg") || format.Contains("jpeg");
                if (panoramaKind && jpeg) return asset;
            }
            return null;
        }

        private IEnumerator DownloadPanorama(string worldId, string url, bool retried)
        {
            viewerStatus.text = "Downloading panorama…";
            using (UnityWebRequest request = UnityWebRequestTexture.GetTexture(url, false))
            {
                yield return request.SendWebRequest();
                if (request.result != UnityWebRequest.Result.Success)
                {
                    if (!retried && (request.responseCode == 401 || request.responseCode == 403))
                    {
                        string freshResponse = null;
                        string freshError = null;
                        yield return ApiGet("/api/worlds/" + UnityWebRequest.EscapeURL(worldId), value => freshResponse = value, value => freshError = value);
                        if (freshError != null)
                        {
                            ShowViewerError(freshError);
                            yield break;
                        }
                        WorldPayload fresh = JsonUtility.FromJson<WorldPayload>(freshResponse);
                        Asset freshAsset = fresh == null || fresh.world == null ? null : FindPanorama(fresh.world.assets);
                        if (freshAsset != null && !string.IsNullOrEmpty(freshAsset.signed_url))
                        {
                            yield return DownloadPanorama(worldId, freshAsset.signed_url, true);
                            yield break;
                        }
                    }
                    ShowViewerError(ReadError(request, "Could not download the panorama image."));
                    yield break;
                }

                Texture2D downloaded = DownloadHandlerTexture.GetContent(request);
                if (downloaded == null)
                {
                    ShowViewerError("The panorama response was not a readable JPG image.");
                    yield break;
                }
                downloaded.wrapMode = TextureWrapMode.Repeat;
                downloaded.filterMode = FilterMode.Bilinear;
                DisplayPanorama(downloaded);
            }
            busy = false;
        }

        private void DisplayPanorama(Texture2D texture)
        {
            RemovePanorama();
            panoramaTexture = texture;
            panoramaObject = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            panoramaObject.name = "EquirectangularPanorama";
            Collider collider = panoramaObject.GetComponent<Collider>();
            if (collider != null) Destroy(collider);
            panoramaObject.transform.localScale = new Vector3(18f, 18f, 18f);
            Shader shader = Resources.Load<Shader>("EvokePanoramaURP");
            if (shader == null)
            {
                ShowViewerError("The Evoke URP panorama shader is missing from Resources.");
                RemovePanorama();
                return;
            }
            panoramaMaterial = new Material(shader);
            panoramaMaterial.SetTexture("_MainTex", texture);
            panoramaObject.GetComponent<Renderer>().material = panoramaMaterial;
            panoramaObject.transform.position = headCamera.transform.position;
            viewerStatus.text = "Panorama ready · turn your head to look around.";
            viewerStatus.gameObject.SetActive(false);
        }

        private void ShowViewerError(string message)
        {
            viewerStatus.gameObject.SetActive(true);
            viewerStatus.text = message;
            busy = false;
        }

        private IEnumerator ApiGet(string path, Action<string> success, Action<string> failure)
        {
            if (tokenExpiresAt > 0f && Time.realtimeSinceStartup >= tokenExpiresAt - 15f)
            {
                bool refreshed = false;
                bool invalidRefreshToken = false;
                string refreshError = null;
                yield return RefreshSession(value => refreshed = value, value => refreshError = value, value => invalidRefreshToken = value);
                if (!refreshed)
                {
                    string message = invalidRefreshToken
                        ? refreshError ?? "Your session expired. Please sign in again."
                        : "Session refresh failed; your in-memory session is retained. Check the connection and retry; from panorama, return to Worlds first. " + (refreshError ?? string.Empty);
                    failure(message);
                    if (invalidRefreshToken)
                    {
                        Logout(false);
                        statusText.text = message;
                    }
                    yield break;
                }
            }
            for (int attempt = 0; attempt < 2; attempt++)
            {
                if (string.IsNullOrEmpty(accessToken))
                {
                    failure("Your session has expired. Please sign in again.");
                    yield break;
                }
                using (UnityWebRequest request = UnityWebRequest.Get(config.apiBaseUrl + path))
                {
                    request.SetRequestHeader("Authorization", "Bearer " + accessToken);
                    yield return request.SendWebRequest();
                    if (request.result == UnityWebRequest.Result.Success)
                    {
                        success(request.downloadHandler.text);
                        yield break;
                    }

                    if ((request.responseCode == 401 || request.responseCode == 403) && attempt == 0)
                    {
                        bool refreshed = false;
                        bool invalidRefreshToken = false;
                        string refreshError = null;
                        yield return RefreshSession(value => refreshed = value, value => refreshError = value, value => invalidRefreshToken = value);
                        if (refreshed)
                            continue;
                        string message = invalidRefreshToken
                            ? refreshError ?? "Your session expired. Please sign in again."
                            : "Session refresh failed; your in-memory session is retained. Check the connection and retry; from panorama, return to Worlds first. " + (refreshError ?? string.Empty);
                        failure(message);
                        if (invalidRefreshToken)
                        {
                            Logout(false);
                            statusText.text = message;
                        }
                        yield break;
                    }
                    failure(ReadError(request, "Request failed (" + request.responseCode + ")."));
                    yield break;
                }
            }
            failure("The request could not be completed.");
        }

        private IEnumerator RefreshSession(Action<bool> completed, Action<string> failure, Action<bool> invalidRefreshToken)
        {
            if (string.IsNullOrEmpty(refreshToken))
            {
                failure("Your session expired. Please sign in again.");
                invalidRefreshToken(true);
                completed(false);
                yield break;
            }
            string body = JsonUtility.ToJson(new DictionaryJson { refresh_token = refreshToken });
            using (UnityWebRequest request = CreateJsonRequest(config.supabaseUrl + "/auth/v1/token?grant_type=refresh_token", body))
            {
                request.SetRequestHeader("apikey", config.supabaseAnonKey);
                yield return request.SendWebRequest();
                if (request.result == UnityWebRequest.Result.Success && AcceptAuth(request.downloadHandler.text))
                {
                    completed(true);
                    invalidRefreshToken(false);
                    yield break;
                }
                bool invalid = request.responseCode == 400 || request.responseCode == 401;
                string message = ReadError(request, "Could not refresh your session.");
                if (!invalid)
                    message = "Could not refresh your session (" + (request.responseCode == 0 ? "network error" : "HTTP " + request.responseCode) + "). " + message;
                failure(message);
                invalidRefreshToken(invalid);
                completed(false);
            }
        }

        private static UnityWebRequest CreateJsonRequest(string url, string json)
        {
            byte[] bytes = Encoding.UTF8.GetBytes(json);
            UnityWebRequest request = new UnityWebRequest(url, UnityWebRequest.kHttpVerbPOST);
            request.uploadHandler = new UploadHandlerRaw(bytes);
            request.downloadHandler = new DownloadHandlerBuffer();
            request.SetRequestHeader("Content-Type", "application/json");
            return request;
        }

        private static string ReadError(UnityWebRequest request, string fallback)
        {
            if (request.downloadHandler != null && !string.IsNullOrEmpty(request.downloadHandler.text))
            {
                try
                {
                    ErrorPayload payload = JsonUtility.FromJson<ErrorPayload>(request.downloadHandler.text);
                    if (payload != null)
                    {
                        if (!string.IsNullOrEmpty(payload.error)) return payload.error;
                        if (!string.IsNullOrEmpty(payload.message)) return payload.message;
                        if (!string.IsNullOrEmpty(payload.msg)) return payload.msg;
                        if (!string.IsNullOrEmpty(payload.error_description)) return payload.error_description;
                    }
                }
                catch (Exception) { }
            }
            if (!string.IsNullOrEmpty(request.error))
                return fallback + " " + request.error;
            return fallback;
        }
    }
}