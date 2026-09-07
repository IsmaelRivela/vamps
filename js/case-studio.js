import { CaseStage } from "./case-studio-stage.js";
import { buildParallaxHeroMarkup, initCaseParallaxHero } from "./case-studio-parallax.js";

const STORAGE_PREFIX = "vamps-case-studio::";

const caseManifests = import.meta.glob("../creative/cases/*.json", {
  eager: true,
  import: "default",
});

export function caseIdFromLocation() {
  const params = new URLSearchParams(location.search);
  const fromQuery = params.get("case");
  if (fromQuery) return fromQuery;
  const match = location.pathname.match(/\/creative\/cases\/([^/]+)/);
  if (match) return match[1].replace(/\.json$/, "");
  return document.body.dataset.case || "tulipana";
}

export function loadCaseManifest(id) {
  const key = `../creative/cases/${id}.json`;
  const manifest = caseManifests[key];
  if (!manifest) throw new Error(`Case manifest not found: ${id}`);
  return structuredClone(manifest);
}

export function loadCarouselOverride(id) {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${id}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveCarouselOverride(id, data) {
  localStorage.setItem(`${STORAGE_PREFIX}${id}`, JSON.stringify(data));
}

export function clearCarouselOverride(id) {
  localStorage.removeItem(`${STORAGE_PREFIX}${id}`);
}

export function resolveCarouselItems(config, override) {
  const all = config.carousel ?? [];
  if (!override) return all;

  if (Array.isArray(override.order) && override.order.length) {
    const map = new Map(all.map((item) => [item.id, item]));
    const ordered = override.order.map((id) => map.get(id)).filter(Boolean);
    const seen = new Set(override.order);
    const missing = all.filter((item) => !seen.has(item.id));
    const disabled = new Set(override.disabled ?? []);
    return [...missing, ...ordered].filter((item) => !disabled.has(item.id));
  }

  const disabled = new Set(override.disabled ?? []);
  return all.filter((item) => !disabled.has(item.id));
}

function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;");
}

function rowHtml(row) {
  const label = esc(row.label).replace(/\n/g, "<br>");
  const value = row.html ? row.value : esc(row.value);
  return `
    <div class="cstudio__row">
      <div class="cstudio__row-label">${label}</div>
      <div class="cstudio__row-value">${value}</div>
    </div>`;
}

export async function initCaseStudio(root = document) {
  const shell = root.querySelector("[data-case-studio]");
  if (!shell) return null;

  const id = caseIdFromLocation();
  const config = loadCaseManifest(id);
  const override = loadCarouselOverride(id);
  const carouselItems = resolveCarouselItems(config, override);

  let parallaxDispose = null;

  applyTheme(shell, config.theme);
  parallaxDispose = renderHero(shell, config.hero);
  renderMeta(shell, config);
  renderRows(shell, config.rows);

  const stageRoot = shell.querySelector("[data-stage]");
  const indexEl = shell.querySelector("[data-carousel-index]");
  const labelEl = shell.querySelector("[data-carousel-label]");
  const countEl = shell.querySelector("[data-carousel-count]");

  let stage = null;
  if (stageRoot && carouselItems.length) {
    stage = new CaseStage(stageRoot, carouselItems, {
      indexEl,
      labelEl,
      countEl,
      startIndex: config.carouselStart ?? 0,
    });
  }

  initSheetScroll(shell);
  initBuilderPanel(shell, config, stage);
  renderCaseNav(shell, config);

  const title = `${config.title} — Case · VAMPS`;
  document.title = title;

  const desc = config.rows?.find((r) => r.label === "CONTEXT")?.value;
  if (desc) {
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "description";
      document.head.appendChild(meta);
    }
    meta.content = desc.slice(0, 160);
  }

  let canonical = document.querySelector('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement("link");
    canonical.rel = "canonical";
    document.head.appendChild(canonical);
  }
  canonical.href = `https://levamps.com/creative/case-studio/?case=${encodeURIComponent(config.id)}`;

  return { config, stage, dispose: () => parallaxDispose?.() };
}

