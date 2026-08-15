import * as THREE from "three";
import { COLORS, LAYOUT } from "./config.ts";
import type { PartDef } from "./parts-data.ts";

// Every builder returns a THREE.Group of several primitive sub-meshes in
// local space. Local space is NOT arbitrary per part — it's anchored to the
// same world point the part's `assembled` position (parts-data.ts) uses, so
// a part's own geometry and its placement in the case can't drift apart:
//   - case-frame's local origin IS the case's own (0,0,0) center.
//   - motherboard's local origin is LAYOUT.board's center (its own footprint).
//   - cpu and cooler both anchor at LAYOUT.cpuSocket (the exact same point —
//     the cooler's base sits flush against the CPU, which sits flush in the
//     socket, so they can never be positioned independently of each other).
//   - ram/ssd anchor at their own LAYOUT slot points on the board face.
//   - gpu anchors at LAYOUT.pcieSlot (where its edge connector meets the
//     board and its rear bracket meets the case, both close together there).
//   - psu/caseFan anchor at their own LAYOUT bay/mount points.
//
// The caller (buildPart) positions the whole group at `part.assembled` and
// tags every mesh with `userData.part` so raycasting resolves back to the
// same PartDef however many sub-meshes the part is made of.
//
// Materials are built fresh per part (not shared module-level instances):
// hover/select dimming (see interaction/main) mutates `.opacity` per mesh, and
// a shared material instance would leak that mutation across every other
// part using the same colour.

function mat(color: number, opts: Partial<THREE.MeshStandardMaterialParameters> = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.1, ...opts });
}

function createMaterials() {
  return {
    // Graphite grays with real metalness so the key/fill/rim rig gives them
    // visible highlights — a near-zero-luminance color has nothing for light
    // to catch, which is what made the old case read as a black silhouette.
    chassis: mat(COLORS.chassis, { roughness: 0.45, metalness: 0.75 }),
    chassisDark: mat(COLORS.chassisDark, { roughness: 0.55, metalness: 0.55 }),
    cutout: mat(0x14171b, { roughness: 0.8, metalness: 0.1 }), // recessed I/O/vent cutouts — dark, not pure black
    pcb: mat(COLORS.pcb, { roughness: 0.6, metalness: 0.15 }),
    chip: mat(0x1c2027, { roughness: 0.4, metalness: 0.35 }),
    metalCooler: mat(COLORS.metalCooler, { roughness: 0.22, metalness: 0.85 }),
    copper: mat(COLORS.metalCopper, { roughness: 0.28, metalness: 0.9 }),
    plasticDark: mat(COLORS.plasticDark, { roughness: 0.45, metalness: 0.25 }),
    gold: mat(COLORS.gold, { roughness: 0.3, metalness: 0.9 }),
    // The cyan accent stays reserved for small trim (LED strips, connector
    // nubs) — it's still emissive so those read as active/lit, but nothing
    // large-surface uses it, so it can't wash the case in neon.
    accent: mat(COLORS.accent, { roughness: 0.3, metalness: 0.2, emissive: COLORS.accent, emissiveIntensity: 0.9 }),
    glass: (() => {
      // MeshPhysicalMaterial's transmission (rather than plain opacity) lets
      // the panel stay genuinely see-through — the interior behind it reads
      // clearly — while still picking up a soft highlight/reflection of its
      // own, which opacity-only blending can't do.
      const glass = new THREE.MeshPhysicalMaterial({
        color: COLORS.glass,
        transparent: true,
        transmission: 0.94,
        opacity: 1,
        // A near-mirror roughness (0.06) threw a hard, narrow specular streak
        // across the pane from the key light at exactly the default 3/4 camera
        // angle, which competed with the interior for attention. Softening the
        // reflection (without touching the real hardware behind it, per the
        // brief) spreads that highlight out so the transmitted interior reads
        // clearly from the default view, not just from a side-on angle.
        roughness: 0.22,
        metalness: 0,
        ior: 1.45,
        thickness: 0.05,
        depthWrite: false,
      });
      // Marks this material as genuinely see-through by design, distinct from
      // the transient `transparent`/`opacity` a hover/focus dim also sets —
      // only a true see-through hit should ever lose a raycast to a solid
      // part behind it (see interaction.ts's firstSolidHit).
      glass.userData.isSeeThrough = true;
      return glass;
    })(),
  };
}

