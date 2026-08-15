import * as THREE from "three";
import { LAYOUT, QUEUE } from "./config.ts";

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
  order: number; // stagger order in the teardown/reassemble animation (0 = first to move)
  queueIndex: number; // this part's fixed slot in the museum queue, left to right
  queueLabel: string; // short English name shown under the part in the queue
}

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
    order: 0,
    queueIndex: 1,
    queueLabel: "Glass Panel",
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
    order: 1,
    queueIndex: 6,
    queueLabel: "GPU",
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
    order: 2,
    queueIndex: 4,
    queueLabel: "CPU Cooler",
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
    order: 3,
    queueIndex: 5,
    queueLabel: "RAM",
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
    order: 4,
    queueIndex: 3,
    queueLabel: "CPU",
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
    order: 5,
    queueIndex: 7,
    queueLabel: "SSD",
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
    order: 6,
    queueIndex: 8,
    queueLabel: "PSU",
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
    order: 7,
    queueIndex: 9,
    queueLabel: "Fan",
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
    order: 8,
    queueIndex: 2,
    queueLabel: "Motherboard",
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
    order: 9,
    queueIndex: 0,
    queueLabel: "Case",
  },
];

export const PART_BY_ID = new Map(PARTS.map((p) => [p.id, p]));

// Parts in spatial queue order (left to right), for Previous/Next browsing —
// distinct from PARTS' teardown order, which still drives animatePositions'
// stagger timing (main.ts) and is unrelated to where a part sits in the row.
export const PARTS_BY_QUEUE = [...PARTS].sort((a, b) => a.queueIndex - b.queueIndex);

const QUEUE_MID = (PARTS_BY_QUEUE.length - 1) / 2;

// Shared by the overview camera and every per-part focus shot (main.ts
// computes focus shots from each part's live world-space bounding box, but
// reuses this same offset direction so every shot "looks from the same
// angle").
export const QUEUE_VIEW_DIR = new THREE.Vector3(...QUEUE.viewDir).normalize();

// Every part's fixed slot in the museum queue: one row, evenly spaced along
// X, y=0 z=0 baseline. This is the ONLY place a part's exploded position is
// computed — main.ts reads it directly rather than deriving anything, which
// is what keeps repeated queue/reassemble cycles from drifting.
export function queuePosition(part: PartDef): THREE.Vector3 {
  return new THREE.Vector3((part.queueIndex - QUEUE_MID) * QUEUE.spacing, 0, 0);
}

// The default/"back to overview" camera: pulled back along the same shared
// view direction, far enough to frame the entire queue row at once.
export const QUEUE_OVERVIEW = {
  target: new THREE.Vector3(0, 0, 0),
  position: new THREE.Vector3(0, 0, 0).addScaledVector(QUEUE_VIEW_DIR, QUEUE.overviewDistance),
};
