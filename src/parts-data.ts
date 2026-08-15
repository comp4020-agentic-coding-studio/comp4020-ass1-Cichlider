import * as THREE from "three";

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
  name: string; // Chinese name
  abbr: string; // English abbreviation, e.g. "CPU"
  definition: string; // <= 25 Chinese characters
  explanation: string; // 2-3 sentences
  responsibility: string;
  importance: string;
  specFact: string;
}

export interface PartDef extends PartContent {
  geometry: GeometryKind;
  assembled: THREE.Vector3;
  explodeDir: THREE.Vector3; // unit vector
  order: number; // stagger order in the explode sequence (0 = first to move)
}

const dir = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z).normalize();

// Order/content follow real assembly logic: the glass panel comes off first
// (it's the outermost, purely cosmetic layer), then the large add-in parts
// (GPU, cooler), then the small ones (RAM, SSD, fan), then the motherboard
// and case frame last, since everything else was mounted to them.
export const PARTS: PartDef[] = [
  {
    id: "glass",
    name: "玻璃侧板",
    abbr: "Glass Panel",
    definition: "透明侧板，展示内部做工",
    explanation:
      "钢化玻璃侧板取代传统钢板，让使用者无需拆机即可看到内部布线与运行状态。它几乎不参与散热，却已经成为现代机箱的事实标准。",
    responsibility: "提供可视性，同时维持机箱结构完整",
    importance: "纯装饰性部件，但拆下它是打开机箱的第一步",
    specFact: "常见厚度 4mm 钢化玻璃",
    geometry: "glass-panel",
    assembled: new THREE.Vector3(1.62, 0, 0),
    explodeDir: dir(1, 0.1, 0),
    order: 0,
  },
  {
    id: "gpu",
    name: "显卡",
    abbr: "GPU",
    definition: "并行处理图像与批量运算",
    explanation:
      "GPU 把同一种简单运算铺开到成百上千个核心上并行执行，天生适合图像渲染，也被借用来做训练等重复性计算。它的工作方式与 CPU 的“顺序执行”正好互补。",
    responsibility: "并行渲染图形，承担大规模数值计算",
    importance: "决定画面表现与并行计算能力的上限",
    specFact: "常见显存容量 8–24GB GDDR6",
    geometry: "gpu",
    assembled: new THREE.Vector3(-0.9, -0.55, 0.55),
    explodeDir: dir(-0.3, -0.5, 0.9),
    order: 1,
  },
  {
    id: "cooler",
    name: "散热器",
    abbr: "CPU Cooler",
    definition: "把 CPU 产生的热量导出机箱",
    explanation:
      "散热器通过热管把 CPU 核心的热量导向散热鳍片，再由风扇把热量吹散。没有它，CPU 会在几秒内因过热而降频甚至损坏。",
    responsibility: "导出 CPU 热量并维持安全工作温度",
    importance: "直接决定 CPU 能否维持标称频率运行",
    specFact: "常见塔式散热器高度约 150–165mm",
    geometry: "cooler",
    assembled: new THREE.Vector3(0.2, 0.55, -0.9),
    explodeDir: dir(0.15, 0.9, -0.1),
    order: 2,
  },
  {
    id: "ram",
    name: "内存条",
    abbr: "RAM",
    definition: "CPU 当前数据的高速暂存区",
    explanation:
      "内存保存 CPU 正在处理的数据与指令，读写速度远高于存储硬盘，但断电后内容立即丢失。它像一张不断被翻阅又清空的工作台。",
    responsibility: "为 CPU 提供高速可读写的临时数据空间",
    importance: "容量或速度不足，会让再快的 CPU 也被迫等待",
    specFact: "常见规格 DDR5 16–32GB 双通道",
    geometry: "ram",
    assembled: new THREE.Vector3(0.75, 0.35, -0.75),
    explodeDir: dir(0.6, 0.5, -0.6),
    order: 3,
  },
  {
    id: "ssd",
    name: "固态硬盘",
    abbr: "SSD / M.2",
    definition: "断电后仍保留数据的存储部件",
    explanation:
      "SSD 用闪存芯片持久化保存操作系统与文件，断电后数据依然存在——这是它与内存最本质的区别。M.2 接口直接插在主板上，省去了传统硬盘线缆。",
    responsibility: "长期保存操作系统、程序与文件数据",
    importance: "唯一断电后仍“记得”整机状态的部件",
    specFact: "常见容量 1TB，NVMe 读速可达 7000MB/s",
    geometry: "ssd",
    assembled: new THREE.Vector3(-0.55, -0.15, -0.85),
    explodeDir: dir(-0.6, -0.4, -0.7),
    order: 3,
  },
  {
    id: "fan",
    name: "机箱风扇",
    abbr: "Case Fan",
    definition: "把机箱内的热空气排出",
    explanation:
      "机箱风扇在整机层面形成进风与排风的气流循环，配合散热器把各部件产生的热量最终排出机箱之外。风扇数量与朝向的搭配直接影响散热效率。",
    responsibility: "形成机箱级气流循环，辅助整体散热",
    importance: "没有它，局部散热再好也会在机箱内堆积热量",
    specFact: "常见尺寸 120mm / 140mm PWM 风扇",
    geometry: "fan",
    assembled: new THREE.Vector3(0, -0.05, -1.55),
    explodeDir: dir(0, 0.1, -1),
    order: 3,
  },
  {
    id: "motherboard",
    name: "主板",
    abbr: "Motherboard",
    definition: "连接所有部件的通信枢纽",
    explanation:
      "主板上的电路把 CPU、内存、显卡与存储连接成一个整体，任何两个部件之间的信号都要经过它。芯片组选错了，其余部件再强也无法组合使用。",
    responsibility: "承载并互连所有其他部件",
    importance: "决定兼容性上限——插槽、内存代数、扩展槽都由它规定",
    specFact: "常见尺寸 ATX 305×244mm",
    geometry: "motherboard",
    assembled: new THREE.Vector3(0, 0, -0.82),
    explodeDir: dir(0, 0.2, -1),
    order: 4,
  },
  {
    id: "psu",
    name: "电源",
    abbr: "PSU",
    definition: "把市电转换成部件可用的电压",
    explanation:
      "电源模块把交流市电转换成主板、显卡与硬盘所需的多组直流电压，并在电压波动时提供缓冲保护。它是唯一直接连接市电的部件。",
    responsibility: "稳定转换并分配整机所需电力",
    importance: "电力不稳或不足，会导致整机随机重启或烧毁部件",
    specFact: "常见额定功率 650–850W，80+ 金牌认证",
    geometry: "psu",
    assembled: new THREE.Vector3(-1.15, -1.05, 0.95),
    explodeDir: dir(-0.6, -1, 0.5),
    order: 5,
  },
  {
    id: "case",
    name: "机箱框架",
    abbr: "Case Frame",
    definition: "承载并固定所有部件的骨架",
    explanation:
      "机箱框架由钢或铝挤压成型，为所有部件提供固定点与走线空间，同时引导气流方向。它不参与运算，却决定了整机散热效率的上限。",
    responsibility: "固定所有部件的相对位置，管理气流路径",
    importance: "没有稳固的框架，其余部件无法保持对齐，气流也会紊乱",
    specFact: "常见规格 ATX 中塔，约 480×210×450mm",
    geometry: "case-frame",
    assembled: new THREE.Vector3(0, 0, 0),
    explodeDir: dir(0, -0.15, 1),
    order: 6,
  },
];

export const PART_BY_ID = new Map(PARTS.map((p) => [p.id, p]));