type Materials = ReturnType<typeof createMaterials>;

function box(w: number, h: number, d: number, material: THREE.Material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z);
  return m;
}

function cyl(r: number, h: number, material: THREE.Material, x = 0, y = 0, z = 0, rotX = 0) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 20), material);
  m.position.set(x, y, z);
  m.rotation.x = rotX;
  return m;
}

// --- Case frame ------------------------------------------------------------
// Local origin = the case's own (0,0,0): X- tray wall / X+ glass opening,
// Y+ top, Z- rear (I/O side) / Z+ front. Built as a tray + rear/front/top/
// bottom panels around a structural post frame, with recessed (not modeled
// as true holes, since three.js has no cheap CSG here) dark cutouts standing
// in for the rear I/O opening, expansion-slot louvers, and PSU vent — so the
// rear reads as "a case with real openings", not a blank slab.
function buildCaseFrame(mm: Materials): THREE.Object3D[] {
  const { hx, hy, hz, wall } = LAYOUT.case;
  const parts: THREE.Object3D[] = [];

  // Structural corner/edge posts — the load-bearing skeleton.
  for (const sx of [-hx, hx]) {
    for (const sz of [-hz, hz]) parts.push(box(wall, hy * 2, wall, mm.chassis, sx, 0, sz));
  }
  for (const sy of [-hy, hy]) {
    for (const sz of [-hz, hz]) parts.push(box(hx * 2, wall, wall, mm.chassis, 0, sy, sz));
  }
  for (const sy of [-hy, hy]) {
    for (const sx of [-hx, hx]) parts.push(box(wall, wall, hz * 2, mm.chassis, sx, sy, 0));
  }

  // Tray wall (motherboard bolts to this) — solid, opposite the glass side.
  parts.push(box(wall, hy * 2 - wall, hz * 2 - wall, mm.chassisDark, -hx + wall / 2, 0, 0));

  // Rear panel, with a recessed I/O cutout (aligned to the motherboard's
  // rear I/O block) and a stack of expansion-slot louvers (aligned to the
  // GPU's rear bracket) standing in for real openings.
  const rearZ = -hz + wall / 2;
  parts.push(box(hx * 2 - wall, hy * 2 - wall, wall, mm.chassisDark, 0, 0, rearZ));
  const ioY = LAYOUT.cpuSocket.y;
  parts.push(box(0.85, 0.55, wall * 1.4, mm.cutout, LAYOUT.trayX + 0.5, ioY, rearZ));
  for (let i = 0; i < 5; i++) {
    parts.push(box(0.55, 0.045, wall * 1.4, mm.cutout, LAYOUT.trayX + 0.55, LAYOUT.pcieSlot.y - 0.35 + i * 0.11, rearZ));
  }
  // PSU exterior vent (rear panel over the bottom-rear bay).
  parts.push(box(1.3, 0.7, wall * 1.4, mm.cutout, LAYOUT.psu.x, LAYOUT.psu.y, rearZ));

  // PSU shroud — a cover between the bottom bay and the main chamber, so the
  // bay reads as its own compartment without hiding the (separately
  // explodable) PSU part sitting inside it.
  const shroudTopY = LAYOUT.psu.y + 0.475 + 0.02;
  parts.push(box(hx * 2 - wall, wall, hz * 2 * 0.55, mm.chassisDark, 0, shroudTopY, LAYOUT.psu.z - 0.1));

  // Bottom panel + feet, so the case doesn't look like it's floating.
  parts.push(box(hx * 2 - wall, wall, hz * 2 - wall, mm.chassisDark, 0, -hy + wall / 2, 0));
  for (const sx of [-hx + 0.15, hx - 0.15]) {
    for (const sz of [-hz + 0.2, hz - 0.2]) parts.push(cyl(0.09, 0.1, mm.chassisDark, sx, -hy - 0.05, sz));
  }

  // Top panel, mostly solid (assembled state should look usable, not gutted)
  // with a shallow recessed vent strip for texture.
  parts.push(box(hx * 2 - wall, wall, hz * 2 - wall, mm.chassisDark, 0, hy - wall / 2, 0));
  parts.push(box(hx * 2 * 0.5, wall * 0.6, hz * 2 * 0.55, mm.cutout, 0, hy - wall - 0.01, -0.2));

  // Front panel, mostly solid, with a restrained power LED strip.
  const frontZ = hz - wall / 2;
  parts.push(box(hx * 2 - wall, hy * 2 - wall, wall, mm.chassisDark, 0, 0, frontZ));
  parts.push(box(0.5, 0.06, wall * 1.4, mm.accent, LAYOUT.trayX + 0.6, hy - 0.35, frontZ));

  return parts;
}

