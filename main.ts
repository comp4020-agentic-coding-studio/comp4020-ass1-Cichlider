import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

interface Part {
  name: string;
  info: string;
  color: number;
  size: [number, number, number];
  assembled: THREE.Vector3;
  explodeDir: THREE.Vector3;
  transparent?: boolean;
}

const PARTS: Part[] = [
  {
    name: "Case",
    info: "The shell that holds every part in alignment and channels airflow — remove it and nothing stays cool or in place.",
    color: 0x4b5563,
    size: [4.4, 5.2, 3.6],
    assembled: new THREE.Vector3(0, 0, 0),
    explodeDir: new THREE.Vector3(0, 1, 0),
    transparent: true,
  },
  // The remaining six fan out radially at 60° apart (with a shared upward
  // lift) so exploding never sends two parts in near-enough directions to
  // occlude each other on screen.
  {
    name: "Motherboard",
    info: "The wiring hub every other part plugs into — without it, none of the pieces can talk to each other.",
    color: 0x0f766e,
    size: [3.6, 4.2, 0.15],
    assembled: new THREE.Vector3(-1.6, 0, -1.5),
    explodeDir: new THREE.Vector3(1, 0.5, 0),
  },
  {
    name: "CPU",
    info: "Executes instructions one at a time, extremely fast — the only part that actually computes.",
    color: 0xd97706,
    size: [0.5, 0.5, 0.15],
    assembled: new THREE.Vector3(-1.6, 0.9, -1.35),
    explodeDir: new THREE.Vector3(0.5, 0.5, 0.866),
  },
  {
    name: "RAM",
    info: "Holds what the CPU is using right now — fast, but forgets everything the instant the power cuts.",
    color: 0x7c3aed,
    size: [0.25, 1.6, 0.05],
    assembled: new THREE.Vector3(-0.4, 0.6, -1.35),
    explodeDir: new THREE.Vector3(0.5, 0.5, -0.866),
  },
  {
    name: "GPU",
    info: "Does the same simple arithmetic thousands of times at once — built for images, drafted for anything repetitive.",
    color: 0xe11d48,
    size: [3, 0.9, 1.4],
    assembled: new THREE.Vector3(-1.6, -0.8, -1.2),
    explodeDir: new THREE.Vector3(-0.5, 0.5, 0.866),
  },
  {
    name: "PSU",
    info: "Converts wall power into the exact voltages every other part needs — nothing else in the box can safely take mains power directly.",
    color: 0x0284c7,
    size: [1.8, 1.8, 1.6],
    assembled: new THREE.Vector3(1.4, 1.6, -0.8),
    explodeDir: new THREE.Vector3(-0.5, 0.5, -0.866),
  },
  {
    name: "Storage",
    info: "The only part that still remembers anything after the power is off.",
    color: 0x059669,
    size: [1, 1, 0.3],
    assembled: new THREE.Vector3(1.4, -1.6, 1.2),
    explodeDir: new THREE.Vector3(-1, 0.5, 0),
  },
];

const containerQuery = document.querySelector<HTMLDivElement>('[data-testid="scene"]');
const toggleQuery = document.querySelector<HTMLButtonElement>("#explode-toggle");
const infoPanelQuery = document.querySelector<HTMLElement>('[data-testid="part-info"]');

if (containerQuery && toggleQuery && infoPanelQuery) {
  const container = containerQuery;
  const toggle = toggleQuery;
  const infoPanel = infoPanelQuery;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf4f4f5);

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(8, 10, 12);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  container.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.target.set(0, 0, 0);

  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  const key = new THREE.DirectionalLight(0xffffff, 0.9);
  key.position.set(5, 8, 6);
  scene.add(key);

  const meshes = PARTS.map((part) => {
    const geometry = new THREE.BoxGeometry(...part.size);
    const material = new THREE.MeshStandardMaterial(
      part.transparent
        ? { color: part.color, transparent: true, opacity: 0.16, depthWrite: false }
        : { color: part.color },
    );
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(part.assembled);
    mesh.userData.part = part;
    scene.add(mesh);
    return mesh;
  });

  function resize() {
    const width = container.clientWidth;
    const height = container.clientHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  }
  window.addEventListener("resize", resize);
  resize();

  const EXPLODE_DISTANCE = 6;
  let exploded = false;
  let progress = 0; // 0 = assembled, 1 = exploded

  toggle.addEventListener("click", () => {
    exploded = !exploded;
    toggle.setAttribute("aria-pressed", String(exploded));
    toggle.textContent = exploded ? "Reassemble" : "Explode";
  });

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  function showPart(part: Part) {
    infoPanel.innerHTML = "";
    const heading = document.createElement("h2");
    heading.textContent = part.name;
    const body = document.createElement("p");
    body.textContent = part.info;
    infoPanel.append(heading, body);
  }

  renderer.domElement.addEventListener("click", (event) => {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(meshes);
    // The Case is see-through on purpose; don't let its (invisible) surface
    // win a click over a solid part sitting behind it in the same ray.
    const hit = hits.find((h) => !(h.object.userData.part as Part).transparent) ?? hits[0];
    if (hit) showPart(hit.object.userData.part as Part);
  });

  function animate() {
    requestAnimationFrame(animate);
    const target = exploded ? 1 : 0;
    progress += (target - progress) * 0.08;
    for (const mesh of meshes) {
      const part = mesh.userData.part as Part;
      mesh.position.copy(part.assembled).addScaledVector(part.explodeDir, progress * EXPLODE_DISTANCE);
    }
    controls.update();
    renderer.render(scene, camera);
  }
  animate();
}
