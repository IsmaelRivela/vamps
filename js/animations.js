/* ============================================
   GSAP Animation System
   ============================================
   
   Principios de animación:
   1. Suavidad > Espectacularidad — Cada movimiento debe sentirse natural
   2. Performance first — Animar solo transform y opacity (propiedades GPU)
   3. Jerarquía visual — Los elementos importantes se revelan primero
   4. Consistencia — Mismas curvas de easing en toda la web
   5. Respeto al movimiento reducido — prefers-reduced-motion
   
   ============================================ */

import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

// ─── Configuration ───────────────────────────

const EASE = {
  out: 'power3.out',        // Suave y elegante para entradas
  inOut: 'power2.inOut',    // Para transiciones de página
  smooth: 'power4.out',     // Para movimientos hero
}

const DURATION = {
  fast: 0.4,
  base: 0.8,
  slow: 1.2,
  page: 0.6,
}

// ─── Check reduced motion preference ────────

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

// ─── Scroll-triggered reveals ────────────────

export function initScrollAnimations() {
  if (prefersReducedMotion) {
    // Si el usuario prefiere menos movimiento, mostrar todo directamente
    document.querySelectorAll('[data-animate]').forEach(el => {
      el.style.opacity = '1'
      el.style.transform = 'none'
    })
    return
  }

  // Fade up (default)
  gsap.utils.toArray('[data-animate="fade-up"]').forEach(el => {
    gsap.to(el, {
      y: 0,
      opacity: 1,
      duration: DURATION.base,
      ease: EASE.out,
      scrollTrigger: {
        trigger: el,
        start: 'top 85%',
        once: true,
      },
    })
  })

  // Fade in
  gsap.utils.toArray('[data-animate="fade-in"]').forEach(el => {
    gsap.to(el, {
      opacity: 1,
      duration: DURATION.base,
      ease: EASE.out,
      scrollTrigger: {
        trigger: el,
        start: 'top 85%',
        once: true,
      },
    })
  })

  // Slide left
  gsap.utils.toArray('[data-animate="slide-left"]').forEach(el => {
    gsap.to(el, {
      x: 0,
      opacity: 1,
      duration: DURATION.base,
      ease: EASE.out,
      scrollTrigger: {
        trigger: el,
        start: 'top 85%',
        once: true,
      },
    })
  })

  // Slide right
  gsap.utils.toArray('[data-animate="slide-right"]').forEach(el => {
    gsap.to(el, {
      x: 0,
      opacity: 1,
      duration: DURATION.base,
      ease: EASE.out,
      scrollTrigger: {
        trigger: el,
        start: 'top 85%',
        once: true,
      },
    })
  })

  // Scale in
  gsap.utils.toArray('[data-animate="scale-in"]').forEach(el => {
    gsap.to(el, {
      scale: 1,
      opacity: 1,
      duration: DURATION.base,
      ease: EASE.out,
      scrollTrigger: {
        trigger: el,
        start: 'top 85%',
        once: true,
      },
    })
  })

  // Staggered groups
  gsap.utils.toArray('[data-animate-group]').forEach(group => {
    const children = group.querySelectorAll('[data-animate]')
    gsap.to(children, {
      y: 0,
      x: 0,
      opacity: 1,
      duration: DURATION.base,
      ease: EASE.out,
      stagger: 0.1,
      scrollTrigger: {
        trigger: group,
        start: 'top 85%',
        once: true,
      },
    })
  })
}

// ─── Hero animation ─────────────────────────