function buildGlassPanel(mm: Materials): THREE.Object3D[] {
  const { hy, hz, wall } = LAYOUT.case;
  const paneH = hy * 2 * 0.88;
  const paneD = hz * 2 * 0.88;
  const pane = box(0.05, paneH, paneD, mm.glass);
  const bezel: THREE.Object3D[] = [];
  const bezH = paneH + 0.1;
  const bezD = paneD + 0.1;
  for (const sy of [-bezH / 2, bezH / 2]) bezel.push(box(0.06, wall, bezD, mm.chassis, 0, sy, 0));
  for (const sz of [-bezD / 2, bezD / 2]) bezel.push(box(0.06, bezH, wall, mm.chassis, 0, 0, sz));
  return [pane, ...bezel];
}

// --- Motherboard -------------------------------------------------------------
// Local origin = LAYOUT.board's own center. A vertical plane (thin in X)
// carrying the functional zones as raised/recessed blocks: CPU socket
// outline, DIMM slots, PCIe slot, M.2 area, rear I/O block, chipset heatsink,
// VRM strip — so the board reads as a real motherboard, not a green slab.
function buildMotherboard(mm: Materials): THREE.Object3D[] {
  const { thickness, height, depth, centerY, centerZ } = LAYOUT.board;
  const faceX = thickness / 2;
  const toLocalY = (worldY: number) => worldY - centerY;
  const toLocalZ = (worldZ: number) => worldZ - centerZ;

  const plate = box(thickness, height, depth, mm.pcb);

  const socketY = toLocalY(LAYOUT.cpuSocket.y);
  const socketZ = toLocalZ(LAYOUT.cpuSocket.z);
  const socketOutline = box(0.02, 0.48, 0.48, mm.chassisDark, faceX + 0.01, socketY, socketZ);
  const vrm = box(0.05, 0.14, 0.5, mm.metalCooler, faceX + 0.025, socketY + 0.32, socketZ - 0.05);

  const ramY = toLocalY(LAYOUT.ram.y);
  const ramZ = toLocalZ(LAYOUT.ram.z);
  const dimmSlots: THREE.Object3D[] = [];
  for (const yOff of [-0.11, 0.11]) {
    dimmSlots.push(box(0.03, 0.07, 1.05, mm.plasticDark, faceX + 0.015, ramY + yOff, ramZ));
  }

  const ssdY = toLocalY(LAYOUT.ssd.y);
  const ssdZ = toLocalZ(LAYOUT.ssd.z);
  const m2Slot = box(0.02, 0.24, 0.7, mm.chassisDark, faceX + 0.01, ssdY, ssdZ);

  const pcieY = toLocalY(LAYOUT.pcieSlot.y);
  const pcieZ = toLocalZ(LAYOUT.pcieSlot.z);
  const pcieSlotBar = box(0.08, 0.1, 0.9, mm.plasticDark, faceX + 0.04, pcieY, pcieZ);
  const otherSlots: THREE.Object3D[] = [];
  for (let i = 1; i < 3; i++) otherSlots.push(box(0.06, 0.08, 0.55, mm.plasticDark, faceX + 0.03, pcieY - i * 0.22, pcieZ + 0.05));

  const chipset = box(0.08, 0.3, 0.3, mm.metalCooler, faceX + 0.04, pcieY - 0.75, pcieZ + 0.5);

  // Rear I/O block, flush to the board's rear edge (aligned with the case's
  // rear I/O cutout built in buildCaseFrame).
  const rearEdgeZ = -depth / 2;
  const ioBlock = box(0.16, 0.5, 0.1, mm.chassisDark, faceX + 0.08, socketY, rearEdgeZ + 0.05);

  const powerHeader = box(0.05, 0.06, 0.12, mm.accent, faceX + 0.025, -height / 2 + 0.2, depth / 2 - 0.3);

  return [plate, socketOutline, vrm, ...dimmSlots, m2Slot, pcieSlotBar, ...otherSlots, chipset, ioBlock, powerHeader];
}

