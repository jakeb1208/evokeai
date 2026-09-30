using System;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;
using UnityEngine.XR;

namespace EvokeQuest
{
    public sealed partial class EvokeQuestPanoramaClient
    {
        private void BuildInterface()
        {
            eventSystem = EventSystem.current;
            if (eventSystem == null)
            {
                GameObject eventObject = new GameObject("EvokeQuestEventSystem");
                eventSystem = eventObject.AddComponent<EventSystem>();
#if ENABLE_LEGACY_INPUT_MANAGER
                eventObject.AddComponent<StandaloneInputModule>();
#endif
                ownsEventSystem = true;
            }

            GameObject canvasObject = new GameObject("EvokeQuestHeadSpaceUI");
            canvasObject.transform.SetParent(headCamera.transform, false);
            canvasObject.transform.localPosition = new Vector3(0f, 0f, interfaceDistance);
            canvasObject.transform.localRotation = Quaternion.identity;
            canvas = canvasObject.AddComponent<Canvas>();
            canvas.renderMode = RenderMode.WorldSpace;
            canvas.worldCamera = headCamera;
            RectTransform canvasRect = canvas.GetComponent<RectTransform>();
            canvasRect.sizeDelta = new Vector2(1000f, 700f);
            canvasRect.localScale = Vector3.one * 0.0017f;
            CanvasScaler scaler = canvasObject.AddComponent<CanvasScaler>();
            scaler.dynamicPixelsPerUnit = 10f;
            graphicRaycaster = canvasObject.AddComponent<GraphicRaycaster>();
            CreateControllerRay(XRNode.LeftHand);
            CreateControllerRay(XRNode.RightHand);

            panelBackground = CreateImage(canvasObject.transform, "PanelBackground", new Color(0.035f, 0.075f, 0.065f, 0.96f));
            Stretch(panelBackground.rectTransform, 0f, 0f, 0f, 0f);
            brandText = CreateText(canvasObject.transform, "Brand", "evokeai", 31, TextAnchor.MiddleLeft, new Vector2(-392f, 310f), new Vector2(185f, 52f));
            brandText.color = new Color(0.73f, 0.94f, 0.60f, 1f);
            statusText = CreateText(canvasObject.transform, "Status", "Sign in to load your saved panoramas.", 22, TextAnchor.MiddleLeft, new Vector2(35f, 265f), new Vector2(920f, 42f));

            BuildLogin();
            BuildWorlds();
            BuildTabs();
            BuildHowItWorks();
            BuildMusic();
            BuildViewer();
            BuildKeyboard();
        }

        private void BuildLogin()
        {
            loginPanel = NewPanel("LoginPanel");
            CreateText(loginPanel.transform, "LoginTitle", "Sign in", 34, TextAnchor.MiddleLeft, new Vector2(-415f, 205f), new Vector2(830f, 55f));
            emailField = CreateInput(loginPanel.transform, "Email", "Email address", InputField.ContentType.EmailAddress, new Vector2(0f, 125f));
            passwordField = CreateInput(loginPanel.transform, "Password", "Password", InputField.ContentType.Password, new Vector2(0f, 45f));
            CreateButton(loginPanel.transform, "Email keyboard", "Edit email", new Vector2(-225f, -30f), new Vector2(330f, 68f), () => OpenKeyboard(emailField));
            CreateButton(loginPanel.transform, "Password keyboard", "Edit password", new Vector2(225f, -30f), new Vector2(330f, 68f), () => OpenKeyboard(passwordField));
            CreateButton(loginPanel.transform, "Login", "SIGN IN", new Vector2(0f, -125f), new Vector2(370f, 78f), Login);
            CreateText(loginPanel.transform, "KeyboardHint", "Use the on-panel VR keyboard for email and password.", 18, TextAnchor.MiddleCenter, new Vector2(0f, -205f), new Vector2(900f, 42f));
        }

