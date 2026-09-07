import { cp } from "node:fs/promises";
import { access } from "node:fs/promises";

const src = "assets";
const dest = "dist/assets";

try {
  await access(src);
} catch {
  console.warn("[copy-assets] skip: no assets/ folder");
  process.exit(0);
}

await cp(src, dest, { recursive: true, force: true });
console.log(`[copy-assets] ${src}/ → ${dest}/`);
