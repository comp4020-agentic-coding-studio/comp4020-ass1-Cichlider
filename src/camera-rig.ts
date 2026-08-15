import gsap from "gsap";
import * as THREE from "three";
import type { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { DURATION, REDUCED_MOTION } from "./config.ts";

// Every scripted camera move goes through here so OrbitControls and GSAP
// never fight over the same properties: controls are disabled for the
// duration of the tween and handed back afterwards.
export function flyCamera(
  camera: THREE.PerspectiveCamera,
  controls: OrbitControls,
  position: THREE.Vector3,
  lookAt: THREE.Vector3,
  duration = DURATION.cameraMove,
): Promise<void> {
  return new Promise((resolve) => {
    controls.enabled = false;
    const d = REDUCED_MOTION ? Math.min(duration, 0.18) : duration;
    const tl = gsap.timeline({
      onComplete: () => {
        controls.enabled = true;
        resolve();
      },
    });
    tl.to(camera.position, { x: position.x, y: position.y, z: position.z, duration: d, ease: "power2.inOut" }, 0);
    tl.to(controls.target, { x: lookAt.x, y: lookAt.y, z: lookAt.z, duration: d, ease: "power2.inOut" }, 0);
  });
}
