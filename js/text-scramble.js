/* ============================================
   Text Scramble — Hover effect on project names
   Shuffles the word's own letters continuously
   ============================================ */

const SCRAMBLE_SPEED = 40     // ms between shuffle ticks
const LOCK_CHANCE = 0.7       // probability each letter stays in place per tick
const VARIANT_CHANCE = 0.3    // probability a locked letter shows a visual variant

// Characters that look similar or are symbolic variants
const VARIANTS = {
  S: ['$', '5'],
  A: ['4', '@'],
  E: ['3', '€'],
  I: ['1', '!', '|'],
  O: ['0', 'Ø'],
  U: ['V', 'Ü'],
  V: ['U'],
  B: ['8', 'ß'],
  T: ['7', '+'],
  L: ['1', '|'],
  G: ['6', '9'],
  Z: ['2'],
  N: ['Ñ'],
  C: ['(', '¢'],
  R: ['®'],
  D: ['Ð'],
  H: ['#'],
  X: ['×'],
  K: ['K'],
  W: ['VV'],
  P: ['¶'],
}

export function initTextScramble() {
  const projects = document.querySelectorAll('.ismael-project')

  projects.forEach(project => {
    const nameEl = project.querySelector('.ismael-project__name')
    if (!nameEl) return

    const original = nameEl.textContent
    let scrambleTimer = null

    function variantOf(ch) {
      const upper = ch.toUpperCase()
      const alts = VARIANTS[upper]
      if (alts && Math.random() < VARIANT_CHANCE) {
        return alts[Math.floor(Math.random() * alts.length)]
      }
      return ch
    }

    function shuffleText(text) {
      const chars = text.split('')
      // Collect indices eligible to swap
      const free = []
      for (let i = 0; i < chars.length; i++) {
        if (chars[i] !== ' ' && Math.random() > LOCK_CHANCE) {
          free.push(i)
        }
      }
      // Shuffle only the free positions
      for (let i = free.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        const a = free[i], b = free[j]
        ;[chars[a], chars[b]] = [chars[b], chars[a]]
      }
      // Apply visual variants to locked characters
      for (let i = 0; i < chars.length; i++) {
        if (chars[i] !== ' ') {
          chars[i] = variantOf(chars[i])
        }
      }
      return chars.join('')
    }

    function startScramble() {
      stopAll()
      scrambleTimer = setInterval(() => {
        nameEl.textContent = shuffleText(original)
      }, SCRAMBLE_SPEED)
    }

    function stopAll() {
      clearInterval(scrambleTimer)
      scrambleTimer = null
    }

    function reset() {
      stopAll()
      nameEl.textContent = original
    }

    project.addEventListener('mouseenter', startScramble)
    project.addEventListener('mouseleave', reset)
  })
}
