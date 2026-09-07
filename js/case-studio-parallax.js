const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const mobileMq = window.matchMedia("(max-width: 899px)");

/** Empuje % hacia fuera del centro (origen en esquina interior, la más cercana al centro). */
const FLOWER_OUT = {
  "layer-2": { dx: -1, dy: 1, scaleMax: 2.05, push: 24 },
  "layer-3": { dx: 1, dy: 1, scaleMax: 2.2, push: 28 },
  "layer-1": { dx: 1, dy: -1, scaleMax: 2.25, push: 26 },
};

function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;");
}

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function segment(t, start, end) {
  if (end <= start) return t >= end ? 1 : 0;
  return clamp((t - start) / (end - start), 0, 1);
}

function smoothstep(t) {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
}

function placementStyle(p = {}) {
  return [
    `--pl:${p.left ?? 0}%`,
    `--pt:${p.top ?? 0}%`,
    `--pw:${p.width ?? 100}%`,
    `--ph:${p.height ?? 100}%`,
  ].join(";");
}

function layerSrc(base, file) {
  if (!file) return "";
  if (file.startsWith("/")) return file;
  const root = base.replace(/\/[^/]+$/, "");
  return `${root}/${file}`;
}

/** Referencias visuales del dive (no cortes rígidos). Solapamiento entre fases. */
function divePhases(dive, hero) {
  const refEnter = Number(hero.refEnter ?? hero.frame1End) || 0.28;
  const refTunnel = Number(hero.refTunnel ?? hero.frame2End) || 0.58;
  const refExit = Number(hero.refExit) || 0.86;
  const travel = smoothstep(dive);

  const flowersIn = smoothstep(segment(dive, refEnter - 0.08, refEnter + 0.24));
  const tunnelOpen = smoothstep(segment(dive, refEnter - 0.05, refTunnel + 0.12));
  const frameOut = smoothstep(segment(dive, refTunnel + 0.04, refExit + 0.12));
  const sceneDrop = smoothstep(segment(dive, refTunnel + 0.06, 1));
  const flowersOut = smoothstep(segment(dive, refTunnel + 0.08, 1));

  return {
    dive,
    travel,
    refEnter,
    refTunnel,
    refExit,
    flowersIn,
    tunnelOpen,
    frameOut,
    sceneDrop,
    flowersOut,
  };
}

function diveState(dive, hero) {
  const logoMax = Number(hero.logoMaxScale) || 1.14;
  const logoMin = Number(hero.logoBaseScale) || 0.32;
  const groundDrop = Number(hero.groundDrop) || 6.5;
  const flowerMidZ = Number(hero.flowerMidZ) || -900;
  const z = (v) => v * 2;
  const p = divePhases(dive, hero);

  const logoScale = lerp(logoMin, logoMax, smoothstep(segment(dive, 0.06, p.refExit + 0.1)));
  const frameScale = 1 + p.tunnelOpen * 0.14 + p.frameOut * 2.85;
  const frameOpacity = clamp(1 - p.frameOut * 1.08, 0, 1);
  const flowerOpacity = p.flowersIn;

  const frameZ = lerp(z(280), z(245), p.tunnelOpen) + p.frameOut * z(215);
  const flowerZ = lerp(-980, flowerMidZ, p.tunnelOpen) + p.flowersOut * (30 - flowerMidZ);
  const fondoZ = lerp(z(-1100), z(-540), p.travel);
  const cloudZ = lerp(z(-940), z(-440), p.travel);
  const groundZ = lerp(z(-800), z(-320), p.travel);
  const logoZ = lerp(z(-660), z(-140), p.travel);
  const groundY = p.sceneDrop * groundDrop;

  return {
    ...p,
    fondoZ,
    cloudZ,
    groundZ,
    frameScale,
    frameOpacity,
    frameZ,
    logoScale,
    logoZ,
    flowerOpacity,
    flowerZ,
    groundY,
  };
}

