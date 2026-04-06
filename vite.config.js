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
        vamps: resolve(__dirname, 'vamps/index.html'),
        ismael: resolve(__dirname, 'ismael/index.html'),
        work: resolve(__dirname, 'work/index.html'),
        about: resolve(__dirname, 'about/index.html'),
        slot: resolve(__dirname, 'slot/index.html'),
        brandIdentity: resolve(__dirname, 'work/brand-identity-case/index.html'),
        tulipana: resolve(__dirname, 'work/tulipana-case/index.html'),
        copydad: resolve(__dirname, 'work/copydad-case/index.html'),
        verbena: resolve(__dirname, 'work/verbena-case/index.html'),
        vampsProject: resolve(__dirname, 'work/vamps-case/index.html'),
        back2school: resolve(__dirname, 'vamps/back2school/index.html'),
        vampsPharma: resolve(__dirname, 'vamps/pharma/index.html'),
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
