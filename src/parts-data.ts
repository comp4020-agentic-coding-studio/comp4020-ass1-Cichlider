import * as THREE from "three";
import { LAYOUT } from "./config.ts";

export type GeometryKind =
  | "case-frame"
  | "glass-panel"
  | "motherboard"
  | "cpu"
  | "cooler"
  | "ram"
  | "gpu"
  | "psu"
  | "ssd"
  | "fan";

export interface PartContent {
  id: string;
  name: string;
  abbr: string; // short label, e.g. "CPU"
  definition: string; // one-line tagline, <= 8 words
  explanation: string; // 2-3 sentences
  responsibility: string;
  importance: string;
  specFact: string;
}

export interface PartDef extends PartContent {
  geometry: GeometryKind;
  assembled: THREE.Vector3;
  explodeDir: THREE.Vector3; // NOT always unit length — see note below
  order: number; // stagger order in the explode sequence (0 = first to move)
}

// Every connector on the vertically-mounted board (DIMM, PCIe, M.2 standoff,
// the CPU socket itself) releases the same way: pulling away from the board's
// face, i.e. +X. `dir()` normalizes so each of those parts travels the full
// shared EXPLODE_DISTANCE, which is deliberate — it produces a readable
// "exploded column" spread out along X, ordered by each part's own Y/Z anchor,
// which is how real exploded-view diagrams read. Two parts are the exception
// and skip `dir()`: the CPU only lifts "slightly" out of its socket once the
// cooler is off, and the case frame should only settle a short distance, not
// fly off with the same magnitude as everything it contains — both get a
// hand-written non-unit vector instead.
const dir = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z).normalize();

