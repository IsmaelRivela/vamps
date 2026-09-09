import { CaseStage } from "./case-studio-stage.js";
import { buildParallaxHeroMarkup, initCaseParallaxHero } from "./case-studio-parallax.js";
import { buildScannerHeroMarkup, initCaseScannerHero } from "./case-studio-scanner-hero.js";
import { primeVideoPlayback } from "./mockup-content.js";

const STORAGE_PREFIX = "vamps-case-studio::";
const LANG_STORAGE_KEY = "vamps-case-studio-lang";

const ROW_LABEL_I18N = {
  CONTEXT: { en: "CONTEXT", es: "CONTEXTO" },
  IDEA: { en: "IDEA", es: "IDEA" },
  ROLE: { en: "ROLE", es: "ROL" },
  CLIENT: { en: "CLIENT", es: "CLIENTE" },
  WITH: { en: "WITH", es: "CON" },
  YEAR: { en: "YEAR", es: "AÑO" },
  SECTOR: { en: "SECTOR", es: "SECTOR" },
  DISCIPLINES: { en: "DISCIPLINES", es: "DISCIPLINAS" },
  DELIVERABLES: { en: "DELIVERABLES", es: "ENTREGABLES" },
};

const META_LABEL_I18N = {
  en: { projectNo: "Project no.", name: "Name" },
  es: { projectNo: "Proyecto n.º", name: "Nombre" },
};

const NAV_LABEL_I18N = {
  en: { prev: "← Previous", next: "Next →" },
  es: { prev: "← Anterior", next: "Siguiente →" },
};

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

export function loadCaseLang() {
  try {
    const saved = localStorage.getItem(LANG_STORAGE_KEY);
    if (saved === "en" || saved === "es") return saved;
  } catch {
    /* noop */
  }
  return "en";
}

export function saveCaseLang(lang) {
  try {
    localStorage.setItem(LANG_STORAGE_KEY, lang);
  } catch {
    /* noop */
  }
}

export function locText(value, lang) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  return value[lang] ?? value.en ?? value.es ?? "";
}

const EN_ONLY_ROWS = new Set(["ROLE", "DELIVERABLES"]);

function locRowValue(row, lang) {
  if (EN_ONLY_ROWS.has(row.label)) return locText(row.value, "en");
  return locText(row.value, lang);
}

function rowLabel(row, lang) {
  if (row.labels?.[lang]) return row.labels[lang];
  return ROW_LABEL_I18N[row.label]?.[lang] ?? row.label;
}

const SCROLL_ROWS = new Set(["CONTEXT", "IDEA"]);