export function buildParallaxHeroMarkup(hero) {
  const aspect = hero.aspect || 1.6;
  const baseSrc = esc(hero.base);
  const alt = esc(hero.alt || "");
  const layers = hero.layers ?? [];
  const byId = new Map(layers.map((l) => [l.id, l]));

  const cloud = byId.get("cloud-3");
  const ground = byId.get("layer-4");
  const frame = byId.get("layer-5");
  const logo = byId.get("logo");
  const flowers = ["layer-2", "layer-3", "layer-1"]
    .map((id) => byId.get(id))
    .filter(Boolean);

  const cloudRepeat = cloud?.repeat ?? 3;
  const cloudSrc = esc(layerSrc(hero.base, cloud?.file));
  const cloudSpeed = cloud?.speed ?? 36;
  const cloudBandTop = cloud?.placement?.top ?? 5.8125;
  const cloudBandH = cloud?.placement?.height ?? 27.5;

  const fondoPlacement = hero.fondoPlacement || {
    left: -13.0078,
    top: -8.3125,
    width: 120.8984,
    height: 108.3125,
  };

  const flowerHtml = flowers
    .map((layer) => {
      const src = esc(layerSrc(hero.base, layer.file));
      return `
        <div
          class="cstudio-parallax__layer cstudio-parallax__layer--flower"
          data-layer="${layer.id}"
          style="${placementStyle(layer.placement)}"
        >
          <img src="${src}" alt="" loading="eager" decoding="async" draggable="false" />
        </div>`;
    })
    .join("");

  const groundHtml = ground
    ? `<div class="cstudio-parallax__layer cstudio-parallax__layer--ground" data-layer="layer-4" style="${placementStyle(ground.placement)}">
        <img src="${esc(layerSrc(hero.base, ground.file))}" alt="" loading="eager" decoding="async" draggable="false" />
      </div>`
    : "";

  const logoHtml = logo
    ? `<div
        class="cstudio-parallax__layer cstudio-parallax__layer--logo"
        data-layer="logo"
        style="${placementStyle(logo.placement)}"
      >
        <div class="cstudio-parallax__logo-inner">
          <img src="${esc(layerSrc(hero.base, logo.file))}" alt="${alt}" loading="eager" decoding="async" draggable="false" />
        </div>
      </div>`
    : "";

  const frameHtml = frame
    ? `<div
        class="cstudio-parallax__layer cstudio-parallax__layer--frame"
        data-layer="layer-5"
        style="${placementStyle(frame.placement)}"
      >
        <img src="${esc(layerSrc(hero.base, frame.file))}" alt="" loading="eager" decoding="async" draggable="false" />
      </div>`
    : "";

  const cloudImgs = Array.from({ length: cloudRepeat }, () => `<img src="${cloudSrc}" alt="" draggable="false" />`).join("");

  return `
    <div class="cstudio-parallax" data-parallax-hero style="--parallax-aspect:${aspect};--cloud-speed:${cloudSpeed}s">
      <p class="cstudio-parallax__hint" data-parallax-hint aria-live="polite">Scroll para entrar</p>
      <div class="cstudio-parallax__rig">
        <div class="cstudio-parallax__stage">
          <div class="cstudio-parallax__layer cstudio-parallax__layer--fondo" data-layer="fondo" style="${placementStyle(fondoPlacement)}">
            <img class="cstudio-parallax__bg" src="${baseSrc}" alt="${alt}" loading="eager" decoding="async" draggable="false" />
          </div>
          ${
            cloud
              ? `<div
              class="cstudio-parallax__cloud-band"
              data-layer="cloud-3"
              style="--band-top:${cloudBandTop}%;--band-h:${cloudBandH}%"
            >
              <div class="cstudio-parallax__cloud-track">${cloudImgs}</div>
            </div>`
              : ""
          }
          ${groundHtml}
          ${flowerHtml}
          ${logoHtml}
          ${frameHtml}
        </div>
      </div>
    </div>`;
}

