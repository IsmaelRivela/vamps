/* ============================================
   Project Cursor — Custom SVG cursor per project
   Pass { src } to configure per page.
   Uses mix-blend-mode: difference for contrast.
   ============================================ */

/**
 * @param {Object} opts
 * @param {string} opts.src  — path to cursor SVG/image
 * @param {number} [opts.size=40] — cursor size in px
 * @param {number} [opts.lerp=0.15] — follow smoothness (0–1)
 */
export function initProjectCursor({ src, size = 40, lerp: lerpFactor = 0.15 } = {}) {
  if (!src) return
  if (window.matchMedia('(max-width: 768px)').matches) return // Skip on mobile

  const page = document.querySelector('.proj')
  if (!page) return

  // Create cursor element
  const cursor = document.createElement('div')
  cursor.className = 'proj-cursor'
  cursor.style.width = size + 'px'
  cursor.style.height = size + 'px'
  cursor.style.marginLeft = -(size / 2) + 'px'
  cursor.style.marginTop = -(size / 2) + 'px'

  const img = document.createElement('img')
  img.src = src
  img.alt = ''
  img.draggable = false
  cursor.appendChild(img)

  document.body.appendChild(cursor)

  // Hide default cursor
  document.documentElement.style.cursor = 'none'
  document.body.style.cursor = 'none'
  page.style.cursor = 'none'

  let mouseX = 0
  let mouseY = 0
  let curX = 0
  let curY = 0

  function lerp(a, b, t) {
    return a + (b - a) * t
  }

  function update() {
    curX = lerp(curX, mouseX, lerpFactor)
    curY = lerp(curY, mouseY, lerpFactor)
    cursor.style.transform = `translate(${curX}px, ${curY}px)`
    requestAnimationFrame(update)
  }

  document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX
    mouseY = e.clientY
    cursor.classList.add('proj-cursor--visible')
  })

  document.addEventListener('mouseleave', () => {
    cursor.classList.remove('proj-cursor--visible')
  })

  // Invert on click
  document.addEventListener('mousedown', () => {
    cursor.classList.add('proj-cursor--active')
  })

  document.addEventListener('mouseup', () => {
    cursor.classList.remove('proj-cursor--active')
  })

  // Hide native cursor on interactive elements
  page.querySelectorAll('a, button, .sticker, img').forEach(el => {
    el.style.cursor = 'none'
  })

  // Show normal cursor on header/nav
  const nav = document.querySelector('.nav, header, .proj__nav')
  if (nav) {
    nav.style.cursor = 'auto'
    nav.querySelectorAll('a, button').forEach(el => {
      el.style.cursor = 'pointer'
    })
    nav.addEventListener('mouseenter', () => {
      cursor.classList.remove('proj-cursor--visible')
      document.documentElement.style.cursor = ''
    })
    nav.addEventListener('mouseleave', () => {
      cursor.classList.add('proj-cursor--visible')
      document.documentElement.style.cursor = 'none'
    })
  }

  requestAnimationFrame(update)
}
