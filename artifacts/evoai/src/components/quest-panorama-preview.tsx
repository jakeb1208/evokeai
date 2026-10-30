import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

/** A look-around preview, not a stretched flat equirectangular thumbnail. */
export function QuestPanoramaPreview({ url }: { url: string }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    setError("");
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: false }); }
    catch { setError("The 360° preview could not start. Retake using a desktop browser with WebGL enabled."); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    host.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 10);
    camera.rotation.order = "YXZ";
    let disposed = false, yaw = 0, pitch = 0, drag: { x: number; y: number } | null = null;
    let texture: THREE.Texture | undefined;
    const geometry = new THREE.SphereGeometry(2, 48, 24);
    const material = new THREE.ShaderMaterial({
      side: THREE.BackSide, toneMapped: false,
      uniforms: { panorama: { value: null } },
      vertexShader: "varying vec3 direction; void main() { direction = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: `
        uniform sampler2D panorama; varying vec3 direction;
        void main() {
          vec3 d = normalize(direction);
          vec2 uv = vec2(0.5 + atan(d.x, -d.z) / 6.28318530718, 0.5 + asin(clamp(d.y, -1.0, 1.0)) / 3.14159265359);
          gl_FragColor = texture2D(panorama, uv);
          #include <colorspace_fragment>
        }`,
    });
    scene.add(new THREE.Mesh(geometry, material));
    const draw = () => {
      if (disposed) return;
      camera.rotation.set(pitch, yaw, 0);
      renderer.render(scene, camera);
    };
    new THREE.TextureLoader().load(url, (loaded) => {
      if (disposed) { loaded.dispose(); return; }
      texture = loaded; texture.colorSpace = THREE.SRGBColorSpace;
      texture.wrapS = THREE.RepeatWrapping;
      material.uniforms.panorama.value = texture; draw();
    }, undefined, () => {
      if (!disposed) setError("The captured image could not be previewed. Retake before saving.");
    });
    const resize = new ResizeObserver(() => {
      const width = host.clientWidth || 320, height = host.clientHeight || 180;
      renderer.setSize(width, height, false);
      camera.aspect = width / height; camera.updateProjectionMatrix(); draw();
    });
    resize.observe(host);
    const down = (event: PointerEvent) => {
      drag = { x: event.clientX, y: event.clientY };
      renderer.domElement.setPointerCapture(event.pointerId);
    };
    const move = (event: PointerEvent) => {
      if (!drag) return;
      yaw -= (event.clientX - drag.x) * 0.005;
      pitch = THREE.MathUtils.clamp(pitch - (event.clientY - drag.y) * 0.005, -1.5, 1.5);
      drag = { x: event.clientX, y: event.clientY }; draw();
    };
    const up = () => { drag = null; };
    const key = (event: KeyboardEvent) => {
      if (!event.key.startsWith("Arrow")) return;
      event.preventDefault();
      if (event.key === "ArrowLeft") yaw += 0.1;
      if (event.key === "ArrowRight") yaw -= 0.1;
      if (event.key === "ArrowUp") pitch = Math.min(1.5, pitch + 0.1);
      if (event.key === "ArrowDown") pitch = Math.max(-1.5, pitch - 0.1);
      draw();
    };
    renderer.domElement.addEventListener("pointerdown", down);
    renderer.domElement.addEventListener("pointermove", move);
    renderer.domElement.addEventListener("pointerup", up);
    renderer.domElement.addEventListener("pointercancel", up);
    host.addEventListener("keydown", key);
    return () => {
      disposed = true; resize.disconnect(); host.removeEventListener("keydown", key);
      renderer.domElement.removeEventListener("pointerdown", down);
      renderer.domElement.removeEventListener("pointermove", move);
      renderer.domElement.removeEventListener("pointerup", up);
      renderer.domElement.removeEventListener("pointercancel", up);
      texture?.dispose(); geometry.dispose(); material.dispose(); renderer.dispose();
      renderer.domElement.remove();
    };
  }, [url]);
  return <><div className="quest-panorama-preview" ref={hostRef} tabIndex={0}
    aria-label="360 degree Quest preview. Drag or use arrow keys to look around." />
    {error ? <p role="alert">{error}</p> : null}</>;
}
