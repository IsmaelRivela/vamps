/* ============================================
   Draggable Stickers
   ============================================ */

import { addRepelSource } from './text-repel.js'

export function initStickers() {
  const stickers = document.querySelectorAll('.sticker')
  if (!stickers.length) return

  stickers.forEach(sticker => {
    let isDragging = false
    let startX, startY, initialLeft, initialTop
    let repelSource = null

    function stickerCenter() {
      const rect = sticker.getBoundingClientRect()
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
    }

    function startDrag(e) {
      isDragging = true
      sticker.classList.add('sticker--dragging')

      const clientX = e.touches ? e.touches[0].clientX : e.clientX
      const clientY = e.touches ? e.touches[0].clientY : e.clientY

      // Read current offset relative to offsetParent
      initialLeft = sticker.offsetLeft
      initialTop = sticker.offsetTop

      startX = clientX
      startY = clientY

      // Register as repel source
      repelSource = addRepelSource()
      const c = stickerCenter()
      repelSource.update(c.x, c.y)

      e.preventDefault()
    }

    function drag(e) {
      if (!isDragging) return
      const clientX = e.touches ? e.touches[0].clientX : e.clientX
      const clientY = e.touches ? e.touches[0].clientY : e.clientY

      sticker.style.left = initialLeft + (clientX - startX) + 'px'
      sticker.style.top = initialTop + (clientY - startY) + 'px'

      // Update repel source position
      if (repelSource) {
        const c = stickerCenter()
        repelSource.update(c.x, c.y)
      }
    }

    function endDrag() {
      if (!isDragging) return
      isDragging = false
      sticker.classList.remove('sticker--dragging')

      // Remove repel source
      if (repelSource) {
        repelSource.remove()
        repelSource = null
      }
    }

    // Mouse events
    sticker.addEventListener('mousedown', startDrag)
    document.addEventListener('mousemove', drag)
    document.addEventListener('mouseup', endDrag)

    // Touch events
    sticker.addEventListener('touchstart', startDrag, { passive: false })
    document.addEventListener('touchmove', drag, { passive: false })
    document.addEventListener('touchend', endDrag)
  })
}
