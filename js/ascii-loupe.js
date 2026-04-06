/**
 * ASCII Loupe — Magnifying glass effect on hover/touch over the closeup image.
 * Shows a zoomed-in circle that follows the cursor or finger.
 * Works correctly with object-fit: cover.
 */
export function initAsciiLoupe() {
  const container = document.getElementById('asciiLoupe');
  const lens = document.getElementById('asciiLoupeLens');
  if (!container || !lens) return;

  const img = container.querySelector('.ascii-loupe__img');
  if (!img) return;

  const ZOOM = 2.5;
  const LENS_SIZE = window.matchMedia('(max-width: 768px)').matches ? 140 : 200;

  // Compute how object-fit: cover maps the image into the container
  function getCoverDimensions() {
    const cW = container.offsetWidth;
    const cH = container.offsetHeight;
    const iW = img.naturalWidth || cW;
    const iH = img.naturalHeight || cH;
    const scale = Math.max(cW / iW, cH / iH);
    const renderedW = iW * scale;
    const renderedH = iH * scale;
    // object-position: center center
    const offsetX = (cW - renderedW) / 2;
    const offsetY = (cH - renderedH) / 2;
    return { renderedW, renderedH, offsetX, offsetY, cW, cH };
  }

  function updateLens(clientX, clientY) {
    const rect = container.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    // Position lens centered on cursor/finger
    lens.style.left = x + 'px';
    lens.style.top = y + 'px';

    const { renderedW, renderedH, offsetX, offsetY } = getCoverDimensions();

    // Zoomed background size based on the rendered (cover) image
    const bgW = renderedW * ZOOM;
    const bgH = renderedH * ZOOM;
    // Map cursor position to image coordinates
    const bgX = -(((x - offsetX) / renderedW) * bgW - LENS_SIZE / 2);
    const bgY = -(((y - offsetY) / renderedH) * bgH - LENS_SIZE / 2);

    lens.style.backgroundImage = `url('${img.src}')`;
    lens.style.backgroundSize = `${bgW}px ${bgH}px`;
    lens.style.backgroundPosition = `${bgX}px ${bgY}px`;
  }

  // Mouse support
  container.addEventListener('mousemove', (e) => updateLens(e.clientX, e.clientY));

  // Touch support — allow scroll, activate loupe only on horizontal/still touch
  const hint = container.querySelector('.ascii-loupe__hint');
  let touchStartY = 0;
  let loupeActive = false;

  container.addEventListener('touchstart', (e) => {
    const t = e.touches[0];
    touchStartY = t.clientY;
    loupeActive = false;
    // Show loupe tentatively
    lens.style.opacity = '1';
    updateLens(t.clientX, t.clientY);
    if (hint) hint.style.display = 'none';
  }, { passive: true });

  container.addEventListener('touchmove', (e) => {
    const t = e.touches[0];
    const dy = Math.abs(t.clientY - touchStartY);

    if (!loupeActive && dy > 10) {
      // User is scrolling — hide loupe, let scroll happen
      lens.style.opacity = '0';
      return;
    }

    // User is exploring the image (mostly horizontal or small movement)
    loupeActive = true;
    e.preventDefault();
    updateLens(t.clientX, t.clientY);
  }, { passive: false });

  container.addEventListener('touchend', () => {
    lens.style.opacity = '0';
    loupeActive = false;
  });
}
