import * as THREE from "three";
import type { PartDef } from "./parts-data.ts";

export interface InteractionCallbacks {
  onHover: (part: PartDef | null) => void;
  onSelect: (part: PartDef) => void;
}

function isTransparentHit(object: THREE.Object3D): boolean {
  const mesh = object as THREE.Mesh;
  const material = mesh.material as THREE.Material | undefined;
  // Only a material marked see-through *by design* (the glass panel) should
  // ever lose to a solid hit — a material that's merely dimmed for hover/
  // focus (also `transparent: true` while dimmed) must not count here.
  return Boolean(material?.userData.isSeeThrough);
}

// A raycaster hit-tests geometry, not what's visually opaque — a transparent
// hit (the glass panel) must never win over a solid part along the same ray.
// Reused from the previous prototype's fixed bug (see CLAUDE.md).
function firstSolidHit(hits: THREE.Intersection[]): THREE.Intersection | undefined {
  return hits.find((h) => !isTransparentHit(h.object)) ?? hits[0];
}

export function setupInteraction(
  renderer: THREE.WebGLRenderer,
  camera: THREE.PerspectiveCamera,
  pickables: THREE.Object3D[],
  callbacks: InteractionCallbacks,
  isPickingEnabled: () => boolean,
): () => void {
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let lastHoveredId: string | null = null;

  function partAt(clientX: number, clientY: number): PartDef | null {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(pickables, true);
    const hit = firstSolidHit(hits);
    return (hit?.object.userData.part as PartDef | undefined) ?? null;
  }

  function onMove(event: PointerEvent) {
    if (!isPickingEnabled()) return;
    const part = partAt(event.clientX, event.clientY);
    const id = part?.id ?? null;
    if (id !== lastHoveredId) {
      lastHoveredId = id;
      callbacks.onHover(part);
    }
  }

  function onClick(event: MouseEvent) {
    if (!isPickingEnabled()) return;
    const part = partAt(event.clientX, event.clientY);
    if (part) callbacks.onSelect(part);
  }

  function onLeave() {
    if (lastHoveredId !== null) {
      lastHoveredId = null;
      callbacks.onHover(null);
    }
  }

  renderer.domElement.addEventListener("pointermove", onMove);
  renderer.domElement.addEventListener("click", onClick);
  renderer.domElement.addEventListener("pointerleave", onLeave);

  return () => {
    renderer.domElement.removeEventListener("pointermove", onMove);
    renderer.domElement.removeEventListener("click", onClick);
    renderer.domElement.removeEventListener("pointerleave", onLeave);
  };
}