export function animateHero() {
  if (prefersReducedMotion) {
    document.querySelectorAll('.hero [data-animate], .hero__scroll-indicator').forEach(el => {
      el.style.opacity = '1'
      el.style.transform = 'none'
    })
    return
  }

  const tl = gsap.timeline({ delay: 0.3 })

  // Title lines revealing word by word
  tl.from('.hero__title-word', {
    y: '100%',
    duration: DURATION.slow,
    ease: EASE.smooth,
    stagger: 0.08,
  })

  // Subtitle fade up
  tl.to('.hero__subtitle', {
    y: 0,
    opacity: 1,
    duration: DURATION.base,
    ease: EASE.out,
  }, '-=0.4')

  // Scroll indicator
  tl.to('.hero__scroll-indicator', {
    opacity: 1,
    duration: DURATION.base,
    ease: EASE.out,
  }, '-=0.2')

  // Scroll indicator line animation (loop)
  gsap.to('.hero__scroll-line', {
    scaleY: 0,
    transformOrigin: 'bottom',
    duration: 1.5,
    ease: 'power2.inOut',
    repeat: -1,
    yoyo: true,
  })

  return tl
}

// ─── Project card hover ─────────────────────

export function initCardHovers() {
  if (prefersReducedMotion) return

  document.querySelectorAll('.project-card').forEach(card => {
    const image = card.querySelector('.project-card__image')
    if (!image) return

    card.addEventListener('mouseenter', () => {
      gsap.to(image, {
        scale: 1.05,
        duration: DURATION.slow,
        ease: EASE.out,
      })
    })

    card.addEventListener('mouseleave', () => {
      gsap.to(image, {
        scale: 1,
        duration: DURATION.slow,
        ease: EASE.out,
      })
    })
  })
}

// ─── Page transitions ───────────────────────

export function initPageTransitions() {
  const overlay = document.querySelector('.page-transition')
  if (!overlay) return

  if (prefersReducedMotion) {
    // Remove overlay immediately so content is visible
    gsap.set(overlay, { scaleY: 0 })
    return
  }

  // Intercept internal links
  document.querySelectorAll('a[href]').forEach(link => {
    const href = link.getAttribute('href')
    // Only internal links (not external, not anchors, not mailto)
    if (!href || href.startsWith('#') || href.startsWith('http') || href.startsWith('mailto:')) return

    link.addEventListener('click', (e) => {
      e.preventDefault()
      const target = href

      // Exit animation
      gsap.to(overlay, {
        scaleY: 1,
        transformOrigin: 'bottom',
        duration: DURATION.page,
        ease: EASE.inOut,
        onComplete: () => {
          window.location.href = target
        },
      })
    })
  })

  // Entry animation — overlay starts at scaleY(1) via CSS
  gsap.to(overlay, {
    scaleY: 0,
    transformOrigin: 'top',
    duration: DURATION.page,
    ease: EASE.inOut,
    delay: 0.1,
  })

  // Handle bfcache (back/forward navigation)
  window.addEventListener('pageshow', (e) => {
    if (e.persisted) {
      gsap.set(overlay, { scaleY: 0 })
    }
  })
}

// ─── Magnetic hover effect (for buttons/links) ──

export function initMagneticElements() {
  if (prefersReducedMotion) return

  document.querySelectorAll('[data-magnetic]').forEach(el => {
    el.addEventListener('mousemove', (e) => {
      const rect = el.getBoundingClientRect()
      const x = e.clientX - rect.left - rect.width / 2
      const y = e.clientY - rect.top - rect.height / 2

      gsap.to(el, {
        x: x * 0.3,
        y: y * 0.3,
        duration: 0.3,
        ease: 'power2.out',
      })
    })

    el.addEventListener('mouseleave', () => {
      gsap.to(el, {
        x: 0,
        y: 0,
        duration: 0.5,
        ease: 'elastic.out(1, 0.5)',
      })
    })
  })
}

// ─── Parallax on scroll ─────────────────────

export function initParallax() {
  if (prefersReducedMotion) return

  gsap.utils.toArray('[data-parallax]').forEach(el => {
    const speed = parseFloat(el.dataset.parallax) || 0.2

    gsap.to(el, {
      y: () => speed * 100,
      ease: 'none',
      scrollTrigger: {
        trigger: el,
        start: 'top bottom',
        end: 'bottom top',
        scrub: true,
      },
    })
  })
}

// ─── Initialize all ─────────────────────────

export function initAnimations() {
  initPageTransitions()
  initScrollAnimations()
  initCardHovers()
  initMagneticElements()
  initParallax()
}
