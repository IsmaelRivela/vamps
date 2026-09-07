/**
 * Arte en mockups vamps (CONTENT) sin deformar el chasis.
 *
 * cover  → TV / móvil: la pantalla no se mueve; el mapa llena el cristal y recorta.
 * coverWidth → ancho al cristal; recorta arriba/abajo (UV).
 * contentInsetY → recorta el mesh por abajo (cristal más bajo que CONTENT).
 * match  → cuadro: el marco 3D cambia de ratio.
 */

export function findMockupSpec(root) {
  let spec = {};
  root.traverse((o) => {
    if (o.userData?.vamps_fit) spec = o.userData;
  });
  return spec;
}

export function yawForScreen(root) {
  const spec = findMockupSpec(root);
  if (spec.vamps_face === "posX") return -Math.PI / 2;
  return 0;
}

/** Carrusel dock: 3/4 para leer volumen, no solo la pantalla de frente. */
export function dockYawForScreen(root) {
  return yawForScreen(root) + 0.62;
}

export function applyContent(root, image, THREE, fitOverride, opts = {}) {
  const content = root.getObjectByName("CONTENT");
  if (!content || !content.material) {
    throw new Error("Mockup sin mesh CONTENT");
  }

  const spec = findMockupSpec(root);
  const tex = makeTexture(image, THREE);
  const mat = content.material.clone();
  mat.map = tex;
  mat.transparent = false;
  mat.toneMapped = false;
  mat.needsUpdate = true;
  content.material = mat;
  if (mat.color) mat.color.setRGB(1, 1, 1);
  if (mat.emissive) {
    mat.emissiveMap = tex;
    mat.emissive.setRGB(1, 1, 1);
    mat.emissiveIntensity = 0.45;
  }

  const imgAspect = imageAspect(image);
  const fit = fitOverride || spec.vamps_fit || "cover";
  const screenAspect = Number(spec.vamps_base_aspect) || 1.299;

  if (fit !== "match") resetContentTransform(content);

  if (fit === "match") {
    matchFrame(root, content, imgAspect, spec);
    tex.repeat.set(1, 1);
    tex.offset.set(0, 0);
    return tex;
  }

  if (fit === "contain") {
    containInScreen(content, imgAspect, screenAspect);
    tex.repeat.set(1, 1);
    tex.offset.set(0, 0);
    return tex;
  }

  if (fit === "coverWidth") {
    const anchorY = Number.isFinite(opts.anchorY) ? opts.anchorY : 0.5;
    coverWidthMap(tex, imgAspect, screenAspect, THREE, anchorY);
    trimScreenBottom(content, resolveInsetY(opts, spec));
    return tex;
  }

  coverMap(tex, imgAspect, screenAspect, THREE);
  trimScreenBottom(content, resolveInsetY(opts, spec));
  return tex;
}

function resolveInsetY(opts, spec) {
  if (Number.isFinite(opts.insetY)) return opts.insetY;
  if (Number.isFinite(spec.vamps_inset_y)) return spec.vamps_inset_y;
  return 0;
}

function resetContentTransform(content) {
  content.scale.set(1, 1, 1);
  if (content.userData.vamps_originY == null) {
    content.userData.vamps_originY = content.position.y;
  }
  content.position.y = content.userData.vamps_originY;
}

/** Acorta CONTENT por abajo y sube el pivot para que no invada el bisel. */
function trimScreenBottom(content, insetY) {
  if (!insetY) return;
  content.geometry?.computeBoundingBox?.();
  const bb = content.geometry?.boundingBox;
  const halfH = bb ? (bb.max.y - bb.min.y) * 0.5 : 0.1686;
  content.scale.y *= 1 - insetY;
  content.position.y += halfH * insetY;
}

export function loadContentMedia(src) {
  return new Promise((resolve, reject) => {
    if (!src) {
      resolve(null);
      return;
    }
    if (/\.(mp4|webm|mov|ogg)$/i.test(src)) {
      const video = document.createElement("video");
      video.src = src;
      video.muted = true;
      video.defaultMuted = true;
      video.volume = 0;
      video.loop = true;
      video.playsInline = true;
      video.autoplay = true;
      video.preload = "auto";
      video.crossOrigin = "anonymous";
      video.setAttribute("muted", "");
      video.setAttribute("playsinline", "");
      video.setAttribute("autoplay", "");
      video.className = "cstudio__mockup-video";
      const done = () => resolve(video);
      video.addEventListener("loadeddata", done, { once: true });
      video.addEventListener("error", () => reject(new Error(`No carga ${src}`)), {
        once: true,
      });
      video.load();
      setTimeout(() => {
        if (video.readyState >= 2) done();
      }, 1600);
      return;
    }

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`No carga ${src}`));
    img.src = src;
  });
}

