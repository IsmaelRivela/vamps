/* ============================================
   Glyph Cursor — Cycling ASCII/SVG glyph cursor
   Turns red on clickable elements
   ============================================ */

// Resolve glyph URLs through Vite
const glyphModules = import.meta.glob('/assets/glifos/*.svg', { eager: true, query: '?url', import: 'default' })
const copydadModules = import.meta.glob('/assets/projects/copydad/*.svg', { eager: true, query: '?url', import: 'default' })

function glyphUrl(name) {
  return glyphModules[`/assets/glifos/${name}.svg`] || `/assets/glifos/${name}.svg`
}
function copydadUrl(name) {
  return copydadModules[`/assets/projects/copydad/${name}.svg`] || `/assets/projects/copydad/${name}.svg`
}

const GLYPH_SETS = {
  all: [
    'copydad1', 'copydad2', 'copydad3',
    'tulipana1', 'tulipana2', 'tulipana3', 'tulipana4', 'tulipana5',
    'tulipana6', 'tulipana7', 'tulipana8', 'tulipana9',
    'vamps1', 'vamps3', 'vamps4', 'vamps5',
    'vamps6', 'vamps7', 'vamps8',
  ].map(n => glyphUrl(n)),
  tulipana: ['tulipana1','tulipana2','tulipana3','tulipana4','tulipana5','tulipana6','tulipana7','tulipana8','tulipana9'].map(n => glyphUrl(n)),
  copydad:  ['sticker-copy1','sticker-copy2','sticker-copy3','sticker-copy4'].map(n => copydadUrl(n)),
  vamps:    ['vamps1','vamps3','vamps4','vamps5','vamps6','vamps7','vamps8'].map(n => glyphUrl(n)),
}

const CYCLE_INTERVAL = 200 // ms between glyph changes

export function initGlyphCursor() {
  const cursor = document.querySelector('.ismael-cursor')
  if (!cursor) return
  if (window.matchMedia('(max-width: 768px)').matches) return // Skip on mobile

  const glyphEl = cursor.querySelector('.ismael-cursor__glyph')
  if (!glyphEl) return

  let activeSet = GLYPH_SETS.all
  let currentIndex = 0
  let isOverClickable = false

  // Set initial glyph
  glyphEl.src = activeSet[0]

  // Cycle glyphs
  setInterval(() => {
    currentIndex = (currentIndex + 1) % activeSet.length
    glyphEl.src = activeSet[currentIndex]
  }, CYCLE_INTERVAL)

  // Switch glyph set per project row
  document.querySelectorAll('.ismael-project--tulipana').forEach(el => {
    el.addEventListener('mouseenter', () => { activeSet = GLYPH_SETS.tulipana; currentIndex = 0 })
    el.addEventListener('mouseleave', () => { activeSet = GLYPH_SETS.all })
  })
  document.querySelectorAll('.ismael-project--copydad').forEach(el => {
    el.addEventListener('mouseenter', () => { activeSet = GLYPH_SETS.copydad; currentIndex = 0 })
    el.addEventListener('mouseleave', () => { activeSet = GLYPH_SETS.all })
  })
  document.querySelectorAll('.ismael-project--vamps').forEach(el => {
    el.addEventListener('mouseenter', () => { activeSet = GLYPH_SETS.vamps; currentIndex = 0 })
    el.addEventListener('mouseleave', () => { activeSet = GLYPH_SETS.all })
  })

  // Activar modo glyph solo dentro de .ismael-screen2
  const screen2 = document.querySelector('.ismael-screen2')
  if (screen2) {
    screen2.addEventListener('mouseenter', () => {
      cursor.classList.add('ismael-cursor--glyph')
      document.documentElement.style.cursor = 'none'
    })
    screen2.addEventListener('mouseleave', () => {
      cursor.classList.remove('ismael-cursor--glyph')
      cursor.classList.remove('ismael-cursor--active')
      document.documentElement.style.cursor = ''
    })
  }

  // Follow mouse
  document.addEventListener('mousemove', (e) => {
    cursor.style.left = e.clientX + 'px'
    cursor.style.top = e.clientY + 'px'

    // Check if over a clickable element (solo en modo glyph)
    if (cursor.classList.contains('ismael-cursor--glyph')) {
      const target = e.target.closest('a, button, [role="button"], input[type="submit"], .ismael-project')
      const wasOver = isOverClickable
      isOverClickable = !!target
      if (isOverClickable !== wasOver) {
        cursor.classList.toggle('ismael-cursor--active', isOverClickable)
      }
    }
  })

  // Show/hide on enter/leave document
  document.addEventListener('mouseenter', () => {
    cursor.style.opacity = '1'
  })
  document.addEventListener('mouseleave', () => {
    cursor.style.opacity = '0'
  })

}
