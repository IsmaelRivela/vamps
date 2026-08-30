# VAMPS site

Landing switch and ped notes for agents. Full playbook: user skill `levamps-ped`.

## Landings

| Id | What | Path |
|---|---|---|
| **ped** | GTA NPC, click-to-move, punch the words | `landings/ped/` |
| **classic** | Old split VAMPS / Ismael | `landings/classic/` (keep) |

Active copy is root `index.html`. See `landings/ACTIVE`.

```bash
node landings/use.mjs ped
node landings/use.mjs classic
```

Do not delete classic. New ped files stay under `landings/ped/`. Model: `public/models/ped.glb`.

Ped JS: `import * as THREE from "three"` and `GLTFLoader` from `three/addons/loaders/GLTFLoader.js`. Load `/models/ped.glb`.

## Words vs floor

- Floor click → ground ray, red arrow, walk.
- VAMPS / Portfolio → shoulder-height aim, `FightA_1` toward the label, then `/vamps/` or `/creative/`.

## Export a new GLB

Follow `landings/EXPORT.md`. Never ship leftover `IFP_*` actions.

## Git on this machine

If `/usr/bin/git` fails (Xcode license):

```bash
export DEVELOPER_DIR=/Library/Developer/CommandLineTools
/Library/Developer/CommandLineTools/usr/bin/git …
```
