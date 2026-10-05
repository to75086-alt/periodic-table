/* ============================================================
   INTERACTIVE PERIODIC TABLE + 3D BOHR MODEL
   ============================================================ */

/* ---------- Category mapping (từ JSON gốc → class CSS) ---------- */
const CATEGORY_MAP = {
  "alkali metal":            { cls: "cat-alkali-metal",     label: "Alkali Metal" },
  "alkaline earth metal":    { cls: "cat-alkaline-earth",   label: "Alkaline Earth" },
  "transition metal":        { cls: "cat-transition-metal", label: "Transition Metal" },
  "post-transition metal":   { cls: "cat-post-transition",  label: "Post-transition" },
  "metalloid":               { cls: "cat-metalloid",        label: "Metalloid" },
  "diatomic nonmetal":       { cls: "cat-nonmetal",         label: "Nonmetal" },
  "polyatomic nonmetal":     { cls: "cat-nonmetal",         label: "Nonmetal" },
  "nonmetal":                { cls: "cat-nonmetal",         label: "Nonmetal" },
  "halogen":                 { cls: "cat-halogen",          label: "Halogen" },
  "noble gas":               { cls: "cat-noble-gas",        label: "Noble Gas" },
  "lanthanide":              { cls: "cat-lanthanide",       label: "Lanthanide" },
  "actinide":                { cls: "cat-actinide",         label: "Actinide" },
  "unknown, probably transition metal": { cls: "cat-unknown", label: "Unknown" },
  "unknown, probably post-transition metal": { cls: "cat-unknown", label: "Unknown" },
  "unknown, probably metalloid": { cls: "cat-unknown", label: "Unknown" },
  "unknown, predicted to be noble gas": { cls: "cat-unknown", label: "Unknown" },
  "unknown, probably transition metal ": { cls: "cat-unknown", label: "Unknown" }
};

function getCat(catName) {
  if (!catName) return { cls: "cat-unknown", label: "Unknown" };
  const key = catName.toLowerCase().trim();
  for (const k in CATEGORY_MAP) {
    if (key.includes(k)) return CATEGORY_MAP[k];
  }
  return { cls: "cat-unknown", label: catName };
}

/* ---------- Build main table ---------- */
const table = document.getElementById("table");
const legendEl = document.getElementById("legend");

function getGridPos(el) {
  if (el.number >= 57 && el.number <= 71) return { row: 9,  col: el.number - 57 + 3 };
  if (el.number >= 89 && el.number <= 103) return { row: 10, col: el.number - 89 + 3 };
  return { row: el.period, col: el.group };
}

elements.forEach(el => {
  const pos = getGridPos(el);
  const cat = getCat(el.category);
  const div = document.createElement("div");
  div.className = "element " + cat.cls;
  div.style.gridRow = pos.row;
  div.style.gridColumn = pos.col;
  div.innerHTML = `
    <span class="number">${el.number}</span>
    <span class="symbol">${el.symbol}</span>
    <span class="name">${el.name}</span>
  `;
  div.addEventListener("click", () => showDetail(el));
  table.appendChild(div);
});

/* ---------- Legend ---------- */
const LEGEND_ITEMS = [
  ["cat-alkali-metal",     "Alkali Metal"],
  ["cat-alkaline-earth",   "Alkaline Earth"],
  ["cat-transition-metal", "Transition Metal"],
  ["cat-post-transition",  "Post-transition"],
  ["cat-metalloid",        "Metalloid"],
  ["cat-nonmetal",         "Nonmetal"],
  ["cat-halogen",          "Halogen"],
  ["cat-noble-gas",        "Noble Gas"],
  ["cat-lanthanide",       "Lanthanide"],
  ["cat-actinide",         "Actinide"],
  ["cat-unknown",          "Unknown"]
];
LEGEND_ITEMS.forEach(([cls, label]) => {
  const s = document.createElement("span");
  s.className = "legend-item " + cls;
  s.textContent = label;
  legendEl.appendChild(s);
});

