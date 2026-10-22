#if EVOKE_WALKABLE_WORLDS
using System;
using System.Collections;
using System.Collections.Generic;
using System.Threading.Tasks;
using GaussianSplatting.Runtime;
using GLTFast;
using UnityEngine;
using UnityEngine.AI;
using UnityEngine.Networking;
using UnityEngine.XR;
#if UNITY_EDITOR
using UnityEditor;
#endif

namespace EvokeQuest
{
    public sealed partial class EvokeQuestPanoramaClient
    {
        [Header("Walk mode — Quest 2 experimental")]
        [SerializeField] private Shader walkSplatShader;
        [SerializeField] private Shader walkCompositeShader;
        [SerializeField] private Shader walkDebugPointsShader;
        [SerializeField] private Shader walkDebugBoxesShader;
        [SerializeField] private ComputeShader walkDeviceRadixSort;
        [SerializeField] private ComputeShader walkFidelityFxSort;
        [SerializeField, Min(0.5f)] private float walkSpeed = 1.6f;
        [SerializeField, Range(0.1f, 0.5f)] private float walkableStepHeight = 0.32f;
        [SerializeField] private float snapTurnDegrees = 45f;

        private const int MaxWalkSplatBytes = 96 * 1024 * 1024;
        private const int MaxColliderTriangles = 400000;
        private const int MaxColliderVertices = 800000;
        private readonly List<NavMeshBuildSource> walkSources = new List<NavMeshBuildSource>();
        private GameObject walkWorldRoot;
        private GameObject walkColliderRoot;
        private GltfImport walkColliderImport;
        private NavMeshData walkNavMesh;
        private NavMeshDataInstance walkNavMeshInstance;
        private CharacterController walkController;
        private bool ownsWalkController;
        private bool walkActive;
        private bool walkOriginalTransformCaptured;
        private Vector3 walkOriginalPosition;
        private Quaternion walkOriginalRotation;
        private float verticalVelocity;
        private int lastSnapTurnDirection;
        private float nextSnapTurnTime;

        private void Reset()
        {
            const string shaderRoot = "Packages/com.worldlabs.gaussian-splatting/Shaders/";
            walkSplatShader = AssetDatabase.LoadAssetAtPath<Shader>(shaderRoot + "RenderGaussianSplats.shader");
            walkCompositeShader = AssetDatabase.LoadAssetAtPath<Shader>(shaderRoot + "GaussianComposite.shader");
            walkDebugPointsShader = AssetDatabase.LoadAssetAtPath<Shader>(shaderRoot + "GaussianDebugRenderPoints.shader");
            walkDebugBoxesShader = AssetDatabase.LoadAssetAtPath<Shader>(shaderRoot + "GaussianDebugRenderBoxes.shader");
            walkDeviceRadixSort = AssetDatabase.LoadAssetAtPath<ComputeShader>(shaderRoot + "SplatUtilities_DeviceRadixSort.compute");
            walkFidelityFxSort = AssetDatabase.LoadAssetAtPath<ComputeShader>(shaderRoot + "SplatUtilities_FidelityFX.compute");
        }

        private void OpenWalkableWorld(string id, string displayName)
        {
            if (busy) return;
            if (!WalkRendererConfigured())
            {
                ShowWalkableSetupError();
                return;
            }
            RemovePanorama();
            StopWalkableWorld();
            panelBackground.enabled = false;
            brandText.gameObject.SetActive(false);
            statusText.gameObject.SetActive(false);
            worldsPanel.SetActive(false);
            tabsPanel.SetActive(false);
            viewerPanel.SetActive(true);
            viewerStatus.gameObject.SetActive(true);
            viewerStatus.text = "Preparing 3D world…";
            worldLoadCoroutine = StartCoroutine(LoadWalkableWorld(id, displayName));
        }

        private bool WalkRendererConfigured()
        {
            return walkSplatShader != null && walkCompositeShader != null &&
                walkDebugPointsShader != null && walkDebugBoxesShader != null &&
                walkDeviceRadixSort != null && walkFidelityFxSort != null;
        }

