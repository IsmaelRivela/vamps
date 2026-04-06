/* ============================================
   Breakable Fluid Membrane
   ============================================

   Physical model: vertical elastic membrane at screen center.
   The cursor is a CIRCLE. Collision is against the cursor's
   OUTER EDGE, not its center.

   When the cursor edge penetrates the membrane, nearby points
   are pushed to the circle boundary. If displacement exceeds
   a threshold, the membrane BREAKS — points snap back and
   generate a propagating ripple wave.

   Phases: IDLE → CONTACT → STRETCH → BREAK → RIPPLE → REFORM

   ============================================ */

import gsap from 'gsap'

// ─── Physical Constants ─────────────────────

const MEMBRANE = {
  numPoints: 80,
  maxStretch: 0,            // w/5, set on init

  // Cursor
  baseCursorR: 87,          // Half of the 175px CSS cursor
  cursorGrowth: 1.2,        // Scale when near center

  // Push spring (while cursor is in contact)
  pushStiffness: 0.07,      // Force toward cursor edge
  pushDamping: 0.84,        // Friction during push

  // Return spring (after break or no contact)
  returnStiffness: 0.025,   // Snap-back force
  returnDamping: 0.935,     // Oscillation damping (higher = more bounces)

  // Wave propagation between neighbors
  waveTension: 0.25,

  // Break / reform
  breakThreshold: 0.90,     // Fraction of maxStretch that triggers break
  breakRadius: 6,           // Neighbor points that break together
  breakImpulse: 0.18,       // Snap-back velocity multiplier
  reformDistance: 6,         // px from rest to reform
  reformSpeed: 0.4,         // Max velocity to allow reform
}

