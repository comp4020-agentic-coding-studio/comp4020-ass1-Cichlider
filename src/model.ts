import * as THREE from "three";
import { COLORS } from "./config.ts";
import type { PartDef } from "./parts-data.ts";

// Every builder returns a THREE.Group of several primitive sub-meshes in
// local space (centered near the origin, sized to the part's real envelope).
// The caller positions the group at `part.assembled` and tags every mesh in
// it with `userData.part` so raycasting resolves back to the same PartDef
// however many sub-meshes the part is made of.
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
    chassis: mat(COLORS.chassis, { roughness: 0.4, metalness: 0.7 }),
    chassisDark: mat(COLORS.chassisDark, { roughness: 0.6, metalness: 0.5 }),
    pcb: mat(COLORS.pcb, { roughness: 0.7, metalness: 0.1 }),
    chip: mat(0x0a0a0c, { roughness: 0.4, metalness: 0.3 }),
    metalCooler: mat(COLORS.metalCooler, { roughness: 0.25, metalness: 0.85 }),
    copper: mat(COLORS.metalCopper, { roughness: 0.3, metalness: 0.9 }),
    plasticDark: mat(COLORS.plasticDark, { roughness: 0.5, metalness: 0.2 }),
    gold: mat(COLORS.gold, { roughness: 0.3, metalness: 0.9 }),
    accent: mat(COLORS.accent, { roughness: 0.3, metalness: 0.2, emissive: COLORS.accent, emissiveIntensity: 0.9 }),
    glass: (() => {
      const glass = new THREE.MeshPhysicalMaterial({
        color: COLORS.glass,
        transparent: true,
        opacity: 0.22,
        roughness: 0.05,
        metalness: 0,
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

function buildCaseFrame(mm: Materials): THREE.Object3D[] {
  const w = 3.2;
  const h = 4.2;
  const d = 3.0;
  const t = 0.08; // strut thickness
  const parts: THREE.Object3D[] = [];
  const hx = w / 2;
  const hy = h / 2;
  const hz = d / 2;
  // 12 edge struts of a wireframe-like box, so the frame reads as a
  // structure you can see into rather than a solid coloured box.
  for (const sx of [-hx, hx]) {
    for (const sz of [-hz, hz]) parts.push(box(t, h, t, mm.chassis, sx, 0, sz));
  }
  for (const sy of [-hy, hy]) {
    for (const sz of [-hz, hz]) parts.push(box(w, t, t, mm.chassis, 0, sy, sz));
  }
  for (const sy of [-hy, hy]) {
    for (const sx of [-hx, hx]) parts.push(box(t, t, d, mm.chassis, sx, sy, 0));
  }
  // solid rear panel (motherboard mounts to this) + a front power LED strip
  parts.push(box(w - t, h - t, 0.06, mm.chassisDark, 0, 0, -hz + 0.03));
  parts.push(box(0.5, 0.06, 0.06, mm.accent, 0, hy - 0.35, hz));
  return parts;
}

function buildGlassPanel(mm: Materials): THREE.Object3D[] {
  const pane = box(0.05, 3.9, 2.8, mm.glass);
  const bezel: THREE.Object3D[] = [];
  const h = 4.0;
  const d = 2.9;
  const t = 0.07;
  for (const sy of [-h / 2, h / 2]) bezel.push(box(0.05, t, d, mm.chassis, 0, sy, 0));
  for (const sz of [-d / 2, d / 2]) bezel.push(box(0.05, h, t, mm.chassis, 0, 0, sz));
  return [pane, ...bezel];
}

function buildMotherboard(mm: Materials): THREE.Object3D[] {
  const plate = box(2.6, 3.0, 0.08, mm.pcb);
  const socket = box(0.62, 0.62, 0.05, mm.chassisDark, -0.75, 0.85, 0.07);
  const slots: THREE.Object3D[] = [];
  for (let i = 0; i < 2; i++) slots.push(box(0.14, 1.15, 0.07, mm.plasticDark, -0.05 + i * 0.18, 0.65, 0.08));
  const pcie = box(2.0, 0.12, 0.06, mm.plasticDark, 0.2, -0.6, 0.07);
  const caps: THREE.Object3D[] = [];
  for (let i = 0; i < 5; i++) caps.push(cyl(0.05, 0.12, mm.chip, -1.0 + i * 0.12, 0.5, 0.1));
  const trace = box(2.4, 0.02, 0.001, mm.accent, 0, -1.25, 0.05);
  return [plate, socket, ...slots, pcie, ...caps, trace];
}

function buildCPU(mm: Materials): THREE.Object3D[] {
  const substrate = box(0.56, 0.56, 0.04, mm.plasticDark, 0, 0, -0.02);
  const ihs = box(0.5, 0.5, 0.06, mm.metalCooler, 0, 0, 0.02);
  const pins: THREE.Object3D[] = [];
  for (const cx of [-0.24, 0.24]) {
    for (const cz of [-0.24, 0.24]) pins.push(box(0.05, 0.05, 0.02, mm.gold, cx, cz, -0.05));
  }
  return [substrate, ihs, ...pins];
}

function buildCooler(mm: Materials): THREE.Object3D[] {
  const base = box(0.5, 0.5, 0.06, mm.copper);
  // Heat pipes run vertically from the base up through the fin stack (as on
  // a real tower cooler), staggered in x/z and height so they stay tucked
  // behind the fins rather than poking out toward the fan face — a pair of
  // pipe-ends sitting beside a flat fan disc reads as a face otherwise.
  const pipes: THREE.Object3D[] = [
    cyl(0.032, 1.0, mm.copper, -0.14, 0.52, -0.05, 0.08),
    cyl(0.032, 0.95, mm.copper, 0.03, 0.48, 0.08, -0.06),
    cyl(0.032, 1.05, mm.copper, 0.15, 0.55, -0.1, 0.12),
  ];
  const fins: THREE.Object3D[] = [];
  for (let i = 0; i < 9; i++) fins.push(box(0.42, 1.0, 0.02, mm.metalCooler, 0.02, 0.55, -0.3 + i * 0.075));
  // Fan built from a ring + hub + angled blades arranged radially around the
  // hub (not a flat solid disc), so it reads as machinery rather than a
  // plain eye-like circle. The torus/blades lie in the cooler's local XY
  // plane facing +Z, matching the ring's default orientation.
  const fanCenter = { x: 0, y: 0.55, z: 0.42 };
  const fanRing = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.02, 8, 20), mm.plasticDark);
  fanRing.position.set(fanCenter.x, fanCenter.y, fanCenter.z);
  const fanHub = cyl(0.07, 0.05, mm.chassisDark, fanCenter.x, fanCenter.y, fanCenter.z, Math.PI / 2);
  const fan: THREE.Object3D[] = [fanRing, fanHub];
  const bladeCount = 7;
  const bladeRadius = 0.13;
  for (let i = 0; i < bladeCount; i++) {
    const theta = (i / bladeCount) * Math.PI * 2;
    const blade = box(
      0.19,
      0.05,
      0.015,
      mm.plasticDark,
      fanCenter.x + Math.cos(theta) * bladeRadius,
      fanCenter.y + Math.sin(theta) * bladeRadius,
      fanCenter.z,
    );
    blade.rotation.z = theta;
    fan.push(blade);
  }
  return [base, ...pipes, ...fins, ...fan];
}

function buildRAM(mm: Materials): THREE.Object3D[] {
  const sticks: THREE.Object3D[] = [];
  for (const ox of [-0.11, 0.11]) {
    sticks.push(box(0.06, 1.1, 0.6, mm.pcb, ox, 0, 0));
    sticks.push(box(0.07, 0.14, 0.55, mm.accent, ox, 0.42, 0));
    for (let i = 0; i < 4; i++) sticks.push(box(0.065, 0.12, 0.09, mm.chip, ox, 0.15 - i * 0.15, 0.15));
  }
  return sticks;
}

function buildGPU(mm: Materials): THREE.Object3D[] {
  const pcb = box(1.9, 0.06, 0.85, mm.pcb, 0, -0.1, 0);
  const shroud = box(1.9, 0.35, 0.8, mm.plasticDark, 0, 0.12, 0.02);
  const fans = [
    cyl(0.22, 0.06, mm.chassisDark, -0.5, 0.3, 0.05, Math.PI / 2),
    cyl(0.22, 0.06, mm.chassisDark, 0.5, 0.3, 0.05, Math.PI / 2),
  ];
  const backplate = box(1.9, 0.7, 0.04, mm.metalCooler, 0, 0, -0.42);
  const accentStrip = box(1.85, 0.03, 0.02, mm.accent, 0, -0.28, 0.44);
  const bracket = box(0.06, 0.85, 0.5, mm.chassis, -0.98, -0.1, 0);
  return [pcb, shroud, ...fans, backplate, accentStrip, bracket];
}

function buildPSU(mm: Materials): THREE.Object3D[] {
  const body = box(1.5, 0.85, 1.4, mm.chassis);
  const vent = box(1.3, 0.02, 1.2, mm.chassisDark, 0, 0.42, 0);
  const fanGrille = cyl(0.5, 0.03, mm.plasticDark, 0, 0.44, 0, Math.PI / 2);
  const connectors: THREE.Object3D[] = [];
  for (let i = 0; i < 3; i++) connectors.push(box(0.16, 0.16, 0.1, mm.plasticDark, -0.5 + i * 0.2, 0, 0.75));
  const switchNub = box(0.14, 0.08, 0.05, mm.accent, 0.6, -0.3, 0.75);
  return [body, vent, fanGrille, ...connectors, switchNub];
}

function buildSSD(mm: Materials): THREE.Object3D[] {
  const board = box(0.22, 0.02, 0.8, mm.pcb);
  const chips: THREE.Object3D[] = [];
  for (let i = 0; i < 2; i++) chips.push(box(0.16, 0.03, 0.16, mm.chip, 0, 0.02, -0.25 + i * 0.35));
  const label = box(0.2, 0.005, 0.35, mm.accent, 0, 0.025, 0.15);
  const notch = box(0.05, 0.03, 0.05, mm.gold, 0, 0, -0.38);
  return [board, ...chips, label, notch];
}

function buildFan(mm: Materials): THREE.Object3D[] {
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.045, 10, 24), mm.plasticDark);
  const hub = cyl(0.12, 0.1, mm.chassisDark, 0, 0, 0, Math.PI / 2);
  const blades: THREE.Object3D[] = [];
  const bladeCount = 7;
  for (let i = 0; i < bladeCount; i++) {
    const blade = box(0.32, 0.02, 0.14, mm.metalCooler, 0.24, 0, 0);
    blade.rotation.z = (i / bladeCount) * Math.PI * 2;
    blades.push(blade);
  }
  const accentRing = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.012, 8, 24), mm.accent);
  return [ring, hub, ...blades, accentRing];
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
