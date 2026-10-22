using System;
using System.Collections;
using System.Collections.Generic;
using System.Text;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.Networking;
using UnityEngine.UI;
using UnityEngine.XR;

namespace EvokeQuest
{
    /// <summary>
    /// Runtime-built Quest panorama client. Add to the XR Origin and assign its tracked camera.
    /// </summary>
    public sealed partial class EvokeQuestPanoramaClient : MonoBehaviour
    {
        private static int nextAuthSessionGeneration;
        [SerializeField] private Camera headCamera;
        [SerializeField] private float interfaceDistance = 1.35f;

        private string runtimeDeviceDetails = string.Empty;
        private EvokeQuestConfig config;
        private string accessToken;
        private string refreshToken;
        private float tokenExpiresAt;
        private Canvas canvas;
        private GraphicRaycaster graphicRaycaster;
        private EventSystem eventSystem;
        private bool ownsEventSystem;
        private Image panelBackground;
        private Text brandText;
        private Text statusText;
        private InputField emailField;
        private InputField passwordField;
        private GameObject loginPanel;
        private GameObject worldsPanel;
        private GameObject viewerPanel;
        private GameObject keyboardPanel;
        private GameObject howPanel;
        private GameObject musicPanel;
        private GameObject tabsPanel;
        private Transform keyboardKeyRoot;
        private readonly List<GameObject> keyboardKeys = new List<GameObject>();
        private Transform worldListContent;
        private ScrollRect worldScroll;
        private GameObject panoramaObject;
        private Texture2D panoramaTexture;
        private Material panoramaMaterial;
        private static Sprite uiSprite;
        private readonly Dictionary<XRNode, LineRenderer> controllerRays = new Dictionary<XRNode, LineRenderer>();
        private Text viewerStatus;
        private Text worldsStatus;
        private bool busy;
        private Coroutine worldLoadCoroutine;
        private int authSessionGeneration;
        private bool keyboardShifted;
        private bool keyboardSymbols;
        private string activeTab = "immerse";

        [Serializable] private sealed class AuthPayload
        {
            public string access_token;
            public string refresh_token;
            public int expires_in;
        }

        [Serializable] private sealed class WorldListPayload { public World[] worlds; }
        [Serializable] private sealed class WorldPayload { public World world; }
        [Serializable] private sealed class World
        {
            public string id;
            public string status;
            public string display_name;
            public Asset[] assets;
        }
        [Serializable] private sealed class Asset
        {
            public string kind;
            public string format;
            public string signed_url;
        }
        [Serializable] private sealed class ErrorPayload
        {
            public string error;
            public string message;
            public string msg;
            public string error_description;
        }

        private void AdvanceAuthSessionGeneration()
        {
            authSessionGeneration = ++nextAuthSessionGeneration;
        }

        private void Start()
        {
            if (headCamera == null)
                headCamera = GetComponentInChildren<Camera>();
            if (headCamera == null)
            {
                Debug.LogError("Evoke Quest: Assign the XR Origin's tracked head camera.");
                enabled = false;
                return;
            }

            if (!IsSupportedRuntime())
            {
                ShowRuntimeGuard();
                return;
            }

            try
            {
                config = EvokeQuestConfig.Load();
            }
            catch (Exception exception)
            {
                Debug.LogError(exception.Message);
                enabled = false;
                return;
            }

            BuildInterface();
            ShowLogin();
            Debug.Log("Evoke Quest: sign-in interface initialized.");
        }

        private bool IsSupportedRuntime()
        {
#if UNITY_EDITOR
            return true;
#elif UNITY_ANDROID
            string model = SystemInfo.deviceModel ?? string.Empty;
            string androidModel = string.Empty;
            string propertyModel = string.Empty;
            string lookupNotes = string.Empty;
            try
            {
                // Unity may report the generic "Oculus Quest" even on a Quest 2.
                using (AndroidJavaClass build = new AndroidJavaClass("android.os.Build"))
                    androidModel = build.GetStatic<string>("MODEL") ?? string.Empty;
            }
            catch (Exception exception)
            {
                lookupNotes += "\nAndroid model lookup: " + exception.GetType().Name;
                Debug.LogWarning("Evoke Quest: Android model lookup failed: " + exception.Message);
            }
            try
            {
                // Read the same public property as `adb shell getprop ro.product.model`.
                // Build.MODEL can also contain the generic name on headset firmware.
                propertyModel = ReadAndroidProductModel();
            }
            catch (Exception exception)
            {
                lookupNotes += "\nAndroid property lookup: " + exception.GetType().Name;
                Debug.LogWarning("Evoke Quest: Android product-model lookup failed: " + exception.Message);
            }
            string detectedModel = !string.IsNullOrWhiteSpace(propertyModel) ? propertyModel :
                (!string.IsNullOrWhiteSpace(androidModel) ? androidModel : model);
            bool supported = IsQuest2Model(detectedModel);
            runtimeDeviceDetails = "Unity model: " + model + "\nAndroid model: " + androidModel +
                "\nAndroid property: " + propertyModel + lookupNotes;
            Debug.Log("Evoke Quest: Unity model='" + model + "', Android model='" + androidModel +
                "', Android property='" + propertyModel +
                "', supported=" + supported + ".");
            return supported;
#else
            runtimeDeviceDetails = "Platform: " + Application.platform;
            return false;
#endif
        }

#if UNITY_ANDROID && !UNITY_EDITOR
        private static string ReadAndroidProductModel()
        {
            using (AndroidJavaClass runtimeClass = new AndroidJavaClass("java.lang.Runtime"))
            using (AndroidJavaObject runtime = runtimeClass.CallStatic<AndroidJavaObject>("getRuntime"))
            using (AndroidJavaObject process = runtime.Call<AndroidJavaObject>("exec",
                "/system/bin/getprop ro.product.model"))
            {
                try
                {
                    // Bound startup work if the system command unexpectedly stalls.
                    using (AndroidJavaClass timeUnit = new AndroidJavaClass("java.util.concurrent.TimeUnit"))
                    using (AndroidJavaObject seconds = timeUnit.GetStatic<AndroidJavaObject>("SECONDS"))
                    {
                        if (!process.Call<bool>("waitFor", 2L, seconds))
                            throw new TimeoutException("Android product-model lookup timed out.");
                    }
                    if (process.Call<int>("exitValue") != 0)
                        throw new InvalidOperationException("Android product-model lookup failed.");
                    using (AndroidJavaObject stream = process.Call<AndroidJavaObject>("getInputStream"))
                    using (AndroidJavaObject reader = new AndroidJavaObject("java.io.InputStreamReader", stream))
                    using (AndroidJavaObject lines = new AndroidJavaObject("java.io.BufferedReader", reader))
                    {
                        try
                        {
                            return (lines.Call<string>("readLine") ?? string.Empty).Trim();
                        }
                        finally
                        {
                            lines.Call("close");
                        }
                    }
                }
                finally
                {
                    process.Call("destroy");
                }
            }
        }
#endif

