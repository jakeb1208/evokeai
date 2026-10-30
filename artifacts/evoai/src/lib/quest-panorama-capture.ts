import * as THREE from "three";
import type { SparkRenderer } from "@sparkjsdev/spark";
import type { QuestPanoramaViewpoint } from "@workspace/api-client-react";

export type QuestViewpointControls = {
  getViewpoint: () => QuestPanoramaViewpoint;
  setViewpoint: (point: QuestPanoramaViewpoint) => void;
  setHeight: (height: number) => void;
  reset: () => void;
  capture: () => Promise<{ blob: Blob; viewpoint: QuestPanoramaViewpoint }>;
};

/** North is the top row, the image center is forward (-Z), longitude increases right. */
export const panoramaFragmentShader = `
  uniform samplerCube cubeMap;
  uniform float heading;
  varying vec2 vUv;
  void main() {
    float longitude = (vUv.x - 0.5) * 6.28318530718;
    float latitude = (vUv.y - 0.5) * 3.14159265359;
    vec3 direction = vec3(sin(longitude) * cos(latitude), sin(latitude), -cos(longitude) * cos(latitude));
    float c = cos(heading), s = sin(heading);
    direction = vec3(c * direction.x + s * direction.z, direction.y, -s * direction.x + c * direction.z);
    gl_FragColor = textureCube(cubeMap, direction);
    #include <colorspace_fragment>
  }
`;

export async function captureQuestPanorama(
  renderer: THREE.WebGLRenderer, spark: SparkRenderer, scene: THREE.Scene,
  viewpoint: QuestPanoramaViewpoint,
): Promise<Blob> {
  const width = 4096, height = 2048;
  if (renderer.capabilities.maxTextureSize < width) {
    throw new Error("This device cannot capture a 4096-pixel panorama. Use a desktop browser with WebGL enabled.");
  }
  const previousTarget = renderer.getRenderTarget();
  const previousViewport = renderer.getViewport(new THREE.Vector4());
  const previousScissor = renderer.getScissor(new THREE.Vector4());
  const previousScissorTest = renderer.getScissorTest();
  const xrEnabled = renderer.xr.enabled;
  const target = new THREE.WebGLRenderTarget(width, height, {
    type: THREE.UnsignedByteType, format: THREE.RGBAFormat,
    colorSpace: THREE.SRGBColorSpace, depthBuffer: false, stencilBuffer: false,
  });
  const material = new THREE.ShaderMaterial({
    uniforms: { cubeMap: { value: null }, heading: { value: viewpoint.yaw } },
    vertexShader: "varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }",
    fragmentShader: panoramaFragmentShader,
    depthTest: false, depthWrite: false, toneMapped: false,
  });
  const geometry = new THREE.PlaneGeometry(2, 2);
  try {
    renderer.xr.enabled = false;
    const cubeMap = await spark.renderCubeMap({
      scene, worldCenter: new THREE.Vector3(viewpoint.x, viewpoint.y, viewpoint.z),
      size: 1024, near: 0.01, far: 1000, hideObjects: [], update: true, filter: false,
    });
    material.uniforms.cubeMap.value = cubeMap;
    const conversion = new THREE.Scene();
    conversion.add(new THREE.Mesh(geometry, material));
    renderer.setRenderTarget(target);
    renderer.setScissorTest(false);
    renderer.render(conversion, new THREE.Camera());
    const pixels = new Uint8Array(width * height * 4);
    await renderer.readRenderTargetPixelsAsync(target, 0, 0, width, height, pixels);
    const canvas = document.createElement("canvas");
    canvas.width = width; canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not prepare the panorama image.");
    const image = context.createImageData(width, height);
    // GPU row zero is the bottom; JPEG row zero must be the north/top edge.
    for (let row = 0; row < height; row++) {
      image.data.set(pixels.subarray(row * width * 4, (row + 1) * width * 4),
        (height - row - 1) * width * 4);
    }
    context.putImageData(image, 0, 0);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((result) => result ? resolve(result) : reject(new Error("Could not encode the panorama.")),
        "image/jpeg", 0.95));
    if (blob.size > 8 * 1024 * 1024) throw new Error("The panorama exceeded the 8 MiB limit. Try another viewpoint.");
    return blob;
  } finally {
    renderer.setRenderTarget(previousTarget);
    renderer.setViewport(previousViewport);
    renderer.setScissor(previousScissor);
    renderer.setScissorTest(previousScissorTest);
    renderer.xr.enabled = xrEnabled;
    geometry.dispose(); material.dispose(); target.dispose();
  }
}
