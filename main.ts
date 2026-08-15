import gsap from "gsap";
import * as THREE from "three";
import { flyCamera } from "./src/camera-rig.ts";
import { CAMERA, AUTO_ROTATE_SPEED, DURATION, QUEUE, REDUCED_MOTION } from "./src/config.ts";
import { setupInteraction } from "./src/interaction.ts";
import { buildPart, setPartDimmed } from "./src/model.ts";
import { PARTS, PARTS_BY_QUEUE, QUEUE_VIEW_DIR, queuePosition, QUEUE_OVERVIEW, type PartDef } from "./src/parts-data.ts";
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
// Every part is scaled, once, to a shared visual size (QUEUE.targetSize)
// before ever joining the queue — this is what makes "unified display
// height" real rather than just an offset trick: a full case and a bare CPU
// die read at roughly the same size once queued, so computeFocusFor's live
// bounding-box framing lands on a comparable distance for either. The scale
// factor comes from each part's OWN measured geometry (not a guess), taken
// while it briefly sits at the origin so position doesn't skew the bounds.
const queueScaleById = new Map<string, number>();
const measureBox = new THREE.Box3();
const measureSize = new THREE.Vector3();
for (const part of PARTS) {
  const group = buildPart(part);
  const assembledPos = group.position.clone();
  group.position.set(0, 0, 0);
  group.updateMatrixWorld(true);
  measureBox.setFromObject(group);
  measureBox.getSize(measureSize);
  const naturalSize = Math.max(measureSize.x, measureSize.y, measureSize.z, 0.01);
  queueScaleById.set(part.id, QUEUE.targetSize / naturalSize);
  group.position.copy(assembledPos);
  group.updateMatrixWorld(true);
  groupsById.set(part.id, group);
  computer.add(group);
}
scene.add(computer);

const maxOrder = Math.max(...PARTS.map((p) => p.order));
let hoveredGroup: THREE.Group | null = null;
let currentPartId: string | null = null;

// Computed fresh from the part's ACTUAL current world-space bounding box at
// the moment of selection (never a fixed/hardcoded per-part number) — this
// is what stays correct after repeated select/reassemble/resize cycles,
// since it's derived from static state each time rather than accumulated.
// Also accounts for the detail panel's occupied width, so the part is
// framed in the middle of the visible strip beside the panel rather than
// the center of the whole window (see updateViewOffset below for the
// render-side half of this — setViewOffset actually shifts what's drawn
// where; this only has to pick a distance that keeps the part inside
// whichever FOV — vertical or the panel-narrowed horizontal — is tighter).
function computeFocusFor(group: THREE.Group): { position: THREE.Vector3; target: THREE.Vector3 } {
  const box = new THREE.Box3().setFromObject(group);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const radius = Math.max(size.length() / 2, 0.05);

  const canvasW = renderer.domElement.clientWidth || window.innerWidth;
  const canvasH = renderer.domElement.clientHeight || window.innerHeight;
  const panelWidth = ui.getPanelOverlayWidth();
  const availableW = Math.max(canvasW - panelWidth, canvasW * 0.25);
  const availableAspect = availableW / canvasH;

  const vFov = THREE.MathUtils.degToRad(camera.fov);
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * availableAspect);
  const limitingHalfFov = Math.min(vFov, hFov) / 2;
  const margin = 1.4; // comfortable clearance around the part, not a tight crop
  const rawDistance = radius / Math.sin(limitingHalfFov) * margin;
  const distance = THREE.MathUtils.clamp(rawDistance, controls.minDistance + 0.2, controls.maxDistance - 0.2);

  const position = center.clone().addScaledVector(QUEUE_VIEW_DIR, distance);
  return { position, target: center };
}

// A standard "look at" camera always renders its target dead-center of the
// full canvas, regardless of the detail panel drawn on top of it — so on
// narrower windows the focused part ends up centered behind the panel. This
// shifts the camera's optical center left by half the panel's width via
// THREE's view-offset crop, so the target instead lands centered in the
// visible strip to the panel's left. Cleared outside focusing/detail (or on
// the mobile bottom-drawer layout, where the panel doesn't occlude
// horizontally) so it never leaks into the overview/assembled shots.
let lastViewOffset = { w: -1, h: -1, panelWidth: -1 };
function updateViewOffset() {
  const w = renderer.domElement.clientWidth;
  const h = renderer.domElement.clientHeight;
  const panelWidth = sm.is("focusing", "detail") ? ui.getPanelOverlayWidth() : 0;
  if (w === lastViewOffset.w && h === lastViewOffset.h && panelWidth === lastViewOffset.panelWidth) return;
  lastViewOffset = { w, h, panelWidth };
  if (panelWidth > 0 && w > 0 && h > 0) {
    camera.setViewOffset(w + panelWidth, h, panelWidth, 0, w, h);
  } else {
    camera.clearViewOffset();
  }
}

function refreshDimState() {
  const highlightId = hoveredGroup ? (hoveredGroup.userData.part as PartDef).id : currentPartId;
  for (const [id, group] of groupsById) {
    setPartDimmed(group, highlightId !== null && id !== highlightId);
  }
}

