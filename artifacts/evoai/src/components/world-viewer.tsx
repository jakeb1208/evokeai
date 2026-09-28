import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { SparkRenderer, SplatMesh } from "@sparkjsdev/spark";

type WorldAsset = {
  kind: string;
  format: string;
  quality?: string;
  signed_url: string;
};

type SavedWorld = {
  id: string;
  display_name: string;
  marble_world_id: string | null;
  marble_world: {
    assets?: {
      splats?: { semantics_metadata?: { ground_plane_offset?: number } | null } | null;
    };
  } | null;
  assets: WorldAsset[];
};

type WorldViewerProps = {
  worldId: string;
  accessToken: string;
  onBack: () => void;
};

function getErrorMessage(payload: unknown, fallback: string) {
  return typeof payload === "object" &&
    payload !== null &&
    "error" in payload &&
    typeof payload.error === "string"
    ? payload.error
    : fallback;
}

export function WorldViewer({ worldId, accessToken, onBack }: WorldViewerProps) {
  const [world, setWorld] = useState<SavedWorld | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [splatReady, setSplatReady] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const canvasHostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void fetch(`/api/worlds/${encodeURIComponent(worldId)}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then(async (response) => {
        const payload = (await response.json()) as { world?: SavedWorld; error?: string };
        if (!response.ok || !payload.world) {
          throw new Error(getErrorMessage(payload, "Could not load this saved world."));
        }
        if (!cancelled) setWorld(payload.world);
      })
      .catch((requestError) => {
        if (!cancelled) setError(requestError instanceof Error ? requestError.message : "Could not load this world.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, worldId]);

  useEffect(() => {
    if (!world || !canvasHostRef.current) return;
    const host = canvasHostRef.current;
    const splatAsset =
      world.assets.find((asset) => asset.kind === "splat" && asset.quality === "full_res") ??
      world.assets.find((asset) => asset.kind === "splat" && asset.quality === "500k") ??
      world.assets.find((asset) => asset.kind === "splat");
    if (!splatAsset) {
      setError("This saved world does not have a browser-viewable SPZ asset.");
      return;
    }

    let disposed = false;
    setSplatReady(false);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(65, 1, 0.01, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x10251f, 1);
    host.appendChild(renderer.domElement);

    const spark = new SparkRenderer({ renderer });
    scene.add(spark);
    const splat = new SplatMesh({
      url: splatAsset.signed_url,
      onLoad: () => {
        if (!disposed) setSplatReady(true);
      },
    });
    void splat.initialized.catch(() => {
      if (!disposed) setError("The saved SPZ world could not be rendered in this browser.");
    });
    scene.add(splat);

    const groundOffset =
      world.marble_world?.assets?.splats?.semantics_metadata?.ground_plane_offset ?? 0;
    camera.position.set(0, groundOffset + 1.65, 4);
    camera.rotation.order = "YXZ";
    let yaw = Math.PI;
    let pitch = 0;
    const keys = new Set<string>();
    const clock = new THREE.Clock();

    const resize = () => {
      const width = host.clientWidth || window.innerWidth;
      const height = host.clientHeight || window.innerHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.code)) {
        event.preventDefault();
        keys.add(event.code);
      }
    };
    const onKeyUp = (event: KeyboardEvent) => keys.delete(event.code);
    const onMouseMove = (event: MouseEvent) => {
      if (document.pointerLockElement !== renderer.domElement) return;
      yaw -= event.movementX * 0.0024;
      pitch = THREE.MathUtils.clamp(pitch - event.movementY * 0.0024, -1.35, 1.35);
    };
    const onPointerLockChange = () => setIsLocked(document.pointerLockElement === renderer.domElement);
    const onCanvasClick = () => void renderer.domElement.requestPointerLock();
    const animate = () => {
      if (disposed) return;
      const delta = Math.min(clock.getDelta(), 0.05);
      camera.rotation.set(pitch, yaw, 0);
      const forward = new THREE.Vector3(0, 0, -1).applyEuler(camera.rotation);
      const right = new THREE.Vector3(1, 0, 0).applyEuler(camera.rotation);
      forward.y = 0;
      right.y = 0;
      forward.normalize();
      right.normalize();
      const direction = new THREE.Vector3();
      if (keys.has("KeyW") || keys.has("ArrowUp")) direction.add(forward);
      if (keys.has("KeyS") || keys.has("ArrowDown")) direction.sub(forward);
      if (keys.has("KeyD") || keys.has("ArrowRight")) direction.add(right);
      if (keys.has("KeyA") || keys.has("ArrowLeft")) direction.sub(right);
      if (direction.lengthSq() > 0) {
        direction.normalize().multiplyScalar(delta * 3.5);
        camera.position.add(direction);
      }
      camera.position.y = Math.max(camera.position.y, groundOffset + 1.65);
      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    };

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("mousemove", onMouseMove);
    document.addEventListener("pointerlockchange", onPointerLockChange);
    renderer.domElement.addEventListener("click", onCanvasClick);
    requestAnimationFrame(animate);

    return () => {
      disposed = true;
      if (document.pointerLockElement === renderer.domElement) void document.exitPointerLock();
      window.removeEventListener("resize", resize);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("pointerlockchange", onPointerLockChange);
      renderer.domElement.removeEventListener("click", onCanvasClick);
      splat.dispose();
      spark.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [world]);

  if (loading) {
    return (
      <main className="world-viewer world-viewer-state">
        <div className="world-loader" aria-label="Loading saved world" />
        <p className="evoke-eyebrow">loading saved world</p>
        <h1>Preparing your world.</h1>
        <button className="viewer-back-button" type="button" onClick={onBack}>Return to My Worlds</button>
      </main>
    );
  }

  if (error || !world) {
    return (
      <main className="world-viewer world-viewer-state">
        <p className="evoke-eyebrow">world unavailable</p>
        <h1>We could not open this world.</h1>
        <p className="viewer-error" role="alert">{error || "The saved world was not found."}</p>
        <button className="viewer-back-button" type="button" onClick={onBack}>Return to My Worlds</button>
      </main>
    );
  }

  return (
    <main className="world-viewer">
      <div ref={canvasHostRef} className="world-canvas" aria-label={`${world.display_name} world viewer`} />
      {!splatReady ? (
        <div className="viewer-loading-overlay" role="status">
          <div className="world-loader" aria-hidden="true" />
          <span>Loading your saved world…</span>
        </div>
      ) : null}
      <div className="viewer-hud">
        <button className="viewer-back-button" type="button" onClick={onBack}>← My Worlds</button>
        <div className="viewer-title">
          <span className="evoke-eyebrow">saved world</span>
          <strong>{world.display_name}</strong>
        </div>
        <div className="viewer-controls">
          {isLocked ? "WASD to move · mouse to look · Esc to release" : "Click the world to look around"}
        </div>
      </div>
    </main>
  );
}