/* ---------- Detail view ---------- */
const mainView   = document.getElementById("main-view");
const detailView = document.getElementById("detail-view");
let currentEl = null;

function showDetail(el) {
  currentEl = el;
  mainView.style.display = "none";
  detailView.style.display = "block";
  window.scrollTo(0, 0);

  const cat = getCat(el.category);

  document.getElementById("d-badge").className = "element-badge " + cat.cls;
  document.getElementById("d-z").textContent = el.number;
  document.getElementById("d-symbol").textContent = el.symbol;
  document.getElementById("d-mass").textContent = el.atomicMass;
  document.getElementById("d-name").textContent = el.name;
  document.getElementById("d-config").textContent = el.electronConfiguration || "—";
  document.getElementById("d-mass2").textContent = el.atomicMass + " u";

  const tagsEl = document.getElementById("d-tags");
  tagsEl.innerHTML = "";
  const tagData = [
    cat.label,
    "Block " + (el.block || "?").toUpperCase(),
    "Period " + el.period,
    el.group ? "Group " + el.group : "—"
  ];
  tagData.forEach(t => {
    const s = document.createElement("span");
    s.className = "tag";
    s.textContent = t;
    tagsEl.appendChild(s);
  });

  buildBohrModel(el);
}

document.getElementById("back-btn").addEventListener("click", () => {
  detailView.style.display = "none";
  mainView.style.display = "block";
  disposeBohr();
});

document.getElementById("prev-btn").addEventListener("click", () => {
  const idx = elements.findIndex(e => e.number === currentEl.number);
  if (idx > 0) showDetail(elements[idx - 1]);
});

document.getElementById("next-btn").addEventListener("click", () => {
  const idx = elements.findIndex(e => e.number === currentEl.number);
  if (idx < elements.length - 1) showDetail(elements[idx + 1]);
});

/* ============================================================
   3D BOHR MODEL with Three.js
   ============================================================ */
let scene, camera, renderer, animationId, controls;
let shellData = [];

function disposeBohr() {
  if (animationId) cancelAnimationFrame(animationId);
  const container = document.getElementById("bohr-container");
  while (container.firstChild) container.removeChild(container.firstChild);
  scene = null; camera = null; renderer = null;
}

/* Phân bố electron theo lớp: 2, 8, 18, 32... */
function getShellDistribution(z) {
  const maxPerShell = [2, 8, 18, 32, 32, 18, 8];
  const shells = [];
  let remaining = z;
  for (let i = 0; i < maxPerShell.length && remaining > 0; i++) {
    const take = Math.min(maxPerShell[i], remaining);
    shells.push(take);
    remaining -= take;
  }
  return shells;
}

/* Xoay/zoom bằng chuột — code orbit đơn giản */
function makeOrbitControls(camera, domElement, target) {
  let isDown = false, px = 0, py = 0;
  let theta = 0, phi = Math.PI / 3, radius = 22;

  function update() {
    camera.position.x = target.x + radius * Math.sin(phi) * Math.sin(theta);
    camera.position.y = target.y + radius * Math.cos(phi);
    camera.position.z = target.z + radius * Math.sin(phi) * Math.cos(theta);
    camera.lookAt(target);
  }
  update();

  domElement.addEventListener("mousedown", e => {
    isDown = true; px = e.clientX; py = e.clientY;
  });
  window.addEventListener("mouseup", () => isDown = false);
  window.addEventListener("mousemove", e => {
    if (!isDown) return;
    const dx = e.clientX - px, dy = e.clientY - py;
    px = e.clientX; py = e.clientY;
    theta -= dx * 0.008;
    phi   -= dy * 0.008;
    phi = Math.max(0.1, Math.min(Math.PI - 0.1, phi));
    update();
  });
  domElement.addEventListener("wheel", e => {
    e.preventDefault();
    radius *= (1 + Math.sign(e.deltaY) * 0.1);
    radius = Math.max(6, Math.min(80, radius));
    update();
  }, { passive: false });

  /* Touch cho mobile */
  domElement.addEventListener("touchstart", e => {
    if (e.touches.length === 1) {
      isDown = true;
      px = e.touches[0].clientX;
      py = e.touches[0].clientY;
    }
  });
  domElement.addEventListener("touchend", () => isDown = false);
  domElement.addEventListener("touchmove", e => {
    if (!isDown || e.touches.length !== 1) return;
    const dx = e.touches[0].clientX - px;
    const dy = e.touches[0].clientY - py;
    px = e.touches[0].clientX;
    py = e.touches[0].clientY;
    theta -= dx * 0.01;
    phi   -= dy * 0.01;
    phi = Math.max(0.1, Math.min(Math.PI - 0.1, phi));
    update();
  });

  return { update };
}

