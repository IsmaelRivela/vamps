/* ============================================
   Language Toggle — EN ↔ ES
   ============================================ */

const STORAGE_KEY = 'site-lang'

export function initLangToggle() {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved) document.documentElement.lang = saved

  const btn = document.getElementById('langToggle')
  if (!btn) return

  updateBtn(btn)

  btn.addEventListener('click', () => {
    const next = document.documentElement.lang === 'en' ? 'es' : 'en'
    document.documentElement.lang = next
    localStorage.setItem(STORAGE_KEY, next)
    updateBtn(btn)
  })
}

function updateBtn(btn) {
  btn.textContent = document.documentElement.lang === 'en' ? 'ES' : 'EN'
}
