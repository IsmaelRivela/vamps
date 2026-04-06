import sharp from 'sharp';
import { readdir, stat, readFile, writeFile, unlink } from 'fs/promises';
import { join, extname, basename, dirname } from 'path';
import { optimize } from 'svgo';

const ROOT = '.';
const EXCLUDE = ['node_modules', '.git', '.venv', 'dist'];

// Max dimensions for images
const MAX_WIDTH = 1920;
const MAX_HEIGHT = 1920;
const JPG_QUALITY = 80;
const PNG_QUALITY = 80; // not used directly by sharp, but controls compression
const WEBP_QUALITY = 80;

// Size threshold for SVG optimization (skip tiny ones)
const SVG_MIN_SIZE = 5000; // 5KB

// Track savings
let totalOriginal = 0;
let totalOptimized = 0;

async function getAllFiles(dir) {
  const files = [];
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (EXCLUDE.includes(entry.name)) continue;
        files.push(...(await getAllFiles(fullPath)));
      } else {
        files.push(fullPath);
      }
    }
  } catch (e) {
    // skip unreadable dirs
  }
  return files;
}

async function optimizeImage(filePath) {
  const ext = extname(filePath).toLowerCase();
  if (!['.jpg', '.jpeg', '.png', '.gif'].includes(ext)) return;

  try {
    const stats = await stat(filePath);
    const originalSize = stats.size;

    // Skip tiny files
    if (originalSize < 10000) return; // < 10KB

    // For animated GIFs, read all frames
    const isGif = ext === '.gif';
    const sharpOpts = isGif ? { animated: true } : {};

    const image = sharp(filePath, sharpOpts);
    const metadata = await image.metadata();

    // Determine if resize is needed
    const needsResize = metadata.width > MAX_WIDTH || metadata.height > MAX_HEIGHT;
    
    let pipeline = sharp(filePath, sharpOpts);
    
    if (needsResize) {
      pipeline = pipeline.resize(MAX_WIDTH, MAX_HEIGHT, { 
        fit: 'inside', 
        withoutEnlargement: true 
      });
    }

    let outputBuffer;
    
    if (ext === '.jpg' || ext === '.jpeg') {
      outputBuffer = await pipeline
        .jpeg({ quality: JPG_QUALITY, mozjpeg: true })
        .toBuffer();
    } else if (ext === '.png') {
      outputBuffer = await pipeline
        .png({ quality: PNG_QUALITY, compressionLevel: 9, effort: 10 })
        .toBuffer();
    } else if (ext === '.gif') {
      // Sharp can optimize GIFs by re-encoding
      outputBuffer = await pipeline
        .gif({ effort: 10 })
        .toBuffer();
    }

    if (outputBuffer && outputBuffer.length < originalSize) {
      await writeFile(filePath, outputBuffer);
      const saved = originalSize - outputBuffer.length;
      const pct = ((saved / originalSize) * 100).toFixed(1);
      console.log(`  ✓ ${filePath}: ${formatSize(originalSize)} → ${formatSize(outputBuffer.length)} (-${pct}%)`);
      totalOriginal += originalSize;
      totalOptimized += outputBuffer.length;
    } else {
      console.log(`  – ${filePath}: ya optimizado (${formatSize(originalSize)})`);
    }
  } catch (e) {
    console.error(`  ✗ Error en ${filePath}: ${e.message}`);
  }
}

async function optimizeSVG(filePath) {
  try {
    const stats = await stat(filePath);
    const originalSize = stats.size;

    if (originalSize < SVG_MIN_SIZE) return;

    const content = await readFile(filePath, 'utf8');
    
    // Check if SVG has embedded raster data (huge base64)
    const hasEmbeddedRaster = content.includes('data:image/png') || 
                               content.includes('data:image/jpeg') ||
                               content.length > 1000000; // > 1MB = likely has embedded images
    
    if (hasEmbeddedRaster && originalSize > 5 * 1024 * 1024) {
      console.log(`  ⚠ ${filePath}: SVG con datos raster embebidos (${formatSize(originalSize)}) - considera convertirlo a PNG/WebP`);
      // Still try SVGO but it may not help much
    }

    const result = optimize(content, {
      path: filePath,
      multipass: true,
      plugins: [
        {
          name: 'preset-default',
          params: {
            overrides: {
              removeViewBox: false,
              removeTitle: false,
            },
          },
        },
        'removeDimensions',
      ],
    });

    const optimizedSize = Buffer.byteLength(result.data, 'utf8');

    if (optimizedSize < originalSize) {
      await writeFile(filePath, result.data);
      const saved = originalSize - optimizedSize;
      const pct = ((saved / originalSize) * 100).toFixed(1);
      console.log(`  ✓ ${filePath}: ${formatSize(originalSize)} → ${formatSize(optimizedSize)} (-${pct}%)`);
      totalOriginal += originalSize;
      totalOptimized += optimizedSize;
    } else {
      console.log(`  – ${filePath}: ya optimizado (${formatSize(originalSize)})`);
    }
  } catch (e) {
    console.error(`  ✗ Error SVG en ${filePath}: ${e.message}`);
  }
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

async function main() {
  console.log('🔍 Buscando archivos...\n');
  const allFiles = await getAllFiles(ROOT);

  // Separate by type
  const images = allFiles.filter(f => /\.(jpg|jpeg|png|gif)$/i.test(f));
  const svgs = allFiles.filter(f => /\.svg$/i.test(f));

  console.log(`📷 Optimizando ${images.length} imágenes raster...\n`);
  for (const img of images) {
    await optimizeImage(img);
  }

  console.log(`\n🎨 Optimizando ${svgs.length} SVGs...\n`);
  for (const svg of svgs) {
    await optimizeSVG(svg);
  }

  console.log('\n' + '='.repeat(50));
  const totalSaved = totalOriginal - totalOptimized;
  console.log(`📊 Resumen:`);
  console.log(`   Original total procesado: ${formatSize(totalOriginal)}`);
  console.log(`   Optimizado total: ${formatSize(totalOptimized)}`);
  console.log(`   Ahorro total: ${formatSize(totalSaved)} (${totalOriginal > 0 ? ((totalSaved / totalOriginal) * 100).toFixed(1) : 0}%)`);
}

main().catch(console.error);