        private void ShowWalkableSetupError()
        {
            viewerPanel.SetActive(true);
            viewerStatus.gameObject.SetActive(true);
            viewerStatus.text = "Walk mode graphics are not configured yet. Follow the Walk Mode setup steps in the Evoke Quest guide.";
            worldsPanel.SetActive(false);
            tabsPanel.SetActive(false);
        }

        private IEnumerator LoadWalkableWorld(string id, string displayName)
        {
            busy = true;
            string response = null;
            string error = null;
            yield return ApiGet("/api/worlds/" + UnityWebRequest.EscapeURL(id),
                value => response = value, value => error = value);
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

            Asset splat = FindWalkableSplat(payload.world.assets);
            Asset collider = FindWalkableCollider(payload.world.assets);
            if (splat == null || collider == null ||
                string.IsNullOrEmpty(splat.signed_url) || string.IsNullOrEmpty(collider.signed_url))
            {
                ShowViewerError("This world needs both a 100k SPZ scene and a GLB collider to enable walking. Its 360° panorama is still available.");
                yield break;
            }

            byte[] colliderBytes = null;
            yield return DownloadWalkAsset(collider.signed_url, value => colliderBytes = value,
                value => error = value);
            if (error != null)
            {
                ShowViewerError(error);
                yield break;
            }
            if (colliderBytes == null || colliderBytes.Length == 0)
            {
                ShowViewerError("The world collision mesh was empty.");
                yield break;
            }

            byte[] splatBytes = null;
            yield return DownloadWalkAsset(splat.signed_url, value => splatBytes = value,
                value => error = value);
            if (error != null)
            {
                ShowViewerError(error);
                yield break;
            }
            if (splatBytes == null || splatBytes.Length == 0)
            {
                ShowViewerError("The world 3D scene was empty.");
                yield break;
            }

            viewerStatus.text = "Reading world collision surfaces…";
            walkWorldRoot = new GameObject("EvokeWalkableWorld");
            walkWorldRoot.transform.SetParent(transform, false);
            walkColliderRoot = new GameObject("WalkableCollisionMesh");
            walkColliderRoot.transform.SetParent(walkWorldRoot.transform, false);
            walkColliderRoot.transform.localRotation = Quaternion.Euler(-180f, 0f, 0f);

            walkColliderImport = new GltfImport();
            Task<bool> importTask = walkColliderImport.LoadGltfBinary(colliderBytes);
            while (!importTask.IsCompleted) yield return null;
            if (importTask.IsFaulted || !importTask.Result)
            {
                ShowViewerError("Unity could not read this world's GLB collider.");
                yield break;
            }
            Task<bool> instantiateTask = walkColliderImport.InstantiateMainSceneAsync(walkColliderRoot.transform);
            while (!instantiateTask.IsCompleted) yield return null;
            if (instantiateTask.IsFaulted || !instantiateTask.Result)
            {
                ShowViewerError("Unity could not create this world's collision surfaces.");
                yield break;
            }

            Bounds worldBounds;
            string colliderError;
            if (!BuildWalkableNavMesh(out worldBounds, out colliderError))
            {
                ShowViewerError(colliderError);
                yield break;
            }

            viewerStatus.text = "Preparing the Quest 2 3D scene…";
            Task<RuntimeSplatData> processingTask = Task.Run(() =>
                RuntimeSplatProcessing.ProcessSPZBytes(
                    splatBytes,
                    GaussianSplatAsset.VectorFormat.Norm6,
                    GaussianSplatAsset.VectorFormat.Norm6,
                    GaussianSplatAsset.ColorFormat.Norm8x4,
                    GaussianSplatAsset.SHFormat.Cluster4k));
            while (!processingTask.IsCompleted) yield return null;
            if (processingTask.IsFaulted || processingTask.Result == null)
            {
                ShowViewerError("The Quest renderer could not prepare this world's SPZ scene.");
                yield break;
            }

            RuntimeSplatData runtimeSplat = processingTask.Result;
            runtimeSplat.worldId = id;
            runtimeSplat.worldName = displayName;
            GameObject splatObject = new GameObject("EvokeGaussianSplatScene");
            splatObject.transform.SetParent(walkWorldRoot.transform, false);
            splatObject.transform.localRotation = Quaternion.Euler(-180f, 0f, 0f);
            splatObject.SetActive(false);
            GaussianSplatRenderer splatRenderer = splatObject.AddComponent<GaussianSplatRenderer>();
            splatRenderer.m_ShaderSplats = walkSplatShader;
            splatRenderer.m_ShaderComposite = walkCompositeShader;
            splatRenderer.m_ShaderDebugPoints = walkDebugPointsShader;
            splatRenderer.m_ShaderDebugBoxes = walkDebugBoxesShader;
            splatRenderer.m_CSSplatUtilities_deviceRadixSort = walkDeviceRadixSort;
            splatRenderer.m_CSSplatUtilities_fidelityFX = walkFidelityFxSort;
            splatRenderer.m_gpuSortType = GpuSorting.SortType.DeviceRadixSort;
            splatRenderer.m_SortNthFrame = 3;
            splatRenderer.m_CenterEyeOnly = true;
            splatRenderer.m_OptimizeForQuest = true;
            splatObject.SetActive(true);
            splatRenderer.LoadFromRuntimeData(runtimeSplat);

            if (!NavMesh.SamplePosition(transform.position, out NavMeshHit spawnHit,
                    Mathf.Max(4f, worldBounds.extents.magnitude), NavMesh.AllAreas))
            {
                ShowViewerError("The collision mesh has no nearby walkable floor. This world remains available in 360° view.");
                yield break;
            }

            walkOriginalPosition = transform.position;
            walkOriginalRotation = transform.rotation;
            walkOriginalTransformCaptured = true;
            Vector3 cameraOffset = headCamera.transform.position - transform.position;
            if (walkController == null)
            {
                walkController = GetComponent<CharacterController>();
                if (walkController == null)
                {
                    walkController = gameObject.AddComponent<CharacterController>();
                    ownsWalkController = true;
                }
            }
            walkController.height = 1.72f;
            walkController.radius = 0.23f;
            walkController.center = new Vector3(0f, 0.86f, 0f);
            walkController.slopeLimit = 42f;
            walkController.stepOffset = walkableStepHeight;
            walkController.skinWidth = 0.035f;
            transform.SetPositionAndRotation(
                spawnHit.position - new Vector3(cameraOffset.x, 0f, cameraOffset.z),
                transform.rotation);
            walkController.enabled = true;
            walkActive = true;
            viewerStatus.text = "WALK MODE — left stick to walk, right stick to turn. Stay on the generated walkable surfaces.";
            busy = false;
            worldLoadCoroutine = null;
        }

