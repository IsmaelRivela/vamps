#!/usr/bin/env node
/**
 * WebP export for tulipana parallax layers.
 * Optional TinyPNG pass when TINYPNG_API_KEY is set in the environment.
 */
import sharp from "sharp";
import { readdir, readFile, stat, writeFile } from "fs/promises";
import { join } from "path";

const DIR = "assets/projects/tulipana/parallax";
const TINY_KEY = process.env.TINYPNG_API_KEY;

const PROFILES = {
  fondo: { maxWidth: 2560, quality: 82 },
  "layer-5": { maxWidth: 2560, quality: 84 },
  "layer-4": { maxWidth: 2200, quality: 84 },
  logo: { maxWidth: 1400, quality: 88 },
  default: { maxWidth: 1600, quality: 86 },
};

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)}MB`;
}

async function tinyPng(buffer) {
  if (!TINY_KEY) return buffer;
  const res = await fetch("https://api.tinify.com/shrink", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`api:${TINY_KEY}`).toString("base64")}`,
      "Content-Type": "application/octet-stream",
    },
    body: buffer,
  });
  if (!res.ok) return buffer;
  const meta = await res.json();
  const out = await fetch(meta.output.url);
  if (!out.ok) return buffer;
  return Buffer.from(await out.arrayBuffer());
}

async function optimizeFile(pngPath) {
  const base = pngPath.replace(/\.png$/i, "");
  const slug = base.split("/").pop();
  const profile = PROFILES[slug] || PROFILES.default;
  const webpPath = `${base}.webp`;
  const before = (await stat(pngPath)).size;

  let pipeline = sharp(pngPath);
  if (profile.maxWidth) {
    pipeline = pipeline.resize(profile.maxWidth, null, {
      fit: "inside",
      withoutEnlargement: true,
    });
  }

  let buffer = await pipeline.webp({ quality: profile.quality, effort: 6, alphaQuality: 90 }).toBuffer();
  if (TINY_KEY) buffer = await tinyPng(buffer);
  await writeFile(webpPath, buffer);
  console.log(`  ✓ ${slug}: ${formatSize(before)} png → ${formatSize(buffer.length)} webp`);
  return buffer.length;
}

async function main() {
  const files = (await readdir(DIR)).filter((f) => f.endsWith(".png"));
  if (!files.length) {
    console.error(`No PNGs in ${DIR}. Run export-tulipana-parallax.py first.`);
    process.exit(1);
  }
  console.log(`Optimizing ${files.length} layers${TINY_KEY ? " (+ TinyPNG)" : ""}…\n`);
  let total = 0;
  for (const file of files) {
    total += await optimizeFile(join(DIR, file));
  }
  console.log(`\nTotal webp: ${formatSize(total)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
