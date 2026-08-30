import { copyFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const name = process.argv[2];
if (name !== "ped" && name !== "classic") {
  console.error("uso: node landings/use.mjs ped|classic");
  process.exit(1);
}

const root = resolve(import.meta.dirname, "..");
copyFileSync(resolve(root, `landings/${name}/index.html`), resolve(root, "index.html"));
writeFileSync(resolve(root, "landings/ACTIVE"), `${name}\n`);
console.log(`landing activa: ${name}`);
