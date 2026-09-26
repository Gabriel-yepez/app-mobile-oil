# Ruédalo — Monorepo 🛢️

Control del cambio de aceite para carros y motos en Venezuela.

## Proyectos

| Carpeta | Descripción | Estado |
|---|---|---|
| [`app-mobile/`](app-mobile/) | App móvil — React Native + Expo, UI desde el design handoff, data mock | ✅ En desarrollo |
| [`backend-oil-app/`](backend-oil-app/) | API — NestJS 11 + PostgreSQL/Prisma. Registro, login y sesión con refresh rotativo | ✅ Autenticación lista |

**Un solo repositorio.** Las dos carpetas comparten commits, ramas y remoto: no
hay repos anidados ni submódulos. Cada proyecto conserva su propio gestor de
paquetes — `npm` en `app-mobile/`, `pnpm` en `backend-oil-app/`.

## Estructura compartida

- `.agents/skills/` — skills de agentes (Expo, React, Node.js, accesibilidad…) **globales al repo**: aplican tanto a la app móvil como al backend.
- `skills-lock.json` — lockfile del catálogo de skills.

## Quick start (app móvil)

```bash
cd app-mobile
npm install
npm start
```

Más detalles en [`app-mobile/README.md`](app-mobile/README.md).

## Quick start (backend)

```bash
cd backend-oil-app
pnpm install
docker compose up -d   # PostgreSQL (a partir de la Task 2 del plan)
pnpm start:dev
```

- Diseño: [`docs/superpowers/specs/2026-09-15-auth-backend-design.md`](backend-oil-app/docs/superpowers/specs/2026-09-15-auth-backend-design.md)
- Plan: [`docs/superpowers/plans/2026-09-15-auth-backend.md`](backend-oil-app/docs/superpowers/plans/2026-09-15-auth-backend.md)
