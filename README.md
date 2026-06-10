# OilTrack VE — Monorepo 🛢️

Control del cambio de aceite para carros y motos en Venezuela.

## Proyectos

| Carpeta | Descripción | Estado |
|---|---|---|
| [`app-mobile/`](app-mobile/) | App móvil — React Native + Expo, UI desde el design handoff, data mock | ✅ En desarrollo |
| `backend/` | API / backend | 🔜 Pendiente |

## Estructura compartida

- `.agents/skills/` — skills de agentes (Expo, React, Node.js, accesibilidad…) **globales al repo**: aplican tanto a la app móvil como al futuro backend.
- `skills-lock.json` — lockfile del catálogo de skills.

## Quick start (app móvil)

```bash
cd app-mobile
npm install
npm start
```

Más detalles en [`app-mobile/README.md`](app-mobile/README.md).