        private void BuildWorlds()
        {
            worldsPanel = NewPanel("WorldsPanel");
            CreateText(worldsPanel.transform, "WorldsTitle", "Ready panoramas", 34, TextAnchor.MiddleLeft, new Vector2(-415f, 190f), new Vector2(600f, 55f));
            CreateButton(worldsPanel.transform, "RefreshWorlds", "REFRESH", new Vector2(300f, 190f), new Vector2(180f, 60f), LoadWorlds);
            worldsStatus = CreateText(worldsPanel.transform, "WorldsStatus", "Your saved panoramas appear here.", 18, TextAnchor.MiddleLeft, new Vector2(-410f, 135f), new Vector2(780f, 40f));

            GameObject scrollObject = new GameObject("WorldList");
            scrollObject.transform.SetParent(worldsPanel.transform, false);
            RectTransform scrollRect = scrollObject.AddComponent<RectTransform>();
            scrollRect.anchorMin = scrollRect.anchorMax = new Vector2(0.5f, 0.5f);
            scrollRect.pivot = new Vector2(0.5f, 0.5f);
            scrollRect.anchoredPosition = new Vector2(0f, -65f);
            scrollRect.sizeDelta = new Vector2(870f, 320f);
            Image viewportImage = scrollObject.AddComponent<Image>();
            viewportImage.sprite = GetUiSprite();
            viewportImage.color = new Color(1f, 1f, 1f, 0.015f);
            Mask mask = scrollObject.AddComponent<Mask>();
            mask.showMaskGraphic = false;
            worldScroll = scrollObject.AddComponent<ScrollRect>();
            worldScroll.horizontal = false;
            worldScroll.vertical = true;

            GameObject content = new GameObject("Content");
            content.transform.SetParent(scrollObject.transform, false);
            RectTransform contentRect = content.AddComponent<RectTransform>();
            contentRect.anchorMin = new Vector2(0f, 1f);
            contentRect.anchorMax = new Vector2(1f, 1f);
            contentRect.pivot = new Vector2(0.5f, 1f);
            contentRect.sizeDelta = Vector2.zero;
            VerticalLayoutGroup layout = content.AddComponent<VerticalLayoutGroup>();
            layout.spacing = 12f;
            layout.padding = new RectOffset(8, 8, 8, 8);
            layout.childControlHeight = true;
            layout.childControlWidth = true;
            layout.childForceExpandHeight = false;
            layout.childForceExpandWidth = true;
            ContentSizeFitter fitter = content.AddComponent<ContentSizeFitter>();
            fitter.verticalFit = ContentSizeFitter.FitMode.PreferredSize;
            worldListContent = content.transform;
            worldScroll.viewport = scrollRect;
            worldScroll.content = contentRect;
        }

        private void BuildTabs()
        {
            tabsPanel = new GameObject("HeadsetTabs");
            tabsPanel.transform.SetParent(canvas.transform, false);
            RectTransform rect = tabsPanel.AddComponent<RectTransform>();
            Stretch(rect, 20f, 0f, 20f, 0f);
            CreateButton(tabsPanel.transform, "TabImmerse", "IMMERSE", new Vector2(-215f, 310f), new Vector2(160f, 58f), () => SelectTab("immerse"));
            CreateButton(tabsPanel.transform, "TabHow", "HOW IT WORKS", new Vector2(-15f, 310f), new Vector2(210f, 58f), () => SelectTab("how"));
            CreateButton(tabsPanel.transform, "TabMusic", "MUSIC", new Vector2(165f, 310f), new Vector2(125f, 58f), () => SelectTab("music"));
            CreateButton(tabsPanel.transform, "TabLogout", "LOG OUT", new Vector2(355f, 310f), new Vector2(135f, 58f), Logout);
        }

        private void BuildHowItWorks()
        {
            howPanel = NewPanel("HowItWorksPanel");
            CreateText(howPanel.transform, "HowTitle", "A thought becomes a world.", 37, TextAnchor.MiddleLeft, new Vector2(-410f, 175f), new Vector2(820f, 62f));
            CreateText(howPanel.transform, "HowIntro", "Evoke turns your ideas into places to explore. Create and refine worlds on the website; this Quest client is for visiting worlds already saved to your account.", 23, TextAnchor.MiddleLeft, new Vector2(-410f, 110f), new Vector2(820f, 78f));
            CreateText(howPanel.transform, "HowStep1", "01  DESCRIBE\nPut the first version of your idea into words.", 27, TextAnchor.MiddleLeft, new Vector2(-390f, 10f), new Vector2(780f, 72f));
            CreateText(howPanel.transform, "HowStep2", "02  SHAPE\nAdd detail, direction, and the pieces that make it yours.", 27, TextAnchor.MiddleLeft, new Vector2(-390f, -80f), new Vector2(780f, 72f));
            CreateText(howPanel.transform, "HowStep3", "03  REINFORCE\nKeep refining until the world feels ready to step into.", 27, TextAnchor.MiddleLeft, new Vector2(-390f, -170f), new Vector2(780f, 72f));
            CreateText(howPanel.transform, "HowLimit", "In VR, choose a ready panorama and look around from a fixed viewpoint. World creation, editing, and positional 3D movement are not available here.", 21, TextAnchor.MiddleLeft, new Vector2(-410f, -245f), new Vector2(820f, 75f));
        }

