// Shared visual/physics constants. One accent color, one dark palette —
// changing the "look" of the whole scene should mean editing values here,
// not hunting through model.ts or ui.ts.

export const COLORS = {
  background: 0x05070a,
  accent: 0x38e0ff, // the single cyan/ice-blue accent used everywhere
  chassis: 0x2a2f36, // gunmetal — case frame, brackets
  chassisDark: 0x1b1e23,
  pcb: 0x15321f, // dark PCB green — motherboard, RAM, GPU, SSD substrate
  pcbTrace: 0x0a1a10,
  metalCooler: 0xb9c2c9, // brushed aluminium
  metalCopper: 0xb5651d,
  plasticDark: 0x14161a,
  glass: 0x8fd8e8,
  gold: 0xcaa14a, // CPU contact pins
} as const;

export const EXPLODE_DISTANCE = 3.4;
export const AUTO_ROTATE_SPEED = 0.12; // rad/s while assembled and idle

export const CAMERA = {
  fov: 42,
  near: 0.1,
  far: 100,
  assembled: { position: [7.5, 5.5, 9] as [number, number, number], target: [0, 0, 0] as [number, number, number] },
  exploded: { position: [8.5, 6, 11] as [number, number, number], target: [0, 0, 0] as [number, number, number] },
};

export const DURATION = {
  explodeStagger: 0.09, // seconds between each part's explode start
  explodePartDuration: 0.85,
  cameraMove: 0.9,
  panelSlide: 0.35,
};

export const REDUCED_MOTION = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
