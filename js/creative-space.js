import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { Line2 } from "three/addons/lines/Line2.js";
import { LineGeometry } from "three/addons/lines/LineGeometry.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";

const PED_URL = "/models/ped.glb";
const LASTFM_USER = "ismaelrivela";
const LASTFM_KEY = "e3724b3c0543dd7ab22dfc394ffd4afc";
const ARTWORK_API = "https://vamps-artwork-api.vercel.app/api/artwork";
const LASTFM_PLACEHOLDER = "2a96cbd8b46e442fc41c2b86b821562f";
const BG = 0xf3f3f1;
const LINE_IDLE = 0.28;
const LINE_HOVER = 0.78;
const LINE_COLOR = 0x6f6a64;
const LINE_COLOR_WORK = 0xea352a;
const LINE_WIDTH_IDLE = 1.15;
const LINE_WIDTH_HOVER = 2.4;
const LINE_DASH = 0.06;
const LINE_GAP = 0.04;
/** true = nariz al elemento en hover; false = nariz al cursor (comportamiento anterior) */
const HEAD_AIM_AT_HOVER = true;
const HEAD_AIM_YAW_MAX = THREE.MathUtils.degToRad(60);
const HEAD_AIM_PITCH_MAX = THREE.MathUtils.degToRad(60);
const HEAD_AIM_DOT_MIN = Math.cos(HEAD_AIM_YAW_MAX);
const MOBILE_HEAD_SCALE = 2;
const MOBILE_HEAD_YAW = THREE.MathUtils.degToRad(14);
const MOBILE_HEAD_PITCH = THREE.MathUtils.degToRad(9);
const HEAD_KEEP = new Set(["Head", "Jaw", "L Brow", "R Brow"]);
const AUTO_SPIN = 0.018;
const DRAG_THRESH = 10;
const DRAG_SENS = 0.0038;

const FILTER_STORAGE_KEY = "vamps-creative-content-filter";
const LASTFM_CACHE_KEY = "vamps-lastfm-tracks-v2";
const LASTFM_POLL_MS = 30000;
const CONTENT_FILTERS = new Set(["all", "works", "socials"]);

const canvas = document.getElementById("stage");
const labelEl = document.getElementById("space-label");
const labelName = document.getElementById("space-label-name");
const labelMeta = document.getElementById("space-label-meta");
const filterEl = document.getElementById("space-filter");

const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const isMobile = () => innerWidth < 820 || innerHeight < 520;

const pointer = { x: 0, y: 0 };
const pointerTarget = { x: 0, y: 0 };
const ndc = new THREE.Vector2();
const raycaster = new THREE.Raycaster();
const clock = new THREE.Clock();
const loader = new THREE.TextureLoader();
loader.crossOrigin = "anonymous";

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: false,
  powerPreference: "high-performance",
});
renderer.setClearColor(BG, 1);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.sortObjects = true;

const scene = new THREE.Scene();
scene.background = new THREE.Color(BG);

const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 40);
const camBase = new THREE.Vector3(0, 0.28, 5.2);
camera.position.copy(camBase);

const hemi = new THREE.HemisphereLight(0xf7f4ee, 0x8d877c, 0.95);
scene.add(hemi);
const key = new THREE.DirectionalLight(0xfff8f0, 0.55);
key.position.set(2.4, 3.2, 4.2);
scene.add(key);
const fill = new THREE.DirectionalLight(0xd9d4cc, 0.22);
fill.position.set(-3.2, 0.4, 1.4);
scene.add(fill);

const headRoot = new THREE.Group();
headRoot.position.y = 0.06;
headRoot.renderOrder = 8;
const headPivot = new THREE.Group();
headRoot.add(headPivot);
scene.add(headRoot);

const orbitShell = new THREE.Group();
orbitShell.rotation.x = 0.05;
const orbitRing = new THREE.Group();
orbitShell.add(orbitRing);
scene.add(orbitShell);

const orbit = {
  velY: reduced ? 0 : AUTO_SPIN,
  velX: 0,
  dragging: false,
  dragMoved: false,
  lastX: 0,
  lastY: 0,
};

const pickables = [];
const orbitMeshes = [];
const lines = [];
const hoverScales = new Map();
const socialGrays = new Map();
const emailHovers = new Map();
let hovered = null;
let pendingNav = null;
let dockMesh = null;
let dockTex = null;
let mobileLayout = false;
let contentFilter = "all";
const contentVis = new Map();

const spaceScroll = document.getElementById("space-scroll");
const spaceHero = document.getElementById("space-hero");

const PROJECTS = [
  {
    id: "tulipana",
    name: "La Tulipana",
    year: "2025",
    role: "Concept, Project and Content Management",
    href: "/creative/case-studio/?case=tulipana",
    image: "/assets/projects/tulipana/pixelartlogo.webp",
    maxW: 0.5,
    maxH: 0.38,
    theta: 0.2,
    phi: 0.12,
  },
  {
    id: "copydad",
    name: "Copydad",
    year: "2026",
    role: "Concept and Content Branding",
    href: "/creative/case-studio/?case=copydad",
    image: "/assets/projects/copydad/copydad-coin.png",
    maxW: 0.44,
    maxH: 0.44,
    theta: 1.68,
    phi: -0.1,
  },
  {
    id: "vamps",
    name: "VAMPS",
    year: "2026",
    role: "Creative Director",
    href: "/creative/case-studio/?case=vamps",
    image: "/assets/projects/vamps-brand/isologotest.png",
    maxW: 0.56,
    maxH: 0.34,
    theta: 3.15,
    phi: -0.14,
  },
];

const ABOUT = {
  name: "About",
  role: "Bio and recent work",
  href: "/about/",
  image: "/assets/landing/isma.png",
  maxW: 0.24,
  maxH: 0.3,
  theta: 4.55,
  phi: 0.1,
};

const DOCK_SLOT = { theta: 2.45, phi: -0.16 };
const EMAIL = {
  id: "email",
  name: "Email",
  role: "ismael.creative@levamps.com",
  href: "mailto:ismael.creative@levamps.com",
  display: "ismael.creative@levamps.com",
  maxW: 0.92,
  maxH: 0.1,
  theta: 0.95,
  phi: 0.2,
};
const SOCIALS = [
  {
    id: "instagram",
    name: "Instagram",
    href: "https://www.instagram.com/ismaelrivela_/",
    image: "/assets/projects/ig.jpg",
    theta: 5.35,
    phi: 0.14,
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    href: "https://www.linkedin.com/in/ismaelrivelajelliti",
    image: "/assets/projects/linkedin.png",
    linkedin: true,
    theta: 0.55,
    phi: -0.12,
  },
];

const _headLine = new THREE.Vector3();
const _center = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _localO = new THREE.Vector3();
const _localD = new THREE.Vector3();
const _lineEnd = new THREE.Vector3();
const _inv = new THREE.Matrix4();
const _wp = new THREE.Vector3();
const _basePos = new THREE.Vector3();
const _parentQ = new THREE.Quaternion();
const _invParentQ = new THREE.Quaternion();
const _lookTarget = new THREE.Vector3();
const _lookQuat = new THREE.Quaternion();
const _headFwd = new THREE.Vector3(0, 0, 1);
const _headFwdWorld = new THREE.Vector3();
const _aimDir = new THREE.Vector3();

const orbitRadii = { x: 1.4, y: 0.95, z: 1.25 };

