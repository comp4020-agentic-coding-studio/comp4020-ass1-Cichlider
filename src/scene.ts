import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { COLORS, CAMERA } from "./config.ts";

export interface SceneHandles {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  resize: () => void;
}

export function createScene(container: HTMLElement): SceneHandles {
  const scene = new THREE.Scene();
  // A bright cool-gray studio backdrop, not a black void — the case must read
  // as brighter/darker THAN something, and pure black behind it erases that
  // contrast entirely. A slight fog toward the same gray keeps distant edges
  // soft rather than adding false depth-cueing darkness.
  scene.background = new THREE.Color(COLORS.background);
  // Far bound pushed out for the queue overview shot, which sits ~25 units
  // out along the shared view direction (see config.ts QUEUE.overviewDistance).
  scene.fog = new THREE.Fog(COLORS.background, 16, 42);

  const camera = new THREE.PerspectiveCamera(CAMERA.fov, 1, CAMERA.near, CAMERA.far);
  camera.position.set(...CAMERA.assembled.position);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  // ACES filmic tone mapping + a touch of exposure gives the product-shot
  // "clean highlights, no blown whites" look without manually clamping every
  // light's intensity, and keeps sRGB output correct for the light backdrop.
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.target.set(...CAMERA.assembled.target);
  // Bounds widened for the museum queue: single-part focus shots sit close
  // (main.ts computeFocusFor clamps its live bounding-box distance to this
  // very range) and the overview sits far (~25 units, QUEUE.overviewDistance)
  // — flyCamera drives the camera directly, but OrbitControls.update() still
  // clamps to these every frame regardless of controls.enabled, so both
  // scripted extremes must fit inside them.
  controls.minDistance = 2;
  controls.maxDistance = 34;
  controls.maxPolarAngle = Math.PI * 0.85;

  // Product-photography rig: one large soft key light from front-top, a
  // gentle fill so the shadow side never drops to black, a rim/back light to
  // separate the case edges and glass from the backdrop, plus hemisphere +
  // ambient so the interior (behind the glass, inside the frame) never falls
  // into pure black even where no direct light reaches it.
  scene.add(new THREE.HemisphereLight(0xf3f6f8, COLORS.backgroundGround, 0.75));
  scene.add(new THREE.AmbientLight(0xffffff, 0.35));

  const key = new THREE.DirectionalLight(0xffffff, 2.6);
  key.position.set(6, 10, 8);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -8;
  key.shadow.camera.right = 8;
  key.shadow.camera.top = 8;
  key.shadow.camera.bottom = -8;
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 30;
  key.shadow.bias = -0.0015;
  scene.add(key);

  const fill = new THREE.DirectionalLight(0xdce8f0, 0.9);
  fill.position.set(-7, 4, 5);
  scene.add(fill);

  const rim = new THREE.DirectionalLight(0xffffff, 1.1);
  rim.position.set(-4, 6, -9);
  scene.add(rim);

  // A faint cyan kicker keeps the accent colour present in the lighting
  // without letting it wash the whole case in neon — low intensity, aimed
  // from behind so it only catches edges, not full faces.
  const accentKicker = new THREE.PointLight(COLORS.accent, 0.35, 14);
  accentKicker.position.set(2, 1, -6);
  scene.add(accentKicker);

  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(14, 48),
    new THREE.MeshStandardMaterial({ color: COLORS.backgroundGround, roughness: 0.95, metalness: 0 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -2.45; // just below the case's feet (LAYOUT.case.hy=2.3 + wall + foot radius)
  ground.receiveShadow = true;
  scene.add(ground);

  function resize() {
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (width === 0 || height === 0) return;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
  }

  return { scene, camera, renderer, controls, resize };
}