function applyTheme(shell, theme = {}) {
  shell.style.setProperty("--cstudio-bg", theme.bg || "#e5e5e5");
  shell.style.setProperty("--cstudio-stage", theme.stage || "#d8d8d8");
  shell.style.setProperty("--cstudio-text", theme.text || "#0a0a0a");
}

function renderHero(shell, hero) {
  const el = shell.querySelector("[data-hero]");
  if (!el || !hero) return null;

  el.classList.remove("cstudio__hero--parallax");

  if (hero.type === "parallax") {
    el.innerHTML = buildParallaxHeroMarkup(hero);
    el.classList.add("cstudio__hero--parallax");
    el.removeAttribute("aria-hidden");
    return initCaseParallaxHero(el, hero);
  }

  if (hero.type === "video" && !hero.src?.endsWith(".gif")) {
    el.innerHTML = `<video src="${esc(hero.src)}" poster="${esc(hero.poster || "")}" muted playsinline loop autoplay></video>`;
  } else {
    el.innerHTML = `<img src="${esc(hero.src)}" alt="${esc(hero.alt || "")}" />`;
  }
  return null;
}

function renderMeta(shell, config) {
  const el = shell.querySelector("[data-meta-rows]");
  if (!el) return;
  const nameCell = config.titleImage
    ? `<img src="${esc(config.titleImage)}" alt="${esc(config.titleImageAlt || config.title)}" class="cstudio__title-img" />`
    : esc(config.title);
  el.innerHTML = `
    <div class="cstudio__row">
      <div class="cstudio__row-label">Project no.</div>
      <div class="cstudio__row-value">${esc(config.projectNo || "—")}</div>
    </div>
    <div class="cstudio__row">
      <div class="cstudio__row-label">Name</div>
      <div class="cstudio__row-value">${nameCell}</div>
    </div>`;
}

function renderRows(shell, rows = []) {
  const el = shell.querySelector("[data-rows]");
  if (!el) return;
  el.innerHTML = rows.map(rowHtml).join("");
}

function renderCaseNav(shell, config) {
  const nav = shell.querySelector("[data-case-nav]");
  if (!nav || !config.nav) return;

  const { prev, next } = config.nav;
  const parts = [];

  if (prev?.case) {
    parts.push(
      `<a class="cstudio__case-nav-link cstudio__case-nav-link--prev" href="/creative/case-studio/?case=${esc(prev.case)}">
        <span class="cstudio__case-nav-dir">← Previous</span>
        <span class="cstudio__case-nav-title">${esc(prev.title || prev.case)}</span>
      </a>`
    );
  }

  if (next?.case) {
    parts.push(
      `<a class="cstudio__case-nav-link cstudio__case-nav-link--next" href="/creative/case-studio/?case=${esc(next.case)}">
        <span class="cstudio__case-nav-dir">Next →</span>
        <span class="cstudio__case-nav-title">${esc(next.title || next.case)}</span>
      </a>`
    );
  }

  nav.innerHTML = parts.join("");
  nav.hidden = parts.length === 0;
}

function initSheetScroll(shell) {
  const hero = shell.querySelector(".cstudio__hero");
  const sheet = shell.querySelector(".cstudio__sheet");
  if (!hero || !sheet) return;

  const mobileMq = window.matchMedia("(max-width: 899px)");
  const parallaxHero = hero.classList.contains("cstudio__hero--parallax");

  const ease = (t) => {
    const x = Math.min(1, Math.max(0, t));
    return x * x * (3 - 2 * x);
  };

  const handoffPx = () => Math.max(240, Math.min(hero.offsetHeight * 0.32, 520));

  const onScroll = () => {
    if (mobileMq.matches) {
      sheet.style.transform = "";
      sheet.style.opacity = "";
      return;
    }
    if (parallaxHero && !hero.classList.contains("is-dive-complete")) {
      sheet.style.transform = `translateY(12vh)`;
      sheet.style.opacity = "0.55";
      return;
    }
    const p = ease(window.scrollY / handoffPx());
    sheet.style.transform = `translateY(${(1 - p) * 12}vh)`;
    sheet.style.opacity = String(0.55 + p * 0.45);
  };

  window.addEventListener("scroll", onScroll, { passive: true });
  mobileMq.addEventListener("change", onScroll);
  if (parallaxHero) {
    hero.addEventListener("cstudio-parallax-dive-complete", onScroll);
    new MutationObserver(onScroll).observe(hero, { attributes: true, attributeFilter: ["class"] });
  }
  onScroll();
}

