using System.Collections.Generic;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;
using UnityEngine.XR;
#if UNITY_EDITOR && ENABLE_INPUT_SYSTEM
using UnityEngine.InputSystem;
#endif

namespace EvokeQuest
{
    public sealed partial class EvokeQuestPanoramaClient
    {
        private InputField selectedInput;
        private sealed class PointerInteraction
        {
            public GameObject hovered;
            public GameObject pressed;
            public GameObject dragged;
            public Vector2 lastPosition;
        }
        private readonly Dictionary<XRNode, PointerInteraction> controllerPointers = new Dictionary<XRNode, PointerInteraction>();
        private readonly PointerInteraction editorPointer = new PointerInteraction();
        private readonly Dictionary<XRNode, bool> previousTrigger = new Dictionary<XRNode, bool>();

#if UNITY_EDITOR && ENABLE_INPUT_SYSTEM
        private void OnEnable()
        {
            if (Keyboard.current != null)
                Keyboard.current.onTextInput += OnEditorTextInput;
        }

        private void OnDisable()
        {
            if (Keyboard.current != null)
                Keyboard.current.onTextInput -= OnEditorTextInput;
        }

        private void OnEditorTextInput(char character)
        {
            if (eventSystem != null && eventSystem.currentInputModule != null)
                return;
            if (selectedInput == null || (!keyboardPanel.activeSelf && !selectedInput.isFocused) || char.IsControl(character))
                return;
            selectedInput.text += character;
        }
#endif

        private void OpenKeyboard(InputField target)
        {
            if (target == null) return;
            selectedInput = target;
            keyboardSymbols = false;
            keyboardShifted = false;
            BuildKeyboardPage();
            keyboardPanel.SetActive(true);
        }

        private void TypeKey(string key)
        {
            if (selectedInput == null) return;
            selectedInput.text += key;
        }

        private void Backspace()
        {
            if (selectedInput == null || selectedInput.text.Length == 0) return;
            selectedInput.text = selectedInput.text.Substring(0, selectedInput.text.Length - 1);
        }

        private void CloseKeyboard()
        {
            keyboardPanel.SetActive(false);
            selectedInput = null;
        }

        private void Update()
        {
            if (canvas == null || headCamera == null) return;
            if (panoramaObject != null)
                panoramaObject.transform.position = headCamera.transform.position;

            PollController(XRNode.LeftHand);
            PollController(XRNode.RightHand);
            UpdateMusicUi();
#if UNITY_EDITOR
            PollEditorMouse();
#endif
#if UNITY_EDITOR && ENABLE_INPUT_SYSTEM
            PollEditorKeyboard();
#endif
        }

