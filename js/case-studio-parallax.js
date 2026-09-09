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
  const logoStartZ = Number(hero.logoStartZ) || -660;
  const logoEndZ = Number(hero.logoEndZ) || -140;
  const logoZ = lerp(z(logoStartZ), z(logoEndZ), p.travel);
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
      <p class="cstudio-parallax__hint" data-parallax-hint aria-live="polite">Scroll</p>
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

function ensureParallaxScrollWrap(heroEl) {
  let scrollWrap = heroEl.parentElement;
  if (!scrollWrap?.classList.contains("cstudio__parallax-scroll")) {
    scrollWrap = document.createElement("div");
    scrollWrap.className = "cstudio__parallax-scroll";
    heroEl.parentNode.insertBefore(scrollWrap, heroEl);
    scrollWrap.appendChild(heroEl);
  }

  scrollWrap.querySelector(".cstudio__parallax-runway")?.remove();
  return { scrollWrap };
}

function diveEase(t) {
  const x = clamp(t, 0, 1);
  return 1 - (1 - x) ** 3;
}

export function initCaseParallaxHero(root, hero) {
  const rig = root.querySelector(".cstudio-parallax__rig");
  const stage = root.querySelector(".cstudio-parallax__stage");
  const hint = root.querySelector("[data-parallax-hint]");
  if (!rig || !stage) return () => {};

  const motionLayers = root.querySelectorAll("[data-layer]");
  const heroEl = root.closest(".cstudio__hero") || root;
  const parallaxEl = root.querySelector(".cstudio-parallax") || root;
  ensureParallaxScrollWrap(heroEl);
  const designAspect = Number(hero.aspect) || 1.6;
  const diveDuration = Number(hero.diveDurationMs) || 2000;

  const isMobileLoop = () =>
    hero.mobileAutoplay !== false && mobileMq.matches && !reduced;
  const isScrollLock = () => hero.scrollLock !== false && !reduced && !isMobileLoop();

  let mx = 0;
  let my = 0;
  let dive = 0;
  let raf = 0;
  let diveStart = 0;
  let divePlaying = false;
  let diveComplete = !isScrollLock();
  let touchY = 0;
  let completeFired = false;
  let loopDir = 1;
  let loopTarget = 0;
  let lastTick = 0;
  let amp = reduced ? 0.2 : mobileMq.matches ? 0.55 : 1;

  const updateCoverScale = () => {
    const w = heroEl.clientWidth;
    const h = heroEl.clientHeight;
    if (!w || !h) return;
    const viewAspect = w / h;
    const scale =
      viewAspect > designAspect
        ? viewAspect / designAspect
        : designAspect / viewAspect;
    rig.style.setProperty("--cover-scale", (scale * 1.04).toFixed(4));
  };

  const syncLayout = () => {
    amp = reduced ? 0.2 : mobileMq.matches ? 0.55 : 1;
    ensureParallaxScrollWrap(heroEl);
    updateCoverScale();
    if (isMobileLoop()) {
      diveComplete = true;
      divePlaying = false;
      document.body.classList.remove("cstudio-parallax-locked");
      heroEl.classList.remove("is-parallax-playing");
      if (hint) hint.hidden = true;
    }
  };

  const stepMobileLoop = (dt) => {
    const halfCycle = (Number(hero.mobileLoopSeconds) || 18) / 2;
    const speed = 1 / halfCycle;
    loopTarget += loopDir * speed * dt;
    if (loopTarget >= 1) {
      loopTarget = 1;
      loopDir = -1;
    } else if (loopTarget <= 0) {
      loopTarget = 0;
      loopDir = 1;
    }
    dive = lerp(dive, loopTarget, 0.14);
  };

  const lockPage = () => {
    document.body.classList.add("cstudio-parallax-locked");
    heroEl.classList.add("is-parallax-playing");
    window.scrollTo(0, 0);
  };

  const unlockPage = () => {
    document.body.classList.remove("cstudio-parallax-locked");
    heroEl.classList.remove("is-parallax-playing");
    diveComplete = true;
    divePlaying = false;
  };

  const startDive = () => {
    if (!isScrollLock() || diveComplete || divePlaying) return;
    divePlaying = true;
    diveStart = performance.now();
    lockPage();
  };

  const onWheel = (e) => {
    if (isMobileLoop() || !isScrollLock() || diveComplete) return;

    if (e.deltaY > 0) {
      e.preventDefault();
      if (!divePlaying) startDive();
      return;
    }

    if (window.scrollY <= 1) e.preventDefault();
  };

  const onTouchStart = (e) => {
    touchY = e.touches[0]?.clientY ?? 0;
  };

  const onTouchMove = (e) => {
    if (isMobileLoop() || !isScrollLock() || diveComplete) return;
    const y = e.touches[0]?.clientY ?? touchY;
    const dy = touchY - y;
    if (dy > 6) {
      e.preventDefault();
      if (!divePlaying) startDive();
    } else if (window.scrollY <= 1 && dy < -6) {
      e.preventDefault();
    }
  };

  const onKeyDown = (e) => {
    if (isMobileLoop() || !isScrollLock() || diveComplete) return;
    if (e.key === "ArrowDown" || e.key === "PageDown" || e.key === " ") {
      e.preventDefault();
      if (!divePlaying) startDive();
    }
  };

  const onScroll = () => {
    if (isMobileLoop() || !isScrollLock() || diveComplete) return;
    if (window.scrollY > 1) window.scrollTo(0, 0);
  };

  const onMove = (e) => {
    const rect = heroEl.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    mx = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
    my = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
  };

  const onLeave = () => {
    mx = 0;
    my = 0;
  };

  const applyMotion = (state, progress) => {
    const pointerMix = (1 - progress * 0.65) * amp;
    const scrollTiltX = progress * 2.2;
    const scrollTiltY = progress * -1.1;
    const tiltX = my * -0.75 * pointerMix + scrollTiltX;
    const tiltY = mx * 0.95 * pointerMix + scrollTiltY;

    stage.style.transform = `rotateX(${tiltX.toFixed(3)}deg) rotateY(${tiltY.toFixed(3)}deg)`;

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
        return;
      }

      if (id === "logo") {
        const px = mx * 3.5 * pointerMix;
        const py = my * 2.2 * pointerMix;
        el.style.transform = `translate3d(${px.toFixed(2)}px, ${py.toFixed(2)}px, ${state.logoZ.toFixed(2)}px) scale(${state.logoScale.toFixed(4)})`;
        return;
      }

      if (FLOWER_OUT[id]) {
        const cfg = FLOWER_OUT[id];
        const scale = lerp(peekScale, cfg.scaleMax, state.flowersOut);
        const push = state.flowersOut * cfg.push * pointerMix;
        const tx = cfg.dx * push;
        const ty = cfg.dy * push;
        el.style.opacity = String(state.flowerOpacity);
        el.style.transform = `translate3d(${tx.toFixed(2)}%, ${ty.toFixed(2)}%, ${state.flowerZ.toFixed(2)}px) scale(${scale.toFixed(4)})`;
      }
    });
  };

  const markComplete = () => {
    if (completeFired) return;
    completeFired = true;
    heroEl.classList.add("is-dive-complete");
    parallaxEl.classList.add("is-dive-complete");
    if (hint) hint.hidden = true;
    heroEl.dispatchEvent(new CustomEvent("cstudio-parallax-dive-complete", { bubbles: true }));
  };

  const tick = (now) => {
    const dt = lastTick ? (now - lastTick) / 1000 : 0;
    lastTick = now;

    if (isMobileLoop()) {
      stepMobileLoop(dt);
    } else if (divePlaying) {
      const t = clamp((now - diveStart) / diveDuration, 0, 1);
      dive = diveEase(t);
      if (t >= 1) {
        dive = 1;
        unlockPage();
        markComplete();
      }
    } else if (reduced && !diveComplete) {
      dive = 1;
      unlockPage();
      markComplete();
    }

    applyMotion(diveState(dive, hero), dive);
    if (hint && !isMobileLoop()) hint.hidden = dive > 0.04;
    raf = requestAnimationFrame(tick);
  };

  heroEl.classList.add("is-scroll-parallax");
  syncLayout();
  raf = requestAnimationFrame(tick);

  window.addEventListener("wheel", onWheel, { passive: false });
  window.addEventListener("touchstart", onTouchStart, { passive: true });
  window.addEventListener("touchmove", onTouchMove, { passive: false });
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("scroll", onScroll, { passive: true });

  if (isMobileLoop() && hint) hint.hidden = true;

  window.addEventListener("resize", syncLayout, { passive: true });
  mobileMq.addEventListener("change", syncLayout);
  root.addEventListener("pointermove", onMove, { passive: true });
  root.addEventListener("pointerleave", onLeave);

  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener("wheel", onWheel);
    window.removeEventListener("touchstart", onTouchStart);
    window.removeEventListener("touchmove", onTouchMove);
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("scroll", onScroll);
    window.removeEventListener("resize", syncLayout);
    mobileMq.removeEventListener("change", syncLayout);
    root.removeEventListener("pointermove", onMove);
    root.removeEventListener("pointerleave", onLeave);
    parallaxEl.style.opacity = "";
    stage.style.transform = "";
    rig.style.removeProperty("--cover-scale");
    heroEl.classList.remove(
      "is-scroll-parallax",
      "is-dive-complete",
      "is-parallax-playing",
    );
    parallaxEl.classList.remove("is-dive-complete");
    document.body.classList.remove("cstudio-parallax-locked");
  };
}
