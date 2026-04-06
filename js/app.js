/* ============================================
   App Entry Point
   ============================================ */

import { initAnimations, animateHero } from './animations.js'
import { initAsciiBg } from './ascii-bg.js'
import { initGlyphCursor } from './glyph-cursor.js'
import { initTextScramble } from './text-scramble.js'
import { initTextRepel, initProjectTextRepel } from './text-repel.js'
import { initGlyphController } from './glyph-controller.js'
import { initStickers } from './stickers.js'
import { initProjectCursor } from './project-cursor.js'
import { initTulipanaScramble } from './tulipana-scramble.js'
import { initAsciiConverter } from './ascii-converter.js'
import { initAsciiLoupe } from './ascii-loupe.js'
// import { initLangToggle } from './lang-toggle.js'

// Resolve glyph URLs through Vite
const glyphModules = import.meta.glob('/assets/glifos/*.svg', { eager: true, query: '?url', import: 'default' })
function glyphUrl(name) {
  return glyphModules[`/assets/glifos/${name}.svg`] || `/assets/glifos/${name}.svg`
}

// Cursor SVG per project (keyed by pathname substring)
const PROJECT_CURSORS = {
  copydad:     glyphUrl('copydad1'),
  'vamps-case': glyphUrl('vamps2'),
  // tulipana: '/assets/glifos/tulipana1.svg',
  // verbena:  '...'
}

// ─── DOM Ready ──────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  // initLangToggle()
  initAnimations()

  // Hero animation only on home
  if (document.querySelector('.hero')) {
    animateHero()
  }

  // ASCII background on ismael page
  if (document.querySelector('.ismael-ascii-bg')) {
    initAsciiBg('.ismael-ascii-bg')
    initGlyphController()
  }

  // Glyph cursor on ismael page
  if (document.querySelector('.ismael-cursor')) {
    initGlyphCursor()
  }

  // Text scramble on project names
  if (document.querySelector('.ismael-projects')) {
    initTextScramble()
  }

  // Text repel on about section
  if (document.querySelector('.ismael-section--about')) {
    initTextRepel('.ismael-section--about')
  }

  // Text repel on project pages (for sticker interaction)
  if (document.querySelector('.proj')) {
    initProjectTextRepel('.proj')
  }

  // Draggable stickers (any page with .sticker elements)
  if (document.querySelector('.sticker')) {
    initStickers()
  }

  // Tulipana hero scramble effect (disabled)
  // if (document.querySelector('.proj--tulipana')) {
  //   initTulipanaScramble()
  // }

  // ASCII converter interactive demo
  if (document.getElementById('asciiConverter')) {
    initAsciiConverter()
  }

  // ASCII loupe magnifier
  if (document.getElementById('asciiLoupe')) {
    initAsciiLoupe()
  }

  // Custom cursor on project pages
  const path = window.location.pathname
  for (const [key, src] of Object.entries(PROJECT_CURSORS)) {
    if (path.includes(key)) {
      initProjectCursor({ src })
      break
    }
  }

  // Set active nav link
  setActiveNavLink()
})

// ─── Active nav link ────────────────────────

function setActiveNavLink() {
  const path = window.location.pathname
  document.querySelectorAll('.nav__link').forEach(link => {
    const href = link.getAttribute('href')
    if (path === href || (href !== '/' && path.startsWith(href))) {
      link.classList.add('active')
    }
  })
}
