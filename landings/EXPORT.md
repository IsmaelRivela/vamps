# Export ped.glb

Checklist before replacing `public/models/ped.glb`.

## Clips to include (NLA)

- `IDLE_stance`
- `XPRESSscratch`
- `run_player`
- `FightA_1`
- `turn_180`
- `Turn_L`
- `Turn_R`

Add new ones only if the landing will play them (e.g. a kick). Name them exactly.

## Do not export

- Leftover `IFP_*` actions (absolute pose, mesh collapses)
- Extra unused clips (keeps the GLB small)

## After export

1. Overwrite `public/models/ped.glb` (and `~/Desktop/IA/vamps/vamps-levapms/models/ped.glb` if you still use the playground).
2. Confirm clip names in the GLB match `landings/ped/ped-landing.js`.
3. If you added a clip, wire it in JS and update skill `levamps-ped`.
4. Push if the user asked.
