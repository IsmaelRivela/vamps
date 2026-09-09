import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import {
  alignPhoneScreen,
  applyContent,
  attachHiddenVideo,
  loadContentMedia,
  primeVideoPlayback,
  stopMedia,
  dockYawForScreen,
  yawForScreen,
} from "./mockup-content.js";
import { mountAsciiLoupe } from "./ascii-loupe.js";

const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const mobileMq = window.matchMedia("(max-width: 899px)");
const AUTO_SPIN = reduced ? 0 : 18;
const DOCK_OPEN = "transform 0.58s cubic-bezier(0.22, 1.28, 0.36, 1)";

function thumbSrc(item) {
  if (item.type === "glyphs") return item.thumb || item.glyphs?.[0] || item.src;
  if (item.type === "link") return item.thumb || item.src;
  if (item.type === "model" && item.contentPoster) return item.contentPoster;
  if (item.type === "video" && item.poster) return item.poster;
  return item.src;
}

function isGif(item) {
  return item.src?.endsWith(".gif");
}

function dockRadius(n) {
  return Math.max(7.5, 5.8 + n * 0.65);
}

const VIEWER_FIT = 0.9;
const MODEL_VIEWER_PAD = 0.88;
const DEFAULT_MODEL_ASPECT = 0.78;
const LINK_LABEL_EXTRA_PX = 40;
const VIEWER_SLOT_MIN_PX = 192;
const FLOAT_AMP_Y = 9;
const FLOAT_SPEED = 0.7;
const MODEL_CURSOR_YAW = 0.42;
const MODEL_CURSOR_PITCH = 0.2;
const MODEL_CURSOR_ROLL = 0.24;
const MODEL_CURSOR_LERP = 9;
const MOBILE_IDLE_YAW = 0.1;
const MOBILE_IDLE_PITCH = 0.045;
const MOBILE_IDLE_SPEED = 0.5;

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

function damp(current, target, lambda, dt) {
  return current + (target - current) * (1 - Math.exp(-lambda * dt));
}

function applyMetalLighting(renderer, scene, item) {
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = Number(item.modelExposure) || 1.2;
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
  pmrem.dispose();
}

function tuneMetalMaterials(root) {
  root.traverse((child) => {
    if (!child.isMesh?.material) return;
    const mats = Array.isArray(child.material) ? child.material : [child.material];
    mats.forEach((mat) => {
      if (mat.metalness === undefined) return;
      mat.metalness = 0.95;
      mat.roughness = 0.16;
      mat.envMapIntensity = 1.3;
      mat.needsUpdate = true;
    });
  });
}

function bindModelOrientation(entry, item, opts = {}) {
  const pitch = Number(item.modelPitch);
  const roll = Number(item.modelRoll);
  entry.basePitch = Number.isFinite(pitch) ? pitch : opts.dock ? 0.05 : 0;
  entry.baseRoll = Number.isFinite(roll) ? roll : 0;
  entry.faceLock = !!item.modelFaceLock;
  entry.cursorTrack = !!item.cursorTrack;
}

function attachModelToScene(scene, model, item) {
  if (!item.cursorTrack) {
    scene.add(model);
    return model;
  }
  const pivot = new THREE.Group();
  pivot.add(model);
  scene.add(pivot);
  return pivot;
}

function applyModelRotation(entry, px, py, dt, spinRate = 0.45) {
  if (!entry.root) return;

  if (entry.cursorTrack) {
    if (entry.spinEnabled) entry.spin += dt * spinRate;
    const targetYaw = entry.spin + px;
    const targetPitch = py;
    entry.root.rotation.y = damp(entry.root.rotation.y, targetYaw, MODEL_CURSOR_LERP, dt);
    entry.root.rotation.x = damp(entry.root.rotation.x, targetPitch, MODEL_CURSOR_LERP, dt);
    return;
  }

  if (entry.spinEnabled) entry.spin += dt * spinRate;
  const targetYaw = entry.yaw + entry.spin + px;
  const targetPitch = entry.basePitch + py;
  entry.root.rotation.y = damp(entry.root.rotation.y, targetYaw, MODEL_CURSOR_LERP, dt);
  entry.root.rotation.x = damp(entry.root.rotation.x, targetPitch, MODEL_CURSOR_LERP, dt);
  if (entry.faceLock) {
    const targetRoll = entry.baseRoll + px * MODEL_CURSOR_ROLL;
    entry.root.rotation.z = damp(entry.root.rotation.z, targetRoll, MODEL_CURSOR_LERP, dt);
  }
}

function mobileIdleSway(t) {
  return {
    yaw: Math.sin(t * MOBILE_IDLE_SPEED) * MOBILE_IDLE_YAW,
    pitch: Math.sin(t * MOBILE_IDLE_SPEED * 0.82 + 1.1) * MOBILE_IDLE_PITCH,
  };
}

function normPointer(clientX, clientY, rect) {
  if (!rect?.width || !rect?.height) return { x: 0, y: 0 };
  return {
    x: clamp(((clientX - rect.left) / rect.width) * 2 - 1, -1, 1),
    y: clamp(((clientY - rect.top) / rect.height) * 2 - 1, -1, 1),
  };
}