// --- CPU ---------------------------------------------------------------------
// Local origin = LAYOUT.cpuSocket, exactly where buildCooler's base also
// anchors — the CPU sits in the socket, the cooler sits on the CPU, neither
// can drift from the other because both start from this same point.
function buildCPU(mm: Materials): THREE.Object3D[] {
  const substrate = box(0.06, 0.44, 0.44, mm.plasticDark, -0.01);
  const ihs = box(0.03, 0.38, 0.38, mm.metalCooler, 0.045);
  const pads: THREE.Object3D[] = [];
  for (const cy of [-0.16, 0.16]) {
    for (const cz of [-0.16, 0.16]) pads.push(box(0.01, 0.05, 0.05, mm.gold, -0.035, cy, cz));
  }
  return [substrate, ihs, ...pads];
}

// --- CPU cooler ----------------------------------------------------------
// Local origin = LAYOUT.cpuSocket (same anchor as buildCPU). A tower cooler
// grows mostly in +Y (height) off the CPU, with heat pipes carrying that
// height gain, a modest +X protrusion off the board face for the fin
// stack's depth, and fins stacked along Z so a Z-facing fan can blow through
// them — matching real front-to-back case airflow.
function buildCooler(mm: Materials): THREE.Object3D[] {
  const base = box(0.05, 0.42, 0.42, mm.copper, 0.05);
  const pipes: THREE.Object3D[] = [
    cyl(0.032, 1.3, mm.copper, 0.16, 0.66, -0.06, 0.08),
    cyl(0.032, 1.25, mm.copper, 0.24, 0.62, 0.07, -0.06),
    cyl(0.032, 1.35, mm.copper, 0.3, 0.7, -0.1, 0.12),
  ];
  const finCount = 11;
  const fins: THREE.Object3D[] = [];
  for (let i = 0; i < finCount; i++) {
    fins.push(box(0.42, 1.3, 0.022, mm.metalCooler, 0.28, 0.72, -0.35 + i * 0.07));
  }
  // Fan mounted on the fin stack's front (+Z) face, drawing air from the
  // case's front intake and pushing it through the fins toward the rear.
  const fanCenter = { x: 0.28, y: 0.72, z: 0.44 };
  const fanFrame: THREE.Object3D[] = [];
  const frameHalf = 0.34;
  for (const sy of [-frameHalf, frameHalf]) fanFrame.push(box(0.02, frameHalf * 2, 0.03, mm.plasticDark, fanCenter.x, fanCenter.y + sy, fanCenter.z));
  const fanRing = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.02, 8, 20), mm.plasticDark);
  fanRing.rotation.y = Math.PI / 2;
  fanRing.position.set(fanCenter.x, fanCenter.y, fanCenter.z);
  const fanHub = cyl(0.07, 0.05, mm.chassisDark, fanCenter.x, fanCenter.y, fanCenter.z, Math.PI / 2);
  const fan: THREE.Object3D[] = [fanRing, fanHub, ...fanFrame];
  const bladeCount = 7;
  const bladeRadius = 0.14;
  for (let i = 0; i < bladeCount; i++) {
    const theta = (i / bladeCount) * Math.PI * 2;
    const blade = box(
      0.02,
      0.19,
      0.05,
      mm.plasticDark,
      fanCenter.x,
      fanCenter.y + Math.sin(theta) * bladeRadius,
      fanCenter.z + Math.cos(theta) * bladeRadius,
    );
    blade.rotation.x = theta;
    fan.push(blade);
  }
  return [base, ...pipes, ...fins, ...fan];
}

