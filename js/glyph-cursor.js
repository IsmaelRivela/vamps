/* ============================================
   Glyph Cursor — Cycling ASCII/SVG glyph cursor
   Turns red on clickable elements
   ============================================ */

// Resolve glyph URLs through Vite
const glyphModules = import.meta.glob('/assets/glifos/*.svg', { eager: true, query: '?url', import: 'default' })
function glyphUrl(name) {
  return glyphModules[`/assets/glifos/${name}.svg`] || `/assets/glifos/${name}.svg`
}

const GLYPH_PATHS = [
  'copydad1', 'copydad2', 'copydad3',
  'tulipana1', 'tulipana2', 'tulipana3', 'tulipana4', 'tulipana5',
  'tulipana6', 'tulipana7', 'tulipana8', 'tulipana9',
  'vamps1', 'vamps3', 'vamps4', 'vamps5',
  'vamps6', 'vamps7', 'vamps8',
]
const CYCLE_INTERVAL = 200 // ms between glyph changes

export function initGlyphCursor() {
  const cursor = document.querySelector('.ismael-cursor')
  if (!cursor) return
  if (window.matchMedia('(max-width: 768px)').matches) return // Skip on mobile

  const glyphEl = cursor.querySelector('.ismael-cursor__glyph')
  if (!glyphEl) return

  // Load glyph SVGs as image URLs
  const glyphSrcs = GLYPH_PATHS.map(name => glyphUrl(name))

  let currentIndex = 0
  let isOverClickable = false

  // Set initial glyph
  glyphEl.src = glyphSrcs[0]

  // Cycle glyphs
  setInterval(() => {
    currentIndex = (currentIndex + 1) % glyphSrcs.length
    glyphEl.src = glyphSrcs[currentIndex]
  }, CYCLE_INTERVAL)

  // Follow mouse
  document.addEventListener('mousemove', (e) => {
    cursor.style.left = e.clientX + 'px'
    cursor.style.top = e.clientY + 'px'

    // Hide when over glyph controller
    const overCtrl = !!e.target.closest('.glyph-ctrl')
    cursor.style.opacity = overCtrl ? '0' : '1'

    // Check if over a clickable element
    const target = e.target.closest('a, button, [role="button"], input[type="submit"], .ismael-project')
    const wasOver = isOverClickable
    isOverClickable = !!target

    if (isOverClickable !== wasOver) {
      cursor.classList.toggle('ismael-cursor--active', isOverClickable)
    }
  })

  // Show/hide on enter/leave
  document.addEventListener('mouseenter', () => {
    cursor.style.opacity = '1'
  })
  document.addEventListener('mouseleave', () => {
    cursor.style.opacity = '0'
  })
}
