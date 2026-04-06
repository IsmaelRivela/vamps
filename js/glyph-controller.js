/* ============================================
   Glyph Controller — Dropdown to filter
   background glyph collections
   ============================================ */

import { setCollection, getCollections, getCollectionNames } from './ascii-bg.js'

export function initGlyphController() {
  const collections = getCollectionNames()
  const state = getCollections()

  // Build UI
  const wrapper = document.createElement('div')
  wrapper.className = 'glyph-ctrl'
  wrapper.innerHTML = `
    <button class="glyph-ctrl__toggle" aria-expanded="false">
      doodle bg panel control
    </button>
    <div class="glyph-ctrl__panel">
      <label class="glyph-ctrl__item glyph-ctrl__item--all">
        <input type="checkbox" value="__all__" checked />
        <span>all these doodles are giving me a headache, turn it off</span>
      </label>
      <hr class="glyph-ctrl__divider" />
      ${collections.map(name => `
        <label class="glyph-ctrl__item">
          <input type="checkbox" value="${name}" ${state[name] ? 'checked' : ''} />
          <span>${name}</span>
        </label>
      `).join('')}
    </div>
  `

  document.body.appendChild(wrapper)

  // Red dot cursor for the controller
  const dot = document.createElement('div')
  dot.className = 'glyph-ctrl__dot'
  wrapper.appendChild(dot)

  wrapper.addEventListener('mousemove', (e) => {
    const r = wrapper.getBoundingClientRect()
    dot.style.left = (e.clientX - r.left) + 'px'
    dot.style.top = (e.clientY - r.top) + 'px'
    dot.style.opacity = '1'
  })
  wrapper.addEventListener('mouseleave', () => {
    dot.style.opacity = '0'
  })

  // Toggle panel
  const btn = wrapper.querySelector('.glyph-ctrl__toggle')
  const panel = wrapper.querySelector('.glyph-ctrl__panel')

  btn.addEventListener('click', () => {
    const isOpen = wrapper.classList.toggle('glyph-ctrl--open')
    btn.setAttribute('aria-expanded', isOpen)
  })

  // Checkbox changes
  const collectionCheckboxes = panel.querySelectorAll('input[type="checkbox"]:not([value="__all__"])')
  const allToggle = panel.querySelector('input[value="__all__"]')

  panel.addEventListener('change', (e) => {
    if (e.target.type !== 'checkbox') return

    if (e.target.value === '__all__') {
      // Toggle all collections
      const enabled = e.target.checked
      collectionCheckboxes.forEach(cb => {
        cb.checked = enabled
        cb.disabled = !enabled
        setCollection(cb.value, enabled)
      })
    } else {
      setCollection(e.target.value, e.target.checked)
    }
  })

  // Close on click outside
  document.addEventListener('click', (e) => {
    if (!wrapper.contains(e.target) && wrapper.classList.contains('glyph-ctrl--open')) {
      wrapper.classList.remove('glyph-ctrl--open')
      btn.setAttribute('aria-expanded', 'false')
    }
  })
}