export function attachHiddenVideo(video, host) {
  if (!(video instanceof HTMLVideoElement) || !host) return;
  if (!video.isConnected) host.appendChild(video);
  const tryPlay = () => {
    video.muted = true;
    video.play().catch(() => {});
  };
  tryPlay();
  video.addEventListener("canplay", tryPlay);
}

export function stopMedia(media) {
  if (!media) return;
  if (media instanceof HTMLVideoElement) {
    media.pause();
    media.removeAttribute("src");
    media.load();
    media.remove();
  }
}

function imageAspect(image) {
  const w = image.videoWidth || image.naturalWidth || image.width;
  const h = image.videoHeight || image.naturalHeight || image.height;
  if (!w || !h) throw new Error("La imagen no tiene width/height");
  return w / h;
}

function makeTexture(image, THREE) {
  const tex =
    typeof HTMLVideoElement !== "undefined" && image instanceof HTMLVideoElement
      ? new THREE.VideoTexture(image)
      : new THREE.Texture(image);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.flipY = false;
  tex.needsUpdate = true;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

function matchFrame(root, content, imgAspect, spec) {
  const base = Number(spec.vamps_base_aspect) || 1;
  const rail = Number(spec.vamps_rail) || 0.07;
  const lock = spec.vamps_lock || "height";

  let sx;
  let sy;
  if (lock === "width") {
    sx = 1;
    sy = base / imgAspect;
  } else if (lock === "max") {
    if (imgAspect >= 1) {
      sx = 1;
      sy = 1 / imgAspect;
    } else {
      sx = imgAspect;
      sy = 1;
    }
  } else {
    sx = imgAspect / base;
    sy = 1;
  }

  content.scale.set(sx, sy, 1);

  const top = root.getObjectByName("FRAME_T");
  const bot = root.getObjectByName("FRAME_B");
  const left = root.getObjectByName("FRAME_L");
  const right = root.getObjectByName("FRAME_R");
  if (!top || !bot || !left || !right) return;

  const restTopW = 1 + 2 * rail;
  const restSideH = 1;

  top.position.set(0, sy / 2 + rail / 2, top.position.z);
  bot.position.set(0, -sy / 2 - rail / 2, bot.position.z);
  top.scale.set((sx + 2 * rail) / restTopW, 1, 1);
  bot.scale.set((sx + 2 * rail) / restTopW, 1, 1);

  left.position.set(-sx / 2 - rail / 2, 0, left.position.z);
  right.position.set(sx / 2 + rail / 2, 0, right.position.z);
  left.scale.set(1, sy / restSideH, 1);
  right.scale.set(1, sy / restSideH, 1);
}

function containInScreen(content, imgAspect, screenAspect) {
  let widthScale = 1;
  let heightScale = 1;
  if (imgAspect > screenAspect) heightScale = screenAspect / imgAspect;
  else widthScale = imgAspect / screenAspect;
  // CONTENT mira +X: alto = Y, ancho = Z
  content.scale.set(1, heightScale, widthScale);
}

function coverMap(tex, imgAspect, screenAspect, THREE) {
  if (imgAspect > screenAspect) {
    tex.repeat.set(screenAspect / imgAspect, 1);
    tex.offset.set((1 - tex.repeat.x) / 2, 0);
  } else {
    tex.repeat.set(1, imgAspect / screenAspect);
    tex.offset.set(0, (1 - tex.repeat.y) / 2);
  }
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
}

/**
 * Ancho llena el cristal; el sobrante vertical se recorta (UV, sin salir del mesh).
 * anchorY 0 = pegado abajo, 0.5 = centro, 1 = pegado arriba (recorta más abajo).
 */
function coverWidthMap(tex, imgAspect, screenAspect, THREE, anchorY = 0.5) {
  const repeatY = imgAspect >= screenAspect ? screenAspect / imgAspect : imgAspect / screenAspect;
  const slack = 1 - repeatY;
  tex.repeat.set(1, repeatY);
  tex.offset.set(0, slack * Math.min(1, Math.max(0, anchorY)));
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
}
