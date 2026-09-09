/**
 * ASCII Loupe — Magnifying glass effect on hover/touch over the closeup image.
 * Shows a zoomed-in circle that follows the cursor or finger.
 * Works correctly with object-fit: cover.
 */
export function mountAsciiLoupe(container, options = {}) {
  const lens = container.querySelector(".ascii-loupe__lens");
  const img = container.querySelector(".ascii-loupe__img");
  if (!container || !lens || !img) return;

  const zoom = options.zoom ?? 2.5;
  const lensSize =
    options.lensSize ??
    (window.matchMedia("(max-width: 768px)").matches ? 140 : 200);

  lens.style.width = `${lensSize}px`;
  lens.style.height = `${lensSize}px`;

  function getCoverDimensions() {
    const cW = container.offsetWidth;
    const cH = container.offsetHeight;
    const iW = img.naturalWidth || cW;
    const iH = img.naturalHeight || cH;
    const scale = Math.max(cW / iW, cH / iH);
    const renderedW = iW * scale;
    const renderedH = iH * scale;
    const offsetX = (cW - renderedW) / 2;
    const offsetY = (cH - renderedH) / 2;
    return { renderedW, renderedH, offsetX, offsetY };
  }

  function updateLens(clientX, clientY) {
    const rect = container.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    lens.style.left = `${x}px`;
    lens.style.top = `${y}px`;

    const { renderedW, renderedH, offsetX, offsetY } = getCoverDimensions();
    const bgW = renderedW * zoom;
    const bgH = renderedH * zoom;
    const bgX = -(((x - offsetX) / renderedW) * bgW - lensSize / 2);
    const bgY = -(((y - offsetY) / renderedH) * bgH - lensSize / 2);

    lens.style.backgroundImage = `url('${img.currentSrc || img.src}')`;
    lens.style.backgroundSize = `${bgW}px ${bgH}px`;
    lens.style.backgroundPosition = `${bgX}px ${bgY}px`;
  }

  const onMove = (e) => updateLens(e.clientX, e.clientY);
  container.addEventListener("mousemove", onMove);

  const hint = container.querySelector(".ascii-loupe__hint");
  let touchStartY = 0;
  let loupeActive = false;

  const onTouchStart = (e) => {
    const t = e.touches[0];
    touchStartY = t.clientY;
    loupeActive = false;
    lens.style.opacity = "1";
    updateLens(t.clientX, t.clientY);
    if (hint) hint.style.display = "none";
  };

  const onTouchMove = (e) => {
    const t = e.touches[0];
    const dy = Math.abs(t.clientY - touchStartY);

    if (!loupeActive && dy > 10) {
      lens.style.opacity = "0";
      return;
    }

    loupeActive = true;
    e.preventDefault();
    updateLens(t.clientX, t.clientY);
  };

  const onTouchEnd = () => {
    lens.style.opacity = "0";
    loupeActive = false;
  };

  container.addEventListener("touchstart", onTouchStart, { passive: true });
  container.addEventListener("touchmove", onTouchMove, { passive: false });
  container.addEventListener("touchend", onTouchEnd);

  return () => {
    container.removeEventListener("mousemove", onMove);
    container.removeEventListener("touchstart", onTouchStart);
    container.removeEventListener("touchmove", onTouchMove);
    container.removeEventListener("touchend", onTouchEnd);
  };
}

export function initAsciiLoupe() {
  const container = document.getElementById("asciiLoupe");
  if (container) mountAsciiLoupe(container);
}
