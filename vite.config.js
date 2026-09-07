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
        creative: resolve(__dirname, 'creative/index.html'),
        creativeV1: resolve(__dirname, 'creative/v1/index.html'),
        about: resolve(__dirname, 'about/index.html'),
        slot: resolve(__dirname, 'slot/index.html'),
        brandIdentity: resolve(__dirname, 'work/brand-identity-case/index.html'),
        tulipana: resolve(__dirname, 'creative/tulipana-case/index.html'),
        caseStudio: resolve(__dirname, 'creative/case-studio/index.html'),
        caseStudioBuilder: resolve(__dirname, 'creative/case-studio/builder/index.html'),
        tulipanaV2: resolve(__dirname, 'creative/tulipana-case-v2/index.html'),
        copydad: resolve(__dirname, 'creative/copydad-case/index.html'),
        vampsProject: resolve(__dirname, 'creative/vamps-case/index.html'),
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
