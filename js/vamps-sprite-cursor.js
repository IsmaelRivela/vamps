// ─── Keyboard-controlled Sprite + Minijuego for VAMPS ────────────────────────
// vampssprites2.png — 1653×1318px — grid uniforme 6 cols × 5 rows
//
//   Row 0: idle (f0-f2)  Row 1: walk (f0-f5)  Row 2: espalda/↑
//   Row 3: ataque/A      Row 4: fuego(f0)…muerte(f5)
//
// Controls: ← → ↑ ↓  |  F=fuego  A=ataque  Space=click
// Minijuego: activa al primer movimiento con flechas
//   🔥🦇💔 salen de los lados · 3 vidas abajo del bento
//   Sin vidas → caída con sprite muerte (row4 f5)

const SHEET_URL   = '/assets/vamps/vampssprites2.png'
const TOTAL_COLS  = 6
const TOTAL_ROWS  = 5
const W = 80
const H = 80

const ROW_IDLE   = 0
const ROW_WALK   = 1
const ROW_BACK   = 2
const ROW_ATTACK = 3
const ROW_FIRE   = 4

const GRAVITY    = 0.55
const MOVE_SPEED = 4

const MAX_LIVES      = 3
const INVINCIBLE_MS  = 1200
const FRAME_DEATH    = 5   // último sprite del sheet
const EMOJI_TYPES    = ['🔥', '🦇', '💔']