export function initCaseParallaxHero(root, hero) {
  const rig = root.querySelector(".cstudio-parallax__rig");
  const hint = root.querySelector("[data-parallax-hint]");
  if (!rig) return () => {};

  const motionLayers = root.querySelectorAll("[data-layer]");
  const heroEl = root.closest(".cstudio__hero") || root;
  const mobileLoop = hero.mobileAutoplay !== false && mobileMq.matches && !reduced;
  const scrollLock = hero.scrollLock !== false && !reduced && !mobileLoop;
  const diveDistance = Number(hero.diveDistance) || (mobileMq.matches ? 920 : 1850);
  const holdDistance =
    Number(hero.holdDistance) || (mobileMq.matches ? Math.round(diveDistance * 0.2) : Math.round(diveDistance * 0.22));
  const lockDistance = diveDistance + holdDistance;
  const scrollSpeed = Number(hero.scrollSpeed) || (mobileMq.matches ? 600 : 760);
  const wheelStep = Number(hero.wheelStep) || (mobileMq.matches ? 90 : 110);
  const scrollIdleMs = Number(hero.scrollIdleMs) || 380;

  let mx = 0;
  let my = 0;
  let dive = 0;
  let diveTarget = 0;
  let virtualScroll = 0;
  let virtualTarget = 0;
  let diveComplete = !scrollLock;
  let touchY = 0;
  let raf = 0;
  let amp = reduced ? 0.25 : mobileMq.matches ? 0.65 : 1;
  let scrollDrive = 0;
  let lastScrollInput = 0;
  let lastTick = 0;
  let loopDir = 1;

  const syncAmp = () => {
    amp = reduced ? 0.25 : mobileMq.matches ? 0.65 : 1;
  };
  mobileMq.addEventListener("change", syncAmp);

  const stepMobileLoop = (dt) => {
    const halfCycle = (Number(hero.mobileLoopSeconds) || 18) / 2;
    const speed = diveDistance / halfCycle;
    virtualTarget += loopDir * speed * dt;
    if (virtualTarget >= diveDistance) {
      virtualTarget = diveDistance;
      loopDir = -1;
    } else if (virtualTarget <= 0) {
      virtualTarget = 0;
      loopDir = 1;
    }
    virtualScroll = lerp(virtualScroll, virtualTarget, 0.14);
    diveTarget = clamp(virtualScroll / diveDistance, 0, 1);
  };

  const setLocked = (locked) => {
    document.body.classList.toggle("cstudio-parallax-locked", locked);
    heroEl.classList.toggle("is-parallax-locked", locked);
    root.classList.toggle("is-parallax-locked", locked);
    if (hint) hint.hidden = !locked;
  };

  const markComplete = () => {
    if (diveComplete) return;
    diveComplete = true;
    virtualTarget = Math.min(virtualTarget, diveDistance);
    virtualScroll = Math.min(virtualScroll, diveDistance);
    root.classList.add("is-dive-complete");
    heroEl.classList.add("is-dive-complete");
    root.classList.add("is-dive-complete");
    root.style.touchAction = "pan-y";
    setLocked(false);
    if (hint) hint.hidden = true;
    heroEl.dispatchEvent(new CustomEvent("cstudio-parallax-dive-complete", { bubbles: true }));
  };

  const markIncomplete = () => {
    diveComplete = false;
    root.classList.remove("is-dive-complete");
    heroEl.classList.remove("is-dive-complete");
    root.classList.remove("is-dive-complete");
    root.style.touchAction = "";
    setLocked(true);
  };

  const syncDiveFromVirtual = () => {
    virtualScroll = clamp(virtualScroll, 0, lockDistance);
    virtualTarget = clamp(virtualTarget, 0, lockDistance);
    diveTarget = clamp(virtualScroll / diveDistance, 0, 1);
    if (diveTarget >= 1) {
      if (!diveComplete && !mobileLoop) markComplete();
    } else if (diveComplete && window.scrollY <= 1 && !mobileLoop) {
      markIncomplete();
    }
  };

  const nudgeVirtual = (dir) => {
    if (!dir) return;
    const max = diveComplete ? lockDistance : diveDistance;
    virtualTarget = clamp(virtualTarget + dir * wheelStep, 0, max);
    syncDiveFromVirtual();
  };

  const setScrollDrive = (dir) => {
    scrollDrive = dir > 0 ? 1 : dir < 0 ? -1 : 0;
    if (scrollDrive) lastScrollInput = performance.now();
  };

  const stepScroll = (dt) => {
    if (mobileLoop) {
      stepMobileLoop(dt);
      return;
    }
    if (!scrollLock) return;

    const step = scrollSpeed * dt;
    const now = performance.now();
    if (scrollDrive && now - lastScrollInput > scrollIdleMs) scrollDrive = 0;

    if (!diveComplete) {
      const delta = virtualTarget - virtualScroll;
      if (Math.abs(delta) > 0.05) {
        virtualScroll += Math.sign(delta) * Math.min(Math.abs(delta), step);
        syncDiveFromVirtual();
      }
      return;
    }

    if (scrollDrive < 0 && window.scrollY <= 1) {
      const backDelta = virtualTarget - virtualScroll;
      if (Math.abs(backDelta) > 0.05) {
        virtualScroll += Math.sign(backDelta) * Math.min(Math.abs(backDelta), step);
        syncDiveFromVirtual();
      }
    }
  };

  const onMove = (e) => {
    const rect = root.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    mx = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
    my = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
  };

  const onLeave = () => {
    mx = 0;
    my = 0;
  };

  const heroContainsPoint = (x, y) => {
    const r = heroEl.getBoundingClientRect();
    return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  };

  const onWheel = (e) => {
    if (!scrollLock) return;

    const dir = Math.sign(e.deltaY);
    if (!dir) return;

    if (diveComplete) {
      if (dir < 0 && window.scrollY <= 1) {
        e.preventDefault();
        setScrollDrive(-1);
        nudgeVirtual(-1);
      }
      return;
    }

    e.preventDefault();
    setScrollDrive(dir);
    nudgeVirtual(dir);
  };

  const onTouchStart = (e) => {
    touchY = e.touches[0]?.clientY ?? 0;
  };

  const onTouchMove = (e) => {
    if (!scrollLock) return;
    const y = e.touches[0]?.clientY ?? touchY;
    const dy = touchY - y;
    touchY = y;
    if (dy === 0) return;

    const dir = Math.sign(dy);
    if (!dir) return;

    if (diveComplete) {
      if (dir < 0 && window.scrollY <= 1) {
        e.preventDefault();
        setScrollDrive(-1);
        nudgeVirtual(-1);
      }
      return;
    }

    e.preventDefault();
    setScrollDrive(dir);
    nudgeVirtual(dir);
  };

  const applyMotion = (state) => {
    const tiltX = my * -0.9 * amp * dive;
    const tiltY = mx * 1.1 * amp * dive;
    rig.style.transform = `rotateX(${tiltX.toFixed(3)}deg) rotateY(${tiltY.toFixed(3)}deg)`;

    const tunnelHold = state.tunnelOpen * (1 - state.flowersOut);
    const peekScale = lerp(1, 1.08, tunnelHold);

    motionLayers.forEach((el) => {
      const id = el.dataset.layer;
      if (!id) return;

      if (id === "fondo") {
        el.style.transform = `translate3d(0, 0, ${state.fondoZ.toFixed(2)}px)`;
        return;
      }

      if (id === "cloud-3") {
        el.style.transform = `translate3d(0, 0, ${state.cloudZ.toFixed(2)}px)`;
        return;
      }

      if (id === "layer-4") {
        el.style.transform = `translate3d(0, ${state.groundY.toFixed(3)}%, ${state.groundZ.toFixed(2)}px)`;
        return;
      }

      if (id === "layer-5") {
        const gone = state.frameOpacity <= 0.02;
        el.style.opacity = String(state.frameOpacity);
        el.style.visibility = gone ? "hidden" : "visible";
        el.style.transform = `translate3d(0, 0, ${state.frameZ.toFixed(2)}px) scale(${state.frameScale.toFixed(4)})`;
        el.style.pointerEvents = "none";
        return;
      }

      if (id === "logo") {
        const px = mx * 4 * amp;
        const py = my * 2.5 * amp;
        el.style.transform = `translate3d(${px.toFixed(2)}px, ${py.toFixed(2)}px, ${state.logoZ.toFixed(2)}px) scale(${state.logoScale.toFixed(4)})`;
        return;
      }

      if (FLOWER_OUT[id]) {
        const cfg = FLOWER_OUT[id];
        const scale = lerp(peekScale, cfg.scaleMax, state.flowersOut);
        const push = state.flowersOut * cfg.push * amp;
        const tx = cfg.dx * push;
        const ty = cfg.dy * push;
        el.style.opacity = String(state.flowerOpacity);
        el.style.transform = `translate3d(${tx.toFixed(2)}%, ${ty.toFixed(2)}%, ${state.flowerZ.toFixed(2)}px) scale(${scale.toFixed(4)})`;
      }
    });
  };

  const tick = (now) => {
    if (!lastTick) lastTick = now;
    const dt = Math.min((now - lastTick) / 1000, 0.05);
    lastTick = now;

    stepScroll(dt);
    dive = lerp(dive, diveTarget, reduced ? 0.12 : 0.085);
    const state = diveState(dive, hero);
    applyMotion(state);

    if (hint && mobileLoop) {
      hint.hidden = true;
    } else if (hint && scrollLock && !diveComplete) {
      const { refEnter, refTunnel, refExit } = state;
      if (dive < refEnter * 0.85) hint.textContent = "Scroll para entrar";
      else if (dive < refTunnel) hint.textContent = "Sigue…";
      else if (dive < refExit) hint.textContent = "Entra";
      else hint.textContent = "Casi dentro";
    } else if (hint && diveComplete) {
      hint.hidden = false;
      hint.textContent = "Scroll arriba para recomponer";
    }

    raf = requestAnimationFrame(tick);
  };

  if (scrollLock) setLocked(true);
  if (mobileLoop && hint) hint.hidden = true;

  root.addEventListener("pointermove", onMove, { passive: true });
  root.addEventListener("pointerleave", onLeave);
  if (scrollLock) {
    window.addEventListener("wheel", onWheel, { passive: false });
    root.addEventListener("touchstart", onTouchStart, { passive: true });
    root.addEventListener("touchmove", onTouchMove, { passive: false });
  }
  syncDiveFromVirtual();
  raf = requestAnimationFrame(tick);

  return () => {
    cancelAnimationFrame(raf);
    root.removeEventListener("pointermove", onMove);
    root.removeEventListener("pointerleave", onLeave);
    if (scrollLock) {
      window.removeEventListener("wheel", onWheel);
      root.removeEventListener("touchstart", onTouchStart);
      root.removeEventListener("touchmove", onTouchMove);
    }
    mobileMq.removeEventListener("change", syncAmp);
    root.style.touchAction = "";
    document.body.classList.remove("cstudio-parallax-locked");
    heroEl.classList.remove("is-parallax-locked", "is-dive-complete");
    root.classList.remove("is-parallax-locked", "is-dive-complete");
  };
}