function initBuilderPanel(shell, config, stage) {
  const params = new URLSearchParams(location.search);
  if (params.get("builder") !== "1") return;

  shell.classList.add("cstudio--builder");
  const panel = document.createElement("aside");
  panel.className = "cstudio-builder";
  panel.innerHTML = `
    <header class="cstudio-builder__head">
      <strong>Case builder</strong>
      <span>${esc(config.id)}</span>
    </header>
    <p class="cstudio-builder__hint">Toggle carousel items. Order = list order. Saves to localStorage for this browser.</p>
    <ul class="cstudio-builder__list" data-builder-list></ul>
    <div class="cstudio-builder__actions">
      <button type="button" data-builder-save>Apply</button>
      <button type="button" data-builder-reset>Reset</button>
      <a href="/creative/case-studio/builder/?case=${esc(config.id)}">Open full builder</a>
    </div>`;

  document.body.appendChild(panel);
  const list = panel.querySelector("[data-builder-list]");
  const override = loadCarouselOverride(config.id) ?? { order: [], disabled: [] };
  if (!override.order?.length) override.order = (config.carousel ?? []).map((i) => i.id);

  const disabled = new Set(override.disabled ?? []);

  override.order.forEach((id, idx) => {
    const item = config.carousel.find((c) => c.id === id);
    if (!item) return;
    const li = document.createElement("li");
    li.className = "cstudio-builder__item";
    li.innerHTML = `
      <label>
        <input type="checkbox" data-id="${esc(item.id)}" ${disabled.has(item.id) ? "" : "checked"} />
        <span>${esc(item.alt || item.label || item.id)}</span>
        <em>${esc(item.type)}</em>
      </label>
      <div class="cstudio-builder__order">
        <button type="button" data-up="${esc(item.id)}" aria-label="Up">↑</button>
        <button type="button" data-down="${esc(item.id)}" aria-label="Down">↓</button>
      </div>`;
    list.appendChild(li);
  });

  panel.addEventListener("click", (e) => {
    const up = e.target.closest("[data-up]");
    const down = e.target.closest("[data-down]");
    if (up || down) {
      const id = (up || down).dataset.up || (up || down).dataset.down;
      const i = override.order.indexOf(id);
      if (up && i > 0) {
        [override.order[i - 1], override.order[i]] = [override.order[i], override.order[i - 1]];
      }
      if (down && i < override.order.length - 1) {
        [override.order[i + 1], override.order[i]] = [override.order[i], override.order[i + 1]];
      }
      saveCarouselOverride(config.id, readBuilderState(list, override.order));
      location.reload();
    }
  });

  panel.querySelector("[data-builder-save]")?.addEventListener("click", () => {
    saveCarouselOverride(config.id, readBuilderState(list, override.order));
    const items = resolveCarouselItems(config, loadCarouselOverride(config.id));
    stage?.setItems(items);
    location.reload();
  });

  panel.querySelector("[data-builder-reset]")?.addEventListener("click", () => {
    clearCarouselOverride(config.id);
    location.reload();
  });
}

function readBuilderState(list, order) {
  const disabled = [];
  list.querySelectorAll("input[type=checkbox]").forEach((input) => {
    if (!input.checked) disabled.push(input.dataset.id);
  });
  return { order, disabled };
}

export async function initCaseStudioBuilder(root = document) {
  const shell = root.querySelector("[data-case-builder]");
  if (!shell) return;

  const select = shell.querySelector("[data-case-select]");
  const list = shell.querySelector("[data-builder-list]");
  const preview = shell.querySelector("[data-preview]");
  const exportBtn = shell.querySelector("[data-export]");
  const resetBtn = shell.querySelector("[data-reset]");

  const ids = Object.keys(caseManifests).map((k) =>
    k.replace("../creative/cases/", "").replace(".json", "")
  );
  select.innerHTML = ids.map((id) => `<option value="${esc(id)}">${esc(id)}</option>`).join("");

  const initial = caseIdFromLocation();
  if (ids.includes(initial)) select.value = initial;

  let config = loadCaseManifest(select.value);
  let override = loadCarouselOverride(config.id) ?? { order: [], disabled: [] };

  const assetGlob = import.meta.glob("/assets/projects/**/*.{webp,jpg,jpeg,png,gif,mp4,glb}", {
    eager: true,
    query: "?url",
    import: "default",
  });

  function render() {
    config = loadCaseManifest(select.value);
    override = loadCarouselOverride(config.id) ?? { order: [], disabled: [] };
    if (!override.order?.length) override.order = (config.carousel ?? []).map((i) => i.id);

    const folderPrefix = `/assets/projects/${config.assetDir || config.id}/`;
    const discovered = Object.values(assetGlob).filter((url) => url.includes(folderPrefix));

    list.innerHTML = "";

    override.order.forEach((id) => {
      const item = config.carousel.find((c) => c.id === id);
      if (item) list.appendChild(builderRow(item, override));
    });

    const orphanAssets = discovered
      .filter((path) => !(config.carousel ?? []).some((c) => c.src === path || c.thumb === path))
      .slice(0, 12);

    if (orphanAssets.length) {
      const head = document.createElement("li");
      head.className = "cstudio-builder__discover";
      head.innerHTML = `<strong>Assets in folder (add to manifest to use)</strong>`;
      list.appendChild(head);
      orphanAssets.forEach((url) => {
        const li = document.createElement("li");
        li.className = "cstudio-builder__asset";
        li.innerHTML = `<code>${esc(url)}</code>`;
        list.appendChild(li);
      });
    }

    if (preview) {
      preview.src = `/creative/case-studio/?case=${encodeURIComponent(config.id)}&builder=0`;
    }
  }

  function builderRow(item, ov) {
    const disabled = new Set(ov.disabled ?? []);
    const li = document.createElement("li");
    li.className = "cstudio-builder__item";
    li.innerHTML = `
      <label>
        <input type="checkbox" data-id="${esc(item.id)}" ${disabled.has(item.id) ? "" : "checked"} />
        <span>${esc(item.alt || item.label || item.id)}</span>
        <em>${esc(item.type)}</em>
      </label>
      <div class="cstudio-builder__order">
        <button type="button" data-up="${esc(item.id)}">↑</button>
        <button type="button" data-down="${esc(item.id)}">↓</button>
      </div>`;
    return li;
  }

  select.addEventListener("change", render);

  list.addEventListener("click", (e) => {
    const up = e.target.closest("[data-up]");
    const down = e.target.closest("[data-down]");
    if (!up && !down) return;
    const id = up?.dataset.up || down?.dataset.down;
    const i = override.order.indexOf(id);
    if (up && i > 0) [override.order[i - 1], override.order[i]] = [override.order[i], override.order[i - 1]];
    if (down && i < override.order.length - 1) [override.order[i + 1], override.order[i]] = [override.order[i], override.order[i + 1]];
    saveCarouselOverride(config.id, readBuilderState(list, override.order));
    render();
  });

  list.addEventListener("change", () => {
    saveCarouselOverride(config.id, readBuilderState(list, override.order));
    if (preview) preview.src = `/creative/case-studio/?case=${encodeURIComponent(config.id)}&builder=0&_=${Date.now()}`;
  });

  exportBtn?.addEventListener("click", () => {
    const data = readBuilderState(list, override.order);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${config.id}-carousel.json`;
    a.click();
  });

  resetBtn?.addEventListener("click", () => {
    clearCarouselOverride(config.id);
    render();
  });

  render();
}
