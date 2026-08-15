import gsap from "gsap";
import * as THREE from "three";
import type { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { DURATION, REDUCED_MOTION } from "./config.ts";

// Only one camera move is ever "in flight". Starting a new one kills
// whatever tween is still running and resolves ITS promise with `false`
// (superseded) before the new tween starts — without this, two overlapping
// gsap timelines can both eventually fire onComplete, and the OLDER call's
// caller would apply its state transition/UI update after the camera has
// already been sent somewhere else by a newer call (the "blank part" race:
// panel opens for a part the camera isn't actually pointed at any more).
let activeMove: { tl: gsap.core.Timeline; resolve: (completed: boolean) => void } | null = null;

// Every scripted camera move goes through here so OrbitControls and GSAP
// never fight over the same properties: controls are disabled for the
// duration of the tween and handed back afterwards. Resolves `true` if this
// move ran to completion, `false` if a later flyCamera call interrupted it —
// callers must check this and skip their post-move state change when false,
// since only the latest request's continuation should ever apply.
export function flyCamera(
  camera: THREE.PerspectiveCamera,
  controls: OrbitControls,
  position: THREE.Vector3,
  lookAt: THREE.Vector3,
  duration = DURATION.cameraMove,
): Promise<boolean> {
  if (activeMove) {
    activeMove.tl.kill();
    activeMove.resolve(false);
    activeMove = null;
  }
  controls.enabled = false;
  const d = REDUCED_MOTION ? Math.min(duration, 0.18) : duration;
  return new Promise((resolve) => {
    const tl = gsap.timeline({
      onComplete: () => {
        activeMove = null;
        controls.enabled = true;
        resolve(true);
      },
    });
    activeMove = { tl, resolve };
    tl.to(camera.position, { x: position.x, y: position.y, z: position.z, duration: d, ease: "power2.inOut" }, 0);
    tl.to(controls.target, { x: lookAt.x, y: lookAt.y, z: lookAt.z, duration: d, ease: "power2.inOut" }, 0);
  });
}