        private void PollController(XRNode node)
        {
            InputDevice device = InputDevices.GetDeviceAtXRNode(node);
            LineRenderer line;
            controllerRays.TryGetValue(node, out line);
            if (!device.isValid)
            {
                if (line != null) line.enabled = false;
                ReleaseControllerPointer(node);
                return;
            }
            Vector3 localPosition;
            Quaternion localRotation;
            bool trigger;
            if (!device.TryGetFeatureValue(CommonUsages.devicePosition, out localPosition) ||
                !device.TryGetFeatureValue(CommonUsages.deviceRotation, out localRotation) ||
                !device.TryGetFeatureValue(CommonUsages.triggerButton, out trigger))
            {
                if (line != null) line.enabled = false;
                ReleaseControllerPointer(node);
                return;
            }
            Vector2 stick;
            if (worldsPanel != null && worldsPanel.activeSelf &&
                device.TryGetFeatureValue(CommonUsages.primary2DAxis, out stick) &&
                Mathf.Abs(stick.y) > 0.55f)
                worldScroll.verticalNormalizedPosition = Mathf.Clamp01(worldScroll.verticalNormalizedPosition + stick.y * Time.deltaTime);
            if (musicPanel != null && musicPanel.activeSelf &&
                device.TryGetFeatureValue(CommonUsages.primary2DAxis, out stick) &&
                Mathf.Abs(stick.y) > 0.55f)
                musicScroll.verticalNormalizedPosition = Mathf.Clamp01(musicScroll.verticalNormalizedPosition + stick.y * Time.deltaTime);
            Vector3 position = transform.TransformPoint(localPosition);
            Quaternion rotation = transform.rotation * localRotation;
            Ray ray = new Ray(position, rotation * Vector3.forward);
            Plane plane = new Plane(canvas.transform.forward, canvas.transform.position);
            float hitDistance;
            bool intersects = plane.Raycast(ray, out hitDistance) && hitDistance > 0f && hitDistance < 5f;
            Vector3 endPoint = intersects ? ray.GetPoint(hitDistance) : ray.GetPoint(5f);
            if (line != null)
            {
                line.enabled = true;
                line.SetPosition(0, position);
                line.SetPosition(1, endPoint);
            }

            PointerEventData eventData = new PointerEventData(eventSystem) { position = Vector2.zero };
            List<RaycastResult> results = new List<RaycastResult>();
            GameObject target = null;
            if (intersects)
            {
                Vector2 screenPosition = RectTransformUtility.WorldToScreenPoint(headCamera, endPoint);
                eventData.position = screenPosition;
                graphicRaycaster.Raycast(eventData, results);
                if (results.Count > 0)
                {
                    target = results[0].gameObject;
                    eventData.pointerCurrentRaycast = results[0];
                }
            }
            bool wasPressed;
            previousTrigger.TryGetValue(node, out wasPressed);
            PointerInteraction pointer;
            if (!controllerPointers.TryGetValue(node, out pointer))
            {
                pointer = new PointerInteraction();
                controllerPointers[node] = pointer;
            }
            eventData.pointerId = node == XRNode.LeftHand ? -1 : -2;
            ProcessPointer(pointer, eventData, target, trigger, trigger && !wasPressed, !trigger && wasPressed);
            previousTrigger[node] = trigger;
        }

        private void ReleaseControllerPointer(XRNode node)
        {
            bool wasPressed;
            previousTrigger.TryGetValue(node, out wasPressed);
            if (!wasPressed) return;
            PointerInteraction pointer;
            if (controllerPointers.TryGetValue(node, out pointer))
            {
                PointerEventData eventData = new PointerEventData(eventSystem)
                {
                    pointerId = node == XRNode.LeftHand ? -1 : -2,
                    position = pointer.lastPosition,
                };
                ProcessPointer(pointer, eventData, null, false, false, true);
            }
            previousTrigger[node] = false;
        }

        private void ProcessPointer(PointerInteraction pointer, PointerEventData eventData, GameObject target,
            bool pressed, bool down, bool up)
        {
            eventData.button = PointerEventData.InputButton.Left;
            eventData.delta = eventData.position - pointer.lastPosition;

            if (pointer.hovered != target)
            {
                if (pointer.hovered != null)
                    ExecuteEvents.ExecuteHierarchy(pointer.hovered, eventData, ExecuteEvents.pointerExitHandler);
                if (target != null)
                    ExecuteEvents.ExecuteHierarchy(target, eventData, ExecuteEvents.pointerEnterHandler);
                pointer.hovered = target;
            }

            if (down && target != null)
            {
                pointer.pressed = ExecuteEvents.GetEventHandler<IPointerClickHandler>(target);
                if (pointer.pressed == null)
                    pointer.pressed = target;
                eventData.pointerPress = pointer.pressed;
                eventData.pressPosition = eventData.position;
                eventData.pointerPressRaycast = eventData.pointerCurrentRaycast;
                eventData.eligibleForClick = true;
                ExecuteEvents.ExecuteHierarchy(target, eventData, ExecuteEvents.pointerDownHandler);

                pointer.dragged = ExecuteEvents.GetEventHandler<IDragHandler>(target);
                if (pointer.dragged != null)
                {
                    eventData.pointerDrag = pointer.dragged;
                    ExecuteEvents.ExecuteHierarchy(target, eventData, ExecuteEvents.initializePotentialDrag);
                    ExecuteEvents.Execute(pointer.dragged, eventData, ExecuteEvents.beginDragHandler);
                }
            }

            if (pressed && pointer.dragged != null)
            {
                eventData.pointerPress = pointer.pressed;
                eventData.pointerDrag = pointer.dragged;
                ExecuteEvents.Execute(pointer.dragged, eventData, ExecuteEvents.dragHandler);
            }

            if (up)
            {
                eventData.pointerPress = pointer.pressed;
                eventData.pointerDrag = pointer.dragged;
                if (pointer.pressed != null)
                    ExecuteEvents.ExecuteHierarchy(pointer.pressed, eventData, ExecuteEvents.pointerUpHandler);
                GameObject clickTarget = target == null ? null : ExecuteEvents.GetEventHandler<IPointerClickHandler>(target);
                if (pointer.pressed != null && pointer.pressed == clickTarget && eventData.eligibleForClick)
                    ExecuteEvents.Execute(pointer.pressed, eventData, ExecuteEvents.pointerClickHandler);
                if (pointer.dragged != null)
                    ExecuteEvents.Execute(pointer.dragged, eventData, ExecuteEvents.endDragHandler);
                pointer.pressed = null;
                pointer.dragged = null;
            }
            pointer.lastPosition = eventData.position;
        }