        private static Asset FindWalkableCollider(Asset[] assets)
        {
            if (assets == null) return null;
            foreach (Asset asset in assets)
                if (asset != null && string.Equals(asset.kind, "collider", StringComparison.OrdinalIgnoreCase) &&
                    string.Equals(asset.format, "glb", StringComparison.OrdinalIgnoreCase))
                    return asset;
            return null;
        }

        private static Asset FindWalkableSplat(Asset[] assets)
        {
            if (assets == null) return null;
            Asset fallback = null;
            int bestRank = int.MaxValue;
            foreach (Asset asset in assets)
            {
                if (asset == null || !string.Equals(asset.kind, "splat", StringComparison.OrdinalIgnoreCase) ||
                    !string.Equals(asset.format, "spz", StringComparison.OrdinalIgnoreCase))
                    continue;
                string quality = asset.quality ?? string.Empty;
                int rank = quality.Equals("100k", StringComparison.OrdinalIgnoreCase) ? 0 :
                    quality.Equals("150k", StringComparison.OrdinalIgnoreCase) ? 1 :
                    quality.Equals("500k", StringComparison.OrdinalIgnoreCase) ? 2 :
                    quality.Equals("full_res", StringComparison.OrdinalIgnoreCase) ? 3 : 4;
                if (rank < bestRank)
                {
                    fallback = asset;
                    bestRank = rank;
                }
            }
            return fallback;
        }