export function initSpriteCursor() {
  // Fuente pixelada
  if (!document.getElementById('vamps-pixel-font')) {
    const link = document.createElement('link')
    link.id   = 'vamps-pixel-font'
    link.rel  = 'stylesheet'
    link.href = 'https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap'
    document.head.appendChild(link)
  }

  const PIXEL_FONT = '"Press Start 2P", monospace'

  const bentoMount = document.querySelector('.vamps-bento') || document.body
  const bentoW  = () => bentoMount.offsetWidth  || window.innerWidth
  const bentoH  = () => bentoMount.offsetHeight || window.innerHeight
  const groundY = () => bentoH() - H - 30

  // ── Sprite element ────────────────────────────────────────────────────────
  const el = document.createElement('div')
  el.className = 'vamps-sprite-cursor'
  el.style.cssText = `
    position: absolute;
    width: ${W}px; height: ${H}px;
    background-image: url("${SHEET_URL}");
    background-size: ${TOTAL_COLS * W}px ${TOTAL_ROWS * H}px;
    background-repeat: no-repeat;
    pointer-events: none;
    z-index: 9999;
    image-rendering: pixelated;
    image-rendering: crisp-edges;
    transform-origin: center;
    will-change: transform, background-position;
  `
  bentoMount.appendChild(el)

  // ── Ground fire line ───────────────────────────────────────────────────────
  const groundFireEl = document.createElement('div')
  groundFireEl.style.cssText = `
    position: absolute;
    left: 0;
    width: 100%;
    font-size: 22px;
    line-height: 1;
    letter-spacing: -2px;
    white-space: nowrap;
    overflow: hidden;
    pointer-events: none;
    z-index: 9997;
    user-select: none;
  `
  bentoMount.appendChild(groundFireEl)

  let fireSpans = []
  let fireLit   = 0
  let fireInterval = null

  function updateGroundFire() {
    const cols = Math.ceil(bentoW() / 20) + 2
    groundFireEl.innerHTML = ''
    fireSpans = []
    for (let i = 0; i < cols; i++) {
      const s = document.createElement('span')
      s.textContent = '🔥'
      s.style.cssText = 'opacity:0; transition: opacity 0.15s;'
      groundFireEl.appendChild(s)
      fireSpans.push(s)
    }
    groundFireEl.style.top = (groundY() + H / 2 - 20) + 'px'
  }

  function igniteGroundFire() {
    fireLit = 0
    if (fireInterval) clearInterval(fireInterval)
    fireInterval = setInterval(() => {
      if (fireLit < fireSpans.length) {
        fireSpans[fireLit].style.opacity = '1'
        fireLit++
      } else {
        clearInterval(fireInterval)
        fireInterval = null
      }
    }, 30)
  }

  updateGroundFire()
  window.addEventListener('resize', () => {
    updateGroundFire()
    if (gameActive) igniteGroundFire()
  })

  // ── Timer display ─────────────────────────────────────────────────────────
  const timerEl = document.createElement('div')
  timerEl.style.cssText = `
    position: absolute;
    right: 20px;
    font-family: ${PIXEL_FONT};
    font-size: 10px;
    color: #fff;
    text-shadow: 1px 1px 0 #000;
    z-index: 9998;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.5s;
  `
  bentoMount.appendChild(timerEl)

  function positionTimer() {
    timerEl.style.top = (groundY() + H / 2 - 72) + 'px'
  }
  positionTimer()
  window.addEventListener('resize', positionTimer)

  // ── Score overlay (encima del vampiro al morir) ────────────────────────────
  const scoreEl = document.createElement('div')
  scoreEl.style.cssText = `
    position: absolute;
    font-family: ${PIXEL_FONT};
    font-size: 8px;
    color: #fff;
    text-shadow: 1px 1px 0 #000, -1px -1px 0 #000;
    text-align: center;
    line-height: 1.8;
    z-index: 10000;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.5s;
    white-space: nowrap;
  `
  bentoMount.appendChild(scoreEl)

  // ── Lives UI ──────────────────────────────────────────────────────────────
  const livesEl = document.createElement('div')
  livesEl.style.cssText = `
    position: absolute;
    right: 20px;
    font-size: 18px;
    letter-spacing: 4px;
    z-index: 9998;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.5s;
  `
  bentoMount.appendChild(livesEl)

  function positionLives() {
    livesEl.style.top = (groundY() + H / 2 - 52) + 'px'
  }
  positionLives()
  window.addEventListener('resize', positionLives)

  // ── State ─────────────────────────────────────────────────────────────────
  let x = bentoW() - W * 0.6 - 20
  let y = groundY()
  let vx = 0, vy = 0

  let row        = ROW_IDLE
  let frame      = 0
  let fireMode   = false
  let attackAnim = false
  let clickAnim  = false
  let clickSeq   = [0, 2, 1, 4]
  let clickStep  = 0
  let clickTarget = null
  let facingLeft = false
  let fps        = 6
  let lastFT     = performance.now()

  // Minijuego
  let gameActive    = false
  let gameOver      = false
  let lives         = MAX_LIVES
  let enemies       = []
  let lastSpawnTime = 0
  let spawnDelay    = 600
  let enemySpeed    = 2.4
  let difficultyTS  = 0
  let invincibleUntil = 0
  let gameStartTS   = 0
  let elapsedSec    = 0

  const keys = new Set()

  // ── Helpers ───────────────────────────────────────────────────────────────
  function updateLives() {
    livesEl.textContent = '❤️'.repeat(lives) + '🖤'.repeat(MAX_LIVES - lives)
  }

  function startGame(ts) {
    gameActive    = true
    lives         = MAX_LIVES
    lastSpawnTime = ts - spawnDelay
    difficultyTS  = ts
    gameStartTS   = ts
    elapsedSec    = 0
    invincibleUntil = ts + 3000
    updateLives()
    livesEl.style.opacity  = '1'
    timerEl.style.opacity  = '1'
    timerEl.textContent    = '0s'
    scoreEl.style.opacity  = '0'
    igniteGroundFire()
    // Lanzar 4 enemigos iniciales repartidos
    for (let i = 0; i < 4; i++) {
      setTimeout(() => spawnEnemy(performance.now()), i * 120)
    }
  }

  function spawnEnemy(ts) {
    const fromLeft = Math.random() < 0.5
    const ey   = H / 2 + Math.random() * (groundY() - H * 1.5)
    const type = EMOJI_TYPES[Math.floor(Math.random() * EMOJI_TYPES.length)]
    const spd  = (enemySpeed + Math.random() * 1.2) * (fromLeft ? 1 : -1)

    const eEl = document.createElement('div')
    eEl.textContent = type
    eEl.style.cssText = `
      position: absolute;
      font-size: 26px;
      left: ${fromLeft ? -40 : bentoW() + 10}px;
      top: ${ey}px;
      pointer-events: none;
      z-index: 9990;
      user-select: none;
      transform: translateY(-50%);
    `
    bentoMount.appendChild(eEl)
    enemies.push({ el: eEl, x: fromLeft ? -40 : bentoW() + 10, y: ey, vx: spd })
    lastSpawnTime = ts
  }

  function removeEnemy(en) {
    en.el.remove()
    enemies = enemies.filter(e => e !== en)
  }

  function flashSprite() {
    let n = 0
    const iv = setInterval(() => {
      el.style.opacity = el.style.opacity === '0.15' ? '1' : '0.15'
      if (++n >= 8) { clearInterval(iv); el.style.opacity = '1' }
    }, INVINCIBLE_MS / 8)
  }

  function hitPlayer(ts) {
    if (ts < invincibleUntil) return
    lives = Math.max(0, lives - 1)
    updateLives()
    invincibleUntil = ts + INVINCIBLE_MS
    flashSprite()
    if (lives <= 0) triggerDeath()
  }

  function resetGame() {
    // Apagar fuegos
    if (fireInterval) clearInterval(fireInterval)
    fireSpans.forEach(s => { s.style.transition = 'opacity 0.6s'; s.style.opacity = '0' })
    // Ocultar vidas y timer
    livesEl.style.opacity = '0'
    timerEl.style.opacity = '0'
    // Ocultar score tras 4s
    setTimeout(() => { scoreEl.style.opacity = '0' }, 4000)
    // Volver a posición original tras fade
    setTimeout(() => {
      gameOver  = false
      gameActive = false
      lives     = MAX_LIVES
      enemies   = []
      row       = ROW_IDLE
      frame     = 0
      fps       = 6
      facingLeft = false
      fireMode  = false
      attackAnim = false
      clickAnim  = false
      vy = 0; vx = 0
      x  = bentoW() - W * 0.6 - 20
      y  = groundY()
      lastFT = performance.now()
    }, 900)
  }

  function triggerDeath() {
    gameOver   = true
    attackAnim = false
    clickAnim  = false
    fireMode   = false
    row   = TOTAL_ROWS - 1
    frame = TOTAL_COLS - 1
    vy    = -6
    enemies.forEach(en => en.el.remove())
    enemies = []

    // Guardar best score en localStorage
    const best = parseInt(localStorage.getItem('vamps_best_time') || '0')
    if (elapsedSec > best) localStorage.setItem('vamps_best_time', elapsedSec)
    const newBest = parseInt(localStorage.getItem('vamps_best_time'))

    // Mostrar score encima del vampiro
    scoreEl.style.left = (x - 60) + 'px'
    scoreEl.style.top  = (y - H - 30) + 'px'
    scoreEl.innerHTML  = `TIME: ${elapsedSec}s<br>BEST: ${newBest}s`
    scoreEl.style.opacity = '1'
  }

  // ── Render ────────────────────────────────────────────────────────────────
  function draw() {
    el.style.backgroundPosition = `${-(frame * W)}px ${-(row * H)}px`
    el.style.transform = `translate(-50%, -50%) scaleX(${facingLeft ? -1 : 1})`
    el.style.left = x + 'px'
    el.style.top  = y + 'px'
  }

  // ── Input ─────────────────────────────────────────────────────────────────
  document.addEventListener('keydown', e => {
    const GAME_KEYS = ['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight']
    if (GAME_KEYS.includes(e.code)) e.preventDefault()
    keys.add(e.code)

    if (gameOver) return

    // Activar minijuego al primer movimiento
    if (!gameActive && ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.code)) {
      startGame(performance.now())
    }

    if ((e.key === 'f' || e.key === 'F') && !e.repeat) {
      fireMode   = !fireMode
      attackAnim = false
      row        = fireMode ? ROW_FIRE : ROW_IDLE
      frame      = 0; fps = 6; lastFT = performance.now()
    }

    if ((e.key === 'a' || e.key === 'A') && !e.repeat && !fireMode) {
      attackAnim = true
      row = ROW_ATTACK; frame = 0; fps = 10; lastFT = performance.now()
    }

    if (e.code === 'Space' && !e.repeat && !clickAnim) {
      clickAnim   = true
      clickStep   = 0
      clickTarget = document.elementFromPoint(x, y)
      if (clickTarget === el) clickTarget = null
      row = ROW_FIRE; frame = clickSeq[0]; fps = 4; lastFT = performance.now()
    }
  })

  document.addEventListener('keyup', e => { keys.delete(e.code) })

  // ── Tick ──────────────────────────────────────────────────────────────────
  function tick(ts) {
    requestAnimationFrame(tick)
    const gY = groundY()

    // Game over: caída con sprite muerte (row 4 / frame 5)
    if (gameOver) {
      if (y < groundY()) {
        vy = Math.min(vy + GRAVITY * 1.5, 22)
        y  = Math.min(groundY(), y + vy)
      } else {
        vy = 0
        resetGame()
        gameOver = false  // evitar re-trigger mientras el timeout no acaba
      }
      row = TOTAL_ROWS - 1; frame = TOTAL_COLS - 1
      // Mover score con el vampiro mientras cae
      scoreEl.style.left = (x - 60) + 'px'
      scoreEl.style.top  = (y - H - 20) + 'px'
      draw()
      return
    }

    // Movimiento
    if (!fireMode && !attackAnim && !clickAnim) {
      if      (keys.has('ArrowLeft'))  { vx = -MOVE_SPEED; facingLeft = true  }
      else if (keys.has('ArrowRight')) { vx =  MOVE_SPEED; facingLeft = false }
      else                             { vx = 0 }
    } else { vx = 0 }

    if      (keys.has('ArrowUp'))   vy = -MOVE_SPEED
    else if (keys.has('ArrowDown')) vy =  MOVE_SPEED * 2
    else                            vy += GRAVITY

    x = Math.max(W / 2, Math.min(bentoW() - W / 2, x + vx))
    y = Math.max(H / 2, Math.min(gY, y + vy))
    if (y >= gY) vy = 0
    if (y <= H / 2) vy = 0

    // Fila de animación
    if (!attackAnim && !fireMode && !clickAnim) {
      const prevRow = row
      if      (keys.has('ArrowUp')) row = ROW_BACK
      else if (vx !== 0)            row = ROW_WALK
      else                          row = ROW_IDLE
      if (row !== prevRow) { frame = 0; lastFT = ts }
    }

    // Avance de frames
    if (ts - lastFT >= 1000 / fps) {
      if (clickAnim) {
        clickStep++
        if (clickStep >= clickSeq.length) {
          if (clickTarget) { clickTarget.click(); clickTarget = null }
          clickAnim = false; row = ROW_IDLE; frame = 0; fps = 6
        } else { frame = clickSeq[clickStep] }
      } else if (attackAnim) {
        frame++
        if (frame >= TOTAL_COLS) { attackAnim = false; row = ROW_IDLE; frame = 0; fps = 6 }
      } else if (fireMode) {
        frame = 0
      } else if (row === ROW_IDLE) {
        frame = (frame + 1) % 3; fps = 6
      } else {
        frame = (frame + 1) % TOTAL_COLS; fps = 10
      }
      lastFT = ts
    }

    // ── Minijuego ─────────────────────────────────────────────────────────
    if (gameActive) {
      // Actualizar timer
      const secs = Math.floor((ts - gameStartTS) / 1000)
      if (secs !== elapsedSec) {
        elapsedSec = secs
        timerEl.textContent = elapsedSec + 's'
      }

      // Dificultad progresiva cada 15s
      if (ts - difficultyTS > 15000) {
        spawnDelay  = Math.max(350, spawnDelay - 250)
        enemySpeed  = Math.min(5.5, enemySpeed + 0.5)
        difficultyTS = ts
      }

      // Spawn
      if (ts - lastSpawnTime > spawnDelay) spawnEnemy(ts)

      // Fuego del suelo: daño si el vampiro está en el suelo
      if (y >= groundY() - 4) hitPlayer(ts)

      // Mover enemigos + colisiones
      const bW = bentoW()
      for (let i = enemies.length - 1; i >= 0; i--) {
        const en = enemies[i]
        en.x += en.vx
        en.el.style.left = en.x + 'px'

        if (en.x < -80 || en.x > bW + 80) { removeEnemy(en); continue }

        // Hitbox reducida al 55%
        if (Math.abs(en.x - x) < W * 0.28 && Math.abs(en.y - y) < H * 0.28) {
          removeEnemy(en)
          hitPlayer(ts)
        }
      }
    }

    draw()
  }

  requestAnimationFrame(tick)
}
