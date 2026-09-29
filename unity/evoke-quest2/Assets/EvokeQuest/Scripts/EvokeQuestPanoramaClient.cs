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
        [SerializeField] private Camera headCamera;
        [SerializeField] private float interfaceDistance = 1.35f;

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
        private bool busy;
        private bool keyboardShifted;
        private bool keyboardSymbols;
        private readonly Dictionary<XRNode, bool> previousTrigger = new Dictionary<XRNode, bool>();

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

        private void Start()
        {
            if (!IsSupportedRuntime())
            {
                ShowRuntimeGuard();
                return;
            }

            if (headCamera == null)
                headCamera = GetComponentInChildren<Camera>();
            if (headCamera == null)
            {
                Debug.LogError("Evoke Quest: Assign the XR Origin's tracked head camera.");
                enabled = false;
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
        }

        private bool IsSupportedRuntime()
        {
#if UNITY_EDITOR
            return true;
#else
            if (Application.platform != RuntimePlatform.Android)
                return false;
            string model = SystemInfo.deviceModel ?? string.Empty;
            model = model.Replace(" ", string.Empty).Replace("-", string.Empty).Replace("_", string.Empty);
            return model.EndsWith("Quest2", StringComparison.OrdinalIgnoreCase);
#endif
        }

        private void ShowRuntimeGuard()
        {
            GameObject root = new GameObject("EvokeQuestRuntimeGuard");
            Canvas guardCanvas = root.AddComponent<Canvas>();
            guardCanvas.renderMode = RenderMode.ScreenSpaceOverlay;
            root.AddComponent<CanvasScaler>();
            root.AddComponent<GraphicRaycaster>();
            Text message = CreateText(root.transform, "RuntimeGuardMessage", "Evoke panorama client\nQuest 2 Android runtime only.", 32, TextAnchor.MiddleCenter);
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
            statusText.text = "Sign in to load your saved panoramas.";
        }

        private void BackToWorlds()
        {
            StopAllCoroutines();
            busy = false;
            RemovePanorama();
            panelBackground.enabled = true;
            brandText.gameObject.SetActive(true);
            statusText.gameObject.SetActive(true);
            viewerPanel.SetActive(false);
            worldsPanel.SetActive(true);
        }

        private void Logout()
        {
            Logout(true);
        }

        private void Logout(bool clearPassword)
        {
            StopAllCoroutines();
            busy = false;
            accessToken = null;
            refreshToken = null;
            tokenExpiresAt = 0f;
            RemovePanorama();
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
            RemovePanorama();
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