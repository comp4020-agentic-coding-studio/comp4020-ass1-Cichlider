import gsap from "gsap";
import * as THREE from "three";
import { flyCamera } from "./src/camera-rig.ts";
import { CAMERA, AUTO_ROTATE_SPEED, DURATION, EXPLODE_DISTANCE, REDUCED_MOTION } from "./src/config.ts";
import { setupInteraction } from "./src/interaction.ts";
import { buildPart, setPartDimmed } from "./src/model.ts";
import { PARTS, type PartDef } from "./src/parts-data.ts";
import { createScene } from "./src/scene.ts";
import { SceneStateMachine } from "./src/state.ts";
import { setupUI } from "./src/ui.ts";

const container = document.querySelector<HTMLDivElement>('[data-testid="scene"]');
if (!container) throw new Error('missing [data-testid="scene"]');

const { scene, camera, renderer, controls, resize } = createScene(container);
const ui = setupUI();
const sm = new SceneStateMachine();

const computer = new THREE.Group();
const groupsById = new Map<string, THREE.Group>();
for (const part of PARTS) {
  const group = buildPart(part);
  groupsById.set(part.id, group);
  computer.add(group);
}
scene.add(computer);

const maxOrder = Math.max(...PARTS.map((p) => p.order));
let hoveredGroup: THREE.Group | null = null;
let currentPartId: string | null = null;

function refreshDimState() {
  const highlightId = hoveredGroup ? (hoveredGroup.userData.part as PartDef).id : currentPartId;
  for (const [id, group] of groupsById) {
    setPartDimmed(group, highlightId !== null && id !== highlightId);
  }
}

function animatePositions(direction: "out" | "in"): Promise<void> {
  return new Promise((resolve) => {
    const tl = gsap.timeline({ onComplete: resolve });
    for (const part of PARTS) {
      const group = groupsById.get(part.id);
      if (!group) continue;
      const assembled = part.assembled;
      const exploded = assembled.clone().addScaledVector(part.explodeDir, EXPLODE_DISTANCE);
      const to = direction === "out" ? exploded : assembled;
      // Explode outward glass-first, case-last (real teardown order); reverse
      // that for reassembly so the frame goes back together before the
      // panel closes over it, matching real assembly direction.
      const stagger = direction === "out" ? part.order : maxOrder - part.order;
      const delay = REDUCED_MOTION ? 0 : stagger * DURATION.explodeStagger;
      const duration = REDUCED_MOTION ? 0.2 : DURATION.explodePartDuration;
      tl.to(group.position, { x: to.x, y: to.y, z: to.z, duration, ease: "power2.inOut" }, delay);
    }
  });
}

function focusPositionFor(group: THREE.Group) {
  const target = new THREE.Vector3();
  group.getWorldPosition(target);
  const position = target.clone().add(new THREE.Vector3(1.7, 1.15, 2.5));
  return { position, target };
}

async function explode() {
  if (!sm.is("assembled")) return;
  sm.transition("opening");
  ui.setExploded(true);
  await Promise.all([
    animatePositions("out"),
    flyCamera(
      camera,
      controls,
      new THREE.Vector3(...CAMERA.exploded.position),
      new THREE.Vector3(...CAMERA.exploded.target),
    ),
  ]);
  sm.transition("exploded");
}

async function reassemble() {
  if (!sm.is("exploded") && !sm.is("focusing") && !sm.is("detail")) return;
  if (ui.isPanelOpen()) ui.hidePanel();
  currentPartId = null;
  hoveredGroup = null;
  refreshDimState();
  if (!sm.is("exploded")) sm.transition("exploded");
  sm.transition("reassembling");
  ui.setExploded(false);
  await Promise.all([
    animatePositions("in"),
    flyCamera(
      camera,
      controls,
      new THREE.Vector3(...CAMERA.assembled.position),
      new THREE.Vector3(...CAMERA.assembled.target),
    ),
  ]);
  sm.transition("assembled");
}

async function selectPart(part: PartDef) {
  if (sm.is("assembled")) await explode();
  if (!sm.is("exploded") && !sm.is("detail")) return;
  const group = groupsById.get(part.id);
  if (!group) return;
  sm.transition("focusing");
  currentPartId = part.id;
  refreshDimState();
  const { position, target } = focusPositionFor(group);
  await flyCamera(camera, controls, position, target);
  sm.transition("detail");
  ui.showPanel(part);
}

async function closeDetail() {
  if (!sm.is("detail") && !sm.is("focusing")) return;
  currentPartId = null;
  refreshDimState();
  await flyCamera(
    camera,
    controls,
    new THREE.Vector3(...CAMERA.exploded.position),
    new THREE.Vector3(...CAMERA.exploded.target),
  );
  sm.transition("exploded");
}

ui.onExplodeToggle(() => {
  if (sm.is("assembled")) void explode();
  else void reassemble();
});

ui.onPartChosen((part) => void selectPart(part));
ui.onPanelClose(() => void closeDetail());
ui.onEscape(() => void closeDetail());
ui.onPanelStep((direction) => {
  if (!currentPartId) return;
  const idx = PARTS.findIndex((p) => p.id === currentPartId);
  const next = PARTS[(idx + direction + PARTS.length) % PARTS.length];
  void selectPart(next);
});

setupInteraction(
  renderer,
  camera,
  [...groupsById.values()],
  {
    onHover(part) {
      hoveredGroup = part ? (groupsById.get(part.id) ?? null) : null;
      if (!hoveredGroup) ui.setHoverLabel(null, 0, 0);
      refreshDimState();
    },
    onSelect(part) {
      void selectPart(part);
    },
  },
  () => sm.is("exploded", "focusing", "detail"),
);

ui.setExploded(false);
window.addEventListener("resize", resize);
resize();

const clock = new THREE.Clock();
const labelWorldPos = new THREE.Vector3();

function animate() {
  requestAnimationFrame(animate);
  if (document.hidden) return;
  const dt = clock.getDelta();
  if (sm.is("assembled") && !REDUCED_MOTION) {
    computer.rotation.y += AUTO_ROTATE_SPEED * dt;
  }
  controls.update();
  if (hoveredGroup) {
    hoveredGroup.getWorldPosition(labelWorldPos);
    labelWorldPos.project(camera);
    const x = (labelWorldPos.x * 0.5 + 0.5) * renderer.domElement.clientWidth;
    const y = (-labelWorldPos.y * 0.5 + 0.5) * renderer.domElement.clientHeight;
    ui.setHoverLabel((hoveredGroup.userData.part as PartDef).name, x, y);
  }
  renderer.render(scene, camera);
}
animate();