// Parts move to fixed, precomputed queue slots (parts-data.ts queuePosition)
// rather than an offset from their current position — reassembling then
// re-exploding always lands on exactly the same numbers, no drift. The
// queue is laid out along world X, so the whole rig is also rotated back to
// 0 here — otherwise whatever auto-rotate angle the case was sitting at
// when "Explore Inside" was clicked would carry into the queue and the row
// would no longer read as a straight line from the overview camera.
function animatePositions(direction: "out" | "in"): Promise<void> {
  return new Promise((resolve) => {
    const tl = gsap.timeline({ onComplete: resolve });
    if (direction === "out") {
      tl.to(computer.rotation, { y: 0, duration: DURATION.explodePartDuration, ease: "power2.inOut" }, 0);
    }
    for (const part of PARTS) {
      const group = groupsById.get(part.id);
      if (!group) continue;
      const to = direction === "out" ? queuePosition(part) : part.assembled;
      const targetScale = direction === "out" ? (queueScaleById.get(part.id) ?? 1) : 1;
      // Explode outward glass-first, case-last (real teardown order); reverse
      // that for reassembly so the frame goes back together before the
      // panel closes over it, matching real assembly direction.
      const stagger = direction === "out" ? part.order : maxOrder - part.order;
      const delay = REDUCED_MOTION ? 0 : stagger * DURATION.explodeStagger;
      const duration = REDUCED_MOTION ? 0.2 : DURATION.explodePartDuration;
      tl.to(group.position, { x: to.x, y: to.y, z: to.z, duration, ease: "power2.inOut" }, delay);
      tl.to(group.scale, { x: targetScale, y: targetScale, z: targetScale, duration, ease: "power2.inOut" }, delay);
    }
  });
}

async function explode() {
  if (!sm.is("assembled")) return;
  sm.transition("opening");
  ui.setExploded(true);
  const [, completed] = await Promise.all([
    animatePositions("out"),
    flyCamera(camera, controls, QUEUE_OVERVIEW.position, QUEUE_OVERVIEW.target),
  ]);
  if (!completed) return;
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
  const [, completed] = await Promise.all([
    animatePositions("in"),
    flyCamera(camera, controls, new THREE.Vector3(...CAMERA.assembled.position), new THREE.Vector3(...CAMERA.assembled.target)),
  ]);
  if (!completed) return;
  sm.transition("assembled");
}

// The camera is the only thing that moves between parts — every part's
// queue slot is precomputed and static (parts-data.ts queuePosition), so
// selecting a part never re-touches any part's position; only its live
// bounding box (computeFocusFor) drives the camera. Other parts are never
// hidden or moved; they simply fall outside the frame (or sit at its edge)
// once the camera centers on the chosen one. Re-entry from "focusing" is
// allowed (clicking a new part mid-flight retargets the still-running
// flight rather than being ignored) — flyCamera's cancellation token, not
// this guard, is what keeps that race-free.
async function selectPart(part: PartDef) {
  if (sm.is("assembled")) await explode();
  if (!sm.is("exploded") && !sm.is("detail") && !sm.is("focusing")) return;
  if (!sm.is("focusing")) sm.transition("focusing");
  currentPartId = part.id;
  refreshDimState();
  const group = groupsById.get(part.id);
  if (!group) return;
  const { position, target } = computeFocusFor(group);
  const completed = await flyCamera(camera, controls, position, target);
  if (!completed) return;
  sm.transition("detail");
  ui.showPanel(part);
}

async function closeDetail() {
  if (!sm.is("detail") && !sm.is("focusing")) return;
  currentPartId = null;
  refreshDimState();
  const completed = await flyCamera(camera, controls, QUEUE_OVERVIEW.position, QUEUE_OVERVIEW.target);
  if (!completed) return;
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
  // Previous/Next walk the QUEUE's spatial order (left to right along the
  // row), not PARTS' teardown order — "walking down the exhibition" means
  // the neighbour in the display, not the next part to have unscrewed.
  const idx = PARTS_BY_QUEUE.findIndex((p) => p.id === currentPartId);
  const next = PARTS_BY_QUEUE[(idx + direction + PARTS_BY_QUEUE.length) % PARTS_BY_QUEUE.length];
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
const queueLabelWorldPos = new THREE.Vector3();

function updateQueueLabels() {
  const showQueueLabels = sm.is("exploded", "focusing", "detail");
  ui.setQueueLabelsVisible(showQueueLabels);
  if (!showQueueLabels) return;
  for (const part of PARTS) {
    const group = groupsById.get(part.id);
    if (!group) continue;
    group.getWorldPosition(queueLabelWorldPos);
    queueLabelWorldPos.y -= QUEUE.targetSize * 0.55 + 0.25;
    queueLabelWorldPos.project(camera);
    const x = (queueLabelWorldPos.x * 0.5 + 0.5) * renderer.domElement.clientWidth;
    const y = (-queueLabelWorldPos.y * 0.5 + 0.5) * renderer.domElement.clientHeight;
    ui.positionQueueLabel(part.id, x, y);
  }
}

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
  updateQueueLabels();
  updateViewOffset();
  renderer.render(scene, camera);
}
animate();
