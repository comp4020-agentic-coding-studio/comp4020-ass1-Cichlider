// Shared visual/physics constants. One accent color, one dark palette —
// changing the "look" of the whole scene should mean editing values here,
// not hunting through model.ts or ui.ts.

export const COLORS = {
  background: 0xdae1e7, // bright cool-gray studio backdrop (was near-black)
  backgroundGround: 0xb9c2ca, // slightly deeper — the floor the case sits on
  accent: 0x38e0ff, // cyan accent — reserved for small highlights/interaction, never large surfaces
  chassis: 0x565f68, // graphite gray — case frame, brackets (was near-black gunmetal)
  chassisDark: 0x3a4048, // darker graphite for recessed panels, still well above zero luminance
  pcb: 0x35513f, // PCB green — motherboard, RAM, GPU, SSD substrate, lightened for readability
  pcbTrace: 0x1f3a28,
  metalCooler: 0xcbd2d8, // brushed aluminium
  metalCopper: 0xc17a34,
  plasticDark: 0x2c3138, // dark plastic shrouds — dark but never near-black
  glass: 0xdcedf2,
  gold: 0xcaa14a, // CPU contact pins
} as const;

export const AUTO_ROTATE_SPEED = 0.12; // rad/s while assembled and idle

// Front 3/4 view from the glass side, close to the case's own mid-height —
// a real product photo doesn't look down on a tower from above, and a
// top-down hero shot was hiding the front/glass/interior relationship this
// model exists to show.
export const CAMERA = {
  fov: 42,
  near: 0.1,
  far: 100,
  assembled: { position: [4.6, 0.9, 6.2] as [number, number, number], target: [0, -0.1, 0] as [number, number, number] },
};

// The "exploded" state is no longer a radial burst — it's a fixed-order
// horizontal museum queue. Every part sits at (queueIndex - middle) *
// spacing along X, y=0, z=0: a single tidy row, not scattered around the
// case. `viewDir` is shared by every part's focus shot and the overview;
// each shot's actual distance is computed live in main.ts (computeFocusFor)
// from the selected part's real world-space bounding box, not a fixed
// number here — every part's group is scaled, at queue time, to the same
// visual size (see main.ts), so that live computation lands on a
// comparable distance for any part, which is what makes "unified display
// height" actually true rather than just asserted.
export const QUEUE = {
  spacing: 3.2, // world units between adjacent queue slot centers
  targetSize: 2.0, // every part is scaled so its largest dimension is this
  viewDir: [1.7, 1.15, 2.5] as [number, number, number], // camera offset direction, shared by every part's focus and the overview
  overviewDistance: 25, // camera distance to frame the entire queue at once
};

// A single ATX-mid-tower coordinate system and scale (1 world unit = 100mm),
// shared by model.ts (geometry) and parts-data.ts (assembled/explode
// positions), so no part's placement is a standalone guess. Axes:
//   X: - = motherboard tray side, + = glass side (the side the user views)
//   Y: - = bottom, + = top
//   Z: - = rear (I/O side), + = front
export const LAYOUT = {
  case: { hx: 1.1, hy: 2.3, hz: 2.2, wall: 0.05 },
  trayX: -1.05, // inner face of the tray wall the motherboard bolts to
  board: {
    x: -1.0, // board's own thin plane, flush against the tray with standoff clearance
    thickness: 0.06,
    // ATX is 305 x 244mm; mapped so the 305mm edge runs vertically (Y) and
    // the 244mm edge runs front-to-back (Z), rear edge flush to the case's
    // rear I/O cutout — the standard tower mounting orientation.
    height: 3.0,
    depth: 2.4,
    centerY: 0.27,
    centerZ: -0.92,
    rearZ: -2.12,
  },
  // World-space anchor for the CPU socket: CPU and cooler both mount flush
  // to this exact point (CPU thin against the board face, cooler's base
  // stacked directly against the CPU), so they can never drift apart.
  cpuSocket: { x: -0.95, y: 0.85, z: -1.35 },
  ram: { x: -0.75, y: 0.9, z: -0.8 }, // adjacent DIMM slots, front-side of the socket
  ssd: { x: -0.95, y: 0.1, z: -1.0 }, // M.2 slot, below the socket, flush to board face
  pcieSlot: { x: -0.95, y: -0.6, z: -1.82 }, // GPU's edge-connector meets the board here
  psu: { x: 0, y: -1.8, z: -1.45 }, // bottom-rear bay
  caseFan: { x: 0, y: 1.0, z: -2.15 }, // rear exhaust, flush to the rear wall
} as const;

export const DURATION = {
  explodeStagger: 0.09, // seconds between each part's explode start
  explodePartDuration: 0.85,
  cameraMove: 0.9,
  panelSlide: 0.35,
};

export const REDUCED_MOTION = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
