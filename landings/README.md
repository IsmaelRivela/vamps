# Landings

Hay dos landings. Solo una está en la raíz (`/index.html`).

| Id | Qué es | Dónde está |
|---|---|---|
| **ped** | NPC GTA, plano, click-to-move. **Activa ahora.** | `landings/ped/` |
| **classic** | Split VAMPS / Ismael (la antigua). Oculta, intacta. | `landings/classic/` |

El archivo `landings/ACTIVE` dice cuál está servida en `/`.

## Cambiar

Dime *usa la landing classic* o *usa la landing ped*.

O en local:

```bash
node landings/use.mjs classic
node landings/use.mjs ped
```

Eso solo sustituye `/index.html`. No borra nada.

Los CSS/JS de classic siguen en `/css/landing.css` y `/js/landing.js`. Los de ped viven solo en `landings/ped/`. El modelo está en `public/models/ped.glb`.
