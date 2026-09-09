import {
  caseIdFromLocation,
  loadCaseManifest,
  loadCarouselOverride,
  saveCarouselOverride,
  clearCarouselOverride,
} from "./case-studio.js";

const caseManifests = import.meta.glob("../creative/cases/*.json", {
  eager: true,
  import: "default",
});

const assetLoaders = import.meta.glob("../assets/projects/**/*.{webp,jpg,jpeg,png,gif,mp4,glb}", {
  query: "?url",
  import: "default",
});

let assetUrlCache = null;

async function projectAssetUrls() {
  if (assetUrlCache) return assetUrlCache;
  const entries = await Promise.all(
    Object.entries(assetLoaders).map(async ([key, load]) => {
      const url = await load();
      const normalized = key.replace("../assets/projects/", "/assets/projects/");
      return [normalized, url];
    })
  );
  assetUrlCache = entries.map(([, url]) => url);
  return assetUrlCache;
}

function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;");
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

  async function render() {
    config = loadCaseManifest(select.value);
    override = loadCarouselOverride(config.id) ?? { order: [], disabled: [] };
    if (!override.order?.length) override.order = (config.carousel ?? []).map((i) => i.id);

    const folderPrefix = `/assets/projects/${config.assetDir || config.id}/`;
    const discovered = (await projectAssetUrls()).filter((url) => url.includes(folderPrefix));

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

  select.addEventListener("change", () => {
    void render();
  });

  list.addEventListener("click", (e) => {
    const up = e.target.closest("[data-up]");
    const down = e.target.closest("[data-down]");
    if (!up && !down) return;
    const id = up?.dataset.up || down?.dataset.down;
    const i = override.order.indexOf(id);
    if (up && i > 0) [override.order[i - 1], override.order[i]] = [override.order[i], override.order[i - 1]];
    if (down && i < override.order.length - 1) [override.order[i + 1], override.order[i]] = [override.order[i], override.order[i + 1]];
    saveCarouselOverride(config.id, readBuilderState(list, override.order));
    void render();
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
    void render();
  });

  await render();
}
