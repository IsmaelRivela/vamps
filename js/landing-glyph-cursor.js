/* ============================================
   Landing Glyph Cursor — Shows on the
   creative (ismael) side of the landing only
   ============================================ */

const glyphModules = import.meta.glob('/assets/glifos/*.svg', { eager: true, query: '?url', import: 'default' })
const GLYPH_SRCS = Object.values(glyphModules)
const CYCLE_INTERVAL = 200

export function initLandingGlyphCursor() {
  const cursor = document.querySelector('.landing-glyph-cursor')
  if (!cursor) return
  if (window.matchMedia('(max-width: 768px)').matches) return // Skip on mobile

  const imgEl = cursor.querySelector('.landing-glyph-cursor__img')
  if (!imgEl || !GLYPH_SRCS.length) return

  const ismaelSide = document.querySelector('.landing__side--ismael')
  if (!ismaelSide) return

  let currentIndex = 0
  let visible = false

  imgEl.src = GLYPH_SRCS[0]

  setInterval(() => {
    currentIndex = (currentIndex + 1) % GLYPH_SRCS.length
    imgEl.src = GLYPH_SRCS[currentIndex]
  }, CYCLE_INTERVAL)

  document.addEventListener('mousemove', (e) => {
    cursor.style.left = e.clientX + 'px'
    cursor.style.top = e.clientY + 'px'

    // Read transition value from the collision cursor (set by fluid.js)
    const cursorEl = document.querySelector('.landing__cursor')
    const t = cursorEl ? parseFloat(cursorEl.dataset.transitionT || 0) : 0

    // Fade in glyph cursor as we move toward ismael side
    cursor.style.opacity = t
  })

  document.addEventListener('mouseleave', () => {
    cursor.style.opacity = '0'
  })
}