function buildBohrModel(el) {
  disposeBohr();
  const container = document.getElementById("bohr-container");
  const w = container.clientWidth;
  const h = container.clientHeight;

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 1000);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(w, h);
  renderer.setPixelRatio(window.devicePixelRatio);
  container.appendChild(renderer.domElement);

  /* Ánh sáng */
  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  const light = new THREE.PointLight(0xffffff, 1.2);
  light.position.set(15, 15, 15);
  scene.add(light);

  /* Hạt nhân */
  const nucleusRadius = 0.9 + Math.log10(el.number + 1) * 0.35;
  const nucleusGeo = new THREE.SphereGeometry(nucleusRadius, 32, 32);
  const nucleusMat = new THREE.MeshPhongMaterial({
    color: 0x94a3b8,
    emissive: 0x475569,
    shininess: 80
  });
  const nucleus = new THREE.Mesh(nucleusGeo, nucleusMat);
  scene.add(nucleus);

  /* Các lớp vỏ + electron */
  const shells = getShellDistribution(el.number);
  shellData = [];

  shells.forEach((count, i) => {
    const orbitRadius = nucleusRadius + 1.8 + i * 1.6;

    /* Vẽ đường quỹ đạo */
    const curve = new THREE.EllipseCurve(0, 0, orbitRadius, orbitRadius, 0, 2 * Math.PI);
    const points = curve.getPoints(64);
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    const mat = new THREE.LineBasicMaterial({
      color: 0x334155,
      transparent: true,
      opacity: 0.6
    });
    const orbit = new THREE.LineLoop(geo, mat);

    /* Nghiêng quỹ đạo theo các góc khác nhau */
    orbit.rotation.x = Math.PI / 2 + (i % 2 === 0 ? 0.35 : -0.35);
    orbit.rotation.y = i * 0.4;
    orbit.rotation.z = i * 0.25;
    scene.add(orbit);

    /* Electron */
    const electrons = [];
    const eGeo = new THREE.SphereGeometry(0.22, 16, 16);
    const eMat = new THREE.MeshPhongMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      shininess: 100
    });

    for (let j = 0; j < count; j++) {
      const e = new THREE.Mesh(eGeo, eMat);
      /* Gán vào một group xoay theo orbit */
      const group = new THREE.Group();
      group.rotation.copy(orbit.rotation);
      group.add(e);
      scene.add(group);
      electrons.push({
        mesh: e,
        group: group,
        angle: (j / count) * Math.PI * 2,
        radius: orbitRadius,
        speed: 0.4 + Math.random() * 0.3
      });
    }

    shellData.push({ electrons, orbitRadius });
  });

  /* Controls */
  const target = new THREE.Vector3(0, 0, 0);
  controls = makeOrbitControls(camera, renderer.domElement, target);

  /* Animation loop */
  function animate() {
    animationId = requestAnimationFrame(animate);

    shellData.forEach(shell => {
      shell.electrons.forEach(e => {
        e.angle += 0.01 * e.speed;
        e.mesh.position.set(
          Math.cos(e.angle) * e.radius,
          Math.sin(e.angle) * e.radius,
          0
        );
      });
    });

    renderer.render(scene, camera);
  }
  animate();
}

/* Resize */
window.addEventListener("resize", () => {
  if (!renderer || !camera) return;
  const container = document.getElementById("bohr-container");
  const w = container.clientWidth, h = container.clientHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
});
