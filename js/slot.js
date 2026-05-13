/* ============================================
   Slot Machine — VAMPOT!!!
   ============================================ */

// Resolve glyph SVG URLs through Vite so hashed filenames work in production
const glyphModules = import.meta.glob('/assets/glifos/*.svg', { eager: true, query: '?url', import: 'default' })
function glyphUrl(name) {
  return glyphModules[`/assets/glifos/${name}.svg`] || `/assets/glifos/${name}.svg`
}

const SYMBOLS = ['vamps1','vamps3','vamps4','vamps5','vamps6','vamps7','vamps8']
const JACKPOT = 'vamps3'
const BET = 10
const COPIES = 10

// Pharma & School jackpot symbols (used to force directed outcomes)
const PHARMA_SYM = 'vamps1'
const SCHOOL_SYM = 'vamps3'

const PALANCA_FRAMES = [
  '/assets/vamps/palanca/palanca1.png',
  '/assets/vamps/palanca/palanca2.png',
  '/assets/vamps/palanca/palanca3.png',
  '/assets/vamps/palanca/palanca4.png',
  '/assets/vamps/palanca/palanca5.png',
]

export function initSlot() {
  const slotEl = document.querySelector('.slot')
  if (!slotEl) return

  const slotCell = document.getElementById('slot-cell')
  if (!slotCell) return

  // — Cursor palanca —
  const cursor = document.createElement('div')
  cursor.id = 'slot-cursor'
  cursor.style.cssText = [
    'position:fixed',
    'pointer-events:none',
    'z-index:9999',
    'width:120px',
    'height:120px',
    'transform:translate(-20%, -20%)',
    'display:none',
  ].join(';')
  const cursorImg = document.createElement('img')
  cursorImg.src = PALANCA_FRAMES[0]
  cursorImg.style.cssText = 'width:100%;height:100%;object-fit:contain'
  cursor.appendChild(cursorImg)
  document.body.appendChild(cursor)

  // Precarga frames
  PALANCA_FRAMES.forEach(src => { const i = new Image(); i.src = src })

  slotCell.addEventListener('mouseenter', () => {
    slotCell.style.cursor = 'none'
    cursorImg.src = PALANCA_FRAMES[0]
    cursor.style.display = 'block'
  })
  slotCell.addEventListener('mouseleave', () => {
    slotCell.style.cursor = ''
    cursor.style.display = 'none'
  })
  slotCell.addEventListener('mousemove', e => {
    cursor.style.left = e.clientX + 'px'
    cursor.style.top  = e.clientY + 'px'
  })

  function animatePalanca() {
    let frame = 0
    const interval = setInterval(() => {
      frame++
      if (frame >= PALANCA_FRAMES.length) {
        clearInterval(interval)
        cursorImg.src = PALANCA_FRAMES[0]
        return
      }
      cursorImg.src = PALANCA_FRAMES[frame]
    }, 80)
  }

  let spinning = false
  let lastDirected = null

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
      img.src = glyphUrl(sym)
      img.alt = sym
      img.dataset.symbol = sym
      strip.appendChild(img)
    }

    return { reel, strip, totalItems, spinsUsed: 0 }
  })

  function setReelH() {
    // Compute from slot width × aspect-ratio × reel% so it's always exact
    const slotW = slotEl.offsetWidth
    const slotH = slotW * (3090 / 2568)
    const reelH = Math.round(slotH * 0.105)
    reels.forEach(({ reel }) => {
      reel.style.setProperty('--reel-h', reelH + 'px')
    })
  }
  setReelH()
  // ResizeObserver catches all layout changes (viewport, bento reflow, etc.)
  const ro = new ResizeObserver(setReelH)
  ro.observe(slotEl)

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
          img.src = glyphUrl(sym)
          img.alt = sym
          img.dataset.symbol = sym
          strip.appendChild(img)
        }
      }

      const allImgs = strip.querySelectorAll('img')
      allImgs[landIndex].src = glyphUrl(targetSymbol)
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

    spinning = true
    animatePalanca()

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
      results[0] = results[1] = results[2] = SCHOOL_SYM
      directedTarget = 'school'
    } else if (roll >= 0.33 && roll < 0.66 && lastDirected === 'school') {
      results[0] = results[1] = results[2] = PHARMA_SYM
      directedTarget = 'pharma'
    }
    lastDirected = directedTarget

    await Promise.all(reels.map((r, i) => spinReel(r, results[i], i)))

    if (directedTarget === 'pharma') {
      setTimeout(() => { window.location.href = '/vamps/pharma/' }, 600)
    } else if (directedTarget === 'school') {
      setTimeout(() => { window.location.href = '/vamps/back2school/' }, 600)
    }

    spinning = false
  }

  slotCell.addEventListener('click', spin)
}