function computeOrbitRadii() {
  const dist = camBase.z;
  const vFov = THREE.MathUtils.degToRad(camera.fov);
  const halfH = Math.tan(vFov * 0.5) * dist;
  const halfW = halfH * camera.aspect;
  const aspect = camera.aspect;
  const mobile = isMobile();
  const headPad = mobile ? 0.48 : 0.54;

  if (aspect >= 1) {
    if (mobile) {
      const rx = Math.max(headPad + 0.68, halfW * 0.74 - 0.26);
      const ry = Math.max(headPad + 0.26, halfH * 0.36 - 0.16);
      orbitRadii.x = rx;
      orbitRadii.y = ry;
      orbitRadii.z = rx * 0.9;
      orbitShell.rotation.x = 0.03;
    } else {
      const vMargin = halfH * 0.17;
      const rx = Math.max(headPad + 0.94, halfW * 0.81 - 0.1);
      const ry = Math.min(
        Math.max(headPad + 0.18, halfH * 0.25 - 0.04),
        halfH - vMargin
      );
      orbitRadii.x = rx;
      orbitRadii.y = ry;
      orbitRadii.z = rx * 0.9;
      orbitShell.rotation.x = 0.025;
    }
  } else if (mobile) {
    const ry = Math.max(headPad + 0.58, halfH * 0.58 - 0.26);
    const rx = Math.max(headPad + 0.18, halfW * 0.5 - 0.16);
    orbitRadii.x = rx;
    orbitRadii.y = ry;
    orbitRadii.z = ry * 0.88;
    orbitShell.rotation.x = 0.055;
  } else {
    const vMargin = halfH * 0.15;
    const ry = Math.min(
      Math.max(headPad + 0.56, halfH * 0.5 - 0.24),
      halfH - vMargin
    );
    const rx = Math.max(headPad + 0.24, halfW * 0.5 - 0.1);
    orbitRadii.x = rx;
    orbitRadii.y = ry;
    orbitRadii.z = ry * 0.88;
    orbitShell.rotation.x = 0.048;
  }
  return orbitRadii;
}

function meshMatchesFilter(mesh, filter = contentFilter) {
  const kind = mesh.userData.kind;
  if (filter === "all") return true;
  if (filter === "works") return kind === "project";
  if (filter === "socials") {
    return kind === "social" || kind === "email" || kind === "about" || kind === "dock";
  }
  return true;
}

function loadContentFilter() {
  try {
    const saved = localStorage.getItem(FILTER_STORAGE_KEY);
    if (saved && CONTENT_FILTERS.has(saved)) return saved;
  } catch {
    /* noop */
  }
  return "all";
}

function setContentFilter(next, { persist = true } = {}) {
  if (!CONTENT_FILTERS.has(next)) return;
  contentFilter = next;
  if (persist) {
    try {
      localStorage.setItem(FILTER_STORAGE_KEY, next);
    } catch {
      /* noop */
    }
  }
  if (filterEl) {
    for (const btn of filterEl.querySelectorAll("[data-filter]")) {
      const on = btn.dataset.filter === next;
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    }
  }
  if (hovered && !meshMatchesFilter(hovered)) {
    hovered = null;
    setLabel(null);
  }
}

function initContentFilter() {
  if (!filterEl) return;
  setContentFilter(loadContentFilter(), { persist: false });
  filterEl.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-filter]");
    if (!btn || mobileLayout) return;
    setContentFilter(btn.dataset.filter);
  });
}

function updateContentVisibility(ease = 0.12) {
  const blend = reduced ? 1 : ease;

  for (const obj of orbitMeshes) {
    const want = meshMatchesFilter(obj) ? 1 : 0;
    const cur = contentVis.get(obj) ?? 1;
    const next = cur + (want - cur) * blend;
    contentVis.set(obj, next);

    obj.visible = next > 0.03;
    if (obj.material) {
      obj.material.transparent = true;
      obj.material.opacity = next;
      obj.material.depthWrite = next > 0.5;
    }

    const entry = obj.userData.lineEntry;
    if (entry) entry.line.visible = next > 0.03;
  }
}

function contentAlpha(mesh) {
  return contentVis.get(mesh) ?? 1;
}

function orbitRadius() {
  return Math.max(orbitRadii.x, orbitRadii.y);
}

function ellipsoidPos(theta, phi, rx, ry, rz) {
  const cp = Math.cos(phi);
  return new THREE.Vector3(
    rx * cp * Math.sin(theta),
    ry * Math.sin(phi),
    rz * cp * Math.cos(theta)
  );
}

function chaosSeed(obj) {
  if (obj.userData.chaos) return obj.userData.chaos;
  const r = () => Math.random() * Math.PI * 2;
  obj.userData.chaos = {
    p1: r(),
    p2: r(),
    p3: r(),
    p4: r(),
    f1: 0.12 + Math.random() * 0.18,
    f2: 0.16 + Math.random() * 0.22,
    f3: 0.1 + Math.random() * 0.16,
    f4: 0.2 + Math.random() * 0.24,
    aT: 0.04 + Math.random() * 0.03,
    aP: 0.028 + Math.random() * 0.025,
    aR: 0.005 + Math.random() * 0.006,
  };
  return obj.userData.chaos;
}

function chaoticEllipsoidPos(theta, phi, t, obj) {
  const c = chaosSeed(obj);
  const vDamp = isMobile() ? 1 : 0.62;
  const dT =
    Math.sin(t * c.f1 + c.p1) * c.aT +
    Math.sin(t * c.f4 + c.p3) * c.aT * 0.55 +
    Math.cos(t * c.f2 * 1.3 + c.p2) * c.aT * 0.35;
  const dP =
    (Math.cos(t * c.f2 + c.p2) * c.aP +
      Math.sin(t * c.f3 + c.p4) * c.aP * 0.7 +
      Math.sin(t * c.f1 * 0.8 + c.p3) * c.aP * 0.4) *
    vDamp;
  const dR =
    Math.sin(t * c.f3 + c.p1) * c.aR +
    Math.cos(t * c.f4 * 0.9 + c.p4) * c.aR * 0.65;
  const rMul = 1 + dR / orbitRadius();
  return ellipsoidPos(
    theta + dT,
    phi + dP,
    orbitRadii.x * rMul,
    orbitRadii.y * rMul,
    orbitRadii.z * rMul
  );
}

function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;");
}

function loadTexture(url) {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve(null), 2500);
    loader.load(
      url,
      (tex) => {
        clearTimeout(timeout);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.minFilter = THREE.LinearFilter;
        tex.generateMipmaps = false;
        resolve(tex);
      },
      undefined,
      () => {
        clearTimeout(timeout);
        resolve(null);
      }
    );
  });
}

