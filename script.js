/* ============================================================
   INTERACTIVE PERIODIC TABLE + 3D BOHR MODEL
   ============================================================ */

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

const VALID_ELEMENTS = elements.filter(el => el.number >= 1 && el.number <= 118);

const table = document.getElementById("table");
const legendEl = document.getElementById("legend");

function getGridPos(el) {
  if (el.number >= 57 && el.number <= 71) return { row: 9,  col: el.number - 57 + 3 };
  if (el.number >= 89 && el.number <= 103) return { row: 10, col: el.number - 89 + 3 };
  return { row: el.period, col: el.group };
}

VALID_ELEMENTS.forEach(el => {
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

const mainView   = document.getElementById("main-view");
const detailView = document.getElementById("detail-view");
let currentEl = null;

function safe(val, fallback = "—") {
  if (val === null || val === undefined || val === "" || Number.isNaN(val)) return fallback;
  return val;
}

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

  document.getElementById("d-config").textContent = safe(el.electronConfiguration);
  document.getElementById("d-mass2").textContent = safe(el.atomicMass) + " u";

  const en = el.electronegativity_pauling;
  document.getElementById("d-en").textContent = en != null ? en : "—";

  const ar = el.atomic_radius;
  document.getElementById("d-ar").textContent = ar != null ? ar + " pm" : "—";

  const mass = parseFloat(el.atomicMass);
  const neutrons = (!isNaN(mass)) ? Math.round(mass) - el.number : null;
  document.getElementById("d-neutrons").textContent = neutrons != null ? neutrons : "—";

  const about = safe(el.summary, "No description available.");
  document.getElementById("d-about").textContent = about;

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
  const idx = VALID_ELEMENTS.findIndex(e => e.number === currentEl.number);
  if (idx > 0) showDetail(VALID_ELEMENTS[idx - 1]);
});

document.getElementById("next-btn").addEventListener("click", () => {
  const idx = VALID_ELEMENTS.findIndex(e => e.number === currentEl.number);
  if (idx < VALID_ELEMENTS.length - 1) showDetail(VALID_ELEMENTS[idx + 1]);
});

let scene, camera, renderer, animationId;
let shellData = [];

function disposeBohr() {
  if (animationId) cancelAnimationFrame(animationId);
  const container = document.getElementById("bohr-container");
  while (container.firstChild) container.removeChild(container.firstChild);
  scene = null; camera = null; renderer = null;
}

function getShellDistribution(z) {
  /* Bảng tra cứu cho các nguyên tố có cấu hình electron ngoại lệ (bán bão hòa / bão hòa) */
  const EXCEPTIONS = {
    24:  [2, 8, 13, 1],
    29:  [2, 8, 18, 1],
    41:  [2, 8, 18, 12, 1],
    42:  [2, 8, 18, 13, 1],
    44:  [2, 8, 18, 15, 1],
    45:  [2, 8, 18, 16, 1],
    46:  [2, 8, 18, 18],
    47:  [2, 8, 18, 18, 1],
    57:  [2, 8, 18, 18, 9, 2],
    58:  [2, 8, 18, 19, 9, 2],
    64:  [2, 8, 18, 25, 9, 2],
    78:  [2, 8, 18, 32, 17, 1],
    79:  [2, 8, 18, 32, 18, 1],
    89:  [2, 8, 18, 32, 18, 9, 2],
    90:  [2, 8, 18, 32, 18, 10, 2],
    91:  [2, 8, 18, 32, 20, 9, 2],
    92:  [2, 8, 18, 32, 21, 9, 2],
    93:  [2, 8, 18, 32, 22, 9, 2],
    96:  [2, 8, 18, 32, 25, 9, 2],
    103: [2, 8, 18, 32, 32, 8, 3],
    111: [2, 8, 18, 32, 32, 18, 1]
  };

  if (EXCEPTIONS[z]) {
    return EXCEPTIONS[z];
  }

  const orbitalOrder = [
    { n: 1, type: "s", max: 2 }, { n: 2, type: "s", max: 2 }, { n: 2, type: "p", max: 6 },
    { n: 3, type: "s", max: 2 }, { n: 3, type: "p", max: 6 }, { n: 4, type: "s", max: 2 },
    { n: 3, type: "d", max: 10 }, { n: 4, type: "p", max: 6 }, { n: 5, type: "s", max: 2 },
    { n: 4, type: "d", max: 10 }, { n: 5, type: "p", max: 6 }, { n: 6, type: "s", max: 2 },
    { n: 4, type: "f", max: 14 }, { n: 5, type: "d", max: 10 }, { n: 6, type: "p", max: 6 },
    { n: 7, type: "s", max: 2 }, { n: 5, type: "f", max: 14 }, { n: 6, type: "d", max: 10 },
    { n: 7, type: "p", max: 6 }
  ];

  const shellCounts = {};
  let remaining = z;
  for (const orb of orbitalOrder) {
    if (remaining <= 0) break;
    const fill = Math.min(orb.max, remaining);
    shellCounts[orb.n] = (shellCounts[orb.n] || 0) + fill;
    remaining -= fill;
  }

  const maxN = Math.max(...Object.keys(shellCounts).map(Number));
  const shells = [];
  for (let n = 1; n <= maxN; n++) {
    shells.push(shellCounts[n] || 0);
  }
  return shells;
}
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

