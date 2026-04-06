/* ============================================
   ASCII Background — Animated diffuse blobs
   Organic noise-driven ASCII characters on canvas
   ============================================ */

// — Simplex 2D noise (compact implementation) —

const F2 = 0.5 * (Math.sqrt(3) - 1)
const G2 = (3 - Math.sqrt(3)) / 6

const grad2 = [
  [1, 1], [-1, 1], [1, -1], [-1, -1],
  [1, 0], [-1, 0], [0, 1], [0, -1],
]

// Deterministic permutation table
const perm = new Uint8Array(512)
const permMod8 = new Uint8Array(512)
;(function buildPerm() {
  const p = new Uint8Array(256)
  for (let i = 0; i < 256; i++) p[i] = i
  // Seed-based shuffle
  let seed = 42
  for (let i = 255; i > 0; i--) {
    seed = (seed * 16807 + 11) & 0x7fffffff
    const j = seed % (i + 1)
    ;[p[i], p[j]] = [p[j], p[i]]
  }
  for (let i = 0; i < 512; i++) {
    perm[i] = p[i & 255]
    permMod8[i] = perm[i] & 7
  }
})()

function noise2D(x, y) {
  const s = (x + y) * F2
  const i = Math.floor(x + s)
  const j = Math.floor(y + s)
  const t = (i + j) * G2
  const x0 = x - (i - t)
  const y0 = y - (j - t)

  const i1 = x0 > y0 ? 1 : 0
  const j1 = x0 > y0 ? 0 : 1

  const x1 = x0 - i1 + G2
  const y1 = y0 - j1 + G2
  const x2 = x0 - 1 + 2 * G2
  const y2 = y0 - 1 + 2 * G2

  const ii = i & 255
  const jj = j & 255

  let n0 = 0, n1 = 0, n2 = 0

  let t0 = 0.5 - x0 * x0 - y0 * y0
  if (t0 > 0) {
    t0 *= t0
    const g = grad2[permMod8[ii + perm[jj]]]
    n0 = t0 * t0 * (g[0] * x0 + g[1] * y0)
  }

  let t1 = 0.5 - x1 * x1 - y1 * y1
  if (t1 > 0) {
    t1 *= t1
    const g = grad2[permMod8[ii + i1 + perm[jj + j1]]]
    n1 = t1 * t1 * (g[0] * x1 + g[1] * y1)
  }

  let t2 = 0.5 - x2 * x2 - y2 * y2
  if (t2 > 0) {
    t2 *= t2
    const g = grad2[permMod8[ii + 1 + perm[jj + 1]]]
    n2 = t2 * t2 * (g[0] * x2 + g[1] * y2)
  }

  return 70 * (n0 + n1 + n2) // Range approx [-1, 1]
}

// — Fractal Brownian Motion (layered noise) —

function fbm(x, y, octaves = 3) {
  let val = 0
  let amp = 0.5
  let freq = 1
  for (let i = 0; i < octaves; i++) {
    val += amp * noise2D(x * freq, y * freq)
    freq *= 2
    amp *= 0.5
  }
  return val
}

// — Character sets ordered by visual density —

const CHARS_DENSE = '@#%&WM'
const CHARS_MED   = '*+=:;'
const CHARS_LIGHT = '·.,-\''

// Glyph files — auto-discovered from /assets/glifos/
// Vite's import.meta.glob scans the folder at build time so new SVGs are picked up on reload
const glyphModules = import.meta.glob('/assets/glifos/*.svg', { eager: true, query: '?url', import: 'default' })

// Build list of all glyph names from the folder
const ALL_GLYPH_NAMES = Object.keys(glyphModules).map(path => {
  return path.split('/').pop().replace('.svg', '')
})

// Classify glyphs by collection based on filename prefix
const COLLECTIONS = { tulipana: [], vamps: [], copydad: [] }
for (const name of ALL_GLYPH_NAMES) {
  if (name.startsWith('tulipana')) COLLECTIONS.tulipana.push(name)
  else if (name.startsWith('vamps')) COLLECTIONS.vamps.push(name)
  else if (name.startsWith('copydad')) COLLECTIONS.copydad.push(name)
}

// Active collections — all enabled by default
const activeCollections = { tulipana: true, vamps: true, copydad: true }

// Build the filtered glyph list from active collections
let GLYPH_FILES = []
let GLYPH_COUNT = 0

function rebuildGlyphList() {
  GLYPH_FILES = []
  for (const [col, names] of Object.entries(COLLECTIONS)) {
    if (!activeCollections[col]) continue
    for (const name of names) {
      GLYPH_FILES.push(name)
    }
  }
  GLYPH_COUNT = GLYPH_FILES.length
}
rebuildGlyphList()

// Public API to toggle collections
export function setCollection(name, enabled) {
  if (name in activeCollections) {
    activeCollections[name] = enabled
    rebuildGlyphList()
  }
}

export function getCollections() {
  return { ...activeCollections }
}

export function getCollectionNames() {
  return Object.keys(COLLECTIONS)
}
const GLYPH_CHANCE = 1.0 // all visible cells are glyphs

function charForValue(v) {
  // v in [0, 1] — higher = denser character
  // High threshold → lots of whitespace
  if (v < 0.78) return ' '

  // Chance to place a glyph instead of ASCII char
  if (Math.random() < GLYPH_CHANCE) {
    return -(Math.floor(Math.random() * GLYPH_COUNT) + 1) // -1 to -16
  }

  if (v < 0.72) return CHARS_LIGHT[Math.floor(Math.random() * CHARS_LIGHT.length)]
  if (v < 0.82) return CHARS_MED[Math.floor(Math.random() * CHARS_MED.length)]
  return CHARS_DENSE[Math.floor(Math.random() * CHARS_DENSE.length)]
}

