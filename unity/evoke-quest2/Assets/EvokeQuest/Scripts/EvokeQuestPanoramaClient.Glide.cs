#if EVOKE_GLIDE_WORLDS
using System;
using System.Collections;
using System.Threading.Tasks;
using GaussianSplatting.Runtime;
using UnityEngine;
using UnityEngine.Networking;
using UnityEngine.XR;
#if UNITY_EDITOR
using UnityEditor;
#endif

namespace EvokeQuest
{
    public sealed partial class EvokeQuestPanoramaClient
    {
        [Header("Fixed-height glide — Quest 2 experimental")]
        [SerializeField, Range(0.2f, 2f)] private float glideSpeed = 0.8f;
        [SerializeField, Range(15f, 90f)] private float glideTurnDegrees = 45f;
        [SerializeField] private Shader glideSplatShader;
        [SerializeField] private Shader glideCompositeShader;
        [SerializeField] private Shader glideDebugPointsShader;
        [SerializeField] private Shader glideDebugBoxesShader;
        [SerializeField] private ComputeShader glideDeviceRadixSort;
        [SerializeField] private ComputeShader glideFidelityFxSort;

        private GameObject glideWorldRoot;
        private bool glideActive;
        private bool glidePoseCaptured;
        private bool glideTurnHeld;
        private bool glideResetHeld;
        private Vector3 glideStartPosition;
        private Quaternion glideStartRotation;
        private CharacterController glidePreviousController;
        private bool glideControllerWasEnabled;
        private Task<RuntimeSplatData> glideProcessingTask;
        private UnityWebRequest glideDownload;
        private const int MaxGlideBytes = 96 * 1024 * 1024;

        [ContextMenu("Assign Glide Mode Renderer Assets")]
        private void AssignGlideRendererAssets()
        {
#if UNITY_EDITOR
            const string root = "Packages/com.worldlabs.gaussian-splatting/Shaders/";
            glideSplatShader = AssetDatabase.LoadAssetAtPath<Shader>(root + "RenderGaussianSplats.shader");
            glideCompositeShader = AssetDatabase.LoadAssetAtPath<Shader>(root + "GaussianComposite.shader");
            glideDebugPointsShader = AssetDatabase.LoadAssetAtPath<Shader>(root + "GaussianDebugRenderPoints.shader");
            glideDebugBoxesShader = AssetDatabase.LoadAssetAtPath<Shader>(root + "GaussianDebugRenderBoxes.shader");
            glideDeviceRadixSort = AssetDatabase.LoadAssetAtPath<ComputeShader>(root + "SplatUtilities_DeviceRadixSort.compute");
            glideFidelityFxSort = AssetDatabase.LoadAssetAtPath<ComputeShader>(root + "SplatUtilities_FidelityFX.compute");
            EditorUtility.SetDirty(this);
            Debug.Log("Evoke Quest: glide renderer assignment attempted. Check all six Glide fields before building.", this);
#endif
        }

        private void OpenGlideWorld(string id, string displayName)
        {
            if (busy) return;
            RemovePanorama();
#if EVOKE_WALKABLE_WORLDS
            StopWalkableWorld();
#endif
            panelBackground.enabled = false;
            brandText.gameObject.SetActive(false);
            statusText.gameObject.SetActive(false);
            worldsPanel.SetActive(false);
            tabsPanel.SetActive(false);
            viewerPanel.SetActive(true);
            viewerStatus.gameObject.SetActive(true);
            if (glideProcessingTask != null && !glideProcessingTask.IsCompleted)
            {
                ShowViewerError("The previous 3D scene is still finishing preparation. Wait a moment, then return to Worlds and try again.");
                return;
            }
            if (glideProcessingTask != null && glideProcessingTask.IsFaulted)
                glideProcessingTask.Exception.Handle(exception => true);
            glideProcessingTask = null;
            if (!SystemInfo.supportsComputeShaders)
            {
                ShowViewerError("This graphics configuration cannot render the 3D splat. Check the Vulkan/URP setup in the guide, or use 360° View.");
                return;
            }
            if (glideSplatShader == null || glideCompositeShader == null ||
                glideDebugPointsShader == null || glideDebugBoxesShader == null ||
                glideDeviceRadixSort == null || glideFidelityFxSort == null)
            {
                ShowViewerError("Glide graphics need setup. Assign Glide Mode Renderer Assets on the XR Origin component. 360° View is still available.");
                return;
            }
            viewerStatus.text = "Loading the private 3D world…";
            worldLoadCoroutine = StartCoroutine(LoadGlideWorld(id, displayName));
        }

