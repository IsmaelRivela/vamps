/* ============================================
   VAMPS Morph — Particle morph between logo SVG
   and vampstitle SVG on hover
   Square particles, extra spawn on morph
   Positioned in left half (VAMPS side)
   ============================================ */

import logoSvgUrl from '/assets/vamps/logovamps.svg?url'
import titleSvgUrl from '/assets/vamps/vampstitle.svg?url'

const IS_MOBILE = window.matchMedia('(max-width: 768px)').matches
const LOGO_PARTICLES = IS_MOBILE ? 800 : 3000
const TITLE_PARTICLES = IS_MOBILE ? 5000 : 20000
const EASE = 0.0525
const ALPHA_SPEED = 0.02        // linear alpha step per frame
const SQUARE_SIZE = 1.5       // square particle size
const SAMPLE_W = 800
const SAMPLE_H = 800
const LOGO_MAX_W = 120
const TITLE_MAX_W = 500

export function initVampsMorph() {
  const container = document.querySelector('.landing__vamps-morph')
  if (!container) return

  const canvas = container.querySelector('.landing__morph-canvas')
  const ctx = canvas.getContext('2d')

  let width, height, dpr
  let particles = []
  let hovering = false
  let activatedExtras = 0
  const EXTRAS_PER_FRAME = 15
  const INITIAL_EXTRAS = 5000     // extras activated instantly on hover
  let logoBox = { x: 0, y: 0, w: 60, h: 60 }
  let titleBox = { x: 0, y: 0, w: 500, h: 500 }

  // — Compute pixel bounding boxes for logo & title —
  function computeBoxes() {
    // On mobile the container IS the left half, so center at 50%
    // On desktop the container spans full width, center at 25% (left half)
    const cx = IS_MOBILE ? width * 0.5 : width * 0.25
    const cy = height * 0.5

    const lw = Math.min(LOGO_MAX_W, IS_MOBILE ? width * 0.5 : width * 0.2)
    const lh = lw
    logoBox = { x: cx - lw / 2, y: cy - lh / 2, w: lw, h: lh }

    const tw = Math.min(TITLE_MAX_W, IS_MOBILE ? width * 0.9 : width * 0.45)
    const th = tw
    titleBox = { x: cx - tw / 2, y: cy - th / 2, w: tw, h: th }
  }

  // — Sample pixel positions from an offscreen canvas —
  function samplePoints(drawFn, count) {
    const off = document.createElement('canvas')
    off.width = SAMPLE_W
    off.height = SAMPLE_H
    const octx = off.getContext('2d')
    drawFn(octx, SAMPLE_W, SAMPLE_H)
    const imageData = octx.getImageData(0, 0, SAMPLE_W, SAMPLE_H)
    const pixels = imageData.data
    const candidates = []
    for (let y = 0; y < SAMPLE_H; y++) {
      for (let x = 0; x < SAMPLE_W; x++) {
        const alpha = pixels[(y * SAMPLE_W + x) * 4 + 3]
        if (alpha > 128) candidates.push({ x: x / SAMPLE_W, y: y / SAMPLE_H })
      }
    }
    const points = []
    for (let i = 0; i < count; i++) {
      points.push(candidates.length
        ? candidates[Math.floor(Math.random() * candidates.length)]
        : { x: Math.random(), y: Math.random() })
    }
    return points
  }

  // — Load SVG and sample normalized (0-1) points —
  function loadSvgPoints(src, count) {
    return new Promise(resolve => {
      const img = new Image()
      img.onload = () => {
        const points = samplePoints((octx, w, h) => {
          octx.drawImage(img, 0, 0, w, h)
        }, count)
        resolve(points)
      }
      img.onerror = () => {
        const points = []
        for (let i = 0; i < count; i++)
          points.push({ x: Math.random(), y: Math.random() })
        resolve(points)
      }
      img.src = src
    })
  }

  // — Create particles —
  function createParticles(logoPoints, titlePoints) {
    particles = []
    for (let i = 0; i < TITLE_PARTICLES; i++) {
      const isExtra = i >= LOGO_PARTICLES
      // Normalized coords (0-1) within their respective SVG shapes
      const sx = isExtra ? 0.5 : logoPoints[i].x
      const sy = isExtra ? 0.5 : logoPoints[i].y
      // Extra particles hide near the logo center with mixed scatter
      // Some tight, some wider for a balanced transition
      const spread = Math.random() < 0.5 ? 0.15 : 0.6
      const scatterNx = 0.5 + (Math.random() - 0.5) * spread
      const scatterNy = 0.5 + (Math.random() - 0.5) * spread

      let initX, initY
      if (isExtra) {
        const cx = IS_MOBILE ? width * 0.5 : width * 0.25
        const cy = height * 0.5
        initX = cx + (scatterNx - 0.5) * width * 0.4
        initY = cy + (scatterNy - 0.5) * height * 0.4
      } else {
        initX = logoBox.x + sx * logoBox.w
        initY = logoBox.y + sy * logoBox.h
      }

      particles.push({
        sx, sy,
        tx: titlePoints[i].x,
        ty: titlePoints[i].y,
        scatterNx, scatterNy,
        px: initX, py: initY,
        isExtra,
        alpha: isExtra ? 0 : 1,
      })
    }
  }

  // — Resize —
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2)
    width = container.offsetWidth
    height = container.offsetHeight
    canvas.width = width * dpr
    canvas.height = height * dpr
    canvas.style.width = width + 'px'
    canvas.style.height = height + 'px'
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    computeBoxes()
  }

  // — Animation loop —
  function loop() {
    ctx.clearRect(0, 0, width, height)

    // Gradually activate pre-created extra particles
    const totalExtras = TITLE_PARTICLES - LOGO_PARTICLES
    if (hovering && activatedExtras < totalExtras) {
      activatedExtras = Math.min(activatedExtras + EXTRAS_PER_FRAME, totalExtras)
    }

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i]
      let goalX, goalY

      // Extra particles only become active gradually
      const extraIndex = i - LOGO_PARTICLES
      const isActive = !p.isExtra || extraIndex < activatedExtras

      if (hovering) {
        goalX = titleBox.x + p.tx * titleBox.w
        goalY = titleBox.y + p.ty * titleBox.h
      } else if (p.isExtra) {
        // Mix: some hide near logo, some further in left half
        const cx = IS_MOBILE ? width * 0.5 : width * 0.25
        const cy = height * 0.5
        goalX = cx + (p.scatterNx - 0.5) * width * 0.4
        goalY = cy + (p.scatterNy - 0.5) * height * 0.4
      } else {
        goalX = logoBox.x + p.sx * logoBox.w
        goalY = logoBox.y + p.sy * logoBox.h
      }

      const goalAlpha = (isActive && (hovering || !p.isExtra)) ? 1 : 0

      p.px += (goalX - p.px) * EASE
      p.py += (goalY - p.py) * EASE

      // Linear alpha ramp (no easing)
      if (p.alpha < goalAlpha) {
        p.alpha = Math.min(p.alpha + ALPHA_SPEED, 1)
      } else if (p.alpha > goalAlpha) {
        p.alpha = Math.max(p.alpha - ALPHA_SPEED, 0)
      }

      if (p.alpha < 0.02) continue

      ctx.fillStyle = `rgba(255, 255, 255, ${p.alpha})`
      ctx.fillRect(p.px - SQUARE_SIZE / 2, p.py - SQUARE_SIZE / 2, SQUARE_SIZE, SQUARE_SIZE)
    }

    requestAnimationFrame(loop)
  }

  // — Click/tap to toggle morph —
  container.addEventListener('click', () => {
    hovering = !hovering
    if (hovering) {
      activatedExtras = INITIAL_EXTRAS
    } else {
      activatedExtras = 0
    }
  })

  // — Hover events (desktop) —
  container.addEventListener('mouseenter', () => {
    hovering = true
    activatedExtras = INITIAL_EXTRAS
  })
  container.addEventListener('mouseleave', () => {
    hovering = false
    activatedExtras = 0
  })

  // — Init —
  resize()
  let resizeTimer
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer)
    resizeTimer = setTimeout(resize, 150)
  })

  Promise.all([
    loadSvgPoints(logoSvgUrl, LOGO_PARTICLES),
    loadSvgPoints(titleSvgUrl, TITLE_PARTICLES),
  ]).then(([logoPoints, titlePoints]) => {
    createParticles(logoPoints, titlePoints)
    requestAnimationFrame(loop)
  })
}
