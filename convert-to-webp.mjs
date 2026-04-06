import sharp from 'sharp';
import { readdir, stat, writeFile } from 'fs/promises';
import { join, extname } from 'path';

const ROOT = '.';
const EXCLUDE = ['node_modules', '.git', '.venv', 'dist'];
const WEBP_QUALITY = 80;
const MIN_SIZE = 10000; // 10KB — skip tiny images

let converted = 0;
let totalSaved = 0;

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
  } catch (_) {}
  return files;
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

async function convertToWebP(filePath) {
  const ext = extname(filePath).toLowerCase();
  if (!['.jpg', '.jpeg', '.png'].includes(ext)) return;

  try {
    const stats = await stat(filePath);
    if (stats.size < MIN_SIZE) return;

    const webpPath = filePath.replace(/\.(jpg|jpeg|png)$/i, '.webp');
    
    // Check if webp already exists
    try {
      await stat(webpPath);
      return; // already converted
    } catch (_) {}

    const buffer = await sharp(filePath)
      .webp({ quality: WEBP_QUALITY, effort: 6 })
      .toBuffer();

    if (buffer.length < stats.size) {
      await writeFile(webpPath, buffer);
      const saved = stats.size - buffer.length;
      console.log(`  ✓ ${filePath} → .webp: ${formatSize(stats.size)} → ${formatSize(buffer.length)} (-${((saved / stats.size) * 100).toFixed(0)}%)`);
      converted++;
      totalSaved += saved;
    } else {
      console.log(`  – ${filePath}: WebP no es más pequeño, skip`);
    }
  } catch (e) {
    console.error(`  ✗ ${filePath}: ${e.message}`);
  }
}

async function main() {
  console.log('🖼️  Convirtiendo imágenes a WebP...\n');
  const allFiles = await getAllFiles(ROOT);
  const images = allFiles.filter(f => /\.(jpg|jpeg|png)$/i.test(f));

  console.log(`Procesando ${images.length} imágenes...\n`);
  for (const img of images) {
    await convertToWebP(img);
  }

  console.log(`\n${'='.repeat(50)}`);
  console.log(`✅ ${converted} imágenes convertidas a WebP`);
  console.log(`💾 Ahorro total: ${formatSize(totalSaved)}`);
}

main().catch(console.error);
