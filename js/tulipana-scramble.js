/* ============================================
   Tulipana Hero Scramble
   On hover, cursor radius reveals tulipana
   glyphs over the hero SVG — scramble effect
   ============================================ */

// Resolve glyph URLs through Vite
const glyphModules = import.meta.glob('/assets/glifos/tulipana*.svg', { eager: true, query: '?url', import: 'default' })

const GLYPH_COUNT = 9
const CELL_SIZE   = 32
const RADIUS      = 160
const FADE_SPEED  = 0.12
const SCRAMBLE_INTERVAL = 180 // ms — re-randomize active glyphs

export function initTulipanaScramble() {
  const hero = document.querySelector('.proj--tulipana .proj__hero')
  if (!hero) return

  // --- Canvas overlay ---
  const canvas = document.createElement('canvas')
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:1;'
  hero.insertBefore(canvas, hero.querySelector('.proj__hero-inner'))

  const ctx = canvas.getContext('2d')
  const dpr = window.devicePixelRatio || 1

  // --- Load tulipana glyphs ---
  const glyphImgs = []
  let loadedCount = 0

  for (let i = 1; i <= GLYPH_COUNT; i++) {
    const img = new Image()
    img.src = glyphModules[`/assets/glifos/tulipana${i}.svg`] || `/assets/glifos/tulipana${i}.svg`
    img.onload = () => { loadedCount++ }
    glyphImgs.push(img)
  }

  // --- Pre-render tinted glyphs (#ED5B51) ---
  const tintedGlyphs = []
  const TINT_SIZE = 64 // render at this resolution

  function tintGlyphs() {
    tintedGlyphs.length = 0
    for (const img of glyphImgs) {
      const offscreen = document.createElement('canvas')
      offscreen.width = TINT_SIZE
      offscreen.height = TINT_SIZE
      const octx = offscreen.getContext('2d')
      // Draw glyph
      octx.drawImage(img, 0, 0, TINT_SIZE, TINT_SIZE)
      // Tint to brand color using source-in
      octx.globalCompositeOperation = 'source-in'
      octx.fillStyle = '#ED5B51'
      octx.fillRect(0, 0, TINT_SIZE, TINT_SIZE)
      tintedGlyphs.push(offscreen)
    }
  }

  // --- Grid cells ---
  let cells = []
  let cols = 0, rows = 0

  function buildGrid() {
    const rect = hero.getBoundingClientRect()
    cols = Math.ceil(rect.width / CELL_SIZE)
    rows = Math.ceil(rect.height / CELL_SIZE)
    cells = []
    for (let i = 0; i < cols * rows; i++) {
      cells.push({
        glyphIdx: Math.floor(Math.random() * GLYPH_COUNT),
        rotation: (Math.random() - 0.5) * 0.7,
        scale: 0.6 + Math.random() * 0.6,
        opacity: 0,
      })
    }
  }

  // --- Resize ---
  function resize() {
    const rect = hero.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    buildGrid()
  }
  resize()
  let resizeTimer
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer)
    resizeTimer = setTimeout(resize, 150)
  })

  // --- Mouse tracking ---
  let mouseX = -9999, mouseY = -9999
  let isHovering = false

  hero.addEventListener('mousemove', (e) => {
    const rect = hero.getBoundingClientRect()
    mouseX = e.clientX - rect.left
    mouseY = e.clientY - rect.top
    isHovering = true
  })

  hero.addEventListener('mouseleave', () => {
    isHovering = false
  })

  // --- Periodic scramble of active cells ---
  setInterval(() => {
    if (!isHovering) return
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const cell = cells[row * cols + col]
        if (cell.opacity < 0.15) continue
        const cx = col * CELL_SIZE + CELL_SIZE / 2
        const cy = row * CELL_SIZE + CELL_SIZE / 2
        const dx = cx - mouseX
        const dy = cy - mouseY
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < RADIUS * 0.7) {
          cell.glyphIdx = Math.floor(Math.random() * GLYPH_COUNT)
          cell.rotation = (Math.random() - 0.5) * 0.7
          cell.scale = 0.6 + Math.random() * 0.6
        }
      }
    }
  }, SCRAMBLE_INTERVAL)

  // --- Render loop ---
  let running = true

  function draw() {
    if (!running) return

    // Wait for all glyphs to load, then tint once
    if (loadedCount < GLYPH_COUNT) {
      requestAnimationFrame(draw)
      return
    }
    if (tintedGlyphs.length === 0) tintGlyphs()

    const rect = hero.getBoundingClientRect()
    const w = rect.width
    const h = rect.height

    // Resize if needed
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    ctx.clearRect(0, 0, w, h)

    // Only process cells near the cursor (optimization)
    const minCol = Math.max(0, Math.floor((mouseX - RADIUS) / CELL_SIZE) - 1)
    const maxCol = Math.min(cols - 1, Math.ceil((mouseX + RADIUS) / CELL_SIZE) + 1)
    const minRow = Math.max(0, Math.floor((mouseY - RADIUS) / CELL_SIZE) - 1)
    const maxRow = Math.min(rows - 1, Math.ceil((mouseY + RADIUS) / CELL_SIZE) + 1)

    // Update & draw cells near cursor
    for (let row = minRow; row <= maxRow; row++) {
      for (let col = minCol; col <= maxCol; col++) {
        const idx = row * cols + col
        const cell = cells[idx]
        const cx = col * CELL_SIZE + CELL_SIZE / 2
        const cy = row * CELL_SIZE + CELL_SIZE / 2

        const dx = cx - mouseX
        const dy = cy - mouseY
        const dist = Math.sqrt(dx * dx + dy * dy)

        // Target: full opacity at center, fades toward edge
        const targetOpacity = isHovering && dist < RADIUS
          ? Math.pow(1 - dist / RADIUS, 0.6)
          : 0

        cell.opacity += (targetOpacity - cell.opacity) * FADE_SPEED

        if (cell.opacity < 0.01) { cell.opacity = 0; continue }

        const size = CELL_SIZE * cell.scale
        ctx.save()
        ctx.globalAlpha = cell.opacity
        ctx.translate(cx, cy)
        ctx.rotate(cell.rotation)
        ctx.drawImage(tintedGlyphs[cell.glyphIdx], -size / 2, -size / 2, size, size)
        ctx.restore()
      }
    }

    // Fade out cells outside the cursor area
    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i]
      if (cell.opacity <= 0) continue
      const col = i % cols
      const row = Math.floor(i / cols)
      if (row >= minRow && row <= maxRow && col >= minCol && col <= maxCol) continue
      cell.opacity += (0 - cell.opacity) * FADE_SPEED
      if (cell.opacity < 0.01) cell.opacity = 0
    }

    requestAnimationFrame(draw)
  }

  requestAnimationFrame(draw)
}
