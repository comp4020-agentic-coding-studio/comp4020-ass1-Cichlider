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
  scene.background = new THREE.Color(COLORS.background);
  scene.fog = new THREE.Fog(COLORS.background, 14, 26);

  const camera = new THREE.PerspectiveCamera(CAMERA.fov, 1, CAMERA.near, CAMERA.far);
  camera.position.set(...CAMERA.assembled.position);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.target.set(...CAMERA.assembled.target);
  controls.minDistance = 4;
  controls.maxDistance = 22;
  controls.maxPolarAngle = Math.PI * 0.85;

  scene.add(new THREE.AmbientLight(0xffffff, 0.45));
  const key = new THREE.DirectionalLight(0xffffff, 1.1);
  key.position.set(6, 9, 7);
  scene.add(key);
  const rim = new THREE.DirectionalLight(COLORS.accent, 0.5);
  rim.position.set(-6, 3, -8);
  scene.add(rim);
  const fill = new THREE.PointLight(COLORS.accent, 0.6, 20);
  fill.position.set(0, -3, 4);
  scene.add(fill);

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
