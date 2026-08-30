/* ============================================
   Landing Entry Point
   ============================================ */

import gsap from 'gsap'
import { initFluidDivider } from './fluid.js'
import { initAsciiBg } from './ascii-bg.js'
// import { initLangToggle } from './lang-toggle.js'

document.addEventListener('DOMContentLoaded', () => {
  // initLangToggle()
  initFluidDivider()
  initAsciiBg()
  initLandingTransitions()
})

function initLandingTransitions() {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const isTouchDevice = window.matchMedia('(hover: none) and (pointer: coarse)').matches

  // Mobile two-tap on VAMPS side: first tap = show hover state, second tap = navigate
  if (isTouchDevice) {
    const vampsSide = document.querySelector('.landing__side--vamps')
    if (vampsSide) {
      vampsSide.addEventListener('click', (e) => {
        if (!vampsSide.classList.contains('landing__side--vamps--tapped')) {
          e.preventDefault()
          vampsSide.classList.add('landing__side--vamps--tapped')
          return
        }
        // Second tap — let the normal transition handle it
      })
    }
  }

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

  // Bfcache: al volver atrás el browser restaura la página con los inline styles
  // de GSAP intactos (.landing en autoAlpha:0), así que la reseteamos
  window.addEventListener('pageshow', (e) => {
    if (e.persisted) {
      gsap.set('.landing', { autoAlpha: 1 })
    }
  })
}
