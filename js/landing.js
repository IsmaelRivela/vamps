/* ============================================
   Landing Entry Point
   ============================================ */

import gsap from 'gsap'
import { initFluidDivider } from './fluid.js'
import { initAsciiBg } from './ascii-bg.js'
import { initVampsMorph } from './vamps-morph.js'
import { initLandingGlyphCursor } from './landing-glyph-cursor.js'
// import { initLangToggle } from './lang-toggle.js'

document.addEventListener('DOMContentLoaded', () => {
  // initLangToggle()
  initFluidDivider()
  initAsciiBg()
  initVampsMorph()
  initLandingGlyphCursor()
  initLandingTransitions()
})

function initLandingTransitions() {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  document.querySelectorAll('a[href]').forEach(link => {
    const href = link.getAttribute('href')
    if (!href || href.startsWith('#') || href.startsWith('http') || href.startsWith('mailto:')) return

    link.addEventListener('click', (e) => {
      e.preventDefault()
      const target = href

      if (prefersReducedMotion) {
        window.location.href = target
        return
      }

      gsap.to('.landing', {
        autoAlpha: 0,
        duration: 0.5,
        ease: 'power2.inOut',
        onComplete: () => {
          window.location.href = target
        },
      })
    })
  })
}