        private IEnumerator LoadGlideWorld(string id, string displayName)
        {
            busy = true;
            string response = null;
            string error = null;
            yield return ApiGet("/api/worlds/" + UnityWebRequest.EscapeURL(id),
                value => response = value, value => error = value);
            if (error != null) { FailGlide(error); yield break; }

            WorldPayload payload = null;
            try { payload = JsonUtility.FromJson<WorldPayload>(response); }
            catch (Exception exception) { error = "Could not read the saved 3D world: " + exception.Message; }
            if (payload == null || payload.world == null)
            {
                FailGlide(error ?? "The API did not return this saved world.");
                yield break;
            }
            Asset selected = null;
            foreach (Asset asset in payload.world.assets ?? new Asset[0])
            {
                if (asset == null || asset.kind != "splat" || asset.format != "spz" ||
                    string.IsNullOrEmpty(asset.signed_url)) continue;
                if (asset.quality == "100k") { selected = asset; break; }
                if (asset.quality == "150k") selected = asset;
            }
            if (selected == null)
            {
                FailGlide("This world has no 100k/150k SPZ suitable for Quest 2. Use 360° View; higher-detail desktop assets are not loaded automatically.");
                yield break;
            }

            byte[] bytes;
            using (UnityWebRequest request = UnityWebRequest.Get(selected.signed_url))
            {
                glideDownload = request;
                request.timeout = 120;
                UnityWebRequestAsyncOperation download = request.SendWebRequest();
                while (!download.isDone)
                {
                    if (request.downloadedBytes > (ulong)MaxGlideBytes)
                    {
                        request.Abort();
                        break;
                    }
                    yield return null;
                }
                bytes = request.downloadHandler.data;
                if (request.result != UnityWebRequest.Result.Success || bytes == null ||
                    bytes.Length == 0 || bytes.Length > MaxGlideBytes)
                {
                    glideDownload = null;
                    FailGlide("The 3D scene download failed or exceeded the Quest 2 size limit. Return to Worlds and retry, or use 360° View.");
                    yield break;
                }
                glideDownload = null;
            }
            viewerStatus.text = "Preparing the Quest 2 3D scene…";
            Task<RuntimeSplatData> processing = Task.Run(() =>
                RuntimeSplatProcessing.ProcessSPZBytes(bytes,
                    GaussianSplatAsset.VectorFormat.Norm11,
                    GaussianSplatAsset.VectorFormat.Norm11,
                    GaussianSplatAsset.ColorFormat.Norm8x4,
                    GaussianSplatAsset.SHFormat.Norm6));
            glideProcessingTask = processing;
            while (!processing.IsCompleted) yield return null;
            glideProcessingTask = null;
            if (processing.IsFaulted || processing.IsCanceled || processing.Result == null)
            {
                // Observe background exceptions without exposing private asset URLs.
                if (processing.IsFaulted) Debug.LogWarning("Evoke Quest: SPZ processing failed: " + processing.Exception.GetBaseException().Message);
                FailGlide("The Quest renderer could not prepare this SPZ scene. Use 360° View.");
                yield break;
            }
            RuntimeSplatData runtimeSplat = processing.Result;
            if (runtimeSplat.splatCount <= 0 || runtimeSplat.splatCount > 150000)
            {
                FailGlide("This decoded scene exceeds the 150k-splat Quest 2 limit. Use 360° View.");
                yield break;
            }

            try
            {
                glideWorldRoot = new GameObject("EvokeGlideWorld");
                // Keep the world independent of the XR Origin; only the player moves.
                // The reference view starts at the tracked head, not at the rig's feet.
                glideWorldRoot.transform.SetPositionAndRotation(headCamera.transform.position, transform.rotation);
                GameObject splatObject = new GameObject("GlideGaussianSplats");
                splatObject.transform.SetParent(glideWorldRoot.transform, false);
                splatObject.transform.localRotation = Quaternion.Euler(-180f, 0f, 0f);
                // Anchor the raw camera origin to the tracked head. No generated floor
                // offset is needed because glide does not attempt to stand on a floor.
                float metricScale = payload.world.marble_world != null &&
                    payload.world.marble_world.assets != null &&
                    payload.world.marble_world.assets.splats != null &&
                    payload.world.marble_world.assets.splats.semantics_metadata != null
                    ? payload.world.marble_world.assets.splats.semantics_metadata.metric_scale_factor : 1f;
                if (float.IsNaN(metricScale) || float.IsInfinity(metricScale) || metricScale <= 0f)
                    metricScale = 1f;
                splatObject.transform.localScale = Vector3.one * metricScale;
                splatObject.SetActive(false);
                GaussianSplatRenderer renderer = splatObject.AddComponent<GaussianSplatRenderer>();
                renderer.m_ShaderSplats = glideSplatShader;
                renderer.m_ShaderComposite = glideCompositeShader;
                renderer.m_ShaderDebugPoints = glideDebugPointsShader;
                renderer.m_ShaderDebugBoxes = glideDebugBoxesShader;
                renderer.m_CSSplatUtilities_deviceRadixSort = glideDeviceRadixSort;
                renderer.m_CSSplatUtilities_fidelityFX = glideFidelityFxSort;
                renderer.m_gpuSortType = GpuSorting.SortType.DeviceRadixSort;
                renderer.m_SortNthFrame = 3;
                renderer.m_CenterEyeOnly = true;
                renderer.m_OptimizeForQuest = true;
                runtimeSplat.worldId = id;
                runtimeSplat.worldName = displayName;
                splatObject.SetActive(true);
                renderer.LoadFromRuntimeData(runtimeSplat);

                glideStartPosition = transform.position;
                glideStartRotation = transform.rotation;
                glidePoseCaptured = true;
                glidePreviousController = GetComponent<CharacterController>();
                if (glidePreviousController != null)
                {
                    glideControllerWasEnabled = glidePreviousController.enabled;
                    glidePreviousController.enabled = false;
                }
                glideActive = true;
            }
            catch (Exception exception)
            {
                error = "The 3D renderer failed to start: " + exception.Message;
            }
            if (error != null) { FailGlide(error); yield break; }
            busy = false;
            worldLoadCoroutine = null;
            viewerStatus.text = "GLIDE · left stick: move · right stick: snap-turn\nClick left stick: reset · Back: Worlds\nFixed rig height · no wall collisions";
        }

