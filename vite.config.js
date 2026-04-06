import { resolve } from 'path'
import { defineConfig } from 'vite'

export default defineConfig({
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    cssMinify: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        vamps: resolve(__dirname, 'vamps.html'),
        ismael: resolve(__dirname, 'ismael.html'),
        work: resolve(__dirname, 'work.html'),
        about: resolve(__dirname, 'about.html'),
        slot: resolve(__dirname, 'slot.html'),
        brandIdentity: resolve(__dirname, 'work/brand-identity-case.html'),
        tulipana: resolve(__dirname, 'work/tulipana-case.html'),
        copydad: resolve(__dirname, 'work/copydad-case.html'),
        verbena: resolve(__dirname, 'work/verbena-case.html'),
        vampsProject: resolve(__dirname, 'work/vamps-case.html'),
        back2school: resolve(__dirname, 'vamps/back2school.html'),
        vampsPharma: resolve(__dirname, 'vamps/pharma.html'),
      },
      output: {
        manualChunks: {
          gsap: ['gsap', 'gsap/ScrollTrigger'],
          three: ['three'],
        },
      },
    },
    assetsInlineLimit: 4096,
  },
  server: {
    port: 3000,
    open: true,
    host: true,
  },
})