function loadImage(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

const IG_ICON =
  "M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z";
const LI_ICON =
  "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z";

function drawSocialIcon(ctx, iconId, size, iconFrac = 0.36) {
  const path = iconId === "linkedin" ? LI_ICON : IG_ICON;
  ctx.save();
  ctx.translate(size / 2, size / 2);
  const s = (size / 24) * iconFrac;
  ctx.scale(s, s);
  ctx.translate(-12, -12);
  ctx.fillStyle = "#ffffff";
  ctx.fill(new Path2D(path));
  ctx.restore();
}

function drawImageCover(ctx, img, size, zoom = 1) {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  if (!iw || !ih) return;
  const cover = Math.max(size / iw, size / ih) * zoom;
  const dw = iw * cover;
  const dh = ih * cover;
  ctx.drawImage(img, (size - dw) * 0.5, (size - dh) * 0.5, dw, dh);
}

function paintSocialTexture(img, linkedin, hover) {
  const size = 256;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d");
  ctx.save();
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  ctx.filter = `grayscale(${100 - hover * 100}%)`;
  drawImageCover(ctx, img, size, linkedin ? 1.28 : 1);
  ctx.filter = "none";
  if (hover < 0.98) {
    ctx.fillStyle = `rgba(0,0,0,${0.45 * (1 - hover)})`;
    ctx.fillRect(0, 0, size, size);
    ctx.globalAlpha = 1 - hover;
    drawSocialIcon(ctx, linkedin ? "linkedin" : "instagram", size);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  return tex;
}

function paintTextTexture(text, hover = 0, opts = {}) {
  const uppercase = opts.uppercase !== false;
  const label = uppercase ? text.toUpperCase() : text;
  const fontSize = opts.fontSize ?? 38;
  const font = `700 ${fontSize}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
  const probe = document.createElement("canvas").getContext("2d");
  probe.font = font;
  const textW = probe.measureText(label).width;
  const padX = opts.padX ?? 22;
  const padY = opts.padY ?? 14;
  const c = document.createElement("canvas");
  c.width = Math.ceil(textW + padX * 2);
  c.height = fontSize + padY * 2;
  const ctx = c.getContext("2d");

  if (hover > 0.04) {
    ctx.fillStyle = `rgba(28, 27, 25, ${0.035 + hover * 0.05})`;
    roundRect(ctx, 1, 1, c.width - 2, c.height - 2, 10);
    ctx.fill();
  }

  const tone = Math.round(28 + hover * 78);
  ctx.fillStyle = `rgb(${tone}, ${tone - 2}, ${tone - 6})`;
  ctx.font = font;
  ctx.textBaseline = "middle";
  ctx.fillText(label, padX, c.height / 2);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  return tex;
}

function paintEmailTexture(text, hover = 0) {
  return paintTextTexture(text, hover, { fontSize: 38 });
}

function canvasTexture(seed, w = 256, h = 256) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  const hues = [28, 12, 200];
  ctx.fillStyle = `hsl(${hues[seed % hues.length]} 8% 72%)`;
  ctx.fillRect(0, 0, w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function planeSize(map, maxW, maxH) {
  const img = map?.image;
  const aspect = img && img.height ? img.width / img.height : 1;
  let h = maxH;
  let w = h * aspect;
  if (w > maxW) {
    w = maxW;
    h = w / aspect;
  }
  return [w, h];
}

function placeOnOrbit(obj, theta, phi) {
  obj.userData.orbitTheta = theta;
  obj.userData.orbitPhi = phi;
  orbitRing.add(obj);
  orbitMeshes.push(obj);
  makeLine(obj);
  return obj;
}

function makePlane(w, h, map, data) {
  const geo = new THREE.PlaneGeometry(w, h);
  const mat = new THREE.MeshBasicMaterial({
    map: map || undefined,
    color: map ? 0xffffff : 0xb7b0a6,
    transparent: true,
    alphaTest: 0.08,
    side: THREE.FrontSide,
    depthWrite: true,
    depthTest: true,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.userData = { ...data, planeW: w, planeH: h };
  mesh.userData.baseScale = 1;
  mesh.renderOrder = 4;
  hoverScales.set(mesh, 1);
  pickables.push(mesh);
  placeOnOrbit(mesh, data.theta, data.phi);
  return mesh;
}

function makeSocialDisc(tex, data, socialState) {
  const ref = isMobile() ? 1.05 : 1.25;
  const r = (isMobile() ? 0.13 : 0.15) * Math.min(1, orbitRadius() / ref);
  const geo = new THREE.CircleGeometry(r, 48);
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    side: THREE.FrontSide,
    depthWrite: true,
    depthTest: true,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.userData = {
    kind: "social",
    external: true,
    role: "Profile",
    planeW: r * 2,
    planeH: r * 2,
    socialState,
    ...data,
  };
  mesh.userData.baseScale = 1;
  mesh.renderOrder = 4;
  hoverScales.set(mesh, 1);
  socialGrays.set(mesh, 0);
  pickables.push(mesh);
  placeOnOrbit(mesh, data.theta, data.phi);
  return mesh;
}

function makeLine(toMesh) {
  const isWork = toMesh.userData.kind === "project";
  const geo = new LineGeometry();
  geo.setPositions([0, 0, 0, 0, 0, 0, 0, 0, 0]);
  const mat = new LineMaterial({
    color: isWork ? LINE_COLOR_WORK : LINE_COLOR,
    linewidth: LINE_WIDTH_IDLE,
    dashed: true,
    dashSize: LINE_DASH,
    gapSize: LINE_GAP,
    transparent: true,
    opacity: LINE_IDLE,
    depthWrite: false,
    depthTest: true,
    resolution: new THREE.Vector2(innerWidth, innerHeight),
  });
  const line = new Line2(geo, mat);
  line.frustumCulled = false;
  line.renderOrder = 2;
  scene.add(line);
  const entry = {
    line,
    geo,
    mat,
    target: toMesh,
    width: LINE_WIDTH_IDLE,
  };
  lines.push(entry);
  toMesh.userData.lineEntry = entry;
  return entry;
}

function drawDockCanvas(ctx, tracks) {
  const w = 512;
  const h = 220;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#f3f3f1";
  roundRect(ctx, 0, 0, w, h, 28);
  ctx.fill();
  ctx.strokeStyle = "rgba(28,27,25,0.07)";
  ctx.lineWidth = 2;
  roundRect(ctx, 1, 1, w - 2, h - 2, 27);
  ctx.stroke();

  ctx.fillStyle = "#6b6760";
  ctx.font = "500 18px Helvetica Neue, Helvetica, Arial, sans-serif";
  ctx.fillText("Recently played", 22, 34);

  const slotW = 118;
  const gap = 14;
  const startX = (w - slotW * 3 - gap * 2) / 2;
  const coverY = 52;
  const coverS = 96;

  for (let i = 0; i < 3; i++) {
    const t = tracks[i];
    const x = startX + i * (slotW + gap);
    ctx.fillStyle = "#e8e8e6";
    roundRect(ctx, x + (slotW - coverS) / 2, coverY, coverS, coverS, 10);
    ctx.fill();
    if (t?.artImg) {
      ctx.save();
      roundRect(ctx, x + (slotW - coverS) / 2, coverY, coverS, coverS, 10);
      ctx.clip();
      ctx.drawImage(t.artImg, x + (slotW - coverS) / 2, coverY, coverS, coverS);
      ctx.restore();
    }
    if (t?.now) {
      ctx.fillStyle = "#ed5b51";
      ctx.beginPath();
      ctx.arc(x + (slotW - coverS) / 2 + coverS - 10, coverY + 10, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#1c1b19";
    ctx.font = "500 15px Helvetica Neue, Helvetica, Arial, sans-serif";
    const name = t?.name || "—";
    ctx.fillText(truncate(ctx, name, slotW - 4), x + 2, coverY + coverS + 22);
    ctx.fillStyle = "#6b6760";
    ctx.font = "13px Helvetica Neue, Helvetica, Arial, sans-serif";
    const artist = t?.artist || "";
    ctx.fillText(truncate(ctx, artist, slotW - 4), x + 2, coverY + coverS + 40);
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function truncate(ctx, text, maxW) {
  if (ctx.measureText(text).width <= maxW) return text;
  let s = text;
  while (s.length > 1 && ctx.measureText(`${s}…`).width > maxW) s = s.slice(0, -1);
  return `${s}…`;
}

function trackListKey(tracks) {
  return tracks.map((t) => `${t.artist}§${t.name}§${t.now ? 1 : 0}`).join("|");
}

function loadCachedTracks() {
  try {
    const raw = localStorage.getItem(LASTFM_CACHE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!Array.isArray(data) || !data.length) return null;
    return data;
  } catch {
    return null;
  }
}

function saveCachedTracks(tracks) {
  if (!tracks?.length) return;
  try {
    localStorage.setItem(LASTFM_CACHE_KEY, JSON.stringify(tracks));
  } catch {
    /* noop */
  }
}

async function paintDock(tracks) {
  const enriched = [];
  for (const t of tracks) {
    let artImg = null;
    if (t.art) artImg = await loadImage(t.art);
    enriched.push({ ...t, artImg });
  }
  while (enriched.length < 3) enriched.push(null);

  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 220;
  const ctx = c.getContext("2d");
  drawDockCanvas(ctx, enriched);

  if (!dockTex) {
    dockTex = new THREE.CanvasTexture(c);
    dockTex.colorSpace = THREE.SRGBColorSpace;
    dockTex.minFilter = THREE.LinearFilter;
    const [w, h] = planeSize(dockTex, ...itemDim(0.82, 0.36));
    dockMesh = makePlane(w, h, dockTex, {
      kind: "dock",
      name: "Recently played",
      role: "Last.fm",
      href: null,
      theta: DOCK_SLOT.theta,
      phi: DOCK_SLOT.phi,
    });
  } else {
    dockTex.image = c;
    dockTex.needsUpdate = true;
  }
  scaleDockToViewport();
}

function renderMobileDock(tracks) {
  const host = document.getElementById("space-mobile-dock");
  if (!host) return;
  const slots = [...tracks];
  while (slots.length < 3) slots.push(null);

  host.innerHTML = `
    <div class="space-dock-mobile">
      <span class="space-dock-mobile__label">Recently played</span>
      <div class="space-dock-mobile__row">
        ${slots
          .map(
            (t) => `
          <div class="space-dock-mobile__slot">
            ${
              t?.art
                ? `<img class="space-dock-mobile__cover" src="${esc(t.art)}" alt="" loading="lazy" />`
                : `<div class="space-dock-mobile__cover"></div>`
            }
            <span class="space-dock-mobile__name">${esc(t?.name || "—")}</span>
            <span class="space-dock-mobile__artist">${esc(t?.artist || "")}</span>
          </div>
        `
          )
          .join("")}
      </div>
    </div>
  `;
}

let lastFmRenderedKey = "";

async function renderLastFmTracks(tracks) {
  if (!tracks?.length) return;
  const key = trackListKey(tracks);
  if (key === lastFmRenderedKey) return;
  lastFmRenderedKey = key;
  await paintDock(tracks);
  renderMobileDock(tracks);
}

function itemDim(maxW, maxH) {
  const ref = isMobile() ? 1.05 : 1.25;
  const k = Math.min(1, orbitRadius() / ref);
  return [maxW * k, maxH * k];
}

function rayRectEdge2D(ox, oy, dx, dy, hw, hh) {
  let tNear = -Infinity;
  let tFar = Infinity;
  const axes = [
    [dx, -hw - ox, hw - ox],
    [dy, -hh - oy, hh - oy],
  ];
  for (const [d, minB, maxB] of axes) {
    if (Math.abs(d) < 1e-6) {
      if (minB > 0 || maxB < 0) return null;
      continue;
    }
    const t1 = minB / d;
    const t2 = maxB / d;
    const lo = Math.min(t1, t2);
    const hi = Math.max(t1, t2);
    tNear = Math.max(tNear, lo);
    tFar = Math.min(tFar, hi);
  }
  if (tNear > tFar || tFar < 0) return null;
  const t = tNear > 0 ? tNear : tFar;
  return { x: ox + dx * t, y: oy + dy * t, z: 0 };
}

function planeLineAnchor(mesh) {
  mesh.updateWorldMatrix(true, false);
  mesh.getWorldPosition(_center);
  headAnchor(_headLine);
  _dir.subVectors(_center, _headLine);
  if (_dir.lengthSq() < 1e-6) return _center;
  _dir.normalize();

  if (mesh.userData.kind === "social") {
    const r = mesh.userData.planeW * mesh.scale.x * 0.5 * 0.94;
    return _lineEnd.copy(_center).addScaledVector(_dir, -r);
  }

  _inv.copy(mesh.matrixWorld).invert();
  _localO.copy(_headLine).applyMatrix4(_inv);
  _localD.copy(_dir).transformDirection(_inv);

  const hw = mesh.userData.planeW * mesh.scale.x * 0.54;
  const hh = mesh.userData.planeH * mesh.scale.y * 0.54;

  if (Math.abs(_localD.z) < 1e-5) return _center;
  const tPlane = -_localO.z / _localD.z;
  if (tPlane < 0) return _center;

  const hitX = _localO.x + _localD.x * tPlane;
  const hitY = _localO.y + _localD.y * tPlane;

  let lx = hitX;
  let ly = hitY;
  if (Math.abs(hitX) <= hw && Math.abs(hitY) <= hh) {
    const edge = rayRectEdge2D(_localO.x, _localO.y, _localD.x, _localD.y, hw, hh);
    if (edge) {
      lx = edge.x;
      ly = edge.y;
    }
  } else {
    lx = THREE.MathUtils.clamp(hitX, -hw, hw);
    ly = THREE.MathUtils.clamp(hitY, -hh, hh);
  }

  return _lineEnd.set(lx, ly, 0).applyMatrix4(mesh.matrixWorld);
}

function headAnchor(out) {
  headRoot.getWorldPosition(out);
  out.y -= 0.02;
}

function toBasic(mat) {
  const map = mat.map || null;
  if (map) {
    map.colorSpace = THREE.SRGBColorSpace;
    map.needsUpdate = true;
  }
  return new THREE.MeshBasicMaterial({
    map,
    transparent: mat.transparent,
    alphaTest: mat.alphaTest || 0.4,
    side: mat.side,
    depthWrite: true,
    depthTest: true,
  });
}

const _skinMat = new THREE.Matrix4();
const _skinned = new THREE.Vector3();

function skinnedVertex(mesh, index, target) {
  const geo = mesh.geometry;
  const pos = geo.attributes.position;
  const si = geo.attributes.skinIndex;
  const sw = geo.attributes.skinWeight;
  const bones = mesh.skeleton.bones;
  const inverses = mesh.skeleton.boneInverses;

  target.fromBufferAttribute(pos, index);
  target.applyMatrix4(mesh.bindMatrix);

  const px = target.x;
  const py = target.y;
  const pz = target.z;
  let x = 0;
  let y = 0;
  let z = 0;

  for (let i = 0; i < 4; i++) {
    const w = sw.getComponent(index, i);
    if (w === 0) continue;
    const boneIndex = si.getComponent(index, i);
    _skinMat.multiplyMatrices(bones[boneIndex].matrixWorld, inverses[boneIndex]);
    const e = _skinMat.elements;
    x += w * (e[0] * px + e[4] * py + e[8] * pz + e[12]);
    y += w * (e[1] * px + e[5] * py + e[9] * pz + e[13]);
    z += w * (e[2] * px + e[6] * py + e[10] * pz + e[14]);
  }

  target.set(x, y, z);
  target.applyMatrix4(mesh.bindMatrixInverse);
}

function dominantIsHead(mesh, index, keepIdx) {
  const si = mesh.geometry.attributes.skinIndex;
  const sw = mesh.geometry.attributes.skinWeight;
  let bestW = -1;
  let best = -1;
  for (let i = 0; i < 4; i++) {
    const w = sw.getComponent(index, i);
    if (w > bestW) {
      bestW = w;
      best = si.getComponent(index, i);
    }
  }
  return keepIdx.has(best);
}

function extractHeadMesh(mesh, keepIdx) {
  const geo = mesh.geometry;
  const pos = geo.attributes.position;
  const srcIndex = geo.index;
  if (!pos || !geo.attributes.skinIndex) return null;

  const keepVert = new Uint8Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    if (dominantIsHead(mesh, i, keepIdx)) keepVert[i] = 1;
  }

  const faces = [];
  const push = (a, b, c) => {
    if (keepVert[a] && keepVert[b] && keepVert[c]) faces.push(a, b, c);
  };
  if (srcIndex) {
    for (let i = 0; i < srcIndex.count; i += 3) {
      push(srcIndex.getX(i), srcIndex.getX(i + 1), srcIndex.getX(i + 2));
    }
  } else {
    for (let i = 0; i < pos.count; i += 3) push(i, i + 1, i + 2);
  }
  if (faces.length < 3) return null;

  const used = [...new Set(faces)];
  const remap = new Int32Array(pos.count).fill(-1);
  used.forEach((v, i) => {
    remap[v] = i;
  });

  const newPos = new Float32Array(used.length * 3);
  const srcUv = geo.attributes.uv;
  const newUv = srcUv ? new Float32Array(used.length * 2) : null;

  used.forEach((v, i) => {
    skinnedVertex(mesh, v, _skinned);
    _skinned.applyMatrix4(mesh.matrixWorld);
    newPos[i * 3] = _skinned.x;
    newPos[i * 3 + 1] = _skinned.y;
    newPos[i * 3 + 2] = _skinned.z;
    if (newUv) {
      newUv[i * 2] = srcUv.getX(v);
      newUv[i * 2 + 1] = srcUv.getY(v);
    }
  });

  const baked = new THREE.BufferGeometry();
  baked.setAttribute("position", new THREE.BufferAttribute(newPos, 3));
  if (newUv) baked.setAttribute("uv", new THREE.BufferAttribute(newUv, 2));
  baked.setIndex(faces.map((v) => remap[v]));
  baked.computeVertexNormals();

  const mat = Array.isArray(mesh.material)
    ? mesh.material.map((m) => m.clone())
    : mesh.material.clone();
  const out = new THREE.Mesh(baked, mat);
  out.frustumCulled = false;
  out.renderOrder = 8;
  return out;
}

function isolatePedHead(gltf) {
  const model = gltf.scene;
  model.rotation.y = Math.PI / 2;
  model.traverse((obj) => {
    if (!obj.isMesh) return;
    obj.material = Array.isArray(obj.material)
      ? obj.material.map(toBasic)
      : toBasic(obj.material);
    obj.renderOrder = 8;
  });

  model.updateMatrixWorld(true);

  const head = new THREE.Group();
  model.traverse((obj) => {
    if (!obj.isSkinnedMesh || !obj.skeleton) return;
    obj.skeleton.update();
    const keepIdx = new Set();
    obj.skeleton.bones.forEach((bone, i) => {
      if (HEAD_KEEP.has(bone.name)) keepIdx.add(i);
    });
    const piece = extractHeadMesh(obj, keepIdx);
    if (piece) head.add(piece);
  });

  if (!head.children.length) return model;

  const box = new THREE.Box3().setFromObject(head);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  head.position.sub(center);
  const wrap = new THREE.Group();
  wrap.add(head);
  wrap.rotation.y = Math.PI;
  wrap.scale.setScalar(1.08 / Math.max(size.y, 0.05));
  wrap.renderOrder = 8;
  return wrap;
}

function createPlaceholderHead() {
  const pts = [
    new THREE.Vector2(0.0, 0.74),
    new THREE.Vector2(0.16, 0.72),
    new THREE.Vector2(0.27, 0.62),
    new THREE.Vector2(0.3, 0.46),
    new THREE.Vector2(0.27, 0.32),
    new THREE.Vector2(0.2, 0.22),
    new THREE.Vector2(0.13, 0.14),
    new THREE.Vector2(0.12, 0.06),
    new THREE.Vector2(0.18, -0.02),
  ];
  const geo = new THREE.LatheGeometry(pts, 64);
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({
    color: 0x8f877c,
    roughness: 0.92,
    metalness: 0.02,
    depthWrite: true,
    depthTest: true,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = 0.04;
  mesh.renderOrder = 8;
  return mesh;
}

async function loadHead() {
  try {
    const gltf = await new GLTFLoader().loadAsync(PED_URL);
    return isolatePedHead(gltf);
  } catch {
    return null;
  }
}

function lastFmArt(images) {
  if (!images) return "";
  for (const size of ["extralarge", "large", "medium", "small"]) {
    const url = images.find((img) => img.size === size)?.["#text"];
    if (url && !url.includes(LASTFM_PLACEHOLDER) && url.trim()) {
      return url.replace("http://", "https://");
    }
  }
  return "";
}

async function itunesArt(artist, track) {
  try {
    const r = await fetch(
      `${ARTWORK_API}?artist=${encodeURIComponent(artist)}&track=${encodeURIComponent(track)}`
    );
    const d = await r.json();
    return d.url || "";
  } catch {
    return "";
  }
}

function isYouTube(t) {
  const artist = (t.artist?.["#text"] || "").toLowerCase();
  const album = (t.album?.["#text"] || "").toLowerCase();
  if (!artist || artist === "youtube") return true;
  if (album.includes("- topic") || album.includes("auto-generated")) return true;
  return false;
}

const NON_MUSIC_RE =
  /\b(playlist|podcasts?|episodio|episode|opening\s*\d|openings?\s*\d|soundtrack compilation|mixtape|full album|entrevista|debate|documental|analizando|react(?:s|ing)?|watch party)\b/i;

function isNonMusicScrobble(t) {
  if (isYouTube(t)) return true;

  const artist = (t.artist?.["#text"] || "").trim();
  const name = (t.name || "").trim();
  const album = (t.album?.["#text"] || "").trim();
  const blob = `${artist} ${name} ${album}`;

  if (NON_MUSIC_RE.test(blob)) return true;
  if (/^\d{1,3}$/.test(name)) return true;
  if (name.split(/\s+/).length >= 9) return true;
  if (name.length >= 56) return true;

  return false;
}

function normalizeMusicMeta(artist, name) {
  const fifaInName = name.match(/^(.+?)\s*\((?:fifa|nba|madden)\s*\d+/i);
  if (fifaInName) {
    return { artist: fifaInName[1].trim(), name: artist.trim() || name };
  }
  const fifaInArtist = artist.match(/^(.+?)\s*\((?:fifa|nba|madden)\s*\d+/i);
  if (fifaInArtist) {
    return { artist: fifaInArtist[1].trim(), name: name.trim() || artist };
  }
  return { artist, name };
}

async function resolveTrackArt(artist, track) {
  let art = await itunesArt(artist, track);
  if (!art && artist && track) art = await itunesArt(track, artist);
  return art;
}

async function fetchTracksFromApi() {
  try {
    const r = await fetch(
      `https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${LASTFM_USER}&api_key=${LASTFM_KEY}&format=json&limit=30&_=${Date.now()}`,
      { cache: "no-store" }
    );
    const data = await r.json();
    if (data.error) return null;
    const tracks = data.recenttracks?.track || [];
    const all = Array.isArray(tracks) ? tracks : [tracks];
    const seen = new Set();
    const list = [];
    for (const t of all) {
      if (isNonMusicScrobble(t)) continue;

      const rawArtist = t.artist?.["#text"] || "";
      const rawName = t.name || "";
      const { artist, name } = normalizeMusicMeta(rawArtist, rawName);
      const key = `${artist}§${name}`.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);

      let art = lastFmArt(t.image);
      if (!art) art = await resolveTrackArt(artist, name);
      if (!art) continue;

      list.push({
        name,
        artist,
        art,
        now: t["@attr"]?.nowplaying === "true",
      });
      if (list.length === 3) break;
    }
    return list.length ? list : null;
  } catch {
    return null;
  }
}

async function refreshLastFmTracks() {
  const fresh = await fetchTracksFromApi();
  if (!fresh?.length) return;
  saveCachedTracks(fresh);
  await renderLastFmTracks(fresh);
}

async function initLastFmDock() {
  const cached = loadCachedTracks();
  if (cached?.length) await renderLastFmTracks(cached);
  await refreshLastFmTracks();
  setInterval(refreshLastFmTracks, LASTFM_POLL_MS);
}

function setLayoutMode(mobile) {
  mobileLayout = mobile;
  document.body.classList.toggle("space--mobile", mobile);
  document.documentElement.classList.toggle("space--mobile", mobile);
  orbitShell.visible = !mobile;
  for (const { line } of lines) line.visible = !mobile;
  if (!mobile) {
    hovered = null;
    labelEl.hidden = true;
  }
}

function resize() {
  const mobile = isMobile();
  setLayoutMode(mobile);

  let w;
  let h;
  if (mobile) {
    w = spaceHero?.clientWidth || innerWidth;
    h = spaceHero?.clientHeight || Math.min(innerWidth * 0.44, 264);
    camBase.set(0, 0.04, 3.55);
    camera.fov = 42;
    headRoot.scale.setScalar(MOBILE_HEAD_SCALE);
  } else {
    w = innerWidth;
    h = innerHeight;
    camBase.set(0, 0.28, 5.2);
    camera.fov = 36;
    headRoot.scale.setScalar(1);
    computeOrbitRadii();
    scaleDockToViewport();
  }

  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();

  for (const { mat } of lines) {
    mat.resolution.set(w, h);
  }
}

function scaleDockToViewport() {
  if (!dockMesh || !dockTex) return;
  const [w, h] = planeSize(dockTex, ...itemDim(0.82, 0.36));
  dockMesh.geometry.dispose();
  dockMesh.geometry = new THREE.PlaneGeometry(w, h);
  dockMesh.userData.planeW = w;
  dockMesh.userData.planeH = h;
}

const _scrCenter = new THREE.Vector3();
const _scrBottom = new THREE.Vector3();

function meshScreenAnchor(mesh) {
  mesh.updateWorldMatrix(true, false);
  mesh.getWorldPosition(_scrCenter);
  const hh = (mesh.userData.planeH ?? 0.2) * mesh.scale.y * 0.5;
  _scrBottom.set(0, -hh, 0).applyMatrix4(mesh.matrixWorld);
  _scrCenter.project(camera);
  _scrBottom.project(camera);
  if (_scrCenter.z > 1) return null;
  const cx = (_scrCenter.x * 0.5 + 0.5) * innerWidth;
  const bottom = (-_scrBottom.y * 0.5 + 0.5) * innerHeight;
  return { cx, bottom };
}

function setLabel(data, mesh) {
  if (!data || !mesh) {
    labelEl.hidden = true;
    labelEl.classList.remove("space-label--work");
    if (!orbit.dragging) canvas.style.cursor = "grab";
    return;
  }
  const anchor = meshScreenAnchor(mesh);
  if (!anchor) {
    labelEl.hidden = true;
    return;
  }
  labelName.textContent = data.name;
  const meta =
    data.kind === "about"
      ? ""
      : [data.year, data.role].filter(Boolean).join(" · ");
  labelMeta.textContent = meta;
  labelMeta.hidden = !meta;
  labelEl.classList.toggle("space-label--work", data.kind === "project");
  labelEl.hidden = false;
  const cx = Math.min(Math.max(anchor.cx, 88), innerWidth - 88);
  const top = Math.min(anchor.bottom + 10, innerHeight - 68);
  labelEl.style.left = `${cx}px`;
  labelEl.style.top = `${top}px`;
  canvas.style.cursor = data.href ? "pointer" : orbit.dragging ? "grabbing" : "grab";
}

function clientToNdc(clientX, clientY, out) {
  const rect = canvas.getBoundingClientRect();
  const rw = rect.width || 1;
  const rh = rect.height || 1;
  out.x = ((clientX - rect.left) / rw) * 2 - 1;
  out.y = -((clientY - rect.top) / rh) * 2 + 1;
  return out;
}

function pick(clientX, clientY) {
  clientToNdc(clientX, clientY, ndc);
  raycaster.setFromCamera(ndc, camera);
  const hits = raycaster.intersectObjects(pickables, false);
  for (const hit of hits) {
    if (meshMatchesFilter(hit.object) && contentAlpha(hit.object) > 0.35) {
      return hit.object;
    }
  }
  return null;
}

function onPointerMove(e) {
  clientToNdc(e.clientX, e.clientY, ndc);
  pointerTarget.x = ndc.x;
  pointerTarget.y = ndc.y;

  if (mobileLayout) return;

  if (orbit.dragging) {
    const dx = e.clientX - orbit.lastX;
    const dy = e.clientY - orbit.lastY;
    orbit.lastX = e.clientX;
    orbit.lastY = e.clientY;
    if (Math.abs(dx) + Math.abs(dy) > DRAG_THRESH) {
      orbit.dragMoved = true;
      pendingNav = null;
    }
    orbitRing.rotation.y += dx * DRAG_SENS;
    orbitRing.rotation.x += dy * DRAG_SENS;
    orbit.velY = dx * DRAG_SENS * 18;
    orbit.velX = dy * DRAG_SENS * 18;
    canvas.style.cursor = "grabbing";
    return;
  }

  const obj = pick(e.clientX, e.clientY);
  hovered = obj;
}

function hideDragHint() {
  const hint = document.getElementById("space-drag-hint");
  if (!hint || hint.classList.contains("is-hidden")) return;
  hint.classList.add("is-hidden");
}

function initDragHint() {
  const hint = document.getElementById("space-drag-hint");
  if (!hint || mobileLayout) {
    hideDragHint();
    return;
  }
  window.setTimeout(hideDragHint, 9000);
}

function onPointerDown(e) {
  if (mobileLayout) return;
  hideDragHint();
  const obj = pick(e.clientX, e.clientY);
  pendingNav = obj?.userData?.href ? obj : null;
  orbit.dragging = true;
  orbit.dragMoved = false;
  orbit.lastX = e.clientX;
  orbit.lastY = e.clientY;
  canvas.setPointerCapture(e.pointerId);
  canvas.style.cursor = "grabbing";
}

function onPointerUp(e) {
  if (!orbit.dragging) return;
  orbit.dragging = false;
  try {
    canvas.releasePointerCapture(e.pointerId);
  } catch {
    /* noop */
  }
  if (pendingNav?.userData?.href && !orbit.dragMoved) {
    const href = pendingNav.userData.href;
    if (pendingNav.userData.external) {
      window.open(href, "_blank", "noopener");
    } else {
      location.href = href;
    }
  }
  pendingNav = null;
  canvas.style.cursor = hovered?.userData?.href ? "pointer" : "grab";
}

function onPointerLeave() {
  pointerTarget.x = 0;
  pointerTarget.y = 0;
  if (!orbit.dragging) {
    hovered = null;
    setLabel(null);
  }
}

function faceCamera(obj) {
  obj.parent.getWorldQuaternion(_parentQ);
  _invParentQ.copy(_parentQ).invert();
  obj.quaternion.copy(camera.quaternion).premultiply(_invParentQ);
}

function updateSocialHover(mesh, wantHover) {
  const st = mesh.userData.socialState;
  if (!st) return;
  const cur = socialGrays.get(mesh) ?? 0;
  const next = cur + ((wantHover ? 1 : 0) - cur) * (reduced ? 1 : 0.12);
  socialGrays.set(mesh, next);
  if (Math.abs(next - st.lastPaint) < 0.04) return;
  st.lastPaint = next;
  const tex = paintSocialTexture(st.img, st.linkedin, next);
  if (mesh.material.map) mesh.material.map.dispose();
  mesh.material.map = tex;
  mesh.material.needsUpdate = true;
}

function updateEmailHover(mesh, wantHover) {
  const st = mesh.userData.emailState;
  if (!st) return;
  const cur = emailHovers.get(mesh) ?? 0;
  const next = cur + ((wantHover ? 1 : 0) - cur) * (reduced ? 1 : 0.12);
  emailHovers.set(mesh, next);
  if (Math.abs(next - st.lastHover) < 0.04) return;
  st.lastHover = next;
  const tex = paintEmailTexture(st.display, next);
  if (mesh.material.map) mesh.material.map.dispose();
  mesh.material.map = tex;
  mesh.material.needsUpdate = true;
}

function updateLines() {
  headAnchor(_headLine);
  const floorY = headRoot.position.y - 0.2;
  const ease = reduced ? 1 : 0.1;

  for (const entry of lines) {
    const { geo, mat, target, line } = entry;
    const vis = contentAlpha(target);
    if (vis < 0.03) continue;

    const end = planeLineAnchor(target);
    const midX = (_headLine.x + end.x) * 0.5;
    const midZ = (_headLine.z + end.z) * 0.5;
    const midY = Math.min(floorY, (_headLine.y + end.y) * 0.5 - 0.06);
    geo.setPositions([
      _headLine.x,
      _headLine.y,
      _headLine.z,
      midX,
      midY,
      midZ,
      end.x,
      end.y,
      end.z,
    ]);

    const hot = hovered === target;
    const isWork = target.userData.kind === "project";
    mat.color.setHex(isWork ? LINE_COLOR_WORK : LINE_COLOR);
    const wantOp = (hot ? LINE_HOVER : LINE_IDLE) * vis;
    const wantW = hot ? LINE_WIDTH_HOVER : LINE_WIDTH_IDLE;
    const wantDash = !hot;

    mat.opacity += (wantOp - mat.opacity) * ease;
    entry.width += (wantW - entry.width) * ease;
    mat.linewidth = entry.width;

    if (mat.dashed !== wantDash) {
      mat.dashed = wantDash;
      mat.needsUpdate = true;
    }

    line.computeLineDistances();
  }
}

function applyOrbitMotion(t) {
  for (const obj of orbitMeshes) {
    const { orbitTheta, orbitPhi } = obj.userData;
    if (orbitTheta === undefined) continue;
    _basePos.copy(chaoticEllipsoidPos(orbitTheta, orbitPhi, t, obj));
    obj.position.copy(_basePos);
  }
}

function clampHeadAim(dir) {
  const yaw = Math.atan2(dir.x, dir.z);
  const pitch = Math.asin(THREE.MathUtils.clamp(dir.y, -1, 1));
  const cy = THREE.MathUtils.clamp(yaw, -HEAD_AIM_YAW_MAX, HEAD_AIM_YAW_MAX);
  const cp = THREE.MathUtils.clamp(pitch, -HEAD_AIM_PITCH_MAX, HEAD_AIM_PITCH_MAX);
  const cosP = Math.cos(cp);
  dir.set(Math.sin(cy) * cosP, Math.sin(cp), Math.cos(cy) * cosP);
  return dir;
}

function updateHeadLook() {
  headPivot.getWorldPosition(_wp);

  if (mobileLayout && !reduced) {
    const t = clock.elapsedTime;
    _lookTarget.set(
      Math.sin(t * 0.36) * 1.05,
      headRoot.position.y + Math.sin(t * 0.28 + 1.1) * 0.18,
      3.55
    );
    _aimDir.subVectors(_lookTarget, _wp);
    if (_aimDir.lengthSq() < 1e-6) return;
    _aimDir.normalize();
    const yaw = Math.atan2(_aimDir.x, _aimDir.z);
    const pitch = Math.asin(THREE.MathUtils.clamp(_aimDir.y, -1, 1));
    const cy = THREE.MathUtils.clamp(yaw, -MOBILE_HEAD_YAW, MOBILE_HEAD_YAW);
    const cp = THREE.MathUtils.clamp(pitch, -MOBILE_HEAD_PITCH, MOBILE_HEAD_PITCH);
    const cosP = Math.cos(cp);
    _aimDir.set(Math.sin(cy) * cosP, Math.sin(cp), Math.cos(cy) * cosP);
    _lookQuat.setFromUnitVectors(_headFwd, _aimDir);
    headPivot.quaternion.slerp(_lookQuat, 0.085);
    return;
  }

  let aimAtHover = false;
  if (HEAD_AIM_AT_HOVER && hovered) {
    hovered.getWorldPosition(_lookTarget);
    _headFwdWorld.copy(_headFwd).applyQuaternion(headPivot.quaternion);
    _aimDir.subVectors(_lookTarget, _wp);
    if (_aimDir.lengthSq() > 1e-6) {
      _aimDir.normalize();
      aimAtHover = _headFwdWorld.dot(_aimDir) > HEAD_AIM_DOT_MIN;
    }
  }

  if (!aimAtHover) {
    const mobile = isMobile();
    const spreadX = mobile ? 1.7 : 2.5;
    const spreadY = mobile ? 1.25 : 1.85;
    const depth = mobile ? 3.4 : 4.2;
    _lookTarget.set(
      pointer.x * spreadX,
      headRoot.position.y + pointer.y * spreadY * 0.38,
      depth
    );
  }

  _aimDir.subVectors(_lookTarget, _wp);
  if (_aimDir.lengthSq() < 1e-6) return;
  _aimDir.normalize();
  clampHeadAim(_aimDir);

  _lookQuat.setFromUnitVectors(_headFwd, _aimDir);
  const blend = reduced ? 1 : aimAtHover ? 0.18 : 0.14;
  headPivot.quaternion.slerp(_lookQuat, blend);
}

function buildMobileScroll() {
  if (!spaceScroll || spaceScroll.dataset.built) return;
  spaceScroll.dataset.built = "1";

  const casesSec = document.createElement("section");
  casesSec.className = "space-section space-section--cases";
  casesSec.innerHTML = `<p class="space-section__eyebrow">Selected work</p>`;
  const track = document.createElement("div");
  track.className = "space-cases__track";
  for (const p of PROJECTS) {
    const a = document.createElement("a");
    a.className = "space-case";
    a.href = p.href;
    a.innerHTML = `<img class="space-case__logo" src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy" />`;
    track.appendChild(a);
  }
  casesSec.appendChild(track);
  spaceScroll.appendChild(casesSec);

  const split = document.createElement("section");
  split.className = "space-section space-section--about-social";
  const about = document.createElement("a");
  about.className = "space-text space-text--about";
  about.href = ABOUT.href;
  about.textContent = "About";
  const socials = document.createElement("div");
  socials.className = "space-socials-inline";
  for (const s of SOCIALS) {
    const a = document.createElement("a");
    a.className = `space-social-inline${s.linkedin ? " space-social-inline--linkedin" : ""}`;
    a.href = s.href;
    a.target = "_blank";
    a.rel = "noopener";
    const icon = s.linkedin ? LI_ICON : IG_ICON;
    a.innerHTML = `
      <img src="${esc(s.image)}" alt="${esc(s.name)}" loading="lazy" />
      <span class="space-social-inline__icon" aria-hidden="true">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="${icon}"/></svg>
      </span>
    `;
    socials.appendChild(a);
  }
  split.append(about, socials);
  spaceScroll.appendChild(split);

  const dockSec = document.createElement("section");
  dockSec.className = "space-section space-section--dock";
  dockSec.id = "space-mobile-dock";
  spaceScroll.appendChild(dockSec);

  const emailSec = document.createElement("section");
  emailSec.className = "space-section space-section--email";
  const email = document.createElement("a");
  email.className = "space-text space-text--email";
  email.href = EMAIL.href;
  email.textContent = EMAIL.display.toUpperCase();
  emailSec.appendChild(email);
  spaceScroll.appendChild(emailSec);

  const vampsSec = document.createElement("section");
  vampsSec.className = "space-section space-section--vamps";
  const vampsLink = document.createElement("a");
  vampsLink.className = "space-footer-vamps";
  vampsLink.href = "/";
  vampsLink.setAttribute("aria-label", "Volver a VAMPS");
  vampsLink.innerHTML = `<img src="/assets/vamps/logovamps.svg" alt="" width="300" height="300" decoding="async" />`;
  vampsSec.appendChild(vampsLink);
  spaceScroll.appendChild(vampsSec);
}

function tick() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  const ease = reduced ? 1 : 0.065;

  pointer.x += (pointerTarget.x - pointer.x) * ease;
  pointer.y += (pointerTarget.y - pointer.y) * ease;

  if (mobileLayout) {
    camera.position.copy(camBase);
    camera.lookAt(0, 0.06, 0);
    headRoot.position.y = 0.06 + (reduced ? 0 : Math.sin(t * 0.4) * 0.012);
    updateHeadLook();
    renderer.render(scene, camera);
    requestAnimationFrame(tick);
    return;
  }

  const pan = 0.08;
  camera.position.x = camBase.x + pointer.x * pan;
  camera.position.y = camBase.y - pointer.y * 0.06;
  camera.position.z = camBase.z;
  camera.lookAt(pointer.x * 0.04, 0.08, 0);

  if (!reduced && !orbit.dragging) {
    orbitRing.rotation.y += orbit.velY * dt;
    orbitRing.rotation.x += orbit.velX * dt;
    orbit.velY += (AUTO_SPIN - orbit.velY) * 0.008;
    orbit.velX *= 0.992;
  }

  headRoot.position.y = 0.06 + (reduced ? 0 : Math.sin(t * 0.4) * 0.01);

  applyOrbitMotion(t);

  for (const obj of orbitMeshes) {
    faceCamera(obj);

    if (obj.isMesh) {
      const want = hovered === obj ? 1.06 : 1;
      const cur = hoverScales.get(obj) ?? 1;
      const next = cur + (want - cur) * (reduced ? 1 : 0.12);
      hoverScales.set(obj, next);
      obj.scale.setScalar(next);

      if (obj.userData.socialState) {
        updateSocialHover(obj, hovered === obj);
      }
      if (obj.userData.emailState) {
        updateEmailHover(obj, hovered === obj);
      }
    }
  }

  updateContentVisibility();
  updateHeadLook();
  updateLines();

  if (hovered) setLabel(hovered.userData, hovered);
  else labelEl.hidden = true;

  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

async function init() {
  buildMobileScroll();
  initContentFilter();
  initDragHint();
  resize();
  canvas.style.cursor = "grab";
  requestAnimationFrame(tick);

  headPivot.add(createPlaceholderHead());
  loadHead().then((model) => {
    if (!model) return;
    headPivot.clear();
    headPivot.add(model);
  });

  for (const p of PROJECTS) {
    const map = (await loadTexture(p.image)) || canvasTexture(1, 512, 640);
    const [mw, mh] = itemDim(p.maxW, p.maxH);
    const [w, h] = planeSize(map, mw, mh);
    makePlane(w, h, map, { kind: "project", ...p });
  }

  {
    const map = (await loadTexture(ABOUT.image)) || canvasTexture(2, 400, 520);
    const [mw, mh] = itemDim(ABOUT.maxW, ABOUT.maxH);
    const [w, h] = planeSize(map, mw, mh);
    makePlane(w, h, map, { kind: "about", ...ABOUT });
  }

  for (const s of SOCIALS) {
    const img = await loadImage(s.image);
    if (!img) continue;
    const socialState = {
      img,
      linkedin: Boolean(s.linkedin),
      icon: s.id,
      lastPaint: -1,
    };
    const tex = paintSocialTexture(img, socialState.linkedin, 0);
    makeSocialDisc(tex, s, socialState);
  }

  {
    const tex = paintEmailTexture(EMAIL.display, 0);
    const [mw, mh] = itemDim(EMAIL.maxW, EMAIL.maxH);
    const [w, h] = planeSize(tex, mw, mh);
    const mesh = makePlane(w, h, tex, { kind: "email", ...EMAIL });
    mesh.userData.emailState = { display: EMAIL.display, lastHover: -1 };
    emailHovers.set(mesh, 0);
  }

  initLastFmDock();
}

window.addEventListener("resize", resize);
window.addEventListener("pointermove", onPointerMove, { passive: true });
canvas.addEventListener("pointerdown", onPointerDown);
canvas.addEventListener("pointerup", onPointerUp);
canvas.addEventListener("pointercancel", onPointerUp);
canvas.addEventListener("pointerleave", onPointerLeave);

init();