        private void CreateControllerRay(XRNode node)
        {
            GameObject rayObject = new GameObject(node + "ControllerRay");
            rayObject.transform.SetParent(transform, false);
            LineRenderer line = rayObject.AddComponent<LineRenderer>();
            line.positionCount = 2;
            line.useWorldSpace = true;
            line.startWidth = 0.006f;
            line.endWidth = 0.002f;
            line.enabled = false;
            Shader shader = Resources.Load<Shader>("EvokeControllerRayURP");
            if (shader != null)
            {
                Material material = new Material(shader);
                material.SetColor("_BaseColor", new Color(0.35f, 0.95f, 0.69f, 0.9f));
                line.material = material;
            }
            else
                Debug.LogError("Evoke Quest: Resources/EvokeControllerRayURP.shader is missing.");
            controllerRays[node] = line;
        }

#if UNITY_EDITOR
        private void PollEditorMouse()
        {
            if (eventSystem.currentInputModule != null)
                return;
            bool available = false;
            bool pressed = false;
            bool down = false;
            bool up = false;
            Vector2 position = Vector2.zero;
#if ENABLE_INPUT_SYSTEM
            Mouse mouse = Mouse.current;
            if (mouse != null)
            {
                available = true;
                pressed = mouse.leftButton.isPressed;
                down = mouse.leftButton.wasPressedThisFrame;
                up = mouse.leftButton.wasReleasedThisFrame;
                position = mouse.position.ReadValue();
            }
#endif
#if ENABLE_LEGACY_INPUT_MANAGER
            if (!available)
            {
                available = true;
                position = Input.mousePosition;
            }
            pressed |= Input.GetMouseButton(0);
            down |= Input.GetMouseButtonDown(0);
            up |= Input.GetMouseButtonUp(0);
#endif
            if (!available) return;
            PointerEventData eventData = new PointerEventData(eventSystem) { position = position, pointerId = 0 };
            List<RaycastResult> results = new List<RaycastResult>();
            graphicRaycaster.Raycast(eventData, results);
            GameObject target = null;
            if (results.Count > 0)
            {
                target = results[0].gameObject;
                eventData.pointerCurrentRaycast = results[0];
            }
            ProcessPointer(editorPointer, eventData, target, pressed, down, up);
        }

#if ENABLE_INPUT_SYSTEM
        private void PollEditorKeyboard()
        {
            Keyboard keyboard = Keyboard.current;
            if ((eventSystem != null && eventSystem.currentInputModule != null) ||
                keyboard == null || selectedInput == null ||
                (!keyboardPanel.activeSelf && !selectedInput.isFocused))
                return;

            if (keyboard.backspaceKey.wasPressedThisFrame)
                Backspace();
            if (keyboard.escapeKey.wasPressedThisFrame && keyboardPanel.activeSelf)
                CloseKeyboard();
        }
#endif
#endif
    }
}