        private void BuildViewer()
        {
            viewerPanel = NewPanel("ViewerPanel");
            viewerStatus = CreateText(viewerPanel.transform, "ViewerStatus", "Preparing panorama…", 17, TextAnchor.MiddleCenter, new Vector2(0f, 310f), new Vector2(700f, 36f));
            CreateButton(viewerPanel.transform, "Back", "← IMMERSE", new Vector2(-365f, -300f), new Vector2(180f, 56f), BackToWorlds);
            CreateButton(viewerPanel.transform, "ViewerLogout", "LOG OUT", new Vector2(365f, -300f), new Vector2(180f, 56f), Logout);
        }

        private void BuildKeyboard()
        {
            keyboardPanel = NewPanel("VRKeyboard");
            CreateText(keyboardPanel.transform, "KeyboardTitle", "VR KEYBOARD  ·  LETTERS AND NUMBERS/SYMBOLS", 22, TextAnchor.MiddleCenter, new Vector2(0f, 270f), new Vector2(900f, 45f));
            GameObject keyRoot = new GameObject("KeyboardKeys");
            keyRoot.transform.SetParent(keyboardPanel.transform, false);
            RectTransform keyRect = keyRoot.AddComponent<RectTransform>();
            Stretch(keyRect, 0f, 0f, 0f, 0f);
            keyboardKeyRoot = keyRoot.transform;
            BuildKeyboardPage();
            CreateButton(keyboardPanel.transform, "Shift", "SHIFT", new Vector2(-360f, -155f), new Vector2(135f, 62f), ToggleKeyboardShift);
            CreateButton(keyboardPanel.transform, "Symbols", "123 / #+=", new Vector2(-190f, -155f), new Vector2(170f, 62f), ToggleKeyboardPage);
            CreateButton(keyboardPanel.transform, "Space", "SPACE", new Vector2(0f, -155f), new Vector2(170f, 62f), () => TypeKey(" "));
            CreateButton(keyboardPanel.transform, "Backspace", "⌫ DELETE", new Vector2(190f, -155f), new Vector2(170f, 62f), Backspace);
            CreateButton(keyboardPanel.transform, "KeyboardDone", "DONE", new Vector2(370f, -155f), new Vector2(135f, 62f), CloseKeyboard);
        }

        private void BuildKeyboardPage()
        {
            for (int i = keyboardKeys.Count - 1; i >= 0; i--)
                Destroy(keyboardKeys[i]);
            keyboardKeys.Clear();

            string[] rows = keyboardSymbols
                ? new[] { "1234567890", "!@#$%^&*()", "-_=+[]{}\\|", ";:'\",.<>/?`~" }
                : new[] { "qwertyuiop", "asdfghjkl", "zxcvbnm@." };
            float[] rowY = keyboardSymbols
                ? new[] { 190f, 110f, 30f, -50f }
                : new[] { 190f, 110f, 30f };

            for (int row = 0; row < rows.Length; row++)
            {
                string keys = rows[row];
                float keyWidth = Mathf.Min(78f, 900f / keys.Length);
                float buttonWidth = keyWidth - 8f;
                float totalWidth = keyWidth * keys.Length;
                for (int col = 0; col < keys.Length; col++)
                {
                    char character = keys[col];
                    string value = character.ToString();
                    string label = keyboardShifted ? value.ToUpperInvariant() : value;
                    Button keyButton = CreateButton(keyboardKeyRoot, "Key_" + row + "_" + col, label,
                        new Vector2(-totalWidth * 0.5f + keyWidth * 0.5f + col * keyWidth, rowY[row]),
                        new Vector2(buttonWidth, 62f), () => TypeKey(keyboardShifted ? value.ToUpperInvariant() : value));
                    keyboardKeys.Add(keyButton.gameObject);
                }
            }
        }

        private void ToggleKeyboardShift()
        {
            keyboardShifted = !keyboardShifted;
            BuildKeyboardPage();
        }

        private void ToggleKeyboardPage()
        {
            keyboardSymbols = !keyboardSymbols;
            keyboardShifted = false;
            BuildKeyboardPage();
        }

        private GameObject NewPanel(string name)
        {
            GameObject panel = new GameObject(name);
            panel.transform.SetParent(canvas.transform, false);
            RectTransform rect = panel.AddComponent<RectTransform>();
            Stretch(rect, 0f, 0f, 0f, 0f);
            return panel;
        }