// --- RAM ---------------------------------------------------------------------
// Local origin = LAYOUT.ram (the DIMM slot's connector edge, on the board
// face). DIMMs are thin, long PCBs standing in their slot: long axis along
// Z (front-to-back, matching the board's own depth axis), thin along Y
// (the direction slots are spaced apart), protruding along +X off the board.
function buildRAM(mm: Materials): THREE.Object3D[] {
  const sticks: THREE.Object3D[] = [];
  for (const yOff of [-0.11, 0.11]) {
    sticks.push(box(0.35, 0.075, 1.05, mm.pcb, 0.175, yOff, 0));
    sticks.push(box(0.36, 0.02, 1.0, mm.metalCooler, 0.315, yOff, 0));
    for (let i = 0; i < 5; i++) sticks.push(box(0.05, 0.06, 0.1, mm.chip, 0.1, yOff, -0.4 + i * 0.2));
  }
  return sticks;
}

// --- SSD (M.2) -----------------------------------------------------------
// Local origin = LAYOUT.ssd, flush against the board face below the socket.
// Thin along X (a couple mm standoff off the board), 22mm wide (Y), 80mm
// long (Z) — the real M.2 2280 footprint.
function buildSSD(mm: Materials): THREE.Object3D[] {
  const board = box(0.02, 0.22, 0.8, mm.pcb, 0.03);
  const chips: THREE.Object3D[] = [];
  for (let i = 0; i < 2; i++) chips.push(box(0.03, 0.16, 0.16, mm.chip, 0.045, 0, -0.25 + i * 0.35));
  const label = box(0.005, 0.2, 0.35, mm.accent, 0.045, 0, 0.1);
  const notch = box(0.03, 0.05, 0.05, mm.gold, 0.01, 0, -0.38);
  return [board, ...chips, label, notch];
}

// --- GPU -----------------------------------------------------------------
// Local origin = LAYOUT.pcieSlot: the point where the card's edge connector
// meets the board AND its rear bracket meets the case (physically close
// together on a real card). The card runs FORWARD from there: length along
// +Z (into the case, 270mm), height along Y, and thickness along +X (off
// the board face, toward the glass side) — the opposite of a card lying
// flat against the board, which read as an unconvincing "green plaque".
function buildGPU(mm: Materials): THREE.Object3D[] {
  const length = 2.7;
  const height = 0.9;
  const thickness = 0.5;
  const cz = length / 2 - 0.1; // card center, Z (starts near the connector, runs forward)
  const cy = 0.15; // slight upward bias — shroud typically bulges above the PCB more than below

  const backplate = box(0.03, height * 0.9, length * 0.95, mm.metalCooler, 0.03, cy, cz);
  const pcb = box(0.05, height * 0.75, length * 0.9, mm.pcb, 0.12, cy, cz);
  const shroud = box(thickness * 0.75, height, length * 0.85, mm.plasticDark, thickness * 0.55, cy, cz);
  const fans = [
    cyl(0.24, 0.05, mm.chassisDark, thickness, cy, cz - length * 0.22, Math.PI / 2),
    cyl(0.24, 0.05, mm.chassisDark, thickness, cy, cz + length * 0.22, Math.PI / 2),
  ];
  const goldFingers = box(0.06, 0.06, 0.5, mm.gold, -0.03, cy - height * 0.42, -0.05);
  const bracket = box(0.05, height * 1.05, thickness, mm.chassis, -0.02, cy, -0.08);
  const accentStrip = box(thickness * 0.78, 0.025, 0.02, mm.accent, thickness * 0.55, cy - height * 0.46, cz);
  return [backplate, pcb, shroud, ...fans, goldFingers, bracket, accentStrip];
}

// --- PSU -------------------------------------------------------------------
// Local origin = LAYOUT.psu (the bay's own center — the PSU is a standalone
// unit, not flush-mounted to anything else). Its rear face (power inlet,
// switch) sits at the -Z end of the body, flush to the case's rear wall;
// its fan/vent grille faces down (-Y), the common real-world convention for
// drawing fresh air through the case's bottom vents.
function buildPSU(mm: Materials): THREE.Object3D[] {
  const body = box(1.5, 0.85, 1.4, mm.chassis);
  const vent = box(1.3, 0.02, 1.2, mm.chassisDark, 0, 0, -0.05);
  const fanGrille = cyl(0.5, 0.03, mm.plasticDark, 0, -0.44, -0.05, Math.PI / 2);
  const rearZ = -0.68;
  const connectors: THREE.Object3D[] = [];
  for (let i = 0; i < 3; i++) connectors.push(box(0.16, 0.16, 0.06, mm.plasticDark, -0.5 + i * 0.2, 0, rearZ));
  const switchNub = box(0.14, 0.08, 0.05, mm.accent, 0.6, -0.3, rearZ);
  return [body, vent, fanGrille, ...connectors, switchNub];
}