function loadImageSize(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () =>
      resolve({
        w: img.naturalWidth || 1,
        h: img.naturalHeight || 1,
      });
    img.onerror = () => resolve({ w: 4, h: 3 });
    img.src = src;
  });
}

function loadVideoSize(src) {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      resolve({
        w: video.videoWidth || 16,
        h: video.videoHeight || 9,
      });
      video.removeAttribute("src");
      video.load();
    };
    video.onerror = () => resolve({ w: 16, h: 9 });
    video.src = src;
  });
}

function modelViewAspect(root, item) {
  if (Number.isFinite(item.viewAspect)) return item.viewAspect;
  if (!root) return DEFAULT_MODEL_ASPECT;
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  box.getSize(size);
  const width = Math.max(size.x, size.z, 0.001);
  return clamp(size.y / width, 0.45, 2.4);
}

function mountLoupeInBody(body, item) {
  const loupeSrc = item.loupeSrc;
  if (!loupeSrc) return;
  const loupeHint = item.loupeHint || "look closer";
  body.innerHTML = `
    <div class="cstudio__loupe">
      <div class="cstudio__glyphs-loupe ascii-loupe">
        <span class="ascii-loupe__hint cstudio__glyphs-loupe-hint">${loupeHint}</span>
        <img src="${loupeSrc}" alt="${item.alt || ""}" class="ascii-loupe__img" loading="lazy" decoding="async" draggable="false" />
        <div class="ascii-loupe__lens" aria-hidden="true"></div>
      </div>
    </div>`;
  const loupe = body.querySelector(".cstudio__glyphs-loupe");
  if (!loupe) return;
  const img = loupe.querySelector(".ascii-loupe__img");
  const bind = () => mountAsciiLoupe(loupe);
  if (img?.complete) bind();
  else img?.addEventListener("load", bind, { once: true });
}

async function measureItemDisplayHeight(item, maxW) {
  if (item.type === "glyphs") return maxW * 0.52;
  if (item.loupeSrc) {
    const { w, h } = await loadImageSize(item.loupeSrc);
    return maxW * (h / w);
  }
  if (item.type === "model") {
    const extra = item.visitHref ? LINK_LABEL_EXTRA_PX : 0;
    const aspect = Number(item.viewAspect) || DEFAULT_MODEL_ASPECT;
    return maxW * aspect + extra;
  }
  if (item.type === "link") {
    const { w, h } = await loadImageSize(thumbSrc(item));
    return maxW * (h / w) + LINK_LABEL_EXTRA_PX;
  }
  if (item.type === "video" && !isGif(item)) {
    const { w, h } = await loadVideoSize(item.src);
    return maxW * (h / w);
  }
  const { w, h } = await loadImageSize(item.src);
  return maxW * (h / w);
}

function fitInViewerBox(nw, nh, maxW, maxH, widthPriority = false) {
  let w = maxW;
  let h = w * (nh / nw);
  if (!widthPriority && h > maxH) {
    h = maxH;
    w = h * (nw / nh);
  }
  return { w, h };
}

function clampStartIndex(index, len) {
  if (!len) return 0;
  const i = Number(index);
  if (!Number.isFinite(i)) return 0;
  return Math.min(Math.max(0, Math.floor(i)), len - 1);
}

function whenMediaReady(el, fn) {
  if (!el) return;
  const run = () => fn();
  if (el.tagName === "VIDEO") {
    if (el.readyState >= 1) run();
    else el.addEventListener("loadedmetadata", run, { once: true });
    return;
  }
  if (el.complete && el.naturalWidth) run();
  else el.addEventListener("load", run, { once: true });
}