// — Load SVG glyphs as Image objects —

function loadGlyphs() {
  // Load ALL glyphs once, filtering happens at draw time via GLYPH_FILES
  const imageMap = {}
  const ready = []
  for (const name of ALL_GLYPH_NAMES) {
    const img = new Image()
    const promise = new Promise(resolve => {
      img.onload = () => resolve(true)
      img.onerror = () => resolve(false)
    })
    img.src = glyphModules[`/assets/glifos/${name}.svg`] || `/assets/glifos/${name}.svg`
    imageMap[name] = img
    ready.push(promise)
  }
  return { imageMap, allReady: Promise.all(ready) }
}

// — Main export —

export function initAsciiBg(selector) {
  const canvas = document.querySelector(selector || '.landing__ascii')
  if (!canvas) return
  // ASCII bg runs on all viewports including mobile

  const ctx = canvas.getContext('2d')
  const parent = canvas.parentElement
  const isFixed = getComputedStyle(canvas).position === 'fixed'
  const getW = () => isFixed ? window.innerWidth : parent.offsetWidth
  const getH = () => isFixed ? window.innerHeight : parent.offsetHeight

  const CELL = 70           // px per character cell (x5)
  const NOISE_SCALE = 0.06  // bigger scale → bigger blobs with more space
  const TIME_SPEED = 0.0004 // animation speed
  const CHAR_FLIP = 0.06    // probability of char changing per frame
  const BLANK_THRESH = 0.78 // matches charForValue threshold
  const GLYPH_SIZE = CELL - 4 // draw size for SVG glyphs

  // Load glyphs
  const { imageMap: glyphImageMap, allReady: glyphsReady } = loadGlyphs()
  let glyphsLoaded = false
  glyphsReady.then(() => { glyphsLoaded = true })

  // 4 layers with different offsets for deep misaligned overlay
  const LAYERS = [
    { offsetX: 0,             offsetY: 0,             noiseOff: 0,    timeOff: 0 },
    { offsetX: 0.45 * CELL,   offsetY: 0.35 * CELL,   noiseOff: 7.7,  timeOff: 1.3 },
    { offsetX: 0.2 * CELL,    offsetY: 0.65 * CELL,   noiseOff: 14.2, timeOff: 2.8 },
    { offsetX: 0.7 * CELL,    offsetY: 0.15 * CELL,   noiseOff: 22.5, timeOff: 4.1 },
  ]

  let cols, rows
  let grids = []
  let valuesArr = []

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const w = getW()
    const h = getH()
    canvas.width = w * dpr
    canvas.height = h * dpr
    canvas.style.width = w + 'px'
    canvas.style.height = h + 'px'
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    cols = Math.ceil(w / CELL) + 1
    rows = Math.ceil(h / CELL) + 1

    const size = cols * rows
    grids = LAYERS.map(() => new Array(size).fill(' '))
    valuesArr = LAYERS.map(() => new Float32Array(size))
  }

  function updateLayer(grid, values, layer, time) {
    const t = time * TIME_SPEED + layer.timeOff

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c

        const nx = c * NOISE_SCALE + layer.noiseOff
        const ny = r * NOISE_SCALE + layer.noiseOff * 0.5

        // Slow large blobs
        const n1 = fbm(nx + t * 0.3, ny + t * 0.2, 3)
        // Faster detail
        const n2 = noise2D(nx * 2.5 + t * 0.8, ny * 2.5 - t * 0.5) * 0.3

        let v = (n1 + n2) * 0.5 + 0.5
        v = Math.max(0, Math.min(1, v))
        values[idx] = v

        if (grid[idx] === ' ' || Math.random() < CHAR_FLIP) {
          grid[idx] = charForValue(v)
        } else if (v < BLANK_THRESH) {
          grid[idx] = ' '
        }
      }
    }
  }

  function update(time) {
    for (let i = 0; i < LAYERS.length; i++) {
      updateLayer(grids[i], valuesArr[i], LAYERS[i], time)
    }
  }

  function drawLayer(grid, values, layer) {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c
        const cell = grid[idx]
        if (cell === ' ') continue

        const x = c * CELL + layer.offsetX
        const y = r * CELL + layer.offsetY

        // Negative number = glyph index
        if (typeof cell === 'number' && cell < 0 && glyphsLoaded && GLYPH_COUNT > 0) {
          const glyphName = GLYPH_FILES[(-cell - 1) % GLYPH_COUNT]
          const img = glyphImageMap[glyphName]
          if (img && img.complete) {
            ctx.drawImage(img, x, y, GLYPH_SIZE, GLYPH_SIZE)
          }
        } else if (typeof cell === 'string') {
          ctx.fillText(cell, x, y)
        }
      }
    }
  }

  function draw() {
    const w = getW()
    const h = getH()
    ctx.clearRect(0, 0, w, h)

    ctx.font = `bold ${CELL - 8}px "Courier New", "Consolas", monospace`
    ctx.textBaseline = 'top'
    ctx.fillStyle = '#000'

    // Draw all 4 layers
    for (let i = 0; i < LAYERS.length; i++) {
      drawLayer(grids[i], valuesArr[i], LAYERS[i])
    }
  }

  let running = true

  function loop(time) {
    if (!running) return
    update(time)
    draw()
    requestAnimationFrame(loop)
  }

  resize()
  let resizeTimer
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer)
    resizeTimer = setTimeout(resize, 150)
  })
  requestAnimationFrame(loop)

  return () => { running = false }
}
