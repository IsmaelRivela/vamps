/**
 * ASCII Converter — Drag the ramo sticker onto the converter dropzone
 * to trigger the ASCII art conversion animation.
 */
import { gsap } from 'gsap';

export function initAsciiConverter() {
  const sticker = document.getElementById('ramoSticker');
  const dropzone = document.getElementById('asciiDropzone');
  const result = document.getElementById('ramoResult');
  const hint = document.getElementById('stickerHint');
  if (!sticker || !dropzone || !result) return;

  // Idle wiggle animation to attract attention
  const wiggle = gsap.timeline({ repeat: -1, repeatDelay: 2 })
    .to(sticker, { rotation: -8, duration: 0.15, ease: 'power1.inOut' })
    .to(sticker, { rotation: 8, duration: 0.15, ease: 'power1.inOut' })
    .to(sticker, { rotation: -5, duration: 0.12, ease: 'power1.inOut' })
    .to(sticker, { rotation: 5, duration: 0.12, ease: 'power1.inOut' })
    .to(sticker, { rotation: 0, duration: 0.2, ease: 'power2.out' });

  // Floating bounce
  const bounce = gsap.to(sticker, {
    y: -10,
    duration: 1.2,
    repeat: -1,
    yoyo: true,
    ease: 'sine.inOut',
  });

  // Arrow hint pulse
  let hintTween;
  if (hint) {
    hintTween = gsap.to(hint, {
      x: 15,
      duration: 0.8,
      repeat: -1,
      yoyo: true,
      ease: 'sine.inOut',
    });
  }

  function stopIdleAnimations() {
    wiggle.kill();
    bounce.kill();
    gsap.set(sticker, { rotation: 0, y: 0 });
    if (hint) {
      if (hintTween) hintTween.kill();
      gsap.to(hint, { autoAlpha: 0, duration: 0.3 });
    }
  }

  let isDragging = false;
  let startX = 0;
  let startY = 0;
  let offsetX = 0;
  let offsetY = 0;
  let originLeft = 0;
  let originTop = 0;
  let converted = false;

  // Store original position
  function storeOrigin() {
    const rect = sticker.getBoundingClientRect();
    const parent = sticker.offsetParent.getBoundingClientRect();
    originLeft = rect.left - parent.left;
    originTop = rect.top - parent.top;
  }

  function onPointerDown(e) {
    if (converted) return;
    e.preventDefault();
    isDragging = true;
    stopIdleAnimations();
    sticker.classList.add('is-dragging');
    sticker.setPointerCapture(e.pointerId);

    storeOrigin();

    const rect = sticker.getBoundingClientRect();
    startX = rect.left;
    startY = rect.top;
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;

    // Switch to absolute positioning for free movement
    sticker.style.position = 'absolute';
    sticker.style.left = originLeft + 'px';
    sticker.style.top = originTop + 'px';
    sticker.style.bottom = 'auto';
  }

  function onPointerMove(e) {
    if (!isDragging) return;
    e.preventDefault();

    const parent = sticker.offsetParent.getBoundingClientRect();
    const x = e.clientX - offsetX - parent.left;
    const y = e.clientY - offsetY - parent.top;

    sticker.style.left = x + 'px';
    sticker.style.top = y + 'px';

    // Check overlap with dropzone
    const stickerRect = sticker.getBoundingClientRect();
    const dropRect = dropzone.getBoundingClientRect();
    const overlapX = Math.max(0, Math.min(stickerRect.right, dropRect.right) - Math.max(stickerRect.left, dropRect.left));
    const overlapY = Math.max(0, Math.min(stickerRect.bottom, dropRect.bottom) - Math.max(stickerRect.top, dropRect.top));
    const overlapArea = overlapX * overlapY;
    const stickerArea = stickerRect.width * stickerRect.height;

    if (overlapArea > stickerArea * 0.3) {
      dropzone.classList.add('is-hover');
    } else {
      dropzone.classList.remove('is-hover');
    }
  }

  function onPointerUp(e) {
    if (!isDragging) return;
    isDragging = false;
    sticker.classList.remove('is-dragging');
    sticker.releasePointerCapture(e.pointerId);

    // Check if dropped on dropzone
    const stickerRect = sticker.getBoundingClientRect();
    const dropRect = dropzone.getBoundingClientRect();
    const overlapX = Math.max(0, Math.min(stickerRect.right, dropRect.right) - Math.max(stickerRect.left, dropRect.left));
    const overlapY = Math.max(0, Math.min(stickerRect.bottom, dropRect.bottom) - Math.max(stickerRect.top, dropRect.top));
    const overlapArea = overlapX * overlapY;
    const stickerArea = stickerRect.width * stickerRect.height;

    if (overlapArea > stickerArea * 0.3) {
      convert();
    } else {
      // Snap back to original position
      resetPosition();
    }

    dropzone.classList.remove('is-hover');
  }

  function convert() {
    converted = true;

    // Center sticker in dropzone then shrink
    const dropRect = dropzone.getBoundingClientRect();
    const parent = sticker.offsetParent.getBoundingClientRect();
    const cx = dropRect.left + dropRect.width / 2 - parent.left - sticker.offsetWidth / 2;
    const cy = dropRect.top + dropRect.height / 2 - parent.top - sticker.offsetHeight / 2;

    sticker.style.left = cx + 'px';
    sticker.style.top = cy + 'px';

    // Trigger conversion animation
    requestAnimationFrame(() => {
      sticker.classList.add('is-converting');
      dropzone.classList.add('is-converted');
    });

    // Show ASCII result
    setTimeout(() => {
      result.classList.add('is-visible');
    }, 400);

    // Allow reset after animation
    setTimeout(() => {
      result.addEventListener('click', reset, { once: true });
    }, 1200);
  }

  function resetPosition() {
    sticker.style.position = '';
    sticker.style.left = '';
    sticker.style.top = '';
    sticker.style.bottom = '';
  }

  function reset() {
    converted = false;
    sticker.classList.remove('is-converting');
    dropzone.classList.remove('is-converted');
    result.classList.remove('is-visible');
    resetPosition();
    sticker.style.opacity = '';
    sticker.style.transform = '';
  }

  sticker.addEventListener('pointerdown', onPointerDown);
  sticker.addEventListener('pointermove', onPointerMove);
  sticker.addEventListener('pointerup', onPointerUp);
  sticker.addEventListener('pointercancel', onPointerUp);
}