export class CaseStage {
  constructor(root, items, opts = {}) {
    this.root = root;
    this.items = items;
    this.viewer = root.querySelector("[data-viewer]");
    this.dockRing = root.querySelector("[data-dock-ring]");
    this.dockScene = root.querySelector("[data-dock-scene]");
    this.indexEl = opts.indexEl;
    this.countEl = opts.countEl;
    this.labelEl = opts.labelEl;
    this.startIndex = clampStartIndex(opts.startIndex, items.length);

    this.active = this.startIndex;
    this.spin = 0;
    this.spinVel = 0;
    this.dragging = false;
    this.dragMoved = false;
    this.dragStartX = 0;
    this.lastX = 0;
    this.spinPaused = false;
    this.opening = false;
    this.floater = null;
    this.floatModel = null;
    this.dockModels = new Map();
    this.clock = new THREE.Clock();
    this.gltfLoader = new GLTFLoader();
    this.fbxLoader = new FBXLoader();
    this.textureLoader = new THREE.TextureLoader();
    this.modelPointer = { x: 0, y: 0 };
    this.viewerPointer = { x: 0, y: 0 };
    this.cursorFollow = reduced ? 0.35 : 1;

    this._onDockDown = (e) => this.onDockDown(e);
    this._onDockMove = (e) => this.onDockMove(e);
    this._onDockUp = (e) => this.onDockUp(e);
    this._onModelPointer = (e) => this.updateModelPointer(e);
    this._onPrimeVideos = () => this.primeAllVideos();
    this._slotTimer = null;
    this._viewerRo = null;
    this._onMobileLayout = () => this.queueViewerSlot();

    this.dockScene?.addEventListener("pointerdown", this._onDockDown);
    window.addEventListener("pointermove", this._onDockMove);
    window.addEventListener("pointermove", this._onModelPointer, { passive: true });
    window.addEventListener("pointerup", this._onDockUp);
    this.viewer?.addEventListener("touchstart", this._onPrimeVideos, { passive: true });

    this.buildDock();
    this.alignDockSpin(this.startIndex);
    if (this.countEl) this.countEl.textContent = String(items.length).padStart(2, "0");
    if (this.items.length) void this.select(this.startIndex, false);
    this.initViewerSlot();
    this.tick();

    window.addEventListener("touchstart", this._onPrimeVideos, { passive: true });
    window.addEventListener("pointerdown", this._onPrimeVideos, { passive: true });

    if (this.viewer && typeof IntersectionObserver !== "undefined") {
      this._videoIo = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) this.primeAllVideos();
        },
        { threshold: 0.15 }
      );
      this._videoIo.observe(this.viewer);
    }
  }

  primeAllVideos() {
    for (const entry of this.dockModels.values()) primeVideoPlayback(entry.media);
    primeVideoPlayback(this.floatModel?.media);
  }

  alignDockSpin(index) {
    const n = this.items.length;
    if (!n || !this.dockRing) return;
    const step = 360 / n;
    this.spin = -index * step;
    this.layoutDock();
  }

  async ensureInitialSelection() {
    if (!this.items.length || !this.viewer) return;
    await this.waitForViewerLayout();
    if (!this.floater) await this.select(this.startIndex, false);
    else {
      const body = this.floater.querySelector(".cstudio__float-body");
      if (body) await this.fitFloatBodyWhenReady(body);
    }
  }

  initViewerSlot() {
    if (!this.viewer) {
      if (this.items.length) void this.select(this.startIndex, false);
      return;
    }
    this._viewerRo = new ResizeObserver(() => this.queueViewerSlot());
    this._viewerRo.observe(this.viewer);
    if (this.root) {
      this._stageRo = new ResizeObserver(() => this.queueViewerSlot());
      this._stageRo.observe(this.root);
    }
    mobileMq.addEventListener("change", this._onMobileLayout);
    this.queueViewerSlot({ boot: true });
  }

  queueViewerSlot(opts = {}) {
    clearTimeout(this._slotTimer);
    this._slotTimer = setTimeout(() => this.updateViewerSlot(opts), opts.boot ? 0 : 60);
  }

  async waitForViewerLayout() {
    if (!this.viewer) return;
    for (let i = 0; i < 24; i++) {
      if (this.viewer.offsetWidth > 100 && this.viewer.offsetHeight > 100) return;
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
  }

  async updateViewerSlot(opts = {}) {
    if (!this.viewer) return;

    if (!this.items.length) {
      this.viewer.style.height = "";
      this.viewer.style.minHeight = "";
      this.viewer.classList.remove("is-slot-ready");
      return;
    }

    const useFixedSlot = mobileMq.matches;
    if (!useFixedSlot) {
      this.viewer.style.height = "";
      this.viewer.style.minHeight = "";
      this.viewer.classList.remove("is-slot-ready");
      if (opts.boot || opts.reselect) await this.ensureInitialSelection();
      else {
        const body = this.floater?.querySelector(".cstudio__float-body");
        if (body) await this.fitFloatBodyWhenReady(body);
      }
      return;
    }

    this.viewer.style.height = "100%";
    this.viewer.style.minHeight = "0";
    this.viewer.classList.add("is-slot-ready");

    if (opts.boot || opts.reselect) {
      await this.ensureInitialSelection();
      return;
    }

    const body = this.floater?.querySelector(".cstudio__float-body");
    if (body) await this.fitFloatBodyWhenReady(body);
  }

  buildDock() {
    if (!this.dockRing) return;
    this.disposeDockModels();
    const n = this.items.length;
    const r = dockRadius(n);
    this.dockRing.style.setProperty("--dock-r", `${r}rem`);
    this.dockRing.innerHTML = this.items
      .map((item, i) => {
        const model = item.type === "model";
        const glyph = item.type === "glyphs";
        const crop = model && item.cropOverflow;
        return `
      <button
        type="button"
        class="cstudio__dock-item${model ? " cstudio__dock-item--model" : ""}${glyph ? " cstudio__dock-item--glyph" : ""}${crop ? " cstudio__dock-item--crop" : ""}"
        data-index="${i}"
        aria-label="${item.alt || item.label || item.id || `Item ${i + 1}`}"
      >
        ${
          model
            ? `<canvas class="cstudio__dock-model" data-model-index="${i}" width="96" height="96"></canvas>`
            : `<img src="${thumbSrc(item)}" alt="" loading="lazy" draggable="false" />`
        }
      </button>`;
      })
      .join("");
    this.layoutDock();
    this.initDockModels();
  }

  initDockModels() {
    this.dockRing?.querySelectorAll(".cstudio__dock-model").forEach((canvas) => {
      const i = Number(canvas.dataset.modelIndex);
      const item = this.items[i];
      if (!item) return;
      this.mountDockModel(canvas, item);
    });
  }

  mountDockModel(canvas, item) {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 20);
    const camZ = Number(item.cameraDockZ) || 2.05;
    camera.position.set(0.45, 0.14, camZ);
    camera.lookAt(0, 0.02, 0);
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setSize(96, 96, false);
    renderer.setPixelRatio(1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    if (item.metalLighting) applyMetalLighting(renderer, scene, item);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x999999, item.metalLighting ? 0.55 : 1.1));
    const key = new THREE.DirectionalLight(0xffffff, item.metalLighting ? 1.65 : 0.45);
    key.position.set(item.metalLighting ? 2.4 : 1.5, item.metalLighting ? 3.2 : 2, item.metalLighting ? 4 : 2);
    scene.add(key);
    if (item.metalLighting) {
      scene.add(new THREE.AmbientLight(0xffffff, 0.85));
      const rim = new THREE.DirectionalLight(0xffffff, 0.75);
      rim.position.set(-2.2, 0.8, -2.5);
      scene.add(rim);
    }

    const entry = {
      scene,
      camera,
      renderer,
      root: null,
      spin: 0,
      yaw: 0,
      basePitch: 0.05,
      baseRoll: 0,
      faceLock: false,
      spinEnabled: item.dockSpin !== false && item.spin !== false,
      media: null,
      contentTex: null,
    };
    this.dockModels.set(canvas, entry);

    this.loadModel(item.src)
      .then(async ({ scene: root }) => {
        entry.yaw = this.fitMockup(root, item, 1.22, { dock: true });
        bindModelOrientation(entry, item, { dock: true });
        alignPhoneScreen(root, item);
        try {
          await this.prepareModelRoot(root, item);
          const painted = await this.paintMockupContent(root, item, this.root);
          entry.media = painted.media;
          entry.contentTex = painted.tex;
        } catch {
          /* chassis only */
        }
        entry.spinEnabled =
          item.dockSpin !== false && item.spin !== false && !item.contentIframe;
        entry.root = attachModelToScene(scene, root, item);
        renderer.render(scene, camera);
        primeVideoPlayback(entry.media);
      })
      .catch(() => {});
  }

  disposeDockModels() {
    for (const entry of this.dockModels.values()) {
      stopMedia(entry.media);
      entry.contentTex?.dispose();
      entry.renderer.dispose();
    }
    this.dockModels.clear();
  }

  fitMockup(root, item, targetSize, opts = {}) {
    let yaw;
    const isPhone = /iphone/i.test(item.src || "");
    if (isPhone) {
      yaw = Math.PI + (opts.dock ? 0.62 : 0);
    } else if (Number.isFinite(item.modelYaw)) {
      const dockBias =
        opts.dock && !item.modelFaceLock && !Number.isFinite(item.modelPitch) ? 0.62 : 0;
      yaw = item.modelYaw + dockBias;
    } else {
      yaw = opts.dock ? dockYawForScreen(root) : yawForScreen(root);
    }
    const pitch = Number(item.modelPitch);
    const roll = Number(item.modelRoll);
    root.rotation.set(
      Number.isFinite(pitch) ? pitch : opts.dock ? 0.05 : 0,
      yaw,
      Number.isFinite(roll) ? roll : 0
    );
    root.updateMatrixWorld(true);

    let box;
    if (item.fitContent) {
      const content = root.getObjectByName("CONTENT");
      if (content) {
        content.updateMatrixWorld(true);
        box = new THREE.Box3().setFromObject(content);
      }
    }
    if (!box || box.isEmpty()) box = new THREE.Box3().setFromObject(root);

    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const fitScale = opts.dock ? Number(item.fitDock) || 1 : Number(item.fitView) || 1;
    const fitPad = Number(item.fitPadding) || (opts.dock ? 0.92 : MODEL_VIEWER_PAD);
    const s = (item.scale ?? 1) * fitScale * fitPad * (targetSize / maxDim);
    root.scale.setScalar(s);
    const center = new THREE.Vector3();
    box.getCenter(center);
    root.position.sub(center.multiplyScalar(s));
    if (Number.isFinite(item.offsetZ)) root.position.z += item.offsetZ;
    if (Number.isFinite(item.offsetY)) root.position.y += item.offsetY;
    return yaw;
  }

  loadModel(src) {
    return new Promise((resolve, reject) => {
      if (/\.fbx$/i.test(src)) {
        this.fbxLoader.load(src, (scene) => resolve({ scene }), undefined, reject);
        return;
      }
      this.gltfLoader.load(src, resolve, undefined, reject);
    });
  }

  async prepareModelRoot(root, item) {
    if (item.metalLighting) tuneMetalMaterials(root);
    if (item.texture) await this.applyModelTexture(root, item.texture);
  }

  applyModelTexture(root, src) {
    return new Promise((resolve, reject) => {
      this.textureLoader.load(
        src,
        (tex) => {
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.flipY = false;
          tex.needsUpdate = true;
          root.traverse((child) => {
            if (!child.isMesh) return;
            const mats = Array.isArray(child.material) ? child.material : [child.material];
            const painted = mats.map((mat) => {
              const next = mat.clone();
              next.map?.dispose?.();
              next.map = tex;
              next.transparent = true;
              next.alphaTest = 0.04;
              next.needsUpdate = true;
              if (next.color) next.color.setRGB(1, 1, 1);
              return next;
            });
            child.material = painted.length === 1 ? painted[0] : painted;
          });
          resolve(tex);
        },
        undefined,
        reject
      );
    });
  }

  mockupContentSrc(item) {
    if (item.contentIframe) return item.contentPoster || null;
    return item.content || null;
  }

  async paintMockupContent(root, item, host = document.body) {
    const src = this.mockupContentSrc(item);
    if (!src) return { media: null, tex: null };
    const media = await loadContentMedia(src);
    if (!media) return { media: null, tex: null };
    const tex = applyContent(root, media, THREE, item.contentFit, {
      anchorY: item.contentAnchorY,
      insetY: item.contentInsetY,
      pad: item.contentPad,
      radius: item.contentRadius,
    });
    if (media instanceof HTMLVideoElement) attachHiddenVideo(media, host);
    return { media, tex };
  }

  layoutDock() {
    const n = this.items.length;
    if (!n || !this.dockRing) return;
    const step = 360 / n;
    const r = dockRadius(n);
    this.dockRing.querySelectorAll(".cstudio__dock-item").forEach((btn, i) => {
      const a = i * step + this.spin;
      const rad = (a * Math.PI) / 180;
      const front = Math.cos(rad);
      const depth = 0.82 + 0.18 * ((front + 1) / 2);
      btn.style.transform = `rotateY(${a}deg) translateZ(${r}rem) rotateY(${-a}deg) scale(${depth})`;
      btn.style.opacity = "1";
      btn.style.pointerEvents = "auto";
      btn.style.zIndex = String(Math.round(front * 100));
      btn.classList.toggle("is-front", i === this.active && front > 0.35);
      btn.classList.toggle("is-active", i === this.active);
    });
  }

  tick() {
    requestAnimationFrame(() => this.tick());
    const dt = Math.min(this.clock.getDelta(), 0.05);

    if (!this.dragging && !this.opening) {
      if (!this.spinPaused) this.spin += AUTO_SPIN * dt;
      this.layoutDock();
    }

    const follow = this.cursorFollow;
    const t = this.clock.getElapsedTime();
    const idle = mobileMq.matches && !reduced ? mobileIdleSway(t) : { yaw: 0, pitch: 0 };
    const px = mobileMq.matches ? idle.yaw : this.modelPointer.x * follow * MODEL_CURSOR_YAW;
    const py = mobileMq.matches ? idle.pitch : this.modelPointer.y * follow * -MODEL_CURSOR_PITCH;
    const vx = mobileMq.matches ? idle.yaw : this.viewerPointer.x * follow * MODEL_CURSOR_YAW;
    const vy = mobileMq.matches ? idle.pitch : this.viewerPointer.y * follow * -MODEL_CURSOR_PITCH;

    for (const entry of this.dockModels.values()) {
      if (!entry.root) continue;
      if (entry.media instanceof HTMLVideoElement && entry.contentTex) {
        entry.contentTex.needsUpdate = true;
      }
      applyModelRotation(entry, px, py, dt);
      entry.renderer.render(entry.scene, entry.camera);
    }

    if (this.floatModel?.renderer) {
      if (this.floatModel.media instanceof HTMLVideoElement && this.floatModel.contentTex) {
        this.floatModel.contentTex.needsUpdate = true;
      }
      if (this.floatModel.root) {
        applyModelRotation(this.floatModel, vx, vy, dt, 0.22);
      }
      this.floatModel.renderer.render(this.floatModel.scene, this.floatModel.camera);
    }

    this.updateFloatMotion();
  }

  updateFloatMotion() {
    const float = this.floater;
    if (!float?.classList.contains("is-live") || reduced || this.opening) return;

    const mobile = mobileMq.matches;
    const ampY = mobile ? 5 : FLOAT_AMP_Y;
    const t = this.clock.getElapsedTime();
    const bobY = Math.sin(t * FLOAT_SPEED) * ampY;

    if (mobile) {
      float.style.transform = `translateY(${bobY.toFixed(2)}px)`;
    } else {
      float.style.transform = `translate(-50%, calc(-50% + ${bobY.toFixed(2)}px))`;
    }
  }

  updateModelPointer(e) {
    if (mobileMq.matches) return;
    if (this.dockScene) {
      const p = normPointer(e.clientX, e.clientY, this.dockScene.getBoundingClientRect());
      this.modelPointer.x = p.x;
      this.modelPointer.y = p.y;
    }
    if (this.viewer) {
      const p = normPointer(e.clientX, e.clientY, this.viewer.getBoundingClientRect());
      this.viewerPointer.x = p.x;
      this.viewerPointer.y = p.y;
    }
  }

  onDockDown(e) {
    this.dragging = true;
    this.dragMoved = false;
    this.dragStartX = e.clientX;
    this.dragStartY = e.clientY;
    this.lastX = e.clientX;
    this.pointerDownTarget = e.target;
    this.spinVel = 0;
    const el = e.currentTarget;
    if (el?.setPointerCapture) el.setPointerCapture(e.pointerId);
    this.dockScene?.classList.add("is-grabbing");
  }

  onDockMove(e) {
    if (!this.dragging) return;
    const dx = e.clientX - this.lastX;
    const totalDx = e.clientX - this.dragStartX;
    const totalDy = e.clientY - this.dragStartY;

    if (Math.abs(totalDx) > 8 || Math.abs(totalDy) > 8) {
      if (mobileMq.matches && Math.abs(totalDy) > Math.abs(totalDx)) {
        this.dragging = false;
        this.dragMoved = false;
        this.pointerDownTarget = null;
        this.dockScene?.classList.remove("is-grabbing");
        try {
          this.dockScene?.releasePointerCapture(e.pointerId);
        } catch {
          /* noop */
        }
        return;
      }
      this.dragMoved = true;
      this.spinPaused = true;
    }
    this.lastX = e.clientX;
    if (this.dragMoved) {
      this.spin += dx * 0.42;
      this.layoutDock();
    }
  }

  onDockUp(e) {
    if (this.dragging && !this.dragMoved && !this.opening) {
      const btn =
        this.pointerDownTarget?.closest?.(".cstudio__dock-item") ||
        document.elementFromPoint(e.clientX, e.clientY)?.closest?.(".cstudio__dock-item");
      if (btn) {
        const i = Number(btn.dataset.index);
        if (!Number.isNaN(i)) this.select(i, true, btn);
      }
    }
    this.pointerDownTarget = null;
    this.dragging = false;
    this.spinVel = 0;
    this.dockScene?.classList.remove("is-grabbing");
  }

  async select(index, animate = true, fromBtn = null) {
    if (!this.items[index] || !this.viewer) return;
    const item = this.items[index];
    this.active = index;

    if (this.indexEl) this.indexEl.textContent = String(index + 1).padStart(2, "0");
    if (this.labelEl) {
      this.labelEl.textContent = item.label || item.alt || item.id || "";
      this.labelEl.hidden = !(item.label || item.alt);
    }

    const btn = fromBtn || this.dockRing?.querySelector(`[data-index="${index}"]`);
    const useMotion = animate && !reduced && !mobileMq.matches;
    if (useMotion && btn) await this.openFromDock(btn, item);
    else await this.placeFloating(item);
    this.primeAllVideos();
    primeVideoPlayback(this.floatModel?.media);
  }

  disposeFloatModel() {
    const fm = this.floatModel;
    if (!fm) return;
    stopMedia(fm.media);
    fm.contentTex?.dispose();
    fm.renderer?.dispose();
    this.floatModel = null;
  }

  clearFloater() {
    this.disposeFloatModel();
    this.floater?.remove();
    this.floater = null;
    if (this.viewer) this.viewer.innerHTML = "";
  }

  async placeFloating(item) {
    this.clearFloater();
    const float = document.createElement("div");
    float.className = "cstudio__float is-live";
    const body = document.createElement("div");
    body.className = "cstudio__float-body";
    float.appendChild(body);
    this.viewer.appendChild(float);
    this.floater = float;
    await this.fillFloatBody(body, item, false);
    await this.fitFloatBodyWhenReady(body);
  }

  viewerBounds() {
    const vr = this.viewer?.getBoundingClientRect() ?? { width: 400, height: 300 };
    return {
      maxW: vr.width * VIEWER_FIT,
      maxH: vr.height * VIEWER_FIT,
    };
  }

  async fitFloatBodyWhenReady(body) {
    const media =
      body.querySelector(":scope > img, :scope > video") ||
      body.querySelector(".cstudio__float-link img, .cstudio__float-link video");
    if (media) {
      await new Promise((resolve) => whenMediaReady(media, resolve));
    }
    this.fitFloatBody(body);
  }

  fitFloatBody(body) {
    if (!body || !this.viewer) return;
    const { maxW, maxH } = this.viewerBounds();
    const widthPriority = !mobileMq.matches;
    const capW = Number(body.dataset.imageMaxWidth) || maxW;
    const capH = Number(body.dataset.imageMaxHeight) || maxH;

    body.style.width = "";
    body.style.height = "";

    const mockup = body.querySelector(".cstudio__float-mockup");
    const model = mockup?.querySelector(".cstudio__float-model") || body.querySelector(".cstudio__float-model");
    if (model) {
      const visit = mockup?.querySelector(".cstudio__float-visit");
      const visitExtra = visit ? LINK_LABEL_EXTRA_PX : 0;
      const aspect = Number(model.dataset.viewAspect) || DEFAULT_MODEL_ASPECT;
      const boundsH = Math.max(1, maxH - visitExtra);
      const { w, h } = fitInViewerBox(100, 100 * aspect, maxW, boundsH, false);
      model.style.width = `${Math.round(w)}px`;
      model.style.height = `${Math.round(h)}px`;
      if (mockup) mockup.style.width = `${Math.round(w)}px`;
      body.style.width = `${Math.round(w)}px`;
      body.style.height = `${Math.round(h + visitExtra)}px`;
      body.style.maxHeight = `${Math.round(boundsH + visitExtra)}px`;
      const float = body.closest(".cstudio__float");
      if (float) float.style.maxHeight = `${Math.round(boundsH + visitExtra)}px`;
      return;
    }

    const loupeBlock = body.querySelector(".cstudio__loupe, .cstudio__glyphs");
    if (loupeBlock) {
      body.style.width = `${Math.round(maxW)}px`;
      body.style.height = "auto";
      return;
    }

    const link = body.querySelector(".cstudio__float-link");
    const media = body.querySelector(":scope > img, :scope > video") || link?.querySelector("img, video");
    if (!media) return;

    const apply = () => {
      const nw = media.naturalWidth || media.videoWidth;
      const nh = media.naturalHeight || media.videoHeight;
      if (!nw || !nh) return;

      const labelExtra = link ? LINK_LABEL_EXTRA_PX : 0;
      const boundsH = Math.max(1, capH - labelExtra);
      const fitW = Math.min(maxW, capW);
      const { w, h } = fitInViewerBox(nw, nh, fitW, boundsH, widthPriority);

      body.style.width = `${Math.round(w)}px`;
      if (widthPriority) {
        body.style.height = "auto";
        media.style.width = "100%";
        media.style.height = "auto";
      } else {
        body.style.height = `${Math.round(h + labelExtra)}px`;
        media.style.width = "100%";
        media.style.height = `${Math.round(h)}px`;
        media.style.objectFit = "contain";
      }
      media.style.maxWidth = "none";
    };

    whenMediaReady(media, apply);
    apply();
  }

  async openFromDock(btn, item) {
    if (!this.viewer) return;
    if (reduced) {
      await this.placeFloating(item);
      return;
    }

    this.opening = true;
    this.clearFloater();

    const vr = this.viewer.getBoundingClientRect();
    const tr = btn.getBoundingClientRect();

    const float = document.createElement("div");
    float.className = "cstudio__float is-opening";
    const body = document.createElement("div");
    body.className = "cstudio__float-body";
    float.appendChild(body);
    this.viewer.appendChild(float);

    await this.fillFloatBody(body, item, false, btn);
    await this.fitFloatBodyWhenReady(body);

    const targetW = body.offsetWidth || this.viewerBounds().maxW;
    const startScale = Math.max(0.1, tr.width / targetW);
    const startDx = tr.left + tr.width / 2 - (vr.left + vr.width / 2);
    const startDy = tr.top + tr.height / 2 - (vr.top + vr.height / 2);

    float.style.transform = `translate(calc(-50% + ${startDx}px), calc(-50% + ${startDy}px)) scale(${startScale})`;

    await new Promise((resolve) => {
      requestAnimationFrame(() => {
        float.style.transition = DOCK_OPEN;
        float.style.transform = "translate(-50%, -50%) scale(1)";
        float.addEventListener("transitionend", resolve, { once: true });
        setTimeout(resolve, 620);
      });
    });

    float.style.transition = "";
    float.style.transform = "";
    float.classList.remove("is-opening");
    float.classList.add("is-live");
    this.floater = float;
    this.opening = false;
    await this.fitFloatBodyWhenReady(body);
  }

  async fillFloatBody(body, item, thumbOnly, fromBtn = null) {
    this.disposeFloatModel();
    body.innerHTML = "";
    delete body.dataset.imageMaxWidth;
    delete body.dataset.imageMaxHeight;
    if (item.imageMaxWidth) body.dataset.imageMaxWidth = String(item.imageMaxWidth);
    if (item.imageMaxHeight) body.dataset.imageMaxHeight = String(item.imageMaxHeight);

    if (item.type === "glyphs") {
      const glyphs = item.glyphs ?? [];
      body.innerHTML = `
        <div class="cstudio__glyphs">
          <div class="cstudio__glyphs-grid">
            ${glyphs.map((src) => `<img src="${src}" alt="" loading="lazy" decoding="async" draggable="false" />`).join("")}
          </div>
          ${item.fontLabel ? `<p class="cstudio__glyphs-font">${item.fontLabel}</p>` : ""}
        </div>`;
      return;
    }

    if (item.loupeSrc && !thumbOnly) {
      mountLoupeInBody(body, item);
      return;
    }

    if (item.type === "model" && !thumbOnly) {
      const hasIframe = Boolean(item.contentIframe);
      const wrap = document.createElement("div");
      wrap.className = [
        "cstudio__float-mockup",
        hasIframe ? "cstudio__float-mockup--iframe" : "",
        item.cropOverflow ? "cstudio__float-mockup--crop" : "",
      ]
        .filter(Boolean)
        .join(" ");

      const stage = document.createElement("div");
      stage.className = "cstudio__float-mockup-stage";
      const canvas = document.createElement("canvas");
      canvas.className = "cstudio__float-model";
      canvas.width = 640;
      canvas.height = 480;
      stage.appendChild(canvas);

      if (hasIframe) {
        const screen = document.createElement("div");
        screen.className = "cstudio__float-screen";
        const iframe = document.createElement("iframe");
        iframe.src = item.contentIframe;
        iframe.title = item.alt || "Live preview";
        iframe.loading = "lazy";
        iframe.setAttribute("referrerpolicy", "no-referrer-when-downgrade");
        screen.appendChild(iframe);
        stage.appendChild(screen);
      }

      wrap.appendChild(stage);

      if (item.visitHref) {
        const visit = document.createElement("a");
        visit.className = "cstudio__float-visit";
        visit.href = item.visitHref;
        visit.target = "_blank";
        visit.rel = "noopener";
        visit.textContent = item.visitLabel || "Visit site →";
        wrap.appendChild(visit);
      }

      body.appendChild(wrap);
      await this.mountFloatModel(canvas, item);
      return;
    }

    if (item.type === "model" && thumbOnly && fromBtn) {
      const dockCanvas = fromBtn.querySelector(".cstudio__dock-model");
      if (dockCanvas) {
        const img = document.createElement("img");
        img.src = dockCanvas.toDataURL("image/png");
        img.alt = item.alt || "";
        body.appendChild(img);
        return;
      }
    }

    if (item.type === "link") {
      body.innerHTML = `
        <a class="cstudio__float-link" href="${item.href}" target="_blank" rel="noopener">
          <img src="${item.thumb || item.src}" alt="${item.alt || item.label || ""}" />
          <span>${item.label || item.href}</span>
        </a>`;
      return;
    }

    if (item.type === "video" && !isGif(item)) {
      const video = document.createElement("video");
      if (item.poster) video.poster = item.poster;
      video.loop = true;
      video.src = item.src;
      body.appendChild(video);
      primeVideoPlayback(video);
      return;
    }

    const img = document.createElement("img");
    img.src = item.src;
    img.alt = item.alt || "";
    img.decoding = "async";
    body.appendChild(img);
  }

  async mountFloatModel(canvas, item) {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, canvas.width / canvas.height, 0.1, 40);
    const camZ = Number(item.cameraZ) || 3.6;
    camera.position.set(0, 0.06, camZ);
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(canvas.clientWidth || 640, canvas.clientHeight || 480, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    if (item.metalLighting) applyMetalLighting(renderer, scene, item);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x888888, item.metalLighting ? 0.5 : 1.1));
    const key = new THREE.DirectionalLight(0xffffff, item.metalLighting ? 1.85 : 0.7);
    key.position.set(item.metalLighting ? 1.2 : 0.4, item.metalLighting ? 2.4 : 1.4, 4);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, item.metalLighting ? 0.9 : 0.35);
    fill.position.set(-2, 0.6, 2);
    scene.add(fill);
    if (item.metalLighting) {
      scene.add(new THREE.AmbientLight(0xffffff, 0.9));
      const rim = new THREE.DirectionalLight(0xffffff, 0.8);
      rim.position.set(2, -0.4, -3);
      scene.add(rim);
    }

    this.floatModel = {
      scene,
      camera,
      renderer,
      root: null,
      spin: 0,
      yaw: 0,
      basePitch: 0,
      baseRoll: 0,
      faceLock: false,
      spinEnabled: item.spin !== false,
      media: null,
      contentTex: null,
    };

    const resize = () => {
      const w = canvas.clientWidth || 1;
      const h = canvas.clientHeight || 1;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    new ResizeObserver(resize).observe(canvas);
    resize();

    await new Promise((resolve) => {
      this.loadModel(item.src)
        .then(async ({ scene: root }) => {
          const yaw = this.fitMockup(root, item, 1.45);
          alignPhoneScreen(root, item);
          try {
            await this.prepareModelRoot(root, item);
            const painted = await this.paintMockupContent(root, item, this.viewer || this.root);
            if (this.floatModel) {
              this.floatModel.media = painted.media;
              this.floatModel.contentTex = painted.tex;
            }
          } catch {
            /* chassis only */
          }
          const aspect = modelViewAspect(root, item);
          canvas.dataset.viewAspect = String(aspect);
          if (this.floatModel) {
            this.floatModel.root = attachModelToScene(scene, root, item);
            this.floatModel.yaw = yaw;
            bindModelOrientation(this.floatModel, item);
            this.floatModel.viewAspect = aspect;
            this.floatModel.spinEnabled = item.spin !== false;
          }
          renderer.render(scene, camera);
          primeVideoPlayback(this.floatModel?.media);
          resolve();
        })
        .catch(() => resolve());
    });
  }

  setItems(items) {
    this.items = items;
    this.startIndex = clampStartIndex(this.startIndex, items.length);
    this.active = this.startIndex;
    this.buildDock();
    this.alignDockSpin(this.startIndex);
    if (this.countEl) this.countEl.textContent = String(items.length).padStart(2, "0");
    this.queueViewerSlot({ reselect: true });
  }

  destroy() {
    clearTimeout(this._slotTimer);
    this._viewerRo?.disconnect();
    this._viewerRo = null;
    this._stageRo?.disconnect();
    this._stageRo = null;
    this._videoIo?.disconnect();
    this._videoIo = null;
    mobileMq.removeEventListener("change", this._onMobileLayout);
    this.clearFloater();
    this.disposeDockModels();
    this.dockScene?.removeEventListener("pointerdown", this._onDockDown);
    window.removeEventListener("pointermove", this._onDockMove);
    window.removeEventListener("pointermove", this._onModelPointer);
    window.removeEventListener("pointerup", this._onDockUp);
    this.viewer?.removeEventListener("touchstart", this._onPrimeVideos);
    window.removeEventListener("touchstart", this._onPrimeVideos);
    window.removeEventListener("pointerdown", this._onPrimeVideos);
  }
}
