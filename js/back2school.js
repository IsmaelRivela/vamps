gsap.registerPlugin(ScrollTrigger);

const container = document.getElementById('tunnel-scroll');
const world     = document.getElementById('world');
const slides    = Array.from(document.querySelectorAll('.slide'));
const N         = slides.length; // 6

// ─── Parámetros del pasillo (adaptativos al viewport) ────────────────────
const isMobile    = window.innerWidth <= 768;
const PERSPECTIVE = isMobile ? 380  : 600;
const SPACING     = isMobile ? 550  : 900;   // distancia Z entre imágenes
const SIDE_OFFSET = isMobile ? 100  : 280;   // px laterales (más estrecho en mobile)
const ROTATE_Y    = isMobile ? 6    : 10;    // giro sutil hacia el centro
const START_OFFSET= isMobile ? 380  : 650;   // cuánto se acerca al inicio
const TRAVEL      = (N + 1) * SPACING;

// Lado por índice: +1 = derecha, -1 = izquierda
// Orden en el DOM: b2s-6(0), b2s-5(1), b2s-4(2), b2s-3(3), b2s-2(4), b2s-1(5)
const SIDES = [1, -1, 1, -1, 1, -1];

// Flip horizontal por índice: true = invertir imagen
const FLIPS = [false, false, false, true, false, false];

// ─── Posicionar imágenes fijas en el escenario 3D ────────────────────────
slides.forEach((s, i) => {
  const z  = -(N - i) * SPACING + START_OFFSET;
  const x  = SIDES[i] * SIDE_OFFSET;
  const ry = -SIDES[i] * ROTATE_Y;                        // giro hacia centro
  gsap.set(s, { z, x, rotateY: ry });
  if (FLIPS[i]) s.querySelector('img').style.transform = 'scaleX(-1)';
  s._worldZ = z;
});

// ─── Niebla + blur por distancia ─────────────────────────────────────────
function updateFog(cameraZ) {
  slides.forEach(s => {
    const effectiveZ = s._worldZ + cameraZ; // Z relativo al ojo del espectador

    // Ocultar cuando ha sobrepasado la cámara
    if (effectiveZ > PERSPECTIVE * 0.9) {
      s.style.visibility = 'hidden';
      return;
    }
    s.style.visibility = 'visible';

    // Blur: sólo para imágenes muy lejanas (efectiveZ muy negativo)
    const dist = Math.max(0, -effectiveZ - SPACING * 0.5);
    const blur = Math.min(5, dist / (SPACING * 1.2));
    s.style.filter = `blur(${blur.toFixed(1)}px)`;

    // Opacidad: desvanece en la lejanía (niebla atmosférica)
    const fog = Math.max(0.15, 1 - dist / (SPACING * 4));
    s.style.opacity = fog.toFixed(3);
  });
}

// Estado inicial
updateFog(0);

// ─── ScrollTrigger: scroll abajo = cámara avanza ─────────────────────────
//  En lugar de mover cada imagen, movemos el MUNDO entero en +Z
//  → el espectador percibe que avanza físicamente por el pasillo
ScrollTrigger.create({
  trigger: container,
  start:   'top top',
  end:     'bottom bottom',
  scrub:   1.2,            // pequeño lag = sensación de peso/inercia
  onUpdate(self) {
    const cameraZ = self.progress * TRAVEL;
    gsap.set(world, { z: cameraZ });
    updateFog(cameraZ);
  },
});