        private IEnumerator DownloadWalkAsset(string url, Action<byte[]> success, Action<string> failure)
        {
            using (UnityWebRequest request = UnityWebRequest.Get(url))
            {
                request.downloadHandler = new DownloadHandlerBuffer();
                yield return request.SendWebRequest();
                if (request.result != UnityWebRequest.Result.Success)
                {
                    failure("Could not download the private world asset. Return to Worlds and try again.");
                    yield break;
                }
                byte[] bytes = request.downloadHandler.data;
                if (bytes == null || bytes.Length == 0 || bytes.Length > MaxWalkSplatBytes)
                {
                    failure("This world asset is empty or exceeds the 96 MB Quest 2 safety limit.");
                    yield break;
                }
                success(bytes);
            }
        }

        private bool BuildWalkableNavMesh(out Bounds worldBounds, out string error)
        {
            walkSources.Clear();
            MeshFilter[] filters = walkColliderRoot.GetComponentsInChildren<MeshFilter>(true);
            int vertices = 0;
            int triangles = 0;
            bool hasBounds = false;
            worldBounds = new Bounds();
            error = null;

            foreach (MeshFilter filter in filters)
            {
                if (filter == null || filter.sharedMesh == null) continue;
                Mesh mesh = filter.sharedMesh;
                vertices += mesh.vertexCount;
                triangles += (int)(mesh.GetIndexCount(0) / 3);
                if (vertices > MaxColliderVertices || triangles > MaxColliderTriangles)
                {
                    error = "The collision mesh is too detailed for the Quest 2 walk-mode limit.";
                    return false;
                }

                MeshCollider meshCollider = filter.GetComponent<MeshCollider>();
                if (meshCollider == null) meshCollider = filter.gameObject.AddComponent<MeshCollider>();
                meshCollider.sharedMesh = mesh;
                Renderer visual = filter.GetComponent<Renderer>();
                if (visual != null) visual.enabled = false;

                Bounds transformed = TransformMeshBounds(mesh.bounds, filter.transform.localToWorldMatrix);
                if (!hasBounds)
                {
                    worldBounds = transformed;
                    hasBounds = true;
                }
                else
                {
                    worldBounds.Encapsulate(transformed.min);
                    worldBounds.Encapsulate(transformed.max);
                }

                walkSources.Add(new NavMeshBuildSource
                {
                    shape = NavMeshBuildSourceShape.Mesh,
                    sourceObject = mesh,
                    transform = filter.transform.localToWorldMatrix,
                    area = 0
                });
            }

            if (walkSources.Count == 0 || triangles == 0)
            {
                error = "The GLB collider contains no walkable triangle-mesh surfaces.";
                return false;
            }

            worldBounds.Expand(new Vector3(1f, 1f, 1f));
            NavMeshBuildSettings settings = NavMesh.GetSettingsByID(0);
            settings.agentRadius = 0.23f;
            settings.agentHeight = 1.72f;
            settings.agentClimb = walkableStepHeight;
            settings.agentSlope = 42f;
            settings.overrideVoxelSize = true;
            settings.voxelSize = 0.06f;

            walkNavMesh = NavMeshBuilder.BuildNavMeshData(
                settings, walkSources, worldBounds, Vector3.zero, Quaternion.identity);
            if (walkNavMesh == null)
            {
                error = "Unity could not build a walkable boundary from this world's collision mesh.";
                return false;
            }
            walkNavMeshInstance = NavMesh.AddNavMeshData(walkNavMesh);
            if (!walkNavMeshInstance.valid)
            {
                error = "Unity could not activate this world's walkable surfaces.";
                return false;
            }
            return true;
        }

        private static Bounds TransformMeshBounds(Bounds localBounds, Matrix4x4 matrix)
        {
            Vector3 center = matrix.MultiplyPoint3x4(localBounds.center);
            Vector3 extents = localBounds.extents;
            Vector3 axisX = matrix.MultiplyVector(new Vector3(extents.x, 0f, 0f));
            Vector3 axisY = matrix.MultiplyVector(new Vector3(0f, extents.y, 0f));
            Vector3 axisZ = matrix.MultiplyVector(new Vector3(0f, 0f, extents.z));
            extents.x = Mathf.Abs(axisX.x) + Mathf.Abs(axisY.x) + Mathf.Abs(axisZ.x);
            extents.y = Mathf.Abs(axisX.y) + Mathf.Abs(axisY.y) + Mathf.Abs(axisZ.y);
            extents.z = Mathf.Abs(axisX.z) + Mathf.Abs(axisY.z) + Mathf.Abs(axisZ.z);
            return new Bounds(center, extents * 2f);
        }