// --- Case fan --------------------------------------------------------------
// Local origin = LAYOUT.caseFan, flush against the rear wall — the rear
// exhaust fan. A square outer frame (with corner mounting tabs) distinct
// from the circular blade area, disc plane in the local XY plane so its
// face-normal matches the rear wall's own Z-facing normal.
function buildFan(mm: Materials): THREE.Object3D[] {
  const half = 0.62;
  const frame: THREE.Object3D[] = [
    box(half * 2, 0.05, 0.05, mm.plasticDark, 0, half, 0),
    box(half * 2, 0.05, 0.05, mm.plasticDark, 0, -half, 0),
    box(0.05, half * 2, 0.05, mm.plasticDark, half, 0, 0),
    box(0.05, half * 2, 0.05, mm.plasticDark, -half, 0, 0),
  ];
  const tabs: THREE.Object3D[] = [];
  for (const sx of [-half, half]) {
    for (const sy of [-half, half]) tabs.push(cyl(0.05, 0.06, mm.chassisDark, sx * 0.88, sy * 0.88, 0, Math.PI / 2));
  }
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.045, 10, 24), mm.plasticDark);
  const hub = cyl(0.12, 0.1, mm.chassisDark, 0, 0, 0, Math.PI / 2);
  const blades: THREE.Object3D[] = [];
  const bladeCount = 7;
  const bladeRadius = 0.24;
  // THREE.js composes rotate-THEN-translate: a fixed `.position` with only
  // `.rotation` varying just spins each mesh in place at that one point, it
  // doesn't orbit it — every blade must get its OWN position around the hub,
  // computed with trig, with `.rotation` only setting that blade's own facing.
  for (let i = 0; i < bladeCount; i++) {
    const theta = (i / bladeCount) * Math.PI * 2;
    const blade = box(0.32, 0.02, 0.14, mm.metalCooler, Math.cos(theta) * bladeRadius, Math.sin(theta) * bladeRadius, 0);
    blade.rotation.z = theta;
    blades.push(blade);
  }
  const accentRing = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.012, 8, 24), mm.accent);
  return [...frame, ...tabs, ring, hub, ...blades, accentRing];
}

const BUILDERS: Record<PartDef["geometry"], (mm: Materials) => THREE.Object3D[]> = {
  "case-frame": buildCaseFrame,
  "glass-panel": buildGlassPanel,
  motherboard: buildMotherboard,
  cpu: buildCPU,
  cooler: buildCooler,
  ram: buildRAM,
  gpu: buildGPU,
  psu: buildPSU,
  ssd: buildSSD,
  fan: buildFan,
};

export function buildPart(part: PartDef): THREE.Group {
  const group = new THREE.Group();
  group.name = part.id;
  const mm = createMaterials();
  for (const child of BUILDERS[part.geometry](mm)) {
    child.traverse((node) => {
      node.userData.part = part;
      const mesh = node as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });
    group.add(child);
  }
  group.position.copy(part.assembled);
  group.userData.part = part;
  const baseOpacity = new Map<THREE.Mesh, number>();
  group.userData.baseOpacity = baseOpacity;
  group.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (mesh.material) baseOpacity.set(mesh, (mesh.material as THREE.Material & { opacity: number }).opacity);
  });
  return group;
}

// Dims every mesh in a part group to fade it against the currently
// hovered/selected part, without touching materials belonging to any other
// part group (each group owns its own material instances — see buildPart).
export function setPartDimmed(group: THREE.Group, dimmed: boolean): void {
  const baseOpacity = group.userData.baseOpacity as Map<THREE.Mesh, number>;
  group.traverse((node) => {
    const mesh = node as THREE.Mesh;
    const material = mesh.material as (THREE.Material & { opacity: number }) | undefined;
    if (!material) return;
    const base = baseOpacity.get(mesh) ?? 1;
    material.transparent = dimmed || material.userData.isSeeThrough || base < 1;
    material.opacity = dimmed ? base * 0.16 : base;
  });
}