export function initFluidDivider() {
  const landing = document.querySelector('.landing')
  const svgEl  = document.querySelector('.landing__divider')
  const cursorEl = document.querySelector('.landing__cursor')
  if (!landing || !svgEl) return
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  if (window.matchMedia('(max-width: 768px)').matches) return // Skip on mobile

  // ─── SVG Setup ──────────────────────────

  const svgNS = 'http://www.w3.org/2000/svg'
  const defs = document.createElementNS(svgNS, 'defs')

  const clipLeft = document.createElementNS(svgNS, 'clipPath')
  clipLeft.setAttribute('id', 'clip-left')
  const pathLeft = document.createElementNS(svgNS, 'path')
  clipLeft.appendChild(pathLeft)
  defs.appendChild(clipLeft)

  const clipRight = document.createElementNS(svgNS, 'clipPath')
  clipRight.setAttribute('id', 'clip-right')
  const pathRight = document.createElementNS(svgNS, 'path')
  clipRight.appendChild(pathRight)
  defs.appendChild(clipRight)

  svgEl.appendChild(defs)

  const visibleLine = document.createElementNS(svgNS, 'path')
  visibleLine.setAttribute('fill', 'none')
  visibleLine.setAttribute('stroke', '#000000')
  visibleLine.setAttribute('stroke-width', '5')
  svgEl.appendChild(visibleLine)

  // ─── State ──────────────────────────────

  let mouse = { x: 0, y: 0 }
  let isMouseInside = false
  let points = []   // Each: { y, x, vx, restX, broken }
  let w, h, centerX

  function initPoints() {
    w = window.innerWidth
    h = window.innerHeight
    centerX = w / 2
    MEMBRANE.maxStretch = w / 4
    svgEl.setAttribute('viewBox', `0 0 ${w} ${h}`)

    points = []
    const step = h / (MEMBRANE.numPoints - 1)
    for (let i = 0; i < MEMBRANE.numPoints; i++) {
      points.push({
        y: step * i,
        x: centerX,
        vx: 0,
        restX: centerX,
        broken: false,
      })
    }
  }

  initPoints()

  // ─── Input ──────────────────────────────

  landing.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX
    mouse.y = e.clientY
    isMouseInside = true
    if (cursorEl) {
      gsap.to(cursorEl, { left: e.clientX, top: e.clientY, duration: 0.12, ease: 'power2.out' })
      if (!cursorEl.classList.contains('landing__cursor--active')) {
        cursorEl.classList.add('landing__cursor--active')
        gsap.to(cursorEl, { scale: 1, duration: 0.3, ease: 'back.out(2)' })
      }
    }
  })

  landing.addEventListener('mouseleave', () => {
    isMouseInside = false
    if (cursorEl) {
      gsap.to(cursorEl, { scale: 0, duration: 0.3, ease: 'power2.in' })
      cursorEl.classList.remove('landing__cursor--active')
    }
  })

  let resizeTimer
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer)
    resizeTimer = setTimeout(initPoints, 150)
  })

  // ─── Clip Paths ─────────────────────────

  const sideVamps  = document.querySelector('.landing__side--vamps')
  const sideIsmael = document.querySelector('.landing__side--ismael')
  if (sideVamps) {
    sideVamps.style.clipPath = 'url(#clip-left)'
    sideVamps.style.webkitClipPath = 'url(#clip-left)'
    sideVamps.style.width = '100%'
  }
  if (sideIsmael) {
    sideIsmael.style.clipPath = 'url(#clip-right)'
    sideIsmael.style.webkitClipPath = 'url(#clip-right)'
    sideIsmael.style.width = '100%'
    sideIsmael.style.left = '0'
  }

  // ─── Break Handler ──────────────────────
  // When tension exceeds threshold, break the membrane locally.
  // Injects a velocity impulse that creates the snap-back ripple.

  function triggerBreak(idx) {
    const { breakRadius, breakImpulse } = MEMBRANE
    const lo = Math.max(0, idx - breakRadius)
    const hi = Math.min(points.length - 1, idx + breakRadius)

    for (let j = lo; j <= hi; j++) {
      const p = points[j]
      if (!p.broken) {
        p.broken = true
        // Snap-back impulse — proportional to how far stretched
        p.vx -= (p.x - p.restX) * breakImpulse
      }
    }
  }

  // ─── Physics Loop ───────────────────────

  function update() {
    const {
      maxStretch, baseCursorR, cursorGrowth,
      pushStiffness, pushDamping,
      returnStiffness, returnDamping,
      waveTension,
      breakThreshold, reformDistance, reformSpeed,
    } = MEMBRANE

    const mx = mouse.x
    const my = mouse.y

    // ── Cursor radius (visual = collision) ──
    // The cursor grows slightly when near center for visual emphasis.
    // We use this SAME radius for collision so what you see = what collides.
    const dCenter = Math.abs(mx - centerX)
    const nearFactor = Math.max(0, 1 - dCenter / 200)
    const cScale = 1 + nearFactor * (cursorGrowth - 1)
    const R = baseCursorR * cScale
    const R2 = R * R

    // Update cursor visual size to match collision radius
    if (cursorEl && isMouseInside) {
      gsap.set(cursorEl, { width: R * 2, height: R * 2 })
    }

    // ════════════════════════════════════════
    // PHASE 1: Collision detection & push
    // ════════════════════════════════════════
    //
    // For each membrane point, we check if it lies INSIDE the
    // cursor circle. If so, we push it to the circle's edge.
    //
    // The key insight: at each point's Y height, the cursor
    // circle has a horizontal half-chord:
    //   halfChord = sqrt(R² - dy²)
    //
    // This gives us the exact X position of the circle edge.
    // The membrane wraps around this edge, which naturally
    // produces a smooth dome shape (it's a circle!).

    for (let i = 0; i < points.length; i++) {
      const p = points[i]
      const dy = p.y - my
      const dy2 = dy * dy

      let contacted = false

      // Only check collision if:
      // - Point is within cursor's vertical extent (dy² < R²)
      // - Membrane at this point hasn't broken
      // - Mouse is on screen
      if (!p.broken && isMouseInside && dy2 < R2) {
        // Is this point inside the cursor circle?
        const dx = p.x - mx
        const dist2 = dx * dx + dy2

        if (dist2 < R2) {
          contacted = true

          // ── Push direction ──
          // Use the point's existing displacement to maintain
          // continuity. If no displacement yet, push AWAY from
          // cursor center (membrane deforms in the direction
          // the cursor is traveling through it).
          const currentDisp = p.x - p.restX
          let pushDir
          if (Math.abs(currentDisp) > 2) {
            pushDir = Math.sign(currentDisp)
          } else {
            pushDir = mx > p.restX ? -1 : 1
          }

          // ── Target: circle edge in push direction ──
          // halfChord = horizontal distance from cursor center
          // to circle boundary at this Y height
          const halfChord = Math.sqrt(R2 - dy2)
          const edgeX = mx + pushDir * halfChord

          // ── Spring force toward cursor edge ──
          p.vx += (edgeX - p.x) * pushStiffness
          p.vx *= pushDamping

          // ── Break check ──
          // If tension exceeds threshold, membrane ruptures
          if (Math.abs(p.x - p.restX) > maxStretch * breakThreshold) {
            triggerBreak(i)
          }
        }
      }

      // ════════════════════════════════════════
      // PHASE 2: Return spring (no contact or broken)
      // ════════════════════════════════════════
      //
      // Points not in contact with cursor spring back to center.
      // Broken points also return but can't be pushed again
      // until they reform (settled back near center).

      if (!contacted) {
        p.vx += (p.restX - p.x) * returnStiffness
        p.vx *= returnDamping

        // Reform: once a broken point settles near rest, re-enable collision
        if (p.broken) {
          const fromRest = Math.abs(p.x - p.restX)
          const speed = Math.abs(p.vx)
          if (fromRest < reformDistance && speed < reformSpeed) {
            p.broken = false
          }
        }
      }

      // Integrate
      p.x += p.vx
    }

    // ════════════════════════════════════════
    // PHASE 3: Wave propagation
    // ════════════════════════════════════════
    //
    // Each point is coupled to its neighbors like a string
    // under tension. Displacement differences create forces
    // that propagate waves along the membrane.
    // 3 passes for stronger propagation.

    for (let pass = 0; pass < 3; pass++) {
      for (let i = 1; i < points.length - 1; i++) {
        const prev = points[i - 1]
        const curr = points[i]
        const next = points[i + 1]
        curr.vx += ((prev.x - curr.x) + (next.x - curr.x)) * waveTension * 0.012
      }
    }

    // ════════════════════════════════════════
    // PHASE 4: Render
    // ════════════════════════════════════════
    //
    // Gaussian smooth (5 passes) then Catmull-Rom spline.
    // This eliminates any possible jaggedness.

    let sm = points
    for (let pass = 0; pass < 5; pass++) sm = gaussianSmooth(sm)

    const curve = catmullRom(sm)
    const firstX = sm[0].x
    const lastX  = sm[sm.length - 1].x

    pathLeft.setAttribute('d',
      `M 0,0 L ${firstX},0 ${curve} L ${lastX},${h} L 0,${h} Z`)
    pathRight.setAttribute('d',
      `M ${firstX},0 ${curve} L ${lastX},${h} L ${w},${h} L ${w},0 Z`)
    visibleLine.setAttribute('d',
      `M ${firstX},${sm[0].y} ${curve}`)

    requestAnimationFrame(update)
  }

  // ─── Catmull-Rom Spline ─────────────────
  // Produces smooth organic curves through control points.
  // Low tension = rounder, more flowing curves.

  function catmullRom(pts) {
    if (pts.length < 2) return ''
    const T = 0.25
    let d = ''
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)]
      const p1 = pts[i]
      const p2 = pts[i + 1]
      const p3 = pts[Math.min(pts.length - 1, i + 2)]
      const cp1x = p1.x + (p2.x - p0.x) * T
      const cp1y = p1.y + (p2.y - p0.y) * T
      const cp2x = p2.x - (p3.x - p1.x) * T
      const cp2y = p2.y - (p3.y - p1.y) * T
      d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`
    }
    return d
  }

  // ─── Gaussian Smoothing ─────────────────
  // [1, 4, 6, 4, 1] / 16 kernel — eliminates jaggedness

  function gaussianSmooth(pts) {
    return pts.map((p, i) => {
      if (i <= 1 || i >= pts.length - 2) return p
      return {
        ...p,
        x: (pts[i-2].x + pts[i-1].x * 4 + p.x * 6 + pts[i+1].x * 4 + pts[i+2].x) / 16,
      }
    })
  }

  // ─── Start ──────────────────────────────

  requestAnimationFrame(update)

  // ─── Click Handlers ─────────────────────

  landing.addEventListener('click', (e) => {
    if (e.clientX < centerX) {
      window.location.href = '/vamps/'
    } else {
      window.location.href = '/ismael/'
    }
  })

  // ─── Cursor Appearance ──────────────────

  const enterVamps  = document.querySelector('.landing__enter--vamps')
  const enterIsmael = document.querySelector('.landing__enter--ismael')
  const btnVamps  = document.querySelector('.landing__btn--vamps')
  const btnIsmael = document.querySelector('.landing__btn--ismael')

  landing.addEventListener('mousemove', () => {
    if (!cursorEl) return

    // Smooth transition zone: 150px around center
    const transitionZone = 150
    const distFromCenter = mouse.x - centerX  // negative = vamps, positive = ismael
    // t goes from 0 (fully vamps) to 1 (fully ismael)
    const t = Math.max(0, Math.min(1, (distFromCenter + transitionZone) / (transitionZone * 2)))

    // Fade the vamps image inside the cursor circle
    const cursorImg = cursorEl.querySelector('.landing__cursor-img')
    if (cursorImg) {
      cursorImg.style.opacity = 1 - t
    }

    // Share transition value for glyph cursor
    cursorEl.dataset.transitionT = t

    if (t < 0.5) {
      if (enterVamps) enterVamps.style.opacity = '1'
      if (enterIsmael) enterIsmael.style.opacity = '0'
      if (btnVamps) { btnVamps.style.opacity = '1'; btnVamps.style.pointerEvents = 'auto' }
      if (btnIsmael) { btnIsmael.style.opacity = '0'; btnIsmael.style.pointerEvents = 'none' }
    } else {
      if (enterVamps) enterVamps.style.opacity = '0'
      if (enterIsmael) enterIsmael.style.opacity = '1'
      if (btnVamps) { btnVamps.style.opacity = '0'; btnVamps.style.pointerEvents = 'none' }
      if (btnIsmael) { btnIsmael.style.opacity = '1'; btnIsmael.style.pointerEvents = 'auto' }
    }
  })
}