        private void UpdateWalkableLocomotion()
        {
            if (!walkActive || walkController == null || !walkController.enabled) return;

            InputDevice left = InputDevices.GetDeviceAtXRNode(XRNode.LeftHand);
            Vector2 moveStick;
            Vector3 horizontalMove = Vector3.zero;
            if (left.isValid && left.TryGetFeatureValue(CommonUsages.primary2DAxis, out moveStick) &&
                moveStick.sqrMagnitude > 0.01f)
            {
                Vector3 forward = Vector3.ProjectOnPlane(headCamera.transform.forward, Vector3.up).normalized;
                if (forward.sqrMagnitude < 0.01f)
                    forward = Vector3.ProjectOnPlane(transform.forward, Vector3.up).normalized;
                Vector3 right = Vector3.Cross(Vector3.up, forward).normalized;
                horizontalMove = (forward * moveStick.y + right * moveStick.x) * walkSpeed;
            }

            InputDevice rightDevice = InputDevices.GetDeviceAtXRNode(XRNode.RightHand);
            Vector2 turnStick;
            if (rightDevice.isValid && rightDevice.TryGetFeatureValue(CommonUsages.primary2DAxis, out turnStick) &&
                Mathf.Abs(turnStick.x) > 0.75f)
            {
                int direction = turnStick.x > 0f ? 1 : -1;
                if (lastSnapTurnDirection == 0 && Time.unscaledTime >= nextSnapTurnTime)
                {
                    transform.RotateAround(headCamera.transform.position, Vector3.up, direction * snapTurnDegrees);
                    nextSnapTurnTime = Time.unscaledTime + 0.25f;
                }
                lastSnapTurnDirection = direction;
            }
            else
            {
                lastSnapTurnDirection = 0;
            }

            Vector3 position = transform.position;
            Vector3 floorPosition = position;
            Vector3 desiredFloor = floorPosition + horizontalMove * Time.deltaTime;
            bool insideWalkableArea = NavMesh.SamplePosition(desiredFloor, out NavMeshHit nextHit,
                0.5f, NavMesh.AllAreas);
            if (!insideWalkableArea)
                horizontalMove = Vector3.zero;
            else if (NavMesh.Raycast(floorPosition, nextHit.position, out NavMeshHit edgeHit, NavMesh.AllAreas))
            {
                Vector3 safeEdge = edgeHit.position - (nextHit.position - edgeHit.position).normalized * 0.06f;
                horizontalMove = (safeEdge - floorPosition) / Mathf.Max(Time.deltaTime, 0.001f);
            }

            if (walkController.isGrounded && verticalVelocity < 0f)
                verticalVelocity = -2f;
            verticalVelocity += Physics.gravity.y * Time.deltaTime;
            walkController.Move((horizontalMove + Vector3.up * verticalVelocity) * Time.deltaTime);
        }

        private void StopWalkableWorld()
        {
            walkActive = false;
            if (walkNavMeshInstance.valid) walkNavMeshInstance.Remove();
            walkNavMeshInstance = default(NavMeshDataInstance);
            if (walkNavMesh != null)
            {
                Destroy(walkNavMesh);
                walkNavMesh = null;
            }
            if (walkWorldRoot != null)
            {
                Destroy(walkWorldRoot);
                walkWorldRoot = null;
            }
            walkColliderRoot = null;
            if (walkColliderImport != null)
            {
                walkColliderImport.Dispose();
                walkColliderImport = null;
            }
            if (walkController != null)
            {
                walkController.enabled = false;
                if (ownsWalkController) Destroy(walkController);
                walkController = null;
                ownsWalkController = false;
            }
            if (walkOriginalTransformCaptured)
                transform.SetPositionAndRotation(walkOriginalPosition, walkOriginalRotation);
            walkOriginalTransformCaptured = false;
            verticalVelocity = 0f;
        }
    }
}
#endif
