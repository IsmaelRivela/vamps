/* ============================================
   Slot Machine — VAMPOT!!!
   ============================================ */

const SYMBOLS = ['vamps1','vamps3','vamps4','vamps5','vamps6','vamps7','vamps8']
const JACKPOT = 'vamps3'
const BET = 10
const COPIES = 10

// Pharma & School jackpot symbols (used to force directed outcomes)
const PHARMA_SYM = 'vamps1'
const SCHOOL_SYM = 'vamps3'

export function initSlot() {
  const slotEl = document.querySelector('.slot')
  if (!slotEl) return

  let credits = 100
  let spinning = false
  let lastDirected = null

  const creditsEl = document.getElementById('credits')
  const msgEl = document.getElementById('msg')
  const spinBtn = document.getElementById('spin')
  if (!creditsEl || !msgEl || !spinBtn) return

  const reels = [0, 1, 2].map(i => {
    const reel = document.getElementById('reel' + i)
    const strip = reel.querySelector('.slot__strip')
    const totalItems = SYMBOLS.length * COPIES

    // Build a shuffled sequence so each reel looks different
    const shuffled = []
    for (let c = 0; c < COPIES; c++) {
      const batch = [...SYMBOLS]
      for (let k = batch.length - 1; k > 0; k--) {
        const r = Math.floor(Math.random() * (k + 1));
        [batch[k], batch[r]] = [batch[r], batch[k]]
      }
      shuffled.push(...batch)
    }

    for (let j = 0; j < totalItems; j++) {
      const img = document.createElement('img')
      const sym = shuffled[j]
      img.src = `/assets/glifos/${sym}.svg`
      img.alt = sym
      img.dataset.symbol = sym
      strip.appendChild(img)
    }

    return { reel, strip, totalItems, spinsUsed: 0 }
  })

  function setReelH() {
    reels.forEach(({ reel }) => {
      reel.style.setProperty('--reel-h', reel.offsetHeight + 'px')
    })
  }
  setReelH()
  let reelTimer
  window.addEventListener('resize', () => {
    clearTimeout(reelTimer)
    reelTimer = setTimeout(setReelH, 150)
  })

  function getRandomSymbol() {
    return SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]
  }

  function spinReel(reelData, targetSymbol, delay) {
    return new Promise(resolve => {
      const { reel, strip } = reelData
      const reelH = reel.offsetHeight
      const extraSpins = (3 + Math.floor(Math.random() * 3)) * SYMBOLS.length
      const targetIndex = SYMBOLS.indexOf(targetSymbol)
      const currentSymIndex = reelData.spinsUsed % SYMBOLS.length
      let advance = targetIndex - currentSymIndex
      if (advance <= 0) advance += SYMBOLS.length
      advance += extraSpins

      const landIndex = reelData.spinsUsed + advance

      while (strip.children.length <= landIndex + SYMBOLS.length) {
        for (let j = 0; j < SYMBOLS.length; j++) {
          const img = document.createElement('img')
          const sym = SYMBOLS[j % SYMBOLS.length]
          img.src = `/assets/glifos/${sym}.svg`
          img.alt = sym
          img.dataset.symbol = sym
          strip.appendChild(img)
        }
      }

      const allImgs = strip.querySelectorAll('img')
      allImgs[landIndex].src = `/assets/glifos/${targetSymbol}.svg`
      allImgs[landIndex].dataset.symbol = targetSymbol

      const itemH = reelH
      const targetY = -(landIndex * itemH)
      const duration = 2 + delay * 0.5

      setTimeout(() => {
        strip.style.transition = `transform ${duration}s cubic-bezier(0.15, 0.85, 0.25, 1)`
        strip.style.transform = `translateY(${targetY}px)`
        setTimeout(() => {
          reelData.spinsUsed = landIndex
          resolve(targetSymbol)
        }, duration * 1000)
      }, delay * 300)
    })
  }

  async function spin() {
    if (spinning) return
    if (credits < BET) {
      msgEl.textContent = 'No credits left!'
      msgEl.className = 'slot__msg'
      return
    }

    spinning = true
    spinBtn.disabled = true
    credits -= BET
    creditsEl.textContent = credits
    msgEl.textContent = '...'
    msgEl.className = 'slot__msg'

    const results = [getRandomSymbol(), getRandomSymbol(), getRandomSymbol()]

    // 33% pharma jackpot, 33% school jackpot, 34% random
    // Never repeat the same directed jackpot twice in a row
    let roll = Math.random()
    let directedTarget = null
    if (roll < 0.33 && lastDirected !== 'pharma') {
      results[0] = results[1] = results[2] = PHARMA_SYM
      directedTarget = 'pharma'
    } else if (roll < 0.66 && lastDirected !== 'school') {
      results[0] = results[1] = results[2] = SCHOOL_SYM
      directedTarget = 'school'
    } else if (roll < 0.33 && lastDirected === 'pharma') {
      // Was pharma last time, switch to school
      results[0] = results[1] = results[2] = SCHOOL_SYM
      directedTarget = 'school'
    } else if (roll >= 0.33 && roll < 0.66 && lastDirected === 'school') {
      // Was school last time, switch to pharma
      results[0] = results[1] = results[2] = PHARMA_SYM
      directedTarget = 'pharma'
    }
    lastDirected = directedTarget

    await Promise.all(reels.map((r, i) => spinReel(r, results[i], i)))

    if (directedTarget) {
      const targetId = directedTarget === 'pharma' ? 'pharma-link' : 'school-link'
      const targetEl = document.getElementById(targetId)
      if (directedTarget === 'pharma') {
        credits += 100
        creditsEl.textContent = credits
        msgEl.textContent = 'PHARMA!!! +100'
        msgEl.className = 'slot__msg slot__msg--jackpot'
      } else {
        credits += 100
        creditsEl.textContent = credits
        msgEl.textContent = 'SCHOOL DAY!!! +100'
        msgEl.className = 'slot__msg slot__msg--jackpot'
      }
      if (targetEl) {
        setTimeout(() => {
          targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }, 600)
      }
    } else if (results[0] === JACKPOT && results[1] === JACKPOT && results[2] === JACKPOT) {
      credits += 500
      creditsEl.textContent = credits
      msgEl.textContent = 'VAMPOT!!! +500'
      msgEl.className = 'slot__msg slot__msg--jackpot'
    } else if (results[0] === results[1] && results[1] === results[2]) {
      credits += 100
      creditsEl.textContent = credits
      msgEl.textContent = 'Three of a kind! +100'
      msgEl.className = 'slot__msg slot__msg--win'
    } else if (results[0] === results[1] || results[1] === results[2] || results[0] === results[2]) {
      credits += 20
      creditsEl.textContent = credits
      msgEl.textContent = 'Pair! +20'
      msgEl.className = 'slot__msg slot__msg--win'
    } else {
      msgEl.textContent = 'Try again...'
      msgEl.className = 'slot__msg'
    }

    spinning = false
    spinBtn.disabled = false
  }

  spinBtn.addEventListener('click', spin)
}
