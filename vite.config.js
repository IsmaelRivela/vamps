import { resolve, join } from 'path'
import { createReadStream, statSync } from 'fs'
import { fileURLToPath } from 'url'
import { defineConfig } from 'vite'

const rootDir = fileURLToPath(new URL('.', import.meta.url))
const assetsDir = join(rootDir, 'assets')

const MIME = {
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.glb': 'model/gltf-binary',
  '.fbx': 'application/octet-stream',
}

function serveAssetsDir() {
  return {
    name: 'serve-assets-dir',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const raw = req.url ?? ''
        if (raw.startsWith('/@') || raw.includes('?import')) return next()
        const url = raw.split('?')[0]
        if (!url.startsWith('/assets/')) return next()
        const rel = decodeURIComponent(url.slice('/assets/'.length))
        const file = join(assetsDir, rel)
        if (!file.startsWith(assetsDir)) return next()
        try {
          const st = statSync(file)
          if (!st.isFile()) return next()
          const ext = rel.slice(rel.lastIndexOf('.')).toLowerCase()
          if (MIME[ext]) res.setHeader('Content-Type', MIME[ext])
          createReadStream(file).pipe(res)
        } catch {
          next()
        }
      })
    },
  }
}

export default defineConfig({
  root: '.',
  publicDir: 'public',
  plugins: [serveAssetsDir()],
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
