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
    const ud = o.userData || {};
    if (ud.vamps_fit || ud.vamps_kind === "screen" || ud.vamps_base_aspect) {
      spec = { ...spec, ...ud };
    }
  });
  return spec;
}

/** iPhone: cristal en +Z del export; frente del chasis en −Z → yaw π + CONTENT en −Z local. */
export function alignPhoneScreen(root, item) {
  const content = root.getObjectByName("CONTENT");
  if (!content) return;

  const isPhone =
    Boolean(root.getObjectByName("iphone_lp")) || /iphone/i.test(item?.src || "");

  if (isPhone) {
    if (content.userData.vamps_originZ == null) {
      content.userData.vamps_originZ = content.position.z;
    }
    content.position.z = -Math.abs(content.userData.vamps_originZ);
    content.rotation.y = Math.PI;
    return;
  }

  if (!Number.isFinite(item?.modelYaw)) return;
  content.rotation.y = Math.PI;
  if (content.userData.vamps_originZ == null) {
    content.userData.vamps_originZ = content.position.z;
  }
  content.position.z = -content.userData.vamps_originZ;
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
  const imgAspect = imageAspect(image);
  const fit = fitOverride || spec.vamps_fit || "cover";
  const screenAspect = Number(spec.vamps_base_aspect) || 1.299;

  if (fit !== "match") resetContentTransform(content);

  if (fit === "match") {
    matchFrame(root, content, imgAspect, spec);
    tex.repeat.set(1, 1);
    tex.offset.set(0, 0);
    content.material = makeScreenMaterial(tex, THREE, content.material, opts);
    finalizeScreenMesh(content);
    return tex;
  }

  if (fit === "contain") {
    containInScreen(content, imgAspect, screenAspect);
    tex.repeat.set(1, 1);
    tex.offset.set(0, 0);
    content.material = makeScreenMaterial(tex, THREE, content.material, opts);
    finalizeScreenMesh(content);
    return tex;
  }

  if (fit === "coverWidth") {
    const anchorY = Number.isFinite(opts.anchorY) ? opts.anchorY : 0.5;
    coverWidthMap(tex, imgAspect, screenAspect, THREE, anchorY);
    trimScreenBottom(content, resolveInsetY(opts, spec));
    insetScreenPad(content, opts.pad);
    content.material = makeScreenMaterial(tex, THREE, content.material, opts);
    finalizeScreenMesh(content);
    return tex;
  }

  coverMap(tex, imgAspect, screenAspect, THREE);
  trimScreenBottom(content, resolveInsetY(opts, spec));
  insetScreenPad(content, opts.pad);
  content.material = makeScreenMaterial(tex, THREE, content.material, opts);
  finalizeScreenMesh(content);
  return tex;
}

function makeScreenMaterial(tex, THREE, previous, opts = {}) {
  if (previous?.map && previous.map !== tex) previous.map.dispose?.();
  if (previous?.alphaMap) previous.alphaMap.dispose?.();
  const radius = Number(opts.radius);
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    toneMapped: false,
    transparent: radius > 0,
    side: THREE.DoubleSide,
  });
  if (radius > 0) {
    mat.alphaMap = roundedAlphaTexture(256, 512, radius, THREE);
    mat.alphaTest = 0.04;
  }
  return mat;
}

function finalizeScreenMesh(content) {
  content.renderOrder = 2;
  const mat = content.material;
  if (!mat) return;
  mat.polygonOffset = true;
  mat.polygonOffsetFactor = -2;
  mat.polygonOffsetUnits = -2;
  mat.needsUpdate = true;
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

/** Encoge CONTENT de forma uniforme para respetar bisel / notch. */
function insetScreenPad(content, pad) {
  const inset = Number(pad);
  if (!inset) return;
  const factor = 1 - Math.min(0.2, Math.max(0, inset));
  content.scale.x *= factor;
  content.scale.y *= factor;
}

function roundedAlphaTexture(w, h, radius, THREE) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#fff";
  const r = radius * Math.min(w, h);
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.lineTo(w - r, 0);
  ctx.quadraticCurveTo(w, 0, w, r);
  ctx.lineTo(w, h - r);
  ctx.quadraticCurveTo(w, h, w - r, h);
  ctx.lineTo(r, h);
  ctx.quadraticCurveTo(0, h, 0, h - r);
  ctx.lineTo(0, r);
  ctx.quadraticCurveTo(0, 0, r, 0);
  ctx.closePath();
  ctx.fill();
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.NoColorSpace;
  tex.flipY = false;
  tex.needsUpdate = true;
  return tex;
}

/** Ajusta CONTENT al bisel sin pintar textura (iframe en pantalla 3D). */
export function applyScreenInsets(root, item) {
  const content = root.getObjectByName("CONTENT");
  if (!content) return null;
  const spec = findMockupSpec(root);
  resetContentTransform(content);
  insetScreenPad(content, item.contentPad);
  trimScreenBottom(content, resolveInsetY({ insetY: item.contentInsetY }, spec));
  return content;
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

function configureInlineVideo(video) {
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
  video.setAttribute("webkit-playsinline", "");
  video.setAttribute("autoplay", "");
}

export function primeVideoPlayback(media) {
  if (!(media instanceof HTMLVideoElement)) return;
  configureInlineVideo(media);
  if (!media.isConnected) {
    document.body.appendChild(media);
  }
  const tryPlay = () => {
    if (document.hidden) return;
    const playPromise = media.play();
    if (playPromise?.catch) {
      playPromise.catch(() => {});
    }
  };
  tryPlay();
  media.addEventListener("loadeddata", tryPlay, { once: true });
  media.addEventListener("canplay", tryPlay, { once: true });
  media.addEventListener("canplaythrough", tryPlay, { once: true });
  if (media.readyState >= 2) tryPlay();
}

export function primeAllVideos(root = document) {
  root.querySelectorAll("video.cstudio__mockup-video").forEach((video) => {
    primeVideoPlayback(video);
  });
}

export function loadContentMedia(src) {
  return new Promise((resolve, reject) => {
    if (!src) {
      resolve(null);
      return;
    }
    if (/\.(mp4|webm|mov|ogg)$/i.test(src)) {
      const video = document.createElement("video");
      configureInlineVideo(video);
      video.className = "cstudio__mockup-video";
      const done = () => resolve(video);
      video.addEventListener("loadeddata", done, { once: true });
      video.addEventListener("error", () => reject(new Error(`No carga ${src}`)), {
        once: true,
      });
      video.src = src;
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
  configureInlineVideo(video);
  if (!video.isConnected) host.appendChild(video);
  primeVideoPlayback(video);
  document.addEventListener(
    "visibilitychange",
    () => {
      if (!document.hidden) primeVideoPlayback(video);
    },
    { passive: true }
  );
  window.addEventListener(
    "pageshow",
    () => {
      primeVideoPlayback(video);
    },
    { passive: true }
  );
  window.addEventListener(
    "focus",
    () => {
      primeVideoPlayback(video);
    },
    { passive: true }
  );
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