function makeNucleusTexture(charge) {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");

  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0, "#e2e8f0");
  grad.addColorStop(0.5, "#cbd5e1");
  grad.addColorStop(1, "#94a3b8");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 180px 'Segoe UI', Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("+" + charge, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
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

  scene.add(new THREE.AmbientLight(0xffffff, 0.7));
  const light = new THREE.PointLight(0xffffff, 1.2);
  light.position.set(15, 15, 15);
  scene.add(light);

  const nucleusRadius = 1.1 + Math.log10(el.number + 1) * 0.4;
  const nucleusGeo = new THREE.SphereGeometry(nucleusRadius, 48, 48);
  const texture = makeNucleusTexture(el.number);
  const nucleusMat = new THREE.MeshPhongMaterial({
    map: texture,
    shininess: 60
  });
  const nucleus = new THREE.Mesh(nucleusGeo, nucleusMat);
  scene.add(nucleus);

  const shells = getShellDistribution(el.number);
  shellData = [];

  shells.forEach((count, i) => {
    const orbitRadius = nucleusRadius + 2 + i * 1.7;

    const curve = new THREE.EllipseCurve(0, 0, orbitRadius, orbitRadius, 0, 2 * Math.PI);
    const points = curve.getPoints(80);
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    const mat = new THREE.LineBasicMaterial({
      color: 0x334155,
      transparent: true,
      opacity: 0.7
    });
    const orbit = new THREE.LineLoop(geo, mat);
    orbit.rotation.x = Math.PI / 2 + (i % 2 === 0 ? 0.35 : -0.35);
    orbit.rotation.y = i * 0.4;
    orbit.rotation.z = i * 0.25;
    scene.add(orbit);

    const electrons = [];
    const eGeo = new THREE.SphereGeometry(0.24, 16, 16);
    const eMat = new THREE.MeshPhongMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      shininess: 100
    });

    for (let j = 0; j < count; j++) {
      const e = new THREE.Mesh(eGeo, eMat);
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

  const target = new THREE.Vector3(0, 0, 0);
  makeOrbitControls(camera, renderer.domElement, target);

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

window.addEventListener("resize", () => {
  if (!renderer || !camera) return;
  const container = document.getElementById("bohr-container");
  const w = container.clientWidth, h = container.clientHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
});

/* ============================================================
   STARFIELD BACKGROUND
   ============================================================ */
(function createStars() {
  const starfield = document.getElementById("starfield");
  if (!starfield) return;

  const STAR_COUNT = 200;
  const fragment = document.createDocumentFragment();

  for (let i = 0; i < STAR_COUNT; i++) {
    const star = document.createElement("div");
    star.className = "star";

    const size = Math.random() * 1.5 + 1;
    star.style.width = size + "px";
    star.style.height = size + "px";

    star.style.left = Math.random() * 100 + "%";
    star.style.top = Math.random() * 100 + "%";

    star.style.animationDuration = (Math.random() * 3 + 2) + "s";
    star.style.animationDelay = (Math.random() * 3) + "s";

    fragment.appendChild(star);
  }

  starfield.appendChild(fragment);
})();
