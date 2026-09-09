/**
 * Hero slit-scan — desktop: cursor escanea + arrastre horizontal.
 * Mobile: escáner automático continuo; cada pasada distorsiona sobre la anterior.
 */

const mobileMq = window.matchMedia("(max-width: 899px)");

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;");
}

function parseBg(hex) {
  const h = String(hex || "#ffffff").replace("#", "");
  if (h.length === 3) {
    return [
      parseInt(h[0] + h[0], 16),
      parseInt(h[1] + h[1], 16),
      parseInt(h[2] + h[2], 16),
      255,
    ];
  }
  return [
    parseInt(h.slice(0, 2), 16) || 255,
    parseInt(h.slice(2, 4), 16) || 255,
    parseInt(h.slice(4, 6), 16) || 255,
    255,
  ];
}

export function buildScannerHeroMarkup(hero) {
  const bg = hero.background || "#ffffff";
  return `
    <div class="cstudio-scanner" data-scanner-hero style="--scanner-bg:${esc(bg)}">
      <canvas class="cstudio-scanner__canvas" role="img" aria-label="${esc(hero.alt || "")}"></canvas>
    </div>`;
}

export function initCaseScannerHero(root, hero) {
  const wrap = root.querySelector("[data-scanner-hero]");
  const canvas = wrap?.querySelector(".cstudio-scanner__canvas");
  if (!wrap || !canvas) return null;

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;

  const wobblePx = Number(hero.wobble) || 0;
  const moveGain = Number(hero.scanGain) || 1.15;
  const mobilePassSec = Number(hero.mobilePassSec) || 3.6;
  const mobileDrift = Number(hero.mobileDrift) || 40;
  const bg = parseBg(hero.background);

  let source = null;
  let output = null;
  let passLayer = null;
  let width = 0;
  let height = 0;
  let displacement = 0;
  let passOffset = 0;
  let lastScanY = null;
  let lastClientX = null;
  let pointerRaf = 0;

  let mobileAuto = false;
  let autoRaf = 0;
  let autoY = 0;
  let autoTime = 0;
  let autoLast = performance.now();
  let pageVisible = true;

  const paintOff = document.createElement("canvas");
  const paintCtx = paintOff.getContext("2d");

  const img = new Image();
  img.crossOrigin = "anonymous";
  img.decoding = "async";

  function isMobileMode() {
    return mobileMq.matches;
  }

  function canAnimate() {
    return pageVisible;
  }

  function layout() {
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width));
    const h = Math.max(1, Math.round(rect.height));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    return rect;
  }

  const focalY = clamp(Number(hero.focalY) || 0.5, 0, 1);

  function imageMetrics(rect) {
    const scale = Math.max(rect.width / width, rect.height / height);
    const dw = width * scale;
    const dh = height * scale;
    const ox = rect.left + (rect.width - dw) * 0.5;
    const oy = rect.top + (rect.height - dh) * focalY;
    return { scale, dw, dh, ox, oy };
  }

  function clientToImage(clientX, clientY, rect) {
    const { scale, ox, oy } = imageMetrics(rect);
    return {
      x: clamp((clientX - ox) / scale, 0, width - 1),
      y: clamp(Math.floor((clientY - oy) / scale), 0, height - 1),
    };
  }

  function paintFit() {
    if (!source || !output) return;
    const rect = layout();
    ctx.fillStyle = hero.background || "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const { dw, dh, ox, oy } = imageMetrics(rect);
    const drawOx = ox - rect.left;
    const drawOy = oy - rect.top;

    paintOff.width = width;
    paintOff.height = height;
    paintCtx.putImageData(output, 0, 0);
    ctx.drawImage(paintOff, drawOx, drawOy, dw, dh);
  }

  function beginPassLayer() {
    if (!output) return;
    passLayer = new Uint8ClampedArray(output.data);
  }

  function scanLine(y, disp, readData) {
    if (!source || !output || !readData || y < 0 || y >= height) return;
    const row = y * width;
    for (let x = 0; x < width; x++) {
      const wobble = wobblePx ? Math.sin(x * 0.036 + y * 0.014) * wobblePx : 0;
      const srcX = Math.round(x - disp - wobble);
      const oi = (row + x) * 4;

      if (srcX < 0 || srcX >= width) {
        output.data[oi] = bg[0];
        output.data[oi + 1] = bg[1];
        output.data[oi + 2] = bg[2];
        output.data[oi + 3] = bg[3];
        continue;
      }

      const si = (row + srcX) * 4;
      output.data[oi] = readData[si];
      output.data[oi + 1] = readData[si + 1];
      output.data[oi + 2] = readData[si + 2];
      output.data[oi + 3] = readData[si + 3];
    }
  }

  function scanBetween(y0, y1, dispStart, dispEnd, readData) {
    const a = Math.round(y0);
    const b = Math.round(y1);
    if (a === b) {
      scanLine(a, dispEnd, readData);
      return;
    }
    const steps = Math.abs(b - a);
    const dir = b > a ? 1 : -1;
    for (let i = 0; i <= steps; i++) {
      const y = a + i * dir;
      const t = i / steps;
      scanLine(y, dispStart + (dispEnd - dispStart) * t, readData);
    }
  }

  function resetScan() {
    if (!source) return;
    output = new ImageData(new Uint8ClampedArray(source.data), width, height);
    displacement = 0;
    passOffset = 0;
    lastScanY = null;
    lastClientX = null;
    autoY = 0;
    autoTime = 0;
    beginPassLayer();
    paintFit();
  }

  function onPointer(clientX, clientY) {
    if (reduced || !source || isMobileMode()) return;
    const rect = canvas.getBoundingClientRect();
    const { y } = clientToImage(clientX, clientY, rect);
    const scale = imageMetrics(rect).scale;
    const dx = lastClientX == null ? 0 : ((clientX - lastClientX) / scale) * moveGain;

    if (lastScanY == null) {
      displacement = 0;
      scanLine(y, displacement, source.data);
      lastScanY = y;
      lastClientX = clientX;
      paintFit();
      return;
    }

    const dispStart = displacement;
    displacement += dx;

    if (y === lastScanY) {
      if (dx !== 0) scanLine(y, displacement, source.data);
    } else {
      scanBetween(lastScanY, y, dispStart, displacement, source.data);
      lastScanY = y;
    }

    lastClientX = clientX;
    paintFit();
  }

  function onMove(e) {
    cancelAnimationFrame(pointerRaf);
    pointerRaf = requestAnimationFrame(() => onPointer(e.clientX, e.clientY));
  }

  function onKey(e) {
    if (e.key === "r" || e.key === "R") resetScan();
  }

  function finishPass() {
    passOffset += mobileDrift * 0.72;
    autoY = 0;
    beginPassLayer();
  }

  function stepAuto(dt) {
    if (!source || !passLayer || !canAnimate()) return;

    autoTime += dt;
    displacement =
      passOffset +
      Math.sin(autoTime * 1.05) * mobileDrift +
      Math.cos(autoTime * 0.48) * mobileDrift * 0.62;

    const prevY = autoY;
    const step = (height / mobilePassSec) * dt;
    autoY += step;

    if (autoY >= height - 1) {
      scanBetween(prevY, height - 1, displacement, displacement, passLayer);
      finishPass();
    } else {
      scanBetween(prevY, autoY, displacement, displacement, passLayer);
    }

    paintFit();
  }

  function autoLoop(now) {
    if (!mobileAuto) return;
    const dt = Math.min((now - autoLast) / 1000, 0.05);
    autoLast = now;
    stepAuto(dt);
    autoRaf = requestAnimationFrame(autoLoop);
  }

  function startMobileAuto() {
    if (reduced || !isMobileMode() || !source || !pageVisible) return;
    if (!passLayer) beginPassLayer();
    mobileAuto = true;
    autoLast = performance.now();
    cancelAnimationFrame(autoRaf);
    autoRaf = requestAnimationFrame(autoLoop);
  }

  function stopMobileAuto() {
    mobileAuto = false;
    cancelAnimationFrame(autoRaf);
  }

  function syncMode() {
    if (isMobileMode()) {
      stopPointer();
      resetScan();
      startMobileAuto();
      root.classList.add("cstudio-scanner--auto");
    } else {
      stopMobileAuto();
      startPointer();
      resetScan();
      root.classList.remove("cstudio-scanner--auto");
    }
  }

  function stopPointer() {
    root.removeEventListener("pointermove", onMove);
    root.removeEventListener("pointerdown", onMove);
  }

  function startPointer() {
    if (reduced) return;
    root.addEventListener("pointermove", onMove, { passive: true });
    root.addEventListener("pointerdown", onMove, { passive: true });
  }

  function onVisibility() {
    pageVisible = !document.hidden;
    if (pageVisible && isMobileMode()) startMobileAuto();
    else stopMobileAuto();
  }

  img.onload = () => {
    width = img.naturalWidth;
    height = img.naturalHeight;
    const off = document.createElement("canvas");
    off.width = width;
    off.height = height;
    const octx = off.getContext("2d");
    octx.drawImage(img, 0, 0);
    source = octx.getImageData(0, 0, width, height);
    resetScan();
    layout();
    paintFit();
    syncMode();
  };
  img.onerror = () => {
    root.innerHTML = `<img src="${esc(hero.src)}" alt="${esc(hero.alt || "")}" />`;
  };
  img.src = hero.src;

  const ro = new ResizeObserver(() => paintFit());
  ro.observe(root);

  const onMq = () => syncMode();
  mobileMq.addEventListener("change", onMq);
  window.addEventListener("keydown", onKey);
  document.addEventListener("visibilitychange", onVisibility);

  return () => {
    cancelAnimationFrame(pointerRaf);
    cancelAnimationFrame(autoRaf);
    ro.disconnect();
    mobileMq.removeEventListener("change", onMq);
    stopPointer();
    stopMobileAuto();
    window.removeEventListener("keydown", onKey);
    document.removeEventListener("visibilitychange", onVisibility);
  };
}