        private static bool IsQuest2Model(string model)
        {
            string normalized = (model ?? string.Empty).Trim().Replace(" ", string.Empty)
                .Replace("-", string.Empty).Replace("_", string.Empty);
            return normalized.EndsWith("Quest2", StringComparison.OrdinalIgnoreCase);
        }

        private void ShowRuntimeGuard()
        {
            Debug.LogWarning("Evoke Quest: unsupported runtime; showing the device compatibility message.");
            GameObject root = new GameObject("EvokeQuestRuntimeGuard");
            root.transform.SetParent(headCamera.transform, false);
            root.transform.localPosition = new Vector3(0f, 0f, interfaceDistance);
            root.transform.localRotation = Quaternion.identity;
            Canvas guardCanvas = root.AddComponent<Canvas>();
            // Screen-space overlay canvases are not visible in the headset's stereo view.
            guardCanvas.renderMode = RenderMode.WorldSpace;
            guardCanvas.worldCamera = headCamera;
            RectTransform canvasRect = guardCanvas.GetComponent<RectTransform>();
            canvasRect.sizeDelta = new Vector2(1000f, 700f);
            canvasRect.localScale = Vector3.one * 0.0017f;
            root.AddComponent<CanvasScaler>();
            Image background = CreateImage(root.transform, "RuntimeGuardBackground",
                new Color(0.035f, 0.075f, 0.065f, 0.96f));
            Stretch(background.rectTransform, 0f, 0f, 0f, 0f);
            Text message = CreateText(root.transform, "RuntimeGuardMessage",
                "Evoke panorama client\nQuest 2 device check\n\n" + runtimeDeviceDetails +
                "\n\nThis app requires a Quest 2 Android headset.\nIf this is your Quest 2, share this screen's model details.",
                26, TextAnchor.MiddleCenter);
            RectTransform rect = message.rectTransform;
            rect.anchorMin = Vector2.zero;
            rect.anchorMax = Vector2.one;
            rect.offsetMin = Vector2.zero;
            rect.offsetMax = Vector2.zero;
        }

        private void ShowLogin()
        {
            panelBackground.enabled = true;
            brandText.gameObject.SetActive(true);
            statusText.gameObject.SetActive(true);
            loginPanel.SetActive(true);
            worldsPanel.SetActive(false);
            viewerPanel.SetActive(false);
            keyboardPanel.SetActive(false);
            tabsPanel.SetActive(false);
            howPanel.SetActive(false);
            musicPanel.SetActive(false);
            statusText.text = "Sign in to load your saved panoramas.";
        }

        private void BackToWorlds()
        {
            if (worldLoadCoroutine != null)
            {
                StopCoroutine(worldLoadCoroutine);
                worldLoadCoroutine = null;
            }
            busy = false;
            RemovePanorama();
            panelBackground.enabled = true;
            brandText.gameObject.SetActive(true);
            statusText.gameObject.SetActive(false);
            viewerPanel.SetActive(false);
            worldsPanel.SetActive(true);
            howPanel.SetActive(false);
            musicPanel.SetActive(false);
            tabsPanel.SetActive(true);
            activeTab = "immerse";
        }

        private void Logout()
        {
            Logout(true);
        }

        private void Logout(bool clearPassword)
        {
            AdvanceAuthSessionGeneration();
            StopAllCoroutines();
            busy = false;
            accessToken = null;
            refreshToken = null;
            tokenExpiresAt = 0f;
            RemovePanorama();
            StopAndClearMusic();
            ClearWorldRows();
            if (clearPassword && passwordField != null)
                passwordField.text = string.Empty;
            ShowLogin();
        }

        private void RemovePanorama()
        {
            if (panoramaObject != null)
                Destroy(panoramaObject);
            panoramaObject = null;
            if (panoramaTexture != null)
                Destroy(panoramaTexture);
            panoramaTexture = null;
            if (panoramaMaterial != null)
                Destroy(panoramaMaterial);
            panoramaMaterial = null;
        }

        private void OnDestroy()
        {
            AdvanceAuthSessionGeneration();
            StopAllCoroutines();
            RemovePanorama();
            StopAndClearMusic();
            foreach (LineRenderer line in controllerRays.Values)
            {
                if (line != null && line.material != null)
                    Destroy(line.material);
            }
            if (ownsEventSystem && eventSystem != null)
                Destroy(eventSystem.gameObject);
        }
    }
}