function rowHtml(row, lang) {
  const label = esc(rowLabel(row, lang)).replace(/\n/g, "<br>");
  const raw = locRowValue(row, lang);
  const value = row.html ? raw : esc(raw);
  const scroll = SCROLL_ROWS.has(row.label) ? " cstudio__row--scroll" : "";
  return `
    <div class="cstudio__row${scroll}">
      <div class="cstudio__row-label">${label}</div>
      <div class="cstudio__row-value" tabindex="0">${value}</div>
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

  const lang = loadCaseLang();

  applyTheme(shell, config.theme);
  parallaxDispose = renderHero(shell, config.hero);
  initLangToggle(shell, config, lang);

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
  applyCaseLang(shell, config, lang);

  const title = `${locText(config.title, lang) || config.title} — Case · VAMPS`;
  document.title = title;

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

  el.classList.remove("cstudio__hero--parallax", "cstudio__hero--scanner");

  if (hero.type === "parallax") {
    el.innerHTML = buildParallaxHeroMarkup(hero);
    el.classList.add("cstudio__hero--parallax");
    el.removeAttribute("aria-hidden");
    return initCaseParallaxHero(el, hero);
  }

  if (hero.type === "scanner") {
    el.innerHTML = buildScannerHeroMarkup(hero);
    el.classList.add("cstudio__hero--scanner");
    el.removeAttribute("aria-hidden");
    if (hero.aspect) el.style.setProperty("--cstudio-hero-aspect", String(hero.aspect));
    else el.style.removeProperty("--cstudio-hero-aspect");
    return initCaseScannerHero(el, hero);
  }

  if (hero.type === "video" && !hero.src?.endsWith(".gif")) {
    const sources = [];
    if (hero.webm) sources.push({ src: hero.webm, type: "video/webm" });
    if (hero.src) sources.push({ src: hero.src, type: hero.src.endsWith(".webm") ? "video/webm" : "video/mp4" });
    const sourceMarkup = sources
      .map((s) => `<source src="${esc(s.src)}" type="${esc(s.type)}" />`)
      .join("");
    el.innerHTML = `<video class="cstudio__hero-video" ${hero.poster ? `poster="${esc(hero.poster)}"` : ""} muted playsinline webkit-playsinline loop autoplay preload="auto">${sourceMarkup}</video>`;
    const video = el.querySelector("video");
    if (video) primeVideoPlayback(video);
    if (hero.aspect) el.style.setProperty("--cstudio-hero-aspect", String(hero.aspect));
  } else {
    el.innerHTML = `<img src="${esc(hero.src)}" alt="${esc(hero.alt || "")}" />`;
    if (hero.aspect) el.style.setProperty("--cstudio-hero-aspect", String(hero.aspect));
  }
  return null;
}

function renderMeta(shell, config, lang) {
  const el = shell.querySelector("[data-meta-rows]");
  if (!el) return;
  const labels = META_LABEL_I18N[lang];
  const titleText = locText(config.title, lang) || config.title;
  const titleImgClass = config.titleImageClass
    ? ` cstudio__title-img--${esc(config.titleImageClass)}`
    : "";
  const nameCell = config.titleImage
    ? `<img src="${esc(config.titleImage)}" alt="${esc(locText(config.titleImageAlt, lang) || titleText)}" class="cstudio__title-img${titleImgClass}" />`
    : esc(titleText);
  el.innerHTML = `
    <div class="cstudio__row">
      <div class="cstudio__row-label">${esc(labels.projectNo)}</div>
      <div class="cstudio__row-value">${esc(config.projectNo || "—")}</div>
    </div>
    <div class="cstudio__row">
      <div class="cstudio__row-label">${esc(labels.name)}</div>
      <div class="cstudio__row-value">${nameCell}</div>
    </div>`;
}

function renderRows(shell, rows = [], lang) {
  const el = shell.querySelector("[data-rows]");
  if (!el) return;
  el.innerHTML = rows.map((row) => rowHtml(row, lang)).join("");
}

function renderCaseNav(shell, config, lang) {
  const nav = shell.querySelector("[data-case-nav]");
  if (!nav || !config.nav) return;

  const { prev, next } = config.nav;
  const labels = NAV_LABEL_I18N[lang];
  const parts = [];

  if (prev?.case) {
    parts.push(
      `<a class="cstudio__case-nav-link cstudio__case-nav-link--prev" href="/creative/case-studio/?case=${esc(prev.case)}">
        <span class="cstudio__case-nav-dir">${labels.prev}</span>
        <span class="cstudio__case-nav-title">${esc(locText(prev.title, lang) || prev.case)}</span>
      </a>`
    );
  }

  if (next?.case) {
    parts.push(
      `<a class="cstudio__case-nav-link cstudio__case-nav-link--next" href="/creative/case-studio/?case=${esc(next.case)}">
        <span class="cstudio__case-nav-dir">${labels.next}</span>
        <span class="cstudio__case-nav-title">${esc(locText(next.title, lang) || next.case)}</span>
      </a>`
    );
  }

  nav.innerHTML = parts.join("");
  nav.hidden = parts.length === 0;
}

function applyCaseLang(shell, config, lang) {
  document.documentElement.lang = lang;
  renderMeta(shell, config, lang);
  renderRows(shell, config.rows, lang);
  renderCaseNav(shell, config, lang);
  updateLangToggle(shell, lang);

  const contextRow = config.rows?.find((r) => r.label === "CONTEXT");
  const desc = contextRow ? locText(contextRow.value, lang) : "";
  if (desc) {
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "description";
      document.head.appendChild(meta);
    }
    meta.content = desc.slice(0, 160);
  }

  const titleText = locText(config.title, lang) || config.title;
  document.title = `${titleText} — Case · VAMPS`;
}

function updateLangToggle(shell, lang) {
  shell.querySelectorAll("[data-lang]").forEach((btn) => {
    const on = btn.dataset.lang === lang;
    btn.setAttribute("aria-pressed", on ? "true" : "false");
  });
}

function initLangToggle(shell, config, lang) {
  const toggle = shell.querySelector("[data-lang-toggle]");
  if (!toggle || toggle.dataset.bound) return;
  toggle.dataset.bound = "1";

  toggle.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-lang]");
    if (!btn) return;
    const next = btn.dataset.lang;
    if (next !== "en" && next !== "es") return;
    saveCaseLang(next);
    applyCaseLang(shell, config, next);
  });

  updateLangToggle(shell, lang);
}

function initSheetScroll(shell) {
  const sheet = shell.querySelector(".cstudio__sheet");
  if (!sheet) return;

  const onScroll = () => {
    sheet.style.transform = "";
    sheet.style.opacity = "";
  };

  window.addEventListener("scroll", onScroll, { passive: true });
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