        private InputField CreateInput(Transform parent, string name, string placeholder, InputField.ContentType contentType, Vector2 position)
        {
            GameObject fieldObject = new GameObject(name);
            fieldObject.transform.SetParent(parent, false);
            RectTransform rect = fieldObject.AddComponent<RectTransform>();
            rect.anchorMin = rect.anchorMax = new Vector2(0.5f, 0.5f);
            rect.sizeDelta = new Vector2(820f, 66f);
            rect.anchoredPosition = position;
            Image image = fieldObject.AddComponent<Image>();
            image.sprite = GetUiSprite();
            image.color = new Color(0.12f, 0.19f, 0.17f, 1f);
            InputField input = fieldObject.AddComponent<InputField>();
            Text text = CreateText(fieldObject.transform, "Text", "", 26, TextAnchor.MiddleLeft);
            Stretch(text.rectTransform, 20f, 10f, 20f, 10f);
            Text hint = CreateText(fieldObject.transform, "Placeholder", placeholder, 24, TextAnchor.MiddleLeft);
            hint.color = new Color(0.72f, 0.78f, 0.75f, 0.68f);
            Stretch(hint.rectTransform, 20f, 10f, 20f, 10f);
            input.textComponent = text;
            input.placeholder = hint;
            input.contentType = contentType;
            input.lineType = InputField.LineType.SingleLine;
            input.onSelect.AddListener(_ => selectedInput = input);
#if UNITY_EDITOR
            input.readOnly = false;
#else
            input.readOnly = true;
#endif
            return input;
        }

        private Button CreateButton(Transform parent, string name, string label, Vector2 position, Vector2 size, Action action)
        {
            GameObject buttonObject = new GameObject(name);
            buttonObject.transform.SetParent(parent, false);
            RectTransform rect = buttonObject.AddComponent<RectTransform>();
            rect.anchorMin = rect.anchorMax = new Vector2(0.5f, 0.5f);
            rect.anchoredPosition = position;
            rect.sizeDelta = size;
            Image image = buttonObject.AddComponent<Image>();
            image.sprite = GetUiSprite();
            image.color = new Color(0.12f, 0.34f, 0.27f, 1f);
            Button button = buttonObject.AddComponent<Button>();
            button.targetGraphic = image;
            ColorBlock colors = button.colors;
            colors.highlightedColor = new Color(0.2f, 0.51f, 0.39f, 1f);
            colors.pressedColor = new Color(0.08f, 0.25f, 0.2f, 1f);
            button.colors = colors;
            Text text = CreateText(buttonObject.transform, "Label", label, 23, TextAnchor.MiddleCenter);
            Stretch(text.rectTransform, 4f, 2f, 4f, 2f);
            button.onClick.AddListener(() => action());
            return button;
        }

        private Image CreateImage(Transform parent, string name, Color color)
        {
            GameObject imageObject = new GameObject(name);
            imageObject.transform.SetParent(parent, false);
            Image image = imageObject.AddComponent<Image>();
            image.sprite = GetUiSprite();
            image.color = color;
            return image;
        }

        private static Sprite GetUiSprite()
        {
            if (uiSprite == null)
                uiSprite = Resources.GetBuiltinResource<Sprite>("UI/Skin/UISprite.psd");
            return uiSprite;
        }

        private Text CreateText(Transform parent, string name, string value, int size, TextAnchor anchor,
            Vector2 position = default(Vector2), Vector2 dimensions = default(Vector2))
        {
            GameObject textObject = new GameObject(name);
            textObject.transform.SetParent(parent, false);
            RectTransform rect = textObject.AddComponent<RectTransform>();
            rect.anchorMin = rect.anchorMax = new Vector2(0.5f, 0.5f);
            rect.anchoredPosition = position;
            rect.sizeDelta = dimensions == Vector2.zero ? new Vector2(900f, 50f) : dimensions;
            Text text = textObject.AddComponent<Text>();
            text.text = value;
            text.font = GetRuntimeFont();
            text.fontSize = size;
            text.color = new Color(0.94f, 0.97f, 0.94f, 1f);
            text.alignment = anchor;
            text.horizontalOverflow = HorizontalWrapMode.Wrap;
            text.verticalOverflow = VerticalWrapMode.Truncate;
            return text;
        }

        private static Font GetRuntimeFont()
        {
            try
            {
                Font font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
                if (font != null) return font;
            }
            catch (Exception) { }
            try
            {
                return Resources.GetBuiltinResource<Font>("Arial.ttf");
            }
            catch (Exception) { return null; }
        }

        private static void Stretch(RectTransform rect, float left, float bottom, float right, float top)
        {
            rect.anchorMin = Vector2.zero;
            rect.anchorMax = Vector2.one;
            rect.offsetMin = new Vector2(left, bottom);
            rect.offsetMax = new Vector2(-right, -top);
        }
    }
}