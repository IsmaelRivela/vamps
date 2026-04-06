/* ============================================
   Text Repel — Characters flee from cursor
   AND from dragged stickers.
   Uses SplitText to split into chars, then
   gsap.quickTo for performant per-char repulsion
   ============================================ */

import gsap from 'gsap'
import { SplitText } from 'gsap/SplitText'

gsap.registerPlugin(SplitText)

const RADIUS = 200        // px — repulsion radius
const MARGIN = 40         // px — extra clearance beyond radius edge

// Shared list of active repel sources { x, y }
// The cursor is always sources[0]; stickers are added dynamically
const sources = [{ x: -9999, y: -9999 }]

let allChars = []
let rafId = null
let initialized = false

function update() {
  for (let i = 0; i < allChars.length; i++) {
    const { el, qtX, qtY } = allChars[i]
    const rect = el.getBoundingClientRect()
    const charCX = rect.left + rect.width / 2
    const charCY = rect.top + rect.height / 2

    let totalPushX = 0
    let totalPushY = 0

    for (let s = 0; s < sources.length; s++) {
      const src = sources[s]
      const dx = charCX - src.x
      const dy = charCY - src.y
      const dist = Math.sqrt(dx * dx + dy * dy)

      if (dist < RADIUS && dist > 0) {
        const pushDist = RADIUS + MARGIN - dist
        const angle = Math.atan2(dy, dx)
        totalPushX += Math.cos(angle) * pushDist
        totalPushY += Math.sin(angle) * pushDist
      }
    }

    qtX(totalPushX)
    qtY(totalPushY)
  }

  rafId = requestAnimationFrame(update)
}

function startLoop() {
  if (!rafId) rafId = requestAnimationFrame(update)
}

function stopLoop() {
  if (rafId) {
    cancelAnimationFrame(rafId)
    rafId = null
  }
}

export function initTextRepel(containerSelector) {
  const container = document.querySelector(containerSelector)
  if (!container) return

  // Respect reduced motion
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  if (window.matchMedia('(max-width: 768px)').matches) return // Skip on mobile

  const textEls = container.querySelectorAll('.ismael-section__text')
  if (!textEls.length) return

  setupChars(textEls)

  container.addEventListener('mouseenter', startLoop)

  container.addEventListener('mouseleave', () => {
    sources[0].x = -9999
    sources[0].y = -9999
    // Reset all chars back to origin before stopping
    for (let i = 0; i < allChars.length; i++) {
      allChars[i].qtX(0)
      allChars[i].qtY(0)
    }
    // Only stop if no stickers are dragging
    if (sources.length <= 1) stopLoop()
  })

  container.addEventListener('mousemove', (e) => {
    sources[0].x = e.clientX
    sources[0].y = e.clientY
  })
}

/**
 * Init text repel on project pages — splits all .proj__text and
 * .proj__statement-text into chars for sticker-driven repulsion.
 */
export function initProjectTextRepel(containerSelector) {
  const container = document.querySelector(containerSelector)
  if (!container) return

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  if (window.matchMedia('(max-width: 768px)').matches) return // Skip on mobile

  const textEls = container.querySelectorAll(
    '.proj__text, .proj__statement-text, .proj__title'
  )
  if (!textEls.length) return

  setupChars(textEls)
  initialized = true
}

function setupChars(textEls) {
  textEls.forEach(el => {
    const split = SplitText.create(el, { type: 'chars, words' })
    split.chars.forEach(char => {
      const qtX = gsap.quickTo(char, 'x', { duration: 0.15, ease: 'power4.out' })
      const qtY = gsap.quickTo(char, 'y', { duration: 0.15, ease: 'power4.out' })
      allChars.push({ el: char, qtX, qtY })
    })
  })
}

/**
 * Register a sticker as a repel source. Returns an object with
 * update(x, y) and remove() methods.
 */
export function addRepelSource() {
  const src = { x: -9999, y: -9999 }
  sources.push(src)
  return {
    update(x, y) {
      src.x = x
      src.y = y
      startLoop()
    },
    remove() {
      src.x = -9999
      src.y = -9999
      const idx = sources.indexOf(src)
      if (idx > -1) sources.splice(idx, 1)
      // Stop loop if no active sources
      if (sources.length <= 1 && sources[0].x === -9999) stopLoop()
    }
  }
}
