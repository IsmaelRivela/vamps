import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export class CaseCarousel {
  constructor(canvas, items, opts = {}) {
    this.canvas = canvas;
    this.items = items;
    this.radius = opts.radius ?? 2.35;
    this.autoSpeed = reduced ? 0 : opts.autoSpeed ?? 0.22;
    this.dragSens = opts.dragSens ?? 0.0042;

    this.rotation = 0;
    this.vel = 0;
    this.dragging = false;
    this.lastX = 0;
    this.slots = [];
    this.activeIndex = 0;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(32, 1, 0.1, 40);
    this.camera.position.set(0, 0.15, 5.4);
    this.camera.lookAt(0, 0, 0);

    const hemi = new THREE.HemisphereLight(0xffffff, 0x9a9a9a, 1.05);
    this.scene.add(hemi);
    const key = new THREE.DirectionalLight(0xffffff, 0.55);
    key.position.set(2, 3, 4);
    this.scene.add(key);

    this.group = new THREE.Group();
    this.scene.add(this.group);

    this.loader = new THREE.TextureLoader();
    this.gltfLoader = new GLTFLoader();
    this.clock = new THREE.Clock();
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.pickables = [];

    this.onIndex = opts.onIndex ?? (() => {});
    this.onLink = opts.onLink ?? (() => {});

    this._boundPointerDown = (e) => this.onPointerDown(e);
    this._boundPointerMove = (e) => this.onPointerMove(e);
    this._boundPointerUp = () => this.onPointerUp();
    this._boundClick = (e) => this.onClick(e);

    canvas.addEventListener("pointerdown", this._boundPointerDown);
    window.addEventListener("pointermove", this._boundPointerMove);
    window.addEventListener("pointerup", this._boundPointerUp);
    canvas.addEventListener("click", this._boundClick);

    this._resizeObs = new ResizeObserver(() => this.resize());
    this._resizeObs.observe(canvas.parentElement ?? canvas);

    this.build();
    this.resize();
    this.tick();
  }

  async build() {
    this.group.clear();
    this.slots = [];
    this.pickables = [];

    const n = this.items.length;
    if (!n) return;

    for (let i = 0; i < n; i++) {
      const slot = new THREE.Group();
      const mesh = await this.createItemMesh(this.items[i]);
      slot.add(mesh);
      slot.userData.index = i;
      slot.userData.item = this.items[i];
      this.group.add(slot);
      this.slots.push(slot);
      if (mesh.userData.pickable) this.pickables.push(mesh);
    }

    this.layoutSlots();
    this.updateActiveIndex();
  }

  async createItemMesh(item) {
    const wrap = new THREE.Group();

    if (item.type === "model") {
      const model = await this.loadModel(item);
      const scale = item.scale ?? 1;
      model.scale.setScalar(scale);
      wrap.add(model);
      wrap.userData.pickable = true;
      return wrap;
    }

    if (item.type === "link") {
      const plane = await this.imagePlane(item.thumb || item.src, item.alt, 1.35, 0.9);
      plane.userData.pickable = true;
      plane.userData.link = item.href;
      wrap.add(plane);
      return wrap;
    }

    if (item.type === "video" && !item.src?.endsWith(".gif")) {
      const plane = await this.videoPlane(item);
      plane.userData.pickable = true;
      wrap.add(plane);
      return wrap;
    }

    const plane = await this.imagePlane(item.src, item.alt, 1.4, 0.92);
    plane.userData.pickable = true;
    wrap.add(plane);
    return wrap;
  }

  imagePlane(src, alt, maxW, maxH) {
    return new Promise((resolve) => {
      this.loader.load(
        src,
        (tex) => {
          tex.colorSpace = THREE.SRGBColorSpace;
          const img = tex.image;
          const aspect = img.width / img.height;
          let w = maxW;
          let h = maxH;
          if (aspect > w / h) h = w / aspect;
          else w = h * aspect;
          const geo = new THREE.PlaneGeometry(w, h);
          const mat = new THREE.MeshBasicMaterial({
            map: tex,
            transparent: true,
            side: THREE.DoubleSide,
          });
          const mesh = new THREE.Mesh(geo, mat);
          mesh.userData.alt = alt;
          resolve(mesh);
        },
        undefined,
        () => {
          const geo = new THREE.PlaneGeometry(maxW, maxH);
          const mat = new THREE.MeshBasicMaterial({ color: 0xcccccc });
          resolve(new THREE.Mesh(geo, mat));
        }
      );
    });
  }

  videoPlane(item) {
    return new Promise((resolve) => {
      const video = document.createElement("video");
      video.src = item.src;
      video.crossOrigin = "anonymous";
      video.loop = true;
      video.muted = true;
      video.playsInline = true;
      if (item.poster) video.poster = item.poster;

      const onReady = () => {
        const aspect = video.videoWidth / video.videoHeight || 16 / 9;
        const maxW = 1.4;
        const maxH = 0.92;
        let w = maxW;
        let h = maxH;
        if (aspect > w / h) h = w / aspect;
        else w = h * aspect;
        const tex = new THREE.VideoTexture(video);
        tex.colorSpace = THREE.SRGBColorSpace;
        const mesh = new THREE.Mesh(
          new THREE.PlaneGeometry(w, h),
          new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide })
        );
        mesh.userData.video = video;
        video.play().catch(() => {});
        resolve(mesh);
      };

      video.addEventListener("loadeddata", onReady, { once: true });
      video.load();
      setTimeout(() => {
        if (!video.videoWidth) onReady();
      }, 1200);
    });
  }

  loadModel(item) {
    return new Promise((resolve) => {
      this.gltfLoader.load(
        item.src,
        (gltf) => {
          const root = gltf.scene;
          const box = new THREE.Box3().setFromObject(root);
          const size = new THREE.Vector3();
          box.getSize(size);
          const maxDim = Math.max(size.x, size.y, size.z) || 1;
          root.scale.setScalar(1.6 / maxDim);
          const center = new THREE.Vector3();
          box.getCenter(center);
          root.position.sub(center.multiplyScalar(1.6 / maxDim));
          resolve(root);
        },
        undefined,
        () => resolve(new THREE.Group())
      );
    });
  }

  layoutSlots() {
    const n = this.slots.length;
    if (!n) return;
    const step = (Math.PI * 2) / n;
    for (let i = 0; i < n; i++) {
      const a = i * step + this.rotation;
      const slot = this.slots[i];
      slot.position.set(Math.sin(a) * this.radius, 0, Math.cos(a) * this.radius);
      slot.lookAt(0, slot.position.y, 0);
      const distZ = Math.cos(a);
      const scale = 0.72 + 0.28 * ((distZ + 1) / 2);
      slot.scale.setScalar(scale);
      slot.children.forEach((c) => {
        c.traverse((o) => {
          if (o.isMesh) o.renderOrder = distZ > 0 ? 2 : 1;
        });
      });
    }
  }

  updateActiveIndex() {
    const n = this.slots.length;
    if (!n) return;
    const step = (Math.PI * 2) / n;
    let best = 0;
    let bestZ = -Infinity;
    for (let i = 0; i < n; i++) {
      const a = i * step + this.rotation;
      const z = Math.cos(a);
      if (z > bestZ) {
        bestZ = z;
        best = i;
      }
    }
    if (best !== this.activeIndex) {
      this.activeIndex = best;
      this.onIndex(best, this.items[best]);
    }
  }

  resize() {
    const parent = this.canvas.parentElement ?? this.canvas;
    const w = parent.clientWidth || 1;
    const h = parent.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  onPointerDown(e) {
    this.dragging = true;
    this.lastX = e.clientX;
    this.vel = 0;
    this.canvas.setPointerCapture(e.pointerId);
    this.canvas.style.cursor = "grabbing";
  }

  onPointerMove(e) {
    if (!this.dragging) return;
    const dx = e.clientX - this.lastX;
    this.lastX = e.clientX;
    this.rotation += dx * this.dragSens;
    this.vel = dx * this.dragSens * 16;
    this.layoutSlots();
    this.updateActiveIndex();
  }

  onPointerUp() {
    this.dragging = false;
    this.canvas.style.cursor = "grab";
  }

  onClick(e) {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(this.pickables, true);
    if (!hits.length) return;
    let obj = hits[0].object;
    while (obj && !obj.userData.link) obj = obj.parent;
    if (obj?.userData?.link) {
      this.onLink(obj.userData.link);
      window.open(obj.userData.link, "_blank", "noopener");
    }
  }

  setItems(items) {
    this.items = items;
    this.build();
  }

  tick() {
    requestAnimationFrame(() => this.tick());
    const dt = Math.min(this.clock.getDelta(), 0.05);
    if (!this.dragging && !reduced) {
      this.rotation += (this.autoSpeed + this.vel) * dt;
      this.vel *= 0.96;
      this.layoutSlots();
      this.updateActiveIndex();
    }
    this.renderer.render(this.scene, this.camera);
  }

  destroy() {
    this._resizeObs.disconnect();
    this.canvas.removeEventListener("pointerdown", this._boundPointerDown);
    window.removeEventListener("pointermove", this._boundPointerMove);
    window.removeEventListener("pointerup", this._boundPointerUp);
    this.canvas.removeEventListener("click", this._boundClick);
    this.renderer.dispose();
  }
}
