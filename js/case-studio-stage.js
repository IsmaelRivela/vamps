import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import {
  applyContent,
  attachHiddenVideo,
  loadContentMedia,
  stopMedia,
  dockYawForScreen,
  yawForScreen,
} from "./mockup-content.js";

const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const mobileMq = window.matchMedia("(max-width: 899px)");
const AUTO_SPIN = reduced ? 0 : 18;
const DOCK_OPEN = "transform 0.58s cubic-bezier(0.22, 1.28, 0.36, 1)";

function thumbSrc(item) {
  if (item.type === "link") return item.thumb || item.src;
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
const LINK_LABEL_EXTRA_PX = 40;
const VIEWER_SLOT_MIN_PX = 192;
const FLOAT_AMP_Y = 9;
const FLOAT_SPEED = 0.7;
const MODEL_CURSOR_YAW = 0.42;
const MODEL_CURSOR_PITCH = 0.2;
const MODEL_CURSOR_LERP = 9;

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

function damp(current, target, lambda, dt) {
  return current + (target - current) * (1 - Math.exp(-lambda * dt));
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

async function measureItemDisplayHeight(item, maxW) {
  if (item.type === "model") return maxW * 0.72;
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
    this.modelPointer = { x: 0, y: 0 };
    this.viewerPointer = { x: 0, y: 0 };
    this.cursorFollow = reduced ? 0.35 : 1;

    this._onDockDown = (e) => this.onDockDown(e);
    this._onDockMove = (e) => this.onDockMove(e);
    this._onDockUp = (e) => this.onDockUp(e);
    this._onModelPointer = (e) => this.updateModelPointer(e);
    this._slotTimer = null;
    this._viewerRo = null;
    this._onMobileLayout = () => this.queueViewerSlot();

    this.dockScene?.addEventListener("pointerdown", this._onDockDown);
    window.addEventListener("pointermove", this._onDockMove);
    window.addEventListener("pointermove", this._onModelPointer, { passive: true });
    window.addEventListener("pointerup", this._onDockUp);

    this.buildDock();
    this.alignDockSpin(this.startIndex);
    if (this.countEl) this.countEl.textContent = String(items.length).padStart(2, "0");
    if (this.items.length) void this.select(this.startIndex, false);
    this.initViewerSlot();
    this.tick();
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

    const vr = this.viewer.getBoundingClientRect();
    const width = vr.width > 1 ? vr.width : this.viewer.offsetWidth || window.innerWidth;
    const maxW = width * VIEWER_FIT;
    const cs = getComputedStyle(this.viewer);
    const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);

    const heights = await Promise.all(
      this.items.map((item) => measureItemDisplayHeight(item, maxW))
    );
    const maxContentH = heights.reduce((top, h) => Math.max(top, h), 0) || VIEWER_SLOT_MIN_PX;
    const slotH = Math.max(Math.ceil(maxContentH + padY), VIEWER_SLOT_MIN_PX);

    this.viewer.style.height = `${slotH}px`;
    this.viewer.style.minHeight = `${slotH}px`;
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
        return `
      <button
        type="button"
        class="cstudio__dock-item${model ? " cstudio__dock-item--model" : ""}"
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
    camera.position.set(0.45, 0.14, 2.05);
    camera.lookAt(0, 0.02, 0);
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setSize(96, 96, false);
    renderer.setPixelRatio(1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    scene.add(new THREE.HemisphereLight(0xffffff, 0x999999, 1.1));
    const key = new THREE.DirectionalLight(0xffffff, 0.45);
    key.position.set(1.5, 2, 2);
    scene.add(key);

    const entry = {
      scene,
      camera,
      renderer,
      root: null,
      spin: 0,
      yaw: 0,
      basePitch: 0.05,
      spinEnabled: item.dockSpin !== false && item.spin !== false,
      media: null,
      contentTex: null,
    };
    this.dockModels.set(canvas, entry);

    this.gltfLoader.load(
      item.src,
      async (gltf) => {
        const root = gltf.scene;
        try {
          const painted = await this.paintMockupContent(root, item);
          entry.media = painted.media;
          entry.contentTex = painted.tex;
        } catch {
          /* chassis only */
        }
        entry.yaw = this.fitMockup(root, item, 1.22, { dock: true });
        entry.spinEnabled = item.dockSpin !== false && item.spin !== false;
        scene.add(root);
        entry.root = root;
        renderer.render(scene, camera);
      },
      undefined,
      () => {}
    );
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
    const yaw = opts.dock ? dockYawForScreen(root) : yawForScreen(root);
    root.rotation.set(opts.dock ? 0.05 : 0, yaw, 0);
    root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(root);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const s = (item.scale ?? 1) * (targetSize / maxDim);
    root.scale.setScalar(s);
    const center = new THREE.Vector3();
    box.getCenter(center);
    root.position.sub(center.multiplyScalar(s));
    return yaw;
  }

  async paintMockupContent(root, item, host = document.body) {
    if (!item.content) return { media: null, tex: null };
    const media = await loadContentMedia(item.content);
    if (!media) return { media: null, tex: null };
    const tex = applyContent(root, media, THREE, item.contentFit, {
      anchorY: item.contentAnchorY,
      insetY: item.contentInsetY,
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
    const px = this.modelPointer.x * follow;
    const py = this.modelPointer.y * follow;

    for (const entry of this.dockModels.values()) {
      if (!entry.root) continue;
      if (entry.spinEnabled) entry.spin += dt * 0.45;
      const targetYaw = entry.yaw + entry.spin + px * MODEL_CURSOR_YAW;
      const targetPitch = entry.basePitch + py * -MODEL_CURSOR_PITCH;
      entry.root.rotation.y = damp(entry.root.rotation.y, targetYaw, MODEL_CURSOR_LERP, dt);
      entry.root.rotation.x = damp(entry.root.rotation.x, targetPitch, MODEL_CURSOR_LERP, dt);
      entry.renderer.render(entry.scene, entry.camera);
    }

    if (this.floatModel?.renderer) {
      if (this.floatModel.spinEnabled) this.floatModel.spin += dt * 0.22;
      if (this.floatModel.root) {
        const vx = this.viewerPointer.x * follow;
        const vy = this.viewerPointer.y * follow;
        const targetYaw = this.floatModel.yaw + this.floatModel.spin + vx * MODEL_CURSOR_YAW;
        const targetPitch = (this.floatModel.basePitch ?? 0) + vy * -MODEL_CURSOR_PITCH;
        this.floatModel.root.rotation.y = damp(
          this.floatModel.root.rotation.y,
          targetYaw,
          MODEL_CURSOR_LERP,
          dt
        );
        this.floatModel.root.rotation.x = damp(
          this.floatModel.root.rotation.x,
          targetPitch,
          MODEL_CURSOR_LERP,
          dt
        );
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
    this.floatModel?.media?.play?.().catch(() => {});
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
    const widthPriority = mobileMq.matches;

    body.style.width = "";
    body.style.height = "";

    const model = body.querySelector(".cstudio__float-model");
    if (model) {
      let w = maxW;
      let h = maxW * 0.72;
      if (!widthPriority && h > maxH) {
        h = maxH;
        w = h / 0.72;
      }
      model.style.width = `${Math.round(w)}px`;
      model.style.height = `${Math.round(h)}px`;
      body.style.width = `${Math.round(w)}px`;
      body.style.height = `${Math.round(h)}px`;
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
      const boundsH = Math.max(1, maxH - labelExtra);
      const { w, h } = fitInViewerBox(nw, nh, maxW, boundsH, widthPriority);

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
      media.style.maxHeight = "none";
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

    if (item.type === "model" && !thumbOnly) {
      const canvas = document.createElement("canvas");
      canvas.className = "cstudio__float-model";
      canvas.width = 640;
      canvas.height = 480;
      body.appendChild(canvas);
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
      video.src = item.src;
      if (item.poster) video.poster = item.poster;
      video.muted = true;
      video.playsInline = true;
      video.loop = true;
      video.autoplay = true;
      body.appendChild(video);
      video.play().catch(() => {});
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
    camera.position.set(0, 0.06, 3.6);
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(canvas.clientWidth || 640, canvas.clientHeight || 480, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    scene.add(new THREE.HemisphereLight(0xffffff, 0x888888, 1.1));
    const key = new THREE.DirectionalLight(0xffffff, 0.7);
    key.position.set(0.4, 1.4, 4);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 0.35);
    fill.position.set(-2, 0.6, 2);
    scene.add(fill);

    this.floatModel = {
      scene,
      camera,
      renderer,
      root: null,
      spin: 0,
      yaw: 0,
      basePitch: 0,
      spinEnabled: item.spin !== false && !item.content,
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
      this.gltfLoader.load(
        item.src,
        async (gltf) => {
          const root = gltf.scene;
          try {
            const painted = await this.paintMockupContent(root, item);
            if (this.floatModel) {
              this.floatModel.media = painted.media;
              this.floatModel.contentTex = painted.tex;
            }
          } catch {
            /* chassis only */
          }
          const yaw = this.fitMockup(root, item, 1.45);
          scene.add(root);
          if (this.floatModel) {
            this.floatModel.root = root;
            this.floatModel.yaw = yaw;
            this.floatModel.spinEnabled = item.spin !== false && !item.content;
          }
          renderer.render(scene, camera);
          resolve();
        },
        undefined,
        () => resolve()
      );
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
    mobileMq.removeEventListener("change", this._onMobileLayout);
    this.clearFloater();
    this.disposeDockModels();
    this.dockScene?.removeEventListener("pointerdown", this._onDockDown);
    window.removeEventListener("pointermove", this._onDockMove);
    window.removeEventListener("pointermove", this._onModelPointer);
    window.removeEventListener("pointerup", this._onDockUp);
  }
}
