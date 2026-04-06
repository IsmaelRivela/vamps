/* ============================================
   VAMPS — Page entry point
   ============================================ */

import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { initSlot } from './slot.js'
import { initStickers } from './stickers.js'
import { initPageTransitions } from './animations.js'
// import { initLangToggle } from './lang-toggle.js'

gsap.registerPlugin(ScrollTrigger)

document.addEventListener('DOMContentLoaded', () => {
  // initLangToggle()
  initPageTransitions()
  initSlot()
  initStickers()

  const heroImg = document.querySelector('.vamps-hero__img')

  // --- Mobile detection (before any use) ---
  const isMobile = window.innerWidth <= 768
  const pxScale = isMobile ? 0.35 : 1

  // Pin the hero and desaturate as user scrolls
  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: '.vamps-hero',
      start: 'top top',
      endTrigger: '.vamps-footer',
      end: 'bottom bottom',
      pin: true,
      pinSpacing: false,
      scrub: true,
    },
  })
  // Skip grayscale filter animation on mobile (expensive)
  if (!isMobile) {
    tl.fromTo(heroImg,
      { filter: 'grayscale(0)' },
      { filter: 'grayscale(1)', ease: 'none' }
    )
  }

  // --- Fit huge titles to full width ---
  function fitHugeTitles() {
    document.querySelectorAll('.vamps-page__huge span').forEach((span) => {
      const parent = span.parentElement
      const parentW = parent.clientWidth
      // Start big and shrink until it fits
      let size = 300
      span.style.fontSize = size + 'px'
      while (span.scrollWidth > parentW && size > 10) {
        size -= 2
        span.style.fontSize = size + 'px'
      }
    })
  }
  fitHugeTitles()
  let fitTimer
  window.addEventListener('resize', () => {
    clearTimeout(fitTimer)
    fitTimer = setTimeout(fitHugeTitles, 150)
  })

  // --- Parallax on ALL elements (tamed on mobile via pxScale) ---

  // Images — parallax Y (no scale on mobile for perf)
  document.querySelectorAll('.vamps-content .vamps-page__img img').forEach((img, i) => {
    const dir = i % 2 === 0 ? 1 : -1
    const dist = 200 * pxScale
    const fromVars = { y: -dist * dir }
    const toVars = { y: dist * dir, ease: 'none' }
    if (!isMobile) {
      fromVars.scale = 1.08
      toVars.scale = 1
    }
    gsap.fromTo(img, fromVars, {
      ...toVars,
      scrollTrigger: {
        trigger: img.parentElement,
        start: 'top bottom',
        end: 'bottom top',
        scrub: true,
      },
    })
  })

  // Huge titles — slow rise, feels heavy
  document.querySelectorAll('.vamps-page__huge').forEach((el, i) => {
    const base = i % 2 === 0 ? 150 : -120
    const dir = base * pxScale
    gsap.fromTo(el,
      { y: dir },
      {
        y: -dir,
        ease: 'none',
        scrollTrigger: {
          trigger: el,
          start: 'top bottom',
          end: 'bottom top',
          scrub: true,
        },
      }
    )
  })

  // Text blocks — subtle drift opposite to images
  document.querySelectorAll('.vamps-page__text').forEach((el, i) => {
    const base = i % 2 === 0 ? -80 : 100
    const dir = base * pxScale
    gsap.fromTo(el,
      { y: dir * 0.6 },
      {
        y: -dir * 0.6,
        ease: 'none',
        scrollTrigger: {
          trigger: el,
          start: 'top bottom',
          end: 'bottom top',
          scrub: true,
        },
      }
    )
  })

  // Big text (EXPERIMENTAL DESIGN LAB, etc) — fast, exaggerated
  document.querySelectorAll('.vamps-page__bigtext').forEach((el, i) => {
    const dir = (i % 2 === 0 ? 250 : -250) * pxScale
    gsap.fromTo(el,
      { y: dir },
      {
        y: -dir,
        ease: 'none',
        scrollTrigger: {
          trigger: el,
          start: 'top bottom',
          end: 'bottom top',
          scrub: true,
        },
      }
    )
  })

  // Red band — slower, heavier feel
  const band = document.querySelector('.vamps-page__band')
  if (band) {
    const bandDist = 100 * pxScale
    gsap.fromTo(band,
      { y: bandDist },
      {
        y: -bandDist,
        ease: 'none',
        scrollTrigger: {
          trigger: band,
          start: 'top bottom',
          end: 'bottom top',
          scrub: true,
        },
      }
    )
  }

  // Stickers — very fast parallax, they fly past
  document.querySelectorAll('.vamps-content .sticker').forEach((el, i) => {
    const speeds = [300, -350, 280]
    const dir = speeds[i % speeds.length] * pxScale
    gsap.fromTo(el,
      { y: dir },
      {
        y: -dir,
        ease: 'none',
        scrollTrigger: {
          trigger: el,
          start: 'top bottom',
          end: 'bottom top',
          scrub: true,
        },
      }
    )
  })

  // Slot section — gentle float
  const slotSection = document.querySelector('.vamps-page__slot')
  if (slotSection) {
    const slotDist = 60 * pxScale
    gsap.fromTo(slotSection,
      { y: slotDist },
      {
        y: -slotDist,
        ease: 'none',
        scrollTrigger: {
          trigger: slotSection,
          start: 'top bottom',
          end: 'bottom top',
          scrub: true,
        },
      }
    )
  }
})