// Order/content follow the real teardown sequence for a tower case, mounted
// board vertical, glass side toward the viewer: glass panel off first (it's
// the outermost, purely cosmetic layer) → GPU unclipped from the PCIe slot →
// CPU cooler lifted off → RAM levered out of its DIMM slots → CPU lifted out
// of the now-exposed socket → M.2 SSD unscrewed from the board → PSU slid out
// of its rear-facing bay → rear exhaust fan unscrewed from the rear wall →
// motherboard unscrewed from the tray last, since every other part depended
// on it being in place. The case frame itself only settles slightly, last of
// all — it's the thing everything else was mounted inside, not a part that
// "explodes off" of anything.
export const PARTS: PartDef[] = [
  {
    id: "glass",
    name: "Glass Side Panel",
    abbr: "Glass Panel",
    definition: "A transparent side, showing off the build",
    explanation:
      "Tempered glass replaces a traditional steel side panel, letting you see the cabling and running hardware without opening the case. It barely helps cooling at all, yet it's become the de facto standard on modern cases.",
    responsibility: "Provides visibility while keeping the case structurally sealed",
    importance: "Purely cosmetic, but removing it is the first step to opening the case",
    specFact: "Typically 4mm tempered glass",
    geometry: "glass-panel",
    assembled: new THREE.Vector3(LAYOUT.case.hx + 0.05, 0, 0),
    explodeDir: dir(1, 0.05, 0),
    order: 0,
  },
  {
    id: "gpu",
    name: "Graphics Card",
    abbr: "GPU",
    definition: "Renders images, in parallel, by the thousands",
    explanation:
      "A GPU spreads one simple operation across thousands of cores running in parallel — a natural fit for rendering, and borrowed for any workload that's repetitive at scale. That's the opposite of how a CPU works through instructions one after another.",
    responsibility: "Renders graphics in parallel and handles large-scale numeric work",
    importance: "Sets the ceiling on both visual output and parallel compute throughput",
    specFact: "Typically 8–24GB of GDDR6 memory",
    geometry: "gpu",
    assembled: new THREE.Vector3(LAYOUT.pcieSlot.x, LAYOUT.pcieSlot.y, LAYOUT.pcieSlot.z),
    explodeDir: dir(1, 0.15, -0.25),
    order: 1,
  },
  {
    id: "cooler",
    name: "CPU Cooler",
    abbr: "CPU Cooler",
    definition: "Carries heat away from the CPU",
    explanation:
      "The cooler pipes heat away from the CPU's core through heat pipes into a stack of fins, then a fan blows that heat away. Without it, the CPU would overheat and throttle — or fail — within seconds.",
    responsibility: "Removes CPU heat and keeps it within a safe operating temperature",
    importance: "Directly determines whether the CPU can sustain its rated clock speed",
    specFact: "Tower coolers typically stand 150–165mm tall",
    geometry: "cooler",
    assembled: new THREE.Vector3(LAYOUT.cpuSocket.x, LAYOUT.cpuSocket.y, LAYOUT.cpuSocket.z),
    // Deliberately non-unit, like CPU/case below: a full-magnitude vertical
    // unit vector at the shared EXPLODE_DISTANCE would lift the cooler to
    // roughly y=4.2 — right at the edge of the exploded camera's vertical
    // frustum, so it read as flying off-screen rather than lifting clear of
    // the CPU. This caps it well inside frame while still separating cleanly
    // from the socket below.
    explodeDir: new THREE.Vector3(0.15, 0.55, 0.05),
    order: 2,
  },
  {
    id: "ram",
    name: "Memory",
    abbr: "RAM",
    definition: "The CPU's fast, short-term scratchpad",
    explanation:
      "RAM holds whatever data and instructions the CPU is actively working with, far faster to read and write than storage — but it forgets everything the instant power is lost. Think of it as a workbench that's constantly being cleared and reloaded.",
    responsibility: "Gives the CPU a fast, read-write space for data in use",
    importance: "Too little capacity or bandwidth forces even a fast CPU to sit idle waiting",
    specFact: "Typically DDR5, 16–32GB in dual-channel",
    geometry: "ram",
    assembled: new THREE.Vector3(LAYOUT.ram.x, LAYOUT.ram.y, LAYOUT.ram.z),
    explodeDir: dir(0.85, 0.5, 0.1),
    order: 3,
  },
  {
    id: "cpu",
    name: "Processor",
    abbr: "CPU",
    definition: "Executes instructions, one after another, extremely fast",
    explanation:
      "The CPU carries out the instruction stream nearly everything in the system depends on — sequential work, branching logic, and coordinating every other part. It sits under the cooler, seated in the socket, and is the single most latency-sensitive part in the machine.",
    responsibility: "Executes instructions and coordinates the rest of the system",
    importance: "Its clock speed and core count set the ceiling on single-thread and overall responsiveness",
    specFact: "Typically 6–16 cores, socketed via LGA or PGA",
    geometry: "cpu",
    assembled: new THREE.Vector3(LAYOUT.cpuSocket.x, LAYOUT.cpuSocket.y, LAYOUT.cpuSocket.z),
    explodeDir: new THREE.Vector3(0.35, 0.05, -0.05), // deliberately non-unit — "slightly out along the socket normal", once the cooler is off
    order: 4,
  },
  {
    id: "ssd",
    name: "Solid-State Drive",
    abbr: "SSD / M.2",
    definition: "Keeps its data after the power goes off",
    explanation:
      "An SSD stores the OS and files on flash chips that hold their charge without power — the fundamental difference from RAM. The M.2 form factor plugs straight into the motherboard, no cables needed.",
    responsibility: "Holds the operating system, programs and files long-term",
    importance: "The only part that still \"remembers\" the machine's state after a shutdown",
    specFact: "Typically 1TB, with NVMe reads up to 7000MB/s",
    geometry: "ssd",
    assembled: new THREE.Vector3(LAYOUT.ssd.x, LAYOUT.ssd.y, LAYOUT.ssd.z),
    explodeDir: dir(1, -0.2, 0.1),
    order: 5,
  },
  {
    id: "psu",
    name: "Power Supply",
    abbr: "PSU",
    definition: "Converts mains power into usable voltages",
    explanation:
      "The power supply converts AC mains power into the several DC voltages the motherboard, GPU and drives need, and buffers against power fluctuations along the way. It's the only part wired directly to mains power.",
    responsibility: "Converts and distributes stable power to the whole system",
    importance: "Unstable or insufficient power causes random reboots or damages components",
    specFact: "Typically rated 650–850W, 80+ Gold certified",
    geometry: "psu",
    assembled: new THREE.Vector3(LAYOUT.psu.x, LAYOUT.psu.y, LAYOUT.psu.z),
    explodeDir: dir(0, -0.3, -1),
    order: 6,
  },
  {
    id: "fan",
    name: "Case Fan",
    abbr: "Case Fan",
    definition: "Pushes hot air out of the case",
    explanation:
      "Case fans set up an intake-and-exhaust airflow loop across the whole case, working with the cooler to actually carry heat out rather than just move it around inside. Fan count and placement have a direct effect on cooling efficiency.",
    responsibility: "Establishes case-wide airflow to support overall cooling",
    importance: "Without it, even great local cooling just lets heat build up inside the case",
    specFact: "Typically 120mm or 140mm, PWM-controlled",
    geometry: "fan",
    assembled: new THREE.Vector3(LAYOUT.caseFan.x, LAYOUT.caseFan.y, LAYOUT.caseFan.z),
    explodeDir: dir(0, 0.1, -1),
    order: 7,
  },
  {
    id: "motherboard",
    name: "Motherboard",
    abbr: "Motherboard",
    definition: "The hub every other part connects through",
    explanation:
      "The motherboard's circuitry ties the CPU, memory, GPU and storage into one system — any signal between two parts passes through it. Pick the wrong chipset and the rest, however capable, simply can't work together.",
    responsibility: "Hosts and interconnects every other component",
    importance: "Sets the compatibility ceiling — socket, memory generation and expansion slots are all fixed by it",
    specFact: "Typically ATX, 305×244mm",
    geometry: "motherboard",
    assembled: new THREE.Vector3(LAYOUT.board.x, LAYOUT.board.centerY, LAYOUT.board.centerZ),
    explodeDir: dir(0.85, 0.35, 0.15),
    order: 8,
  },
  {
    id: "case",
    name: "Case Frame",
    abbr: "Case Frame",
    definition: "The skeleton that holds everything in place",
    explanation:
      "The case frame is formed from steel or extruded aluminium, giving every part a mounting point and cable routing while shaping airflow. It does no computing at all, yet it sets the ceiling on the whole system's cooling.",
    responsibility: "Fixes every part's position relative to the others and routes airflow",
    importance: "Without a rigid frame, parts can't stay aligned and airflow turns chaotic",
    specFact: "Typically an ATX mid-tower, roughly 480×210×450mm",
    geometry: "case-frame",
    assembled: new THREE.Vector3(0, 0, 0),
    explodeDir: new THREE.Vector3(0.05, -0.05, 0.12), // deliberately non-unit — the case only settles slightly, it doesn't fly off itself
    order: 9,
  },
];

export const PART_BY_ID = new Map(PARTS.map((p) => [p.id, p]));