        private void UpdateGlideLocomotion()
        {
            if (!glideActive || busy || !Application.isFocused ||
                !viewerPanel.activeInHierarchy || keyboardPanel.activeSelf) return;
            InputDevice headset = InputDevices.GetDeviceAtXRNode(XRNode.Head);
            bool worn;
            if (!headset.isValid ||
                (headset.TryGetFeatureValue(CommonUsages.userPresence, out worn) && !worn))
                return;
            InputDevice left = InputDevices.GetDeviceAtXRNode(XRNode.LeftHand);
            InputDevice right = InputDevices.GetDeviceAtXRNode(XRNode.RightHand);
            Vector2 stick;
            bool reset;
            if (left.isValid && left.TryGetFeatureValue(CommonUsages.primary2DAxisClick, out reset))
            {
                if (reset && !glideResetHeld)
                    transform.SetPositionAndRotation(glideStartPosition, glideStartRotation);
                glideResetHeld = reset;
                if (reset) return;
            }
            else glideResetHeld = false;
            if (left.isValid && left.TryGetFeatureValue(CommonUsages.primary2DAxis, out stick))
            {
                float magnitude = Mathf.Clamp01(stick.magnitude);
                if (magnitude > 0.2f)
                {
                    Vector3 forward = Vector3.ProjectOnPlane(headCamera.transform.forward, Vector3.up);
                    if (forward.sqrMagnitude < 0.001f) forward = transform.forward;
                    forward = Vector3.ProjectOnPlane(forward, Vector3.up).normalized;
                    Vector3 side = Vector3.Cross(Vector3.up, forward);
                    Vector2 input = stick.normalized * ((magnitude - 0.2f) / 0.8f);
                    Vector3 move = forward * input.y + side * input.x;
                    transform.position += move * glideSpeed * Mathf.Min(Time.unscaledDeltaTime, 0.05f);
                }
            }
            if (right.isValid && right.TryGetFeatureValue(CommonUsages.primary2DAxis, out stick))
            {
                if (Mathf.Abs(stick.x) < 0.3f) glideTurnHeld = false;
                if (Mathf.Abs(stick.x) > 0.75f && !glideTurnHeld)
                {
                    transform.RotateAround(headCamera.transform.position, Vector3.up,
                        Mathf.Sign(stick.x) * glideTurnDegrees);
                    glideTurnHeld = true;
                }
            }
            else glideTurnHeld = false;
        }

        private void FailGlide(string message)
        {
            StopGlideWorld();
            worldLoadCoroutine = null;
            ShowViewerError(message);
        }

        private void StopGlideWorld()
        {
            glideActive = false;
            if (glideDownload != null)
            {
                glideDownload.Abort();
                glideDownload.Dispose();
                glideDownload = null;
            }
            if (glideWorldRoot != null) Destroy(glideWorldRoot);
            glideWorldRoot = null;
            if (glidePoseCaptured)
                transform.SetPositionAndRotation(glideStartPosition, glideStartRotation);
            if (glidePreviousController != null)
                glidePreviousController.enabled = glideControllerWasEnabled;
            glidePreviousController = null;
            glidePoseCaptured = false;
            glideTurnHeld = false;
            glideResetHeld = false;
        }
    }
}
#endif
