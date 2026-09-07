# VAMPS site

Landing switch and ped notes for agents. Full playbook: user skill `levamps-ped`.

## Landings

| Id | What | Path |
|---|---|---|
| **ped** | GTA NPC, click-to-move, punch the words | `landings/ped/` |
| **classic** | Old split VAMPS / Ismael | `landings/classic/` (keep) |

Creative index:

| Id | What | Path |
|---|---|---|
| **v2** | Spatial 3D portfolio (live) | `creative/` + `js/creative-space.js` |
| **v1** | Archived 2D index (bento) | `creative/v1/` (keep) |

Head GLB when ready: `public/models/head.glb` (placeholder bust until then). Do not delete v1.

Active copy is root `index.html`. See `landings/ACTIVE`.

```bash
node landings/use.mjs ped
node landings/use.mjs classic
```

Do not delete classic. New ped files stay under `landings/ped/`. Model: `public/models/ped.glb`.

Ped JS: `import * as THREE from "three"` and `GLTFLoader` from `three/addons/loaders/GLTFLoader.js`. Load `/models/ped.glb`.

## Words vs floor

- Floor click → ground ray, red arrow, walk.
- VAMPS / Portfolio → `FightA_1`, then `/vamps/` or `/creative/`.
- Desktop words: CSS `6vw` sides, mid-screen. Do not JS-pin. Punch dest from the label rect.
- Mobile words: JS-pin to `punchAnchor`. Do not change mobile when editing desktop. Playground: `~/Desktop/IA/vamps/vamps-levapms` (`AGENTS.md` there).

## Export a new GLB

Follow `landings/EXPORT.md`. Never ship leftover `IFP_*` actions.

## Case studio carousel (3D)

- Stage: `js/case-studio-stage.js`, manifests `creative/cases/*.json`.
- Mockups GLB + `CONTENT`: `js/mockup-content.js` (`coverWidth`, `contentAnchorY`).
- Dock models follow cursor (3/4 view); rule: `.cursor/rules/case-studio-3d.mdc`.

## Case studio parallax hero

- PSD fuente: `~/Desktop/fondotuli/fondotuli.psd`.
- Export: `npm run export:tulipana-hero` → `assets/projects/tulipana/parallax/*.webp` (~1.5 MB total).
- Motor: `js/case-studio-parallax.js` + `css/case-studio-parallax.css`.
- Manifest hero `"type": "parallax"`: fondo + layer4 estáticos; cloud-3 ×3 loop; resto parallax suave; logo breathe; layer-5 `object-fit: cover` encima.
- TinyPNG opcional: `TINYPNG_API_KEY` en entorno al optimizar.

## Git on this machine

If `/usr/bin/git` fails (Xcode license):

```bash
export DEVELOPER_DIR=/Library/Developer/CommandLineTools
/Library/Developer/CommandLineTools/usr/bin/git …
```
