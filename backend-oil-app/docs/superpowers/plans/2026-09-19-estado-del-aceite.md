# Estado del aceite — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el medidor del home se alimente de un estado de aceite calculado en el backend, con el odómetro proyectado entre cambios, y que odómetro / próximo cambio / aceite lleguen como un solo bloque a una sola tarjeta.

**Architecture:** La base guarda hechos (`OilChange`, `OdometerReading`) y un espejo del ciclo vigente en `Vehicle`. Un calculador **puro** (`computeOilStatus`) recibe los datos ya cargados y `now`, y devuelve el bloque: proyecta el odómetro con el ritmo km/día del vehículo y corre la vida del aceite por dos ejes —km y tiempo— valiendo el peor. Nada derivado se persiste salvo el espejo, que tiene un único escritor y un test de invariante.

**Tech Stack:** NestJS 11, Prisma 7.10 (`@prisma/adapter-pg`), PostgreSQL, class-validator, Jest 30 + ts-jest, supertest. App: Expo + React Native, Zustand, Tamagui, react-native-svg.

**Spec:** `docs/superpowers/specs/2026-09-19-estado-del-aceite-design.md`

**Nota de alcance:** la spec define dos endpoints de lectura, pero para que
existan datos que leer hacen falta las rutas de escritura de vehículos y
cambios (tareas 8 y 9). Sin ellas `syncVehicleCycle` no tiene cómo probarse:
el test de invariante está definido justo sobre crear / editar / borrar
cambios. Se incluyen en su versión mínima, no como CRUD completo.

## Global Constraints

- Todo cálculo de fechas en **UTC**. `addMonths` es aritmética de calendario, no 30 días; si el día no existe en el mes destino, se recorta al último día del mes.
- `kmPerDay` válido solo en **`[1, 500]`**. Fuera de rango: el valor declarado se rechaza (validación de DTO) y el ciclo medido se descarta del promedio (el cambio se guarda igual).
- La recalibración promedia los **últimos 3 ciclos medidos válidos**.
- Umbral de estado, única definición: `ok` si `pct > 40`; `warn` si `0 < pct <= 40`; `danger` si la vida cruda es `<= 0`.
- `pct` se recorta a `[0, 100]`. `kmLeft` y `daysLeft` **no se recortan**: el negativo es la información útil.
- El odómetro **nunca baja**: `kmEstimado = max(kmEstimado, base.km)`.
- Errores de negocio: siempre vía `Errors.*` en `src/common/errors.ts` (`AppError` con `code` estable y mensaje en español).
- `OilCycleService` es el **único** escritor de `Vehicle.lastChangeKm`, `lastChangeAt`, `nextChangeKm`, `nextChangeDueAt`. Ninguna otra ruta las toca.
- El dominio (`src/modules/oil/domain/**`) **no importa `@prisma/client`**, igual que `users/domain/user.ts`.
- Comentarios en español, explicando el *porqué* y no el *qué*, siguiendo el estilo del repo.
- Tests backend: `*.spec.ts` junto al código (`jest`, rootDir `src`). E2E: `test/*.e2e-spec.ts` con `pnpm test:e2e`.

---

## Mapa de archivos

**Backend — crear**

| Archivo | Responsabilidad |
|---|---|
| `src/modules/oil/domain/oil-status.ts` | Tipos del dominio del aceite y constantes de rango. Sin Prisma. |
| `src/modules/oil/domain/dates.ts` | `addMonths`, `daysBetween`, `isSameUtcDay`. Puro. |
| `src/modules/oil/domain/oil-status.calculator.ts` | `computeOilStatus`. Puro, sin I/O, `now` por parámetro. |
| `src/modules/oil/domain/km-rate.ts` | `computeKmPerDay`: recalibración del ritmo. Puro. |
| `src/modules/oil/domain/vehicle.repository.ts` | Interfaz + token `VEHICLE_REPOSITORY`. |
| `src/modules/oil/domain/oil-change.repository.ts` | Interfaz + token `OIL_CHANGE_REPOSITORY`. |
| `src/modules/oil/domain/odometer.repository.ts` | Interfaz + token `ODOMETER_REPOSITORY`. |
| `src/infra/prisma/prisma-vehicle.repository.ts` | Frontera con Prisma. Mapea fila → dominio. |
| `src/infra/prisma/prisma-oil-change.repository.ts` | Ídem para cambios. |
| `src/infra/prisma/prisma-odometer.repository.ts` | Ídem para lecturas. |
| `src/modules/oil/testing/in-memory-*.repository.ts` | Dobles de prueba, uno por repositorio. |
| `src/modules/oil/oil-cycle.service.ts` | `syncVehicleCycle` y `recomputeAllCycles`. Único escritor del espejo. |
| `src/modules/oil/oil.service.ts` | Orquesta: carga datos, llama al calculador, arma el bloque. |
| `src/modules/oil/vehicles.controller.ts` | HTTP de `/vehicles`. Cero reglas de negocio. |
| `src/modules/oil/dto/*.ts` | DTOs de entrada y respuesta, con decoradores de Swagger. |
| `src/modules/oil/oil.module.ts` | Cableado de providers y tokens. |

**Backend — modificar**

| Archivo | Cambio |
|---|---|
| `prisma/schema.prisma` | Tres modelos y tres enums nuevos; relación en `User`. |
| `src/common/errors.ts` | Cuatro errores nuevos. |
| `src/app.module.ts` | Importar `OilModule`. |

**App móvil — crear**

| Archivo | Responsabilidad |
|---|---|
| `src/api/controllers/oil-status.controller.ts` | Cliente HTTP del recurso, extiende `ApiClient`. |
| `src/home/widgets/OilStatusWidget.tsx` | La tarjeta única: medidor + fila de tres. |

**App móvil — modificar**

| Archivo | Cambio |
|---|---|
| `src/home/layout.ts` | `gauge` + `techReadout` → `oilStatus` en `WidgetId`, `PINNED_WIDGETS`, `WIDGET_ORDER`. |
| `src/home/registry.tsx` | Dos entradas → una. |
| `src/components/OilGauge.tsx` | Centro según `limitedBy`; umbral de estado por prop, no calculado. |
| `src/store/useStore.ts` | Se borran `oilPct`, `kmLeft` y `vehicleStatus`. |
| `src/screens/AddOilScreen.tsx` | Campo de intervalo en meses. |
| `src/screens/AddVehicleFormScreen.tsx` | Campo de uso declarado (→ km/día). |

Se eliminan `src/home/widgets/GaugeWidget.tsx` y `src/home/widgets/TechReadoutWidget.tsx`.

---

# FASE A — Backend

### Task 1: Esquema y migración

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_oil_domain/migration.sql` (lo genera el CLI)

**Interfaces:**
- Consumes: el modelo `User` existente.
- Produces: modelos `Vehicle`, `OilChange`, `OdometerReading` y enums `VehicleKind`, `KmRateSource`, `ReadingSource` en `@prisma/client`.

- [ ] **Step 1: Agregar los enums y modelos al final de `prisma/schema.prisma`**

```prisma
enum VehicleKind   { CAR MOTO }
enum KmRateSource  { DECLARED MEASURED }
enum ReadingSource { OIL_CHANGE MANUAL }

model Vehicle {
  id     String @id @default(uuid()) @db.Uuid
  userId String @db.Uuid
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  kind  VehicleKind
  brand String
  model String
  year  Int
  plate String
  color String

  // Ritmo de uso: la base de la proyección del odómetro. Arranca declarado
  // por el usuario y se recalibra solo con cada ciclo medido. Es un hecho del
  // vehículo, no un estado derivado.
  kmPerDay       Decimal      @db.Decimal(6, 2)
  kmPerDaySource KmRateSource @default(DECLARED)

  // Espejo del ciclo vigente. Derivable de la última fila de OilChange, se
  // persiste para tener el ciclo actual en la ficha. OilCycleService es el
  // ÚNICO que escribe estas cuatro: ni controladores, ni seeds.
  lastChangeKm    Int?
  lastChangeAt    DateTime?
  nextChangeKm    Int?
  nextChangeDueAt DateTime?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  oilChanges       OilChange[]
  odometerReadings OdometerReading[]

  @@unique([userId, plate])
  @@index([userId])
}

model OilChange {
  id        String  @id @default(uuid()) @db.Uuid
  vehicleId String  @db.Uuid
  vehicle   Vehicle @relation(fields: [vehicleId], references: [id], onDelete: Cascade)

  // Fecha real del cambio, que no es createdAt: se puede registrar hoy un
  // cambio hecho la semana pasada.
  changedAt DateTime
  km        Int

  intervalKm     Int
  intervalMonths Int

  oilBrand     String
  oilTag       String
  oilViscosity String
  oilSynthetic Boolean

  shop    String?
  costUsd Decimal? @db.Decimal(10, 2)

  createdAt DateTime @default(now())

  @@index([vehicleId, changedAt(sort: Desc)])
}

model OdometerReading {
  id        String  @id @default(uuid()) @db.Uuid
  vehicleId String  @db.Uuid
  vehicle   Vehicle @relation(fields: [vehicleId], references: [id], onDelete: Cascade)

  km     Int
  readAt DateTime
  source ReadingSource

  createdAt DateTime @default(now())

  @@index([vehicleId, readAt(sort: Desc)])
}
```

- [ ] **Step 2: Agregar la relación inversa en `User`**

Dentro de `model User`, junto a `refreshTokens`:

```prisma
  vehicles Vehicle[]
```

- [ ] **Step 3: Levantar la base y generar la migración**

Run: `pnpm db:up && pnpm db:migrate --name oil_domain`
Expected: crea `prisma/migrations/<timestamp>_oil_domain/` y regenera el cliente sin errores.

- [ ] **Step 4: Verificar que el cliente compila**

Run: `pnpm build`
Expected: sin errores de TypeScript.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(aceite): modelos de vehículo, cambio de aceite y lectura de odómetro"
```

---

### Task 2: Tipos de dominio

**Files:**
- Create: `src/modules/oil/domain/oil-status.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `OilStatusLevel`, `LimitedBy`, `OdometerSource`, `OilCycle`, `OdometerBase`, `OilStatusInput`, `Gauge`, `Odometer`, `OilStatus`, `KM_PER_DAY_MIN`, `KM_PER_DAY_MAX`. Todas las tareas siguientes usan estos nombres tal cual.

Esta tarea no lleva test propio: son tipos y dos constantes, y quien los prueba es el calculador de la tarea 4. Se commitean junto con él si el revisor lo prefiere.

- [ ] **Step 1: Escribir el archivo**

```ts
// El estado del aceite como lo entiende el negocio. Igual que users/domain,
// deliberadamente SIN tipos de Prisma: el calculador tiene que poder correr
// en un test sin base, y el día que cambie el motor esto no se toca.

/** Cortes del medidor. `danger` es vencido, no "poco": ver oil-status.calculator. */
export type OilStatusLevel = 'ok' | 'warn' | 'danger';

/** Cuál de los dos ejes es el que está por vencerse. */
export type LimitedBy = 'km' | 'time';

/** Si el odómetro es una lectura real o una proyección. */
export type OdometerSource = 'reported' | 'estimated';

/** Rango admisible del ritmo de uso, en km/día.
 *
 *  El piso de 1 descarta el vehículo que estuvo meses parado; el techo de 500
 *  descarta el dedazo en el odómetro (un dígito de más da miles de km/día).
 *  Sin estos topes, cualquiera de los dos envenena la estimación por los tres
 *  ciclos siguientes. */
export const KM_PER_DAY_MIN = 1;
export const KM_PER_DAY_MAX = 500;

export type OilCycle = {
  km: number;
  changedAt: Date;
  intervalKm: number;
  intervalMonths: number;
};

export type OdometerBase = { km: number; readAt: Date };

export type OilStatusInput = {
  now: Date;
  kmPerDay: number;
  lastReading: OdometerBase | null;
  cycle: OilCycle | null;
};

export type Gauge = {
  /** Recortado a [0, 100]: la barra no puede dibujar menos que vacío. */
  pct: number;
  status: OilStatusLevel;
  limitedBy: LimitedBy;
  /** SIN recortar: el negativo ("te pasaste 800 km") es la información útil. */
  kmLeft: number;
  /** SIN recortar, y mide su propio eje. Un vehículo limitado por tiempo puede
   *  tener 8.000 en kmLeft y 12 en daysLeft a la vez: no es contradicción, es
   *  el retrato de un carro parado. */
  daysLeft: number;
};

export type Odometer = { km: number; source: OdometerSource; asOf: Date };

export type OilStatus = {
  computedAt: Date;
  /** null cuando el vehículo no tiene ningún cambio registrado. */
  gauge: Gauge | null;
  /** null cuando no hay ninguna lectura de odómetro. */
  odometer: Odometer | null;
};
```

- [ ] **Step 2: Verificar que compila**

Run: `pnpm build`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/modules/oil/domain/oil-status.ts
git commit -m "feat(aceite): tipos de dominio del estado del aceite"
```

---

### Task 3: Aritmética de calendario

**Files:**
- Create: `src/modules/oil/domain/dates.ts`
- Test: `src/modules/oil/domain/dates.spec.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `addMonths(date: Date, months: number): Date`, `daysBetween(from: Date, to: Date): number` (fraccional, con signo), `isSameUtcDay(a: Date, b: Date): boolean`.

- [ ] **Step 1: Escribir los tests que fallan**

```ts
// src/modules/oil/domain/dates.spec.ts
import { addMonths, daysBetween, isSameUtcDay } from './dates';

const utc = (s: string) => new Date(s);

describe('addMonths', () => {
  it('suma meses de calendario, no bloques de 30 días', () => {
    // 4 de junio + 6 meses es el 4 de diciembre, no el 1º.
    expect(addMonths(utc('2026-06-04T00:00:00Z'), 6).toISOString()).toBe(
      '2026-12-04T00:00:00.000Z',
    );
  });

  it('recorta al último día del mes cuando el día no existe', () => {
    // 31 de enero + 1 mes no es el 3 de marzo.
    expect(addMonths(utc('2026-01-31T00:00:00Z'), 1).toISOString()).toBe(
      '2026-02-28T00:00:00.000Z',
    );
  });

  it('respeta el febrero bisiesto', () => {
    expect(addMonths(utc('2028-01-31T00:00:00Z'), 1).toISOString()).toBe(
      '2028-02-29T00:00:00.000Z',
    );
  });

  it('cruza el año', () => {
    expect(addMonths(utc('2026-11-15T00:00:00Z'), 3).toISOString()).toBe(
      '2027-02-15T00:00:00.000Z',
    );
  });

  it('conserva la hora', () => {
    expect(addMonths(utc('2026-06-04T13:45:00Z'), 1).toISOString()).toBe(
      '2026-07-04T13:45:00.000Z',
    );
  });
});

describe('daysBetween', () => {
  it('devuelve días fraccionales', () => {
    expect(
      daysBetween(utc('2026-06-01T00:00:00Z'), utc('2026-06-02T12:00:00Z')),
    ).toBeCloseTo(1.5, 5);
  });

  it('devuelve negativo cuando la fecha destino ya pasó', () => {
    expect(
      daysBetween(utc('2026-06-10T00:00:00Z'), utc('2026-06-08T00:00:00Z')),
    ).toBeCloseTo(-2, 5);
  });
});

describe('isSameUtcDay', () => {
  it('es verdadero dentro del mismo día UTC', () => {
    expect(
      isSameUtcDay(utc('2026-06-04T00:10:00Z'), utc('2026-06-04T23:50:00Z')),
    ).toBe(true);
  });

  it('es falso cruzando la medianoche UTC', () => {
    expect(
      isSameUtcDay(utc('2026-06-04T23:59:00Z'), utc('2026-06-05T00:01:00Z')),
    ).toBe(false);
  });
});
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

Run: `pnpm test -- dates.spec`
Expected: FAIL — "Cannot find module './dates'".

- [ ] **Step 3: Escribir la implementación mínima**

```ts
// src/modules/oil/domain/dates.ts
// Aritmética de fechas del dominio. Todo en UTC: la app se usa en Venezuela,
// pero el servidor no tiene por qué compartir su huso, y una barra que cambia
// de valor según dónde corra el proceso es imposible de depurar.

const MS_POR_DIA = 86_400_000;

/**
 * Suma meses de CALENDARIO. "6 meses" desde el 4 de junio es el 4 de diciembre,
 * no 180 días después — que caería el 1º y adelantaría el vencimiento.
 *
 * Si el día no existe en el mes destino (31 de enero + 1 mes), se recorta al
 * último día del mes: el desborde de JavaScript lo mandaría al 3 de marzo, que
 * es un mes y tres días.
 */
export function addMonths(date: Date, months: number): Date {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth();
  const d = date.getUTCDate();

  // Día 0 del mes siguiente = último día del mes destino.
  const ultimoDelDestino = new Date(Date.UTC(y, m + months + 1, 0)).getUTCDate();

  return new Date(
    Date.UTC(
      y,
      m + months,
      Math.min(d, ultimoDelDestino),
      date.getUTCHours(),
      date.getUTCMinutes(),
      date.getUTCSeconds(),
      date.getUTCMilliseconds(),
    ),
  );
}

/** Días fraccionales de `from` a `to`. Negativo si `to` ya pasó. */
export function daysBetween(from: Date, to: Date): number {
  return (to.getTime() - from.getTime()) / MS_POR_DIA;
}

export function isSameUtcDay(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}
```

- [ ] **Step 4: Correr los tests para verificar que pasan**

Run: `pnpm test -- dates.spec`
Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
git add src/modules/oil/domain/dates.ts src/modules/oil/domain/dates.spec.ts
git commit -m "feat(aceite): aritmética de calendario en UTC"
```

---

### Task 4: El calculador

**Files:**
- Create: `src/modules/oil/domain/oil-status.calculator.ts`
- Test: `src/modules/oil/domain/oil-status.calculator.spec.ts`

**Interfaces:**
- Consumes: `addMonths`, `daysBetween`, `isSameUtcDay` (Task 3); los tipos de Task 2.
- Produces: `computeOilStatus(input: OilStatusInput): OilStatus`.

Es el corazón del diseño. Función pura: sin base, sin `new Date()` interno —
`now` entra por parámetro, que es lo que hace que estos tests existan.

- [ ] **Step 1: Escribir los tests que fallan**

```ts
// src/modules/oil/domain/oil-status.calculator.spec.ts
import { computeOilStatus } from './oil-status.calculator';
import type { OilStatusInput } from './oil-status';

const utc = (s: string) => new Date(s);

// Ciclo base: cambio el 4 de junio a los 45.000 km, 5.000 km / 6 meses.
// Límite por km: 50.000. Límite por tiempo: 4 de diciembre.
const cicloBase = {
  km: 45_000,
  changedAt: utc('2026-06-04T00:00:00Z'),
  intervalKm: 5_000,
  intervalMonths: 6,
};

const entrada = (over: Partial<OilStatusInput> = {}): OilStatusInput => ({
  now: utc('2026-07-04T00:00:00Z'),
  kmPerDay: 40,
  lastReading: { km: 45_000, readAt: utc('2026-06-04T00:00:00Z') },
  cycle: cicloBase,
  ...over,
});

describe('proyección del odómetro', () => {
  it('no proyecta nada si la lectura es de hoy', () => {
    const r = computeOilStatus(
      entrada({
        now: utc('2026-06-04T18:00:00Z'),
        lastReading: { km: 45_000, readAt: utc('2026-06-04T08:00:00Z') },
      }),
    );
    expect(r.odometer).toEqual({
      km: 45_000,
      source: 'reported',
      asOf: utc('2026-06-04T08:00:00Z'),
    });
  });

  it('proyecta 30 días a 40 km/día como 1.200 km', () => {
    const r = computeOilStatus(entrada());
    expect(r.odometer?.km).toBe(46_200);
    expect(r.odometer?.source).toBe('estimated');
  });

  it('el odómetro nunca baja', () => {
    // now anterior a la lectura (reloj torcido): no puede restar km.
    const r = computeOilStatus(entrada({ now: utc('2026-06-01T00:00:00Z') }));
    expect(r.odometer?.km).toBe(45_000);
  });

  it('deja asOf en la fecha de la lectura, no en now', () => {
    const r = computeOilStatus(entrada());
    expect(r.odometer?.asOf).toEqual(utc('2026-06-04T00:00:00Z'));
  });
});

describe('los dos ejes', () => {
  it('manda el km cuando el vehículo se usa mucho', () => {
    // 90 días a 50 km/día = 4.500 km. Quedan 500 km (10%) y ~3 meses (50%).
    const r = computeOilStatus(
      entrada({ now: utc('2026-09-02T00:00:00Z'), kmPerDay: 50 }),
    );
    expect(r.gauge?.limitedBy).toBe('km');
    expect(r.gauge?.kmLeft).toBe(500);
    expect(r.gauge?.pct).toBe(10);
    expect(r.gauge?.status).toBe('warn');
  });

  it('manda el tiempo cuando el vehículo está parado', () => {
    // 150 días a 2 km/día = 300 km. Sobran 4.700 km, pero faltan 33 días.
    const r = computeOilStatus(
      entrada({ now: utc('2026-11-01T00:00:00Z'), kmPerDay: 2 }),
    );
    expect(r.gauge?.limitedBy).toBe('time');
    expect(r.gauge?.kmLeft).toBe(4_700);
    expect(r.gauge?.daysLeft).toBe(33);
    expect(r.gauge?.pct).toBeLessThan(20);
  });

  it('kmLeft y daysLeft miden cada uno su eje, aunque solo uno mande', () => {
    const r = computeOilStatus(
      entrada({ now: utc('2026-11-01T00:00:00Z'), kmPerDay: 2 }),
    );
    expect(r.gauge?.kmLeft).toBeGreaterThan(0);
    expect(r.gauge?.daysLeft).toBeGreaterThan(0);
  });
});

describe('vencimiento', () => {
  it('vence por km: pct en 0, kmLeft negativo, danger', () => {
    // 120 días a 50 km/día = 6.000 km sobre 45.000 → 51.000, límite 50.000.
    const r = computeOilStatus(
      entrada({ now: utc('2026-10-02T00:00:00Z'), kmPerDay: 50 }),
    );
    expect(r.gauge?.pct).toBe(0);
    expect(r.gauge?.kmLeft).toBe(-1_000);
    expect(r.gauge?.status).toBe('danger');
    expect(r.gauge?.limitedBy).toBe('km');
  });

  it('vence por tiempo: pct en 0, daysLeft negativo, danger', () => {
    const r = computeOilStatus(
      entrada({ now: utc('2026-12-20T00:00:00Z'), kmPerDay: 1 }),
    );
    expect(r.gauge?.pct).toBe(0);
    expect(r.gauge?.daysLeft).toBeLessThan(0);
    expect(r.gauge?.status).toBe('danger');
    expect(r.gauge?.limitedBy).toBe('time');
  });

  it('el día del cambio la vida está llena', () => {
    const r = computeOilStatus(entrada({ now: utc('2026-06-04T00:00:00Z') }));
    expect(r.gauge?.pct).toBe(100);
    expect(r.gauge?.status).toBe('ok');
  });
});

describe('umbral de estado', () => {
  it.each([
    ['2026-06-20T00:00:00Z', 40, 'ok'],    // ~87%
    ['2026-08-20T00:00:00Z', 40, 'warn'],  // ~38%
  ])('en %s a %i km/día el estado es %s', (fecha, ritmo, esperado) => {
    const r = computeOilStatus(
      entrada({ now: utc(fecha as string), kmPerDay: ritmo as number }),
    );
    expect(r.gauge?.status).toBe(esperado);
  });

  it('no dice VENCIDO mientras quede vida, aunque pct redondee a 0', () => {
    // Vida cruda positiva pero mínima: pct baja a 0, el estado sigue en warn.
    const r = computeOilStatus(
      entrada({
        cycle: { ...cicloBase, intervalKm: 5_000 },
        now: utc('2026-06-04T00:00:00Z'),
        lastReading: { km: 49_999, readAt: utc('2026-06-04T00:00:00Z') },
      }),
    );
    expect(r.gauge?.status).toBe('warn');
  });
});

describe('sin datos', () => {
  it('sin ciclo devuelve gauge en null pero conserva el odómetro', () => {
    const r = computeOilStatus(entrada({ cycle: null }));
    expect(r.gauge).toBeNull();
    expect(r.odometer?.km).toBe(46_200);
  });

  it('sin lecturas devuelve todo en null', () => {
    const r = computeOilStatus(entrada({ lastReading: null, cycle: null }));
    expect(r.gauge).toBeNull();
    expect(r.odometer).toBeNull();
  });

  it('computedAt es el now que se le pasó', () => {
    const now = utc('2026-07-04T00:00:00Z');
    expect(computeOilStatus(entrada({ now })).computedAt).toEqual(now);
  });
});

describe('bordes del ritmo', () => {
  it.each([1, 500])('acepta %i km/día', (ritmo) => {
    const r = computeOilStatus(entrada({ kmPerDay: ritmo }));
    expect(r.odometer?.km).toBe(45_000 + ritmo * 30);
  });
});
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

Run: `pnpm test -- oil-status.calculator.spec`
Expected: FAIL — "Cannot find module './oil-status.calculator'".

- [ ] **Step 3: Escribir la implementación mínima**

```ts
// src/modules/oil/domain/oil-status.calculator.ts
// El cálculo del estado del aceite. Función PURA: sin base, sin red y sin
// `new Date()` — `now` entra por parámetro. Esa decisión es la que permite
// probar "el 20 de diciembre esto está vencido" sin tocar el reloj del sistema.
import { addMonths, daysBetween, isSameUtcDay } from './dates';
import type {
  Gauge,
  Odometer,
  OdometerBase,
  OilStatus,
  OilStatusInput,
  OilStatusLevel,
} from './oil-status';

const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, n));

/**
 * Proyecta el odómetro desde la última lectura real.
 *
 * Esta es la respuesta al problema de fondo: el odómetro solo existe sentado
 * en el auto, así que entre cambio y cambio hay que estimarlo o la barra se
 * congela y miente.
 */
function projectOdometer(
  base: OdometerBase,
  kmPerDay: number,
  now: Date,
): Odometer {
  // Si la lectura es de hoy, el número es real y se reporta como tal: no tiene
  // sentido "estimar" sobre una medición de hace tres horas.
  if (isSameUtcDay(base.readAt, now)) {
    return { km: base.km, source: 'reported', asOf: base.readAt };
  }

  const dias = Math.max(0, daysBetween(base.readAt, now));
  // El max() cubre el reloj torcido: un odómetro no retrocede nunca.
  const km = Math.max(base.km, base.km + Math.round(kmPerDay * dias));
  return { km, source: 'estimated', asOf: base.readAt };
}

/**
 * El estado sale de la vida CRUDA, no del `pct` ya recortado: un aceite con
 * 0,4% de vida redondea a 0, y decirle VENCIDO a algo que todavía no venció es
 * exactamente el error que este umbral existe para no cometer.
 */
function statusFor(vidaCruda: number, pct: number): OilStatusLevel {
  if (vidaCruda <= 0) return 'danger';
  return pct > 40 ? 'ok' : 'warn';
}

export function computeOilStatus(input: OilStatusInput): OilStatus {
  const { now, kmPerDay, lastReading, cycle } = input;

  const odometer = lastReading
    ? projectOdometer(lastReading, kmPerDay, now)
    : null;

  if (!cycle || !odometer) return { computedAt: now, gauge: null, odometer };

  const limiteKm = cycle.km + cycle.intervalKm;
  const limiteFecha = addMonths(cycle.changedAt, cycle.intervalMonths);

  const kmLeft = limiteKm - odometer.km;
  const diasRestantes = daysBetween(now, limiteFecha);
  const diasTotales = daysBetween(cycle.changedAt, limiteFecha);

  const vidaKm = kmLeft / cycle.intervalKm;
  const vidaTiempo = diasRestantes / diasTotales;

  // El peor de los dos ejes: es el "5.000 km o 6 meses, lo que ocurra primero"
  // que trae el manual de cualquier vehículo.
  const vidaCruda = Math.min(vidaKm, vidaTiempo);
  const pct = Math.round(clamp(vidaCruda, 0, 1) * 100);

  const gauge: Gauge = {
    pct,
    status: statusFor(vidaCruda, pct),
    limitedBy: vidaKm <= vidaTiempo ? 'km' : 'time',
    kmLeft,
    // floor y no round: si quedan 2,7 días se muestran 2. Redondear para
    // arriba le promete al usuario un día que no tiene.
    daysLeft: Math.floor(diasRestantes),
  };

  return { computedAt: now, gauge, odometer };
}
```

- [ ] **Step 4: Correr los tests para verificar que pasan**

Run: `pnpm test -- oil-status.calculator.spec`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/oil/domain/oil-status.calculator.ts src/modules/oil/domain/oil-status.calculator.spec.ts src/modules/oil/domain/oil-status.ts
git commit -m "feat(aceite): calculador de vida del aceite por km y tiempo"
```

---

### Task 5: Recalibración del ritmo

**Files:**
- Create: `src/modules/oil/domain/km-rate.ts`
- Test: `src/modules/oil/domain/km-rate.spec.ts`

**Interfaces:**
- Consumes: `daysBetween` (Task 3), `KM_PER_DAY_MIN`, `KM_PER_DAY_MAX` (Task 2).
- Produces: `computeKmPerDay(changes: RateSample[], fallback: number): number` y el tipo `RateSample = { km: number; changedAt: Date }`. `changes` llega **del más nuevo al más viejo**.

- [ ] **Step 1: Escribir los tests que fallan**

```ts
// src/modules/oil/domain/km-rate.spec.ts
import { computeKmPerDay, type RateSample } from './km-rate';

const utc = (s: string) => new Date(s);

// Del más nuevo al más viejo, como los devuelve el repositorio.
const cambios = (...pares: [string, number][]): RateSample[] =>
  pares.map(([fecha, km]) => ({ changedAt: utc(fecha), km }));

describe('computeKmPerDay', () => {
  it('sin ciclos medibles devuelve el valor declarado', () => {
    expect(computeKmPerDay(cambios(['2026-06-04T00:00:00Z', 45_000]), 30)).toBe(30);
  });

  it('con un ciclo mide el ritmo real', () => {
    // 3.000 km en 100 días = 30 km/día.
    const r = computeKmPerDay(
      cambios(['2026-06-04T00:00:00Z', 45_000], ['2026-02-24T00:00:00Z', 42_000]),
      99,
    );
    expect(r).toBeCloseTo(30, 2);
  });

  it('promedia los tres ciclos más recientes y descarta los viejos', () => {
    const r = computeKmPerDay(
      cambios(
        ['2026-06-04T00:00:00Z', 60_000], // 100 días, 4.000 km → 40
        ['2026-02-24T00:00:00Z', 56_000], // 100 días, 2.000 km → 20
        ['2025-11-16T00:00:00Z', 54_000], // 100 días, 3.000 km → 30
        ['2025-08-08T00:00:00Z', 51_000], // 100 días, 1.000 km → 10 (ignorado)
        ['2025-04-30T00:00:00Z', 50_000],
      ),
      99,
    );
    expect(r).toBeCloseTo(30, 2); // (40 + 20 + 30) / 3
  });

  it('descarta el ciclo con ritmo imposible por dedazo', () => {
    // 400.000 km en 100 días: alguien escribió un dígito de más.
    const r = computeKmPerDay(
      cambios(
        ['2026-06-04T00:00:00Z', 445_000],
        ['2026-02-24T00:00:00Z', 45_000],
        ['2025-11-16T00:00:00Z', 42_000], // 3.000 km en 100 días → 30
      ),
      99,
    );
    expect(r).toBeCloseTo(30, 2);
  });

  it('descarta el ciclo del vehículo que estuvo parado', () => {
    // 50 km en 200 días = 0,25 km/día: por debajo del piso.
    const r = computeKmPerDay(
      cambios(
        ['2026-06-04T00:00:00Z', 45_050],
        ['2025-11-16T00:00:00Z', 45_000],
        ['2025-08-08T00:00:00Z', 42_000], // 3.000 km en 100 días → 30
      ),
      99,
    );
    expect(r).toBeCloseTo(30, 2);
  });

  it('si TODOS los ciclos son inválidos cae al valor declarado', () => {
    const r = computeKmPerDay(
      cambios(['2026-06-04T00:00:00Z', 445_000], ['2026-02-24T00:00:00Z', 45_000]),
      37,
    );
    expect(r).toBe(37);
  });

  it('ignora dos cambios del mismo día en vez de dividir por cero', () => {
    const r = computeKmPerDay(
      cambios(['2026-06-04T00:00:00Z', 45_100], ['2026-06-04T00:00:00Z', 45_000]),
      25,
    );
    expect(r).toBe(25);
  });
});
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

Run: `pnpm test -- km-rate.spec`
Expected: FAIL — "Cannot find module './km-rate'".

- [ ] **Step 3: Escribir la implementación mínima**

```ts
// src/modules/oil/domain/km-rate.ts
// Recalibración del ritmo de uso. El usuario declara un número al dar de alta
// el vehículo, y desde el segundo cambio el ritmo pasa a ser el MEDIDO: km
// recorridos entre dos cambios, dividido por los días que pasaron entre ellos.
import { daysBetween } from './dates';
import { KM_PER_DAY_MAX, KM_PER_DAY_MIN } from './oil-status';

export type RateSample = { km: number; changedAt: Date };

/** Cuántos ciclos entran al promedio. Tres alcanza para amortiguar un mes raro
 *  sin quedar anclado a cómo se usaba el vehículo hace dos años. */
const CICLOS_A_PROMEDIAR = 3;

/**
 * @param changes ciclos del vehículo, del MÁS NUEVO al más viejo.
 * @param fallback el ritmo declarado, que se usa mientras no haya nada medible.
 */
export function computeKmPerDay(
  changes: RateSample[],
  fallback: number,
): number {
  const ritmos: number[] = [];

  for (let i = 0; i < changes.length - 1; i++) {
    const nuevo = changes[i];
    const viejo = changes[i + 1];

    const dias = daysBetween(viejo.changedAt, nuevo.changedAt);
    // Dos cambios el mismo día no son un ciclo medible; sin esta guarda sería
    // una división por cero que devuelve Infinity y se persiste.
    if (dias <= 0) continue;

    const ritmo = (nuevo.km - viejo.km) / dias;
    // Fuera de rango no se rechaza el cambio: se descarta del promedio. Es el
    // dedazo en el odómetro y el vehículo que estuvo parado medio año.
    if (ritmo < KM_PER_DAY_MIN || ritmo > KM_PER_DAY_MAX) continue;

    ritmos.push(ritmo);
    if (ritmos.length === CICLOS_A_PROMEDIAR) break;
  }

  if (ritmos.length === 0) return fallback;
  return ritmos.reduce((a, b) => a + b, 0) / ritmos.length;
}
```

- [ ] **Step 4: Correr los tests para verificar que pasan**

Run: `pnpm test -- km-rate.spec`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/modules/oil/domain/km-rate.ts src/modules/oil/domain/km-rate.spec.ts
git commit -m "feat(aceite): recalibración del ritmo de uso con el historial"
```

---

### Task 6: Repositorios

**Files:**
- Create: `src/modules/oil/domain/vehicle.repository.ts`, `oil-change.repository.ts`, `odometer.repository.ts`
- Create: `src/infra/prisma/prisma-vehicle.repository.ts`, `prisma-oil-change.repository.ts`, `prisma-odometer.repository.ts`
- Create: `src/modules/oil/testing/in-memory-vehicle.repository.ts`, `in-memory-oil-change.repository.ts`, `in-memory-odometer.repository.ts`

**Interfaces:**
- Consumes: `PrismaService`; los tipos de Task 2.
- Produces: los tres tokens (`VEHICLE_REPOSITORY`, `OIL_CHANGE_REPOSITORY`, `ODOMETER_REPOSITORY`), las tres interfaces y los tipos de dominio `Vehicle`, `OilChangeRecord`, `OdometerRecord`. Las tareas 7 a 10 piden **los tokens**, nunca las clases.

Sigue el patrón de `users/domain/user.repository.ts`: el dominio define la
interfaz y un `Symbol`, Prisma la implementa y mapea, y los tests usan el doble
en memoria. Ningún servicio importa `@prisma/client`.

- [ ] **Step 1: Escribir las interfaces de dominio**

```ts
// src/modules/oil/domain/vehicle.repository.ts
export const VEHICLE_REPOSITORY = Symbol('VEHICLE_REPOSITORY');

export type VehicleKind = 'CAR' | 'MOTO';
export type KmRateSource = 'DECLARED' | 'MEASURED';

export type Vehicle = {
  id: string;
  userId: string;
  kind: VehicleKind;
  brand: string;
  model: string;
  year: number;
  plate: string;
  color: string;
  kmPerDay: number;
  kmPerDaySource: KmRateSource;
  lastChangeKm: number | null;
  lastChangeAt: Date | null;
  nextChangeKm: number | null;
  nextChangeDueAt: Date | null;
};

export type NewVehicle = Omit<
  Vehicle,
  'id' | 'kmPerDaySource' | 'lastChangeKm' | 'lastChangeAt' | 'nextChangeKm' | 'nextChangeDueAt'
>;

/** Lo único que OilCycleService puede escribir del espejo. */
export type CycleMirror = {
  lastChangeKm: number | null;
  lastChangeAt: Date | null;
  nextChangeKm: number | null;
  nextChangeDueAt: Date | null;
};

export interface VehicleRepository {
  findById(id: string): Promise<Vehicle | null>;
  findByUser(userId: string): Promise<Vehicle[]>;
  listAllIds(): Promise<string[]>;
  create(data: NewVehicle): Promise<Vehicle>;
  /** Solo lo llama OilCycleService. Ver la regla del escritor único. */
  updateCycleMirror(id: string, mirror: CycleMirror): Promise<void>;
  updateKmRate(id: string, kmPerDay: number, source: KmRateSource): Promise<void>;
}
```

```ts
// src/modules/oil/domain/oil-change.repository.ts
export const OIL_CHANGE_REPOSITORY = Symbol('OIL_CHANGE_REPOSITORY');

export type OilChangeRecord = {
  id: string;
  vehicleId: string;
  changedAt: Date;
  km: number;
  intervalKm: number;
  intervalMonths: number;
  oilBrand: string;
  oilTag: string;
  oilViscosity: string;
  oilSynthetic: boolean;
  shop: string | null;
  costUsd: number | null;
};

export type NewOilChange = Omit<OilChangeRecord, 'id'>;

export interface OilChangeRepository {
  /** Del más nuevo al más viejo. `limit` acota lo que baja de la base. */
  findByVehicle(vehicleId: string, limit?: number): Promise<OilChangeRecord[]>;
  findLatest(vehicleId: string): Promise<OilChangeRecord | null>;
  findById(id: string): Promise<OilChangeRecord | null>;
  create(data: NewOilChange): Promise<OilChangeRecord>;
  update(id: string, patch: Partial<NewOilChange>): Promise<OilChangeRecord>;
  remove(id: string): Promise<void>;
}
```

```ts
// src/modules/oil/domain/odometer.repository.ts
export const ODOMETER_REPOSITORY = Symbol('ODOMETER_REPOSITORY');

export type ReadingSource = 'OIL_CHANGE' | 'MANUAL';

export type OdometerRecord = {
  id: string;
  vehicleId: string;
  km: number;
  readAt: Date;
  source: ReadingSource;
};

export type NewOdometerReading = Omit<OdometerRecord, 'id'>;

export interface OdometerRepository {
  findLatest(vehicleId: string): Promise<OdometerRecord | null>;
  create(data: NewOdometerReading): Promise<OdometerRecord>;
}
```

- [ ] **Step 2: Escribir las implementaciones Prisma**

Las tres siguen el molde de `prisma-user.repository.ts`: `toDomain` privado y
`Decimal` convertido a `number` en la frontera, para que el dominio no vea
tipos de Prisma.

```ts
// src/infra/prisma/prisma-vehicle.repository.ts
// Frontera con Prisma. Entra y sale el tipo de DOMINIO.
import { Injectable } from '@nestjs/common';
import type { Vehicle as PrismaVehicle } from '@prisma/client';
import type {
  CycleMirror,
  KmRateSource,
  NewVehicle,
  Vehicle,
  VehicleRepository,
} from '../../modules/oil/domain/vehicle.repository';
import { PrismaService } from './prisma.service';

@Injectable()
export class PrismaVehicleRepository implements VehicleRepository {
  constructor(private readonly prisma: PrismaService) {}

  private toDomain(row: PrismaVehicle): Vehicle {
    return {
      id: row.id,
      userId: row.userId,
      kind: row.kind,
      brand: row.brand,
      model: row.model,
      year: row.year,
      plate: row.plate,
      color: row.color,
      // Decimal de Prisma no es number: se convierte acá y no más arriba.
      kmPerDay: Number(row.kmPerDay),
      kmPerDaySource: row.kmPerDaySource,
      lastChangeKm: row.lastChangeKm,
      lastChangeAt: row.lastChangeAt,
      nextChangeKm: row.nextChangeKm,
      nextChangeDueAt: row.nextChangeDueAt,
    };
  }

  async findById(id: string): Promise<Vehicle | null> {
    const row = await this.prisma.vehicle.findUnique({ where: { id } });
    return row ? this.toDomain(row) : null;
  }

  async findByUser(userId: string): Promise<Vehicle[]> {
    const rows = await this.prisma.vehicle.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => this.toDomain(r));
  }

  async listAllIds(): Promise<string[]> {
    const rows = await this.prisma.vehicle.findMany({ select: { id: true } });
    return rows.map((r) => r.id);
  }

  async create(data: NewVehicle): Promise<Vehicle> {
    const row = await this.prisma.vehicle.create({ data });
    return this.toDomain(row);
  }

  async updateCycleMirror(id: string, mirror: CycleMirror): Promise<void> {
    await this.prisma.vehicle.update({ where: { id }, data: mirror });
  }

  async updateKmRate(
    id: string,
    kmPerDay: number,
    source: KmRateSource,
  ): Promise<void> {
    await this.prisma.vehicle.update({
      where: { id },
      data: { kmPerDay, kmPerDaySource: source },
    });
  }
}
```

`prisma-oil-change.repository.ts` y `prisma-odometer.repository.ts` se escriben
con el mismo molde: `toDomain` que convierte `costUsd` (`Decimal | null`) con
`row.costUsd === null ? null : Number(row.costUsd)`, `findByVehicle` con
`orderBy: { changedAt: 'desc' }` y `take: limit`, y `findLatest` con
`orderBy: { readAt: 'desc' }` y `take: 1`.

- [ ] **Step 3: Escribir los dobles en memoria**

Mismo molde que `users/testing/in-memory-user.repository.ts`: un `Map` por
entidad, ids con un contador, y el **mismo orden** que la implementación real
(el más nuevo primero) — si el doble ordena distinto, los tests pasan y
producción falla.

```ts
// src/modules/oil/testing/in-memory-oil-change.repository.ts
import type {
  NewOilChange,
  OilChangeRecord,
  OilChangeRepository,
} from '../domain/oil-change.repository';

export class InMemoryOilChangeRepository implements OilChangeRepository {
  private readonly rows = new Map<string, OilChangeRecord>();
  private seq = 0;

  /** Del más nuevo al más viejo: MISMO orden que Prisma. Si el doble ordenara
   *  distinto, los tests pasarían y producción fallaría. */
  private ordenados(vehicleId: string): OilChangeRecord[] {
    return [...this.rows.values()]
      .filter((r) => r.vehicleId === vehicleId)
      .sort((a, b) => b.changedAt.getTime() - a.changedAt.getTime());
  }

  async findByVehicle(vehicleId: string, limit?: number) {
    const all = this.ordenados(vehicleId);
    return limit ? all.slice(0, limit) : all;
  }

  async findLatest(vehicleId: string) {
    return this.ordenados(vehicleId)[0] ?? null;
  }

  async findById(id: string) {
    return this.rows.get(id) ?? null;
  }

  async create(data: NewOilChange) {
    const row: OilChangeRecord = { ...data, id: `oc${++this.seq}` };
    this.rows.set(row.id, row);
    return row;
  }

  async update(id: string, patch: Partial<NewOilChange>) {
    const row = { ...this.rows.get(id)!, ...patch };
    this.rows.set(id, row);
    return row;
  }

  async remove(id: string) {
    this.rows.delete(id);
  }
}
```

`InMemoryVehicleRepository` e `InMemoryOdometerRepository` siguen el mismo
molde, con `updateCycleMirror` y `updateKmRate` mutando el registro guardado y
`findLatest` ordenando por `readAt` descendente.

- [ ] **Step 4: Verificar que todo compila**

Run: `pnpm build && pnpm test`
Expected: compila y los tests existentes siguen en verde.

- [ ] **Step 5: Commit**

```bash
git add src/modules/oil/domain src/modules/oil/testing src/infra/prisma
git commit -m "feat(aceite): repositorios de vehículo, cambios y lecturas"
```

---

### Task 7: El espejo del ciclo y su invariante

**Files:**
- Create: `src/modules/oil/oil-cycle.service.ts`
- Test: `src/modules/oil/oil-cycle.service.spec.ts`

**Interfaces:**
- Consumes: los tres tokens (Task 6), `addMonths` (Task 3), `computeKmPerDay` (Task 5).
- Produces: `OilCycleService.syncVehicleCycle(vehicleId: string): Promise<void>` y `OilCycleService.recomputeAllCycles(): Promise<number>` (devuelve cuántos vehículos tocó).

Esta es la **protección 2** de la spec. El test de invariante es el entregable
más importante de la tarea: sin él, la decisión de duplicar el ciclo en
`Vehicle` no tiene red.

- [ ] **Step 1: Escribir los tests que fallan**

```ts
// src/modules/oil/oil-cycle.service.spec.ts
import { OilCycleService } from './oil-cycle.service';
import { InMemoryVehicleRepository } from './testing/in-memory-vehicle.repository';
import { InMemoryOilChangeRepository } from './testing/in-memory-oil-change.repository';
import { addMonths } from './domain/dates';

const utc = (s: string) => new Date(s);

describe('espejo del ciclo vigente', () => {
  let vehicles: InMemoryVehicleRepository;
  let changes: InMemoryOilChangeRepository;
  let service: OilCycleService;
  let vehicleId: string;

  const cambio = (fecha: string, km: number, intervalKm = 5_000) => ({
    vehicleId,
    changedAt: utc(fecha),
    km,
    intervalKm,
    intervalMonths: 6,
    oilBrand: 'Pennzoil',
    oilTag: 'Platinum',
    oilViscosity: '5W-30',
    oilSynthetic: true,
    shop: null,
    costUsd: null,
  });

  /** La afirmación del invariante: las cuatro columnas == lo derivado. */
  const esperarEspejoCoherente = async () => {
    const v = (await vehicles.findById(vehicleId))!;
    const ultimo = await changes.findLatest(vehicleId);

    if (!ultimo) {
      expect(v.lastChangeKm).toBeNull();
      expect(v.lastChangeAt).toBeNull();
      expect(v.nextChangeKm).toBeNull();
      expect(v.nextChangeDueAt).toBeNull();
      return;
    }
    expect(v.lastChangeKm).toBe(ultimo.km);
    expect(v.lastChangeAt).toEqual(ultimo.changedAt);
    expect(v.nextChangeKm).toBe(ultimo.km + ultimo.intervalKm);
    expect(v.nextChangeDueAt).toEqual(
      addMonths(ultimo.changedAt, ultimo.intervalMonths),
    );
  };

  beforeEach(async () => {
    vehicles = new InMemoryVehicleRepository();
    changes = new InMemoryOilChangeRepository();
    service = new OilCycleService(vehicles, changes);

    const v = await vehicles.create({
      userId: 'u1',
      kind: 'CAR',
      brand: 'Toyota',
      model: 'Corolla',
      year: 2019,
      plate: 'AB123CD',
      color: '#111111',
      kmPerDay: 30,
    });
    vehicleId = v.id;
  });

  it('al registrar un cambio el espejo queda coherente', async () => {
    await changes.create(cambio('2026-06-04T00:00:00Z', 45_000));
    await service.syncVehicleCycle(vehicleId);
    await esperarEspejoCoherente();
  });

  it('al registrar un segundo cambio el espejo pasa al ciclo nuevo', async () => {
    await changes.create(cambio('2026-02-24T00:00:00Z', 42_000));
    await service.syncVehicleCycle(vehicleId);
    await changes.create(cambio('2026-06-04T00:00:00Z', 45_000));
    await service.syncVehicleCycle(vehicleId);

    const v = (await vehicles.findById(vehicleId))!;
    expect(v.lastChangeKm).toBe(45_000);
    await esperarEspejoCoherente();
  });

  it('al corregir el km del último cambio el espejo lo sigue', async () => {
    // El caso real: puso 48.000 y eran 45.000.
    const c = await changes.create(cambio('2026-06-04T00:00:00Z', 48_000));
    await service.syncVehicleCycle(vehicleId);

    await changes.update(c.id, { km: 45_000 });
    await service.syncVehicleCycle(vehicleId);

    const v = (await vehicles.findById(vehicleId))!;
    expect(v.lastChangeKm).toBe(45_000);
    expect(v.nextChangeKm).toBe(50_000);
    await esperarEspejoCoherente();
  });

  it('editar un cambio VIEJO no mueve el espejo', async () => {
    const viejo = await changes.create(cambio('2026-02-24T00:00:00Z', 42_000));
    await changes.create(cambio('2026-06-04T00:00:00Z', 45_000));
    await service.syncVehicleCycle(vehicleId);

    await changes.update(viejo.id, { km: 41_000 });
    await service.syncVehicleCycle(vehicleId);

    const v = (await vehicles.findById(vehicleId))!;
    expect(v.lastChangeKm).toBe(45_000);
    await esperarEspejoCoherente();
  });

  it('al borrar el último cambio el espejo RETROCEDE al anterior', async () => {
    await changes.create(cambio('2026-02-24T00:00:00Z', 42_000));
    const ultimo = await changes.create(cambio('2026-06-04T00:00:00Z', 45_000));
    await service.syncVehicleCycle(vehicleId);

    await changes.remove(ultimo.id);
    await service.syncVehicleCycle(vehicleId);

    const v = (await vehicles.findById(vehicleId))!;
    expect(v.lastChangeKm).toBe(42_000);
    await esperarEspejoCoherente();
  });

  it('al borrar el único cambio las cuatro columnas vuelven a null', async () => {
    const unico = await changes.create(cambio('2026-06-04T00:00:00Z', 45_000));
    await service.syncVehicleCycle(vehicleId);

    await changes.remove(unico.id);
    await service.syncVehicleCycle(vehicleId);

    await esperarEspejoCoherente();
  });
});

describe('recalibración del ritmo', () => {
  it('con dos cambios medibles el ritmo pasa a MEASURED', async () => {
    const vehicles = new InMemoryVehicleRepository();
    const changes = new InMemoryOilChangeRepository();
    const service = new OilCycleService(vehicles, changes);

    const v = await vehicles.create({
      userId: 'u1',
      kind: 'CAR',
      brand: 'Toyota',
      model: 'Corolla',
      year: 2019,
      plate: 'AB123CD',
      color: '#111111',
      kmPerDay: 99,
    });

    const base = {
      vehicleId: v.id,
      intervalKm: 5_000,
      intervalMonths: 6,
      oilBrand: 'Pennzoil',
      oilTag: 'Platinum',
      oilViscosity: '5W-30',
      oilSynthetic: true,
      shop: null,
      costUsd: null,
    };
    await changes.create({ ...base, changedAt: utc('2026-02-24T00:00:00Z'), km: 42_000 });
    await changes.create({ ...base, changedAt: utc('2026-06-04T00:00:00Z'), km: 45_000 });
    await service.syncVehicleCycle(v.id);

    const actualizado = (await vehicles.findById(v.id))!;
    expect(actualizado.kmPerDaySource).toBe('MEASURED');
    expect(actualizado.kmPerDay).toBeCloseTo(30, 1);
  });
});
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

Run: `pnpm test -- oil-cycle.service.spec`
Expected: FAIL — "Cannot find module './oil-cycle.service'".

- [ ] **Step 3: Escribir la implementación mínima**

```ts
// src/modules/oil/oil-cycle.service.ts
// EL ÚNICO ESCRITOR del espejo del ciclo en Vehicle.
//
// Las cuatro columnas (lastChangeKm, lastChangeAt, nextChangeKm,
// nextChangeDueAt) son derivables de la última fila de OilChange. Se persisten
// por decisión de producto, y el precio de esa duplicación es esta regla: si
// alguna otra ruta las escribe, el espejo puede quedar mintiendo sin que nada
// en la base lo delate. Por eso hay un solo método que las toca y un test de
// invariante que lo vigila (oil-cycle.service.spec.ts).
import { Inject, Injectable } from '@nestjs/common';
import { addMonths } from './domain/dates';
import { computeKmPerDay } from './domain/km-rate';
import {
  OIL_CHANGE_REPOSITORY,
  type OilChangeRepository,
} from './domain/oil-change.repository';
import {
  VEHICLE_REPOSITORY,
  type VehicleRepository,
} from './domain/vehicle.repository';

/** Cuántos cambios bajan de la base para recalibrar: los 3 ciclos que promedia
 *  computeKmPerDay necesitan 4 filas. */
const CAMBIOS_PARA_RECALIBRAR = 4;

@Injectable()
export class OilCycleService {
  constructor(
    @Inject(VEHICLE_REPOSITORY) private readonly vehicles: VehicleRepository,
    @Inject(OIL_CHANGE_REPOSITORY) private readonly changes: OilChangeRepository,
  ) {}

  /**
   * Recalcula el espejo desde la fuente de verdad y lo escribe. Lo llaman las
   * tres rutas que tocan el historial: crear, editar y borrar un cambio.
   */
  async syncVehicleCycle(vehicleId: string): Promise<void> {
    const recientes = await this.changes.findByVehicle(
      vehicleId,
      CAMBIOS_PARA_RECALIBRAR,
    );
    const ultimo = recientes[0] ?? null;

    if (!ultimo) {
      // Se borró el único cambio: el espejo vuelve a null. Dejarlo apuntando a
      // un ciclo que ya no existe es justo la mentira que esto evita.
      await this.vehicles.updateCycleMirror(vehicleId, {
        lastChangeKm: null,
        lastChangeAt: null,
        nextChangeKm: null,
        nextChangeDueAt: null,
      });
      return;
    }

    await this.vehicles.updateCycleMirror(vehicleId, {
      lastChangeKm: ultimo.km,
      lastChangeAt: ultimo.changedAt,
      nextChangeKm: ultimo.km + ultimo.intervalKm,
      nextChangeDueAt: addMonths(ultimo.changedAt, ultimo.intervalMonths),
    });

    const vehicle = await this.vehicles.findById(vehicleId);
    if (!vehicle) return;

    const ritmo = computeKmPerDay(recientes, vehicle.kmPerDay);
    if (ritmo !== vehicle.kmPerDay) {
      await this.vehicles.updateKmRate(vehicleId, ritmo, 'MEASURED');
    }
  }

  /**
   * Comando de mantenimiento. Si el espejo se desincroniza alguna vez (una
   * migración, un arreglo a mano en producción), se repara con esto y no con
   * un UPDATE manual. Devuelve cuántos vehículos recorrió.
   */
  async recomputeAllCycles(): Promise<number> {
    const ids = await this.vehicles.listAllIds();
    for (const id of ids) await this.syncVehicleCycle(id);
    return ids.length;
  }
}
```

- [ ] **Step 4: Correr los tests para verificar que pasan**

Run: `pnpm test -- oil-cycle.service.spec`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/modules/oil/oil-cycle.service.ts src/modules/oil/oil-cycle.service.spec.ts
git commit -m "feat(aceite): escritor único del espejo del ciclo, con invariante"
```

---

### Task 8: Errores y alta de vehículo

**Files:**
- Modify: `src/common/errors.ts`
- Create: `src/modules/oil/dto/create-vehicle.dto.ts`, `src/modules/oil/dto/vehicle-response.dto.ts`
- Create: `src/modules/oil/oil.service.ts` (primera versión: alta y búsqueda con alcance)
- Create: `src/modules/oil/vehicles.controller.ts`, `src/modules/oil/oil.module.ts`
- Modify: `src/app.module.ts`
- Test: `src/modules/oil/oil.service.spec.ts`

**Interfaces:**
- Consumes: tokens de Task 6, `JwtAuthGuard` y `@CurrentUser()` existentes.
- Produces: `Errors.vehicleNotFound()`, `Errors.odometerBackwards()`, `Errors.odometerImplausible()`, `Errors.oilChangeBackwards()`; `OilService.createVehicle(userId, dto)`, `OilService.getOwnedVehicle(userId, vehicleId)`; `POST /vehicles`, `GET /vehicles`.

- [ ] **Step 1: Agregar los cuatro errores**

Al final del objeto `Errors` en `src/common/errors.ts`:

```ts
  // 404 y no 403 a propósito: un 403 confirmaría que ese id existe y es de
  // otro. Para quien pregunta por un vehículo ajeno, no existe y punto.
  vehicleNotFound: () =>
    new AppError(
      HttpStatus.NOT_FOUND,
      'VEHICLE_NOT_FOUND',
      'Ese vehículo no está en tu garaje.',
    ),

  odometerBackwards: () =>
    new AppError(
      HttpStatus.UNPROCESSABLE_ENTITY,
      'ODOMETER_BACKWARDS',
      'El odómetro no puede ser menor que la última lectura registrada.',
    ),

  // El salto imposible casi siempre es un dígito de más. Rechazarlo acá evita
  // que entre a la base y envenene la estimación de los ciclos siguientes.
  odometerImplausible: () =>
    new AppError(
      HttpStatus.UNPROCESSABLE_ENTITY,
      'ODOMETER_IMPLAUSIBLE',
      'Ese kilometraje es demasiado alto para el tiempo transcurrido. Revísalo.',
    ),

  oilChangeBackwards: () =>
    new AppError(
      HttpStatus.UNPROCESSABLE_ENTITY,
      'OIL_CHANGE_BACKWARDS',
      'El kilometraje del cambio no puede ser menor que el del cambio anterior.',
    ),
```

- [ ] **Step 2: Escribir el test que falla**

```ts
// src/modules/oil/oil.service.spec.ts
import { OilService } from './oil.service';
import { OilCycleService } from './oil-cycle.service';
import { InMemoryVehicleRepository } from './testing/in-memory-vehicle.repository';
import { InMemoryOilChangeRepository } from './testing/in-memory-oil-change.repository';
import { InMemoryOdometerRepository } from './testing/in-memory-odometer.repository';

const nuevoVehiculo = {
  kind: 'CAR' as const,
  brand: 'Toyota',
  model: 'Corolla',
  year: 2019,
  plate: 'AB123CD',
  color: '#111111',
  kmPerDay: 30,
};

describe('OilService — alcance por usuario', () => {
  let service: OilService;
  let vehicles: InMemoryVehicleRepository;

  beforeEach(() => {
    vehicles = new InMemoryVehicleRepository();
    const changes = new InMemoryOilChangeRepository();
    const odometer = new InMemoryOdometerRepository();
    service = new OilService(
      vehicles,
      changes,
      odometer,
      new OilCycleService(vehicles, changes),
    );
  });

  it('crea el vehículo con el ritmo declarado', async () => {
    const v = await service.createVehicle('u1', nuevoVehiculo);
    expect(v.kmPerDay).toBe(30);
    expect(v.kmPerDaySource).toBe('DECLARED');
  });

  it('el vehículo de otro usuario responde VEHICLE_NOT_FOUND', async () => {
    const v = await service.createVehicle('u1', nuevoVehiculo);
    await expect(service.getOwnedVehicle('u2', v.id)).rejects.toMatchObject({
      response: { error: 'VEHICLE_NOT_FOUND' },
    });
  });

  it('un id inexistente responde VEHICLE_NOT_FOUND', async () => {
    await expect(
      service.getOwnedVehicle('u1', 'no-existe'),
    ).rejects.toMatchObject({ response: { error: 'VEHICLE_NOT_FOUND' } });
  });
});
```

- [ ] **Step 3: Correr el test para verificar que falla**

Run: `pnpm test -- oil.service.spec`
Expected: FAIL — "Cannot find module './oil.service'".

- [ ] **Step 4: Escribir el servicio, el DTO, el controlador y el módulo**

```ts
// src/modules/oil/oil.service.ts
import { Inject, Injectable } from '@nestjs/common';
import { Errors } from '../../common/errors';
import { OilCycleService } from './oil-cycle.service';
import {
  OIL_CHANGE_REPOSITORY,
  type OilChangeRepository,
} from './domain/oil-change.repository';
import {
  ODOMETER_REPOSITORY,
  type OdometerRepository,
} from './domain/odometer.repository';
import {
  VEHICLE_REPOSITORY,
  type NewVehicle,
  type Vehicle,
  type VehicleRepository,
} from './domain/vehicle.repository';

@Injectable()
export class OilService {
  constructor(
    @Inject(VEHICLE_REPOSITORY) private readonly vehicles: VehicleRepository,
    @Inject(OIL_CHANGE_REPOSITORY) private readonly changes: OilChangeRepository,
    @Inject(ODOMETER_REPOSITORY) private readonly odometer: OdometerRepository,
    private readonly cycle: OilCycleService,
  ) {}

  /** Toda ruta que reciba un :id de vehículo pasa por acá primero. */
  async getOwnedVehicle(userId: string, vehicleId: string): Promise<Vehicle> {
    const v = await this.vehicles.findById(vehicleId);
    if (!v || v.userId !== userId) throw Errors.vehicleNotFound();
    return v;
  }

  async createVehicle(
    userId: string,
    data: Omit<NewVehicle, 'userId'>,
  ): Promise<Vehicle> {
    return this.vehicles.create({ ...data, userId });
  }

  async listVehicles(userId: string): Promise<Vehicle[]> {
    return this.vehicles.findByUser(userId);
  }
}
```

```ts
// src/modules/oil/dto/create-vehicle.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import {
  IsHexColor, IsIn, IsInt, IsNumber, IsString, Length, Max, Min,
} from 'class-validator';
import { KM_PER_DAY_MAX, KM_PER_DAY_MIN } from '../domain/oil-status';

export class CreateVehicleDto {
  @ApiProperty({ enum: ['CAR', 'MOTO'] })
  @IsIn(['CAR', 'MOTO'])
  kind!: 'CAR' | 'MOTO';

  @ApiProperty() @IsString() @Length(1, 40) brand!: string;
  @ApiProperty() @IsString() @Length(1, 40) model!: string;

  @ApiProperty() @IsInt() @Min(1950) @Max(2100) year!: number;

  @ApiProperty() @IsString() @Length(4, 10) plate!: string;
  @ApiProperty({ example: '#1E88E5' }) @IsHexColor() color!: string;

  @ApiProperty({
    minimum: KM_PER_DAY_MIN,
    maximum: KM_PER_DAY_MAX,
    description:
      'Ritmo de uso declarado, en km/día. Arranca la estimación del odómetro y se recalibra solo con cada ciclo medido.',
  })
  @IsNumber()
  @Min(KM_PER_DAY_MIN)
  @Max(KM_PER_DAY_MAX)
  kmPerDay!: number;
}
```

```ts
// src/modules/oil/vehicles.controller.ts
// Solo HTTP: recibe DTO, delega, devuelve DTO. Cero reglas de negocio.
import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { User } from '../users/domain/user';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { toVehicleResponse, VehicleResponseDto } from './dto/vehicle-response.dto';
import { OilService } from './oil.service';

@ApiTags('Vehículos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('vehicles')
export class VehiclesController {
  constructor(private readonly oil: OilService) {}

  @ApiOperation({ summary: 'Listar los vehículos del usuario' })
  @ApiOkResponse({ type: [VehicleResponseDto] })
  @Get()
  async list(@CurrentUser() user: User) {
    const vehicles = await this.oil.listVehicles(user.id);
    return vehicles.map(toVehicleResponse);
  }

  @ApiOperation({ summary: 'Dar de alta un vehículo' })
  @ApiCreatedResponse({ type: VehicleResponseDto })
  @Post()
  async create(@CurrentUser() user: User, @Body() dto: CreateVehicleDto) {
    return toVehicleResponse(await this.oil.createVehicle(user.id, dto));
  }
}
```

```ts
// src/modules/oil/dto/vehicle-response.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import type { Vehicle } from '../domain/vehicle.repository';

export class VehicleResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: ['CAR', 'MOTO'] }) kind!: 'CAR' | 'MOTO';
  @ApiProperty() brand!: string;
  @ApiProperty() model!: string;
  @ApiProperty() year!: number;
  @ApiProperty() plate!: string;
  @ApiProperty() color!: string;
  @ApiProperty({ description: 'Ritmo de uso vigente, en km/día.' })
  kmPerDay!: number;
  @ApiProperty({ enum: ['DECLARED', 'MEASURED'] })
  kmPerDaySource!: 'DECLARED' | 'MEASURED';
  @ApiProperty({ nullable: true }) lastChangeKm!: number | null;
  @ApiProperty({ nullable: true }) nextChangeKm!: number | null;
}

/** El userId no sale: el cliente ya sabe de quién es, y exponerlo solo da
 *  material para adivinar ids de otros. */
export function toVehicleResponse(v: Vehicle): VehicleResponseDto {
  return {
    id: v.id,
    kind: v.kind,
    brand: v.brand,
    model: v.model,
    year: v.year,
    plate: v.plate,
    color: v.color,
    kmPerDay: v.kmPerDay,
    kmPerDaySource: v.kmPerDaySource,
    lastChangeKm: v.lastChangeKm,
    nextChangeKm: v.nextChangeKm,
  };
}
```

```ts
// src/modules/oil/oil.module.ts
import { Module } from '@nestjs/common';
import { PrismaOilChangeRepository } from '../../infra/prisma/prisma-oil-change.repository';
import { PrismaOdometerRepository } from '../../infra/prisma/prisma-odometer.repository';
import { PrismaVehicleRepository } from '../../infra/prisma/prisma-vehicle.repository';
import { OIL_CHANGE_REPOSITORY } from './domain/oil-change.repository';
import { ODOMETER_REPOSITORY } from './domain/odometer.repository';
import { VEHICLE_REPOSITORY } from './domain/vehicle.repository';
import { OilCycleService } from './oil-cycle.service';
import { OilService } from './oil.service';
import { VehiclesController } from './vehicles.controller';

@Module({
  controllers: [VehiclesController],
  providers: [
    OilService,
    OilCycleService,
    // Mismo criterio que UsersModule: los servicios piden el token, nunca la
    // clase concreta. Cambiar de motor es cambiar estos useClass.
    { provide: VEHICLE_REPOSITORY, useClass: PrismaVehicleRepository },
    { provide: OIL_CHANGE_REPOSITORY, useClass: PrismaOilChangeRepository },
    { provide: ODOMETER_REPOSITORY, useClass: PrismaOdometerRepository },
  ],
})
export class OilModule {}
```

Y en `src/app.module.ts`, agregar `OilModule` a `imports` junto a `AuthModule`.

- [ ] **Step 5: Correr los tests para verificar que pasan**

Run: `pnpm test -- oil.service.spec && pnpm build`
Expected: PASS, 3 tests; compila.

- [ ] **Step 6: Commit**

```bash
git add src/common/errors.ts src/modules/oil src/app.module.ts
git commit -m "feat(aceite): alta y listado de vehículos con alcance por usuario"
```

---

### Task 9: Registrar, editar y borrar cambios de aceite

**Files:**
- Create: `src/modules/oil/dto/create-oil-change.dto.ts`
- Modify: `src/modules/oil/oil.service.ts`, `src/modules/oil/vehicles.controller.ts`
- Test: `src/modules/oil/oil-changes.service.spec.ts`

**Interfaces:**
- Consumes: `OilService.getOwnedVehicle` (Task 8), `OilCycleService.syncVehicleCycle` (Task 7).
- Produces: `OilService.registerOilChange(userId, vehicleId, dto)`, `OilService.updateOilChange(userId, changeId, patch)`, `OilService.removeOilChange(userId, changeId)`; `POST/PATCH/DELETE` bajo `/vehicles/:id/oil-changes`.

La regla clave: **cada cambio escribe también una lectura de odómetro**
(`source: OIL_CHANGE`) y **siempre** llama a `syncVehicleCycle` después.

- [ ] **Step 1: Escribir los tests que fallan**

```ts
// src/modules/oil/oil-changes.service.spec.ts
import { OilService } from './oil.service';
import { OilCycleService } from './oil-cycle.service';
import { InMemoryVehicleRepository } from './testing/in-memory-vehicle.repository';
import { InMemoryOilChangeRepository } from './testing/in-memory-oil-change.repository';
import { InMemoryOdometerRepository } from './testing/in-memory-odometer.repository';

const utc = (s: string) => new Date(s);

const dto = (km: number, fecha: string) => ({
  changedAt: utc(fecha),
  km,
  intervalKm: 5_000,
  intervalMonths: 6,
  oilBrand: 'Pennzoil',
  oilTag: 'Platinum',
  oilViscosity: '5W-30',
  oilSynthetic: true,
  shop: 'Lubricentro El Rápido',
  costUsd: 32,
});

describe('registrar un cambio de aceite', () => {
  let service: OilService;
  let odometer: InMemoryOdometerRepository;
  let vehicles: InMemoryVehicleRepository;
  let vehicleId: string;

  beforeEach(async () => {
    vehicles = new InMemoryVehicleRepository();
    const changes = new InMemoryOilChangeRepository();
    odometer = new InMemoryOdometerRepository();
    service = new OilService(
      vehicles, changes, odometer, new OilCycleService(vehicles, changes),
    );
    const v = await service.createVehicle('u1', {
      kind: 'CAR', brand: 'Toyota', model: 'Corolla', year: 2019,
      plate: 'AB123CD', color: '#111111', kmPerDay: 30,
    });
    vehicleId = v.id;
  });

  it('deja el espejo del ciclo actualizado', async () => {
    await service.registerOilChange('u1', vehicleId, dto(45_000, '2026-06-04T00:00:00Z'));
    const v = (await vehicles.findById(vehicleId))!;
    expect(v.lastChangeKm).toBe(45_000);
    expect(v.nextChangeKm).toBe(50_000);
  });

  it('escribe también una lectura de odómetro con source OIL_CHANGE', async () => {
    await service.registerOilChange('u1', vehicleId, dto(45_000, '2026-06-04T00:00:00Z'));
    const lectura = await odometer.findLatest(vehicleId);
    expect(lectura).toMatchObject({ km: 45_000, source: 'OIL_CHANGE' });
  });

  it('rechaza un km menor que el del cambio anterior', async () => {
    await service.registerOilChange('u1', vehicleId, dto(45_000, '2026-06-04T00:00:00Z'));
    await expect(
      service.registerOilChange('u1', vehicleId, dto(44_000, '2026-09-04T00:00:00Z')),
    ).rejects.toMatchObject({ response: { error: 'OIL_CHANGE_BACKWARDS' } });
  });

  it('no deja registrar en el vehículo de otro', async () => {
    await expect(
      service.registerOilChange('u2', vehicleId, dto(45_000, '2026-06-04T00:00:00Z')),
    ).rejects.toMatchObject({ response: { error: 'VEHICLE_NOT_FOUND' } });
  });

  it('al borrar el último cambio el espejo retrocede', async () => {
    await service.registerOilChange('u1', vehicleId, dto(42_000, '2026-02-24T00:00:00Z'));
    const ultimo = await service.registerOilChange('u1', vehicleId, dto(45_000, '2026-06-04T00:00:00Z'));

    await service.removeOilChange('u1', ultimo.id);

    const v = (await vehicles.findById(vehicleId))!;
    expect(v.lastChangeKm).toBe(42_000);
  });
});
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

Run: `pnpm test -- oil-changes.service.spec`
Expected: FAIL — `service.registerOilChange is not a function`.

- [ ] **Step 3: Agregar los métodos a `OilService`**

```ts
  /**
   * Registra un cambio y deja el mundo coherente: escribe la lectura de
   * odómetro que el cambio implica y resincroniza el espejo del ciclo.
   *
   * Las tres escrituras van juntas a propósito: un cambio sin su lectura deja
   * la proyección anclada a un odómetro viejo, y un cambio sin sync deja la
   * ficha del vehículo mintiendo.
   */
  async registerOilChange(
    userId: string,
    vehicleId: string,
    data: Omit<NewOilChange, 'vehicleId'>,
  ): Promise<OilChangeRecord> {
    await this.getOwnedVehicle(userId, vehicleId);

    const anterior = await this.changes.findLatest(vehicleId);
    if (anterior && data.km < anterior.km) throw Errors.oilChangeBackwards();

    const creado = await this.changes.create({ ...data, vehicleId });
    await this.odometer.create({
      vehicleId,
      km: data.km,
      readAt: data.changedAt,
      source: 'OIL_CHANGE',
    });
    await this.cycle.syncVehicleCycle(vehicleId);
    return creado;
  }

  async updateOilChange(
    userId: string,
    changeId: string,
    patch: Partial<Omit<NewOilChange, 'vehicleId'>>,
  ): Promise<OilChangeRecord> {
    const existente = await this.changes.findById(changeId);
    if (!existente) throw Errors.vehicleNotFound();
    await this.getOwnedVehicle(userId, existente.vehicleId);

    const actualizado = await this.changes.update(changeId, patch);
    await this.cycle.syncVehicleCycle(existente.vehicleId);
    return actualizado;
  }

  async removeOilChange(userId: string, changeId: string): Promise<void> {
    const existente = await this.changes.findById(changeId);
    if (!existente) throw Errors.vehicleNotFound();
    await this.getOwnedVehicle(userId, existente.vehicleId);

    await this.changes.remove(changeId);
    await this.cycle.syncVehicleCycle(existente.vehicleId);
  }
```

- [ ] **Step 4: Agregar el DTO y las rutas al controlador**

`CreateOilChangeDto` con `@IsDate()` sobre `changedAt` (más
`@Type(() => Date)` de class-transformer), `@IsInt() @Min(0)` en `km`,
`@IsInt() @Min(500) @Max(50_000)` en `intervalKm`, `@IsInt() @Min(1) @Max(36)`
en `intervalMonths`, los cuatro campos del aceite y `shop`/`costUsd`
opcionales. En `VehiclesController`:

```ts
  @ApiOperation({ summary: 'Registrar un cambio de aceite' })
  @Post(':id/oil-changes')
  async registerChange(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateOilChangeDto,
  ) {
    return this.oil.registerOilChange(user.id, id, dto);
  }

  @ApiOperation({ summary: 'Corregir un cambio de aceite' })
  @Patch('oil-changes/:changeId')
  async updateChange(
    @CurrentUser() user: User,
    @Param('changeId', ParseUUIDPipe) changeId: string,
    @Body() dto: UpdateOilChangeDto,
  ) {
    return this.oil.updateOilChange(user.id, changeId, dto);
  }

  @ApiOperation({ summary: 'Borrar un cambio de aceite' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete('oil-changes/:changeId')
  async removeChange(
    @CurrentUser() user: User,
    @Param('changeId', ParseUUIDPipe) changeId: string,
  ) {
    await this.oil.removeOilChange(user.id, changeId);
  }
```

`UpdateOilChangeDto` es `PartialType(CreateOilChangeDto)` de `@nestjs/swagger`.

- [ ] **Step 5: Correr los tests para verificar que pasan**

Run: `pnpm test -- oil-changes.service.spec && pnpm build`
Expected: PASS, 5 tests; compila.

- [ ] **Step 6: Commit**

```bash
git add src/modules/oil
git commit -m "feat(aceite): registrar, corregir y borrar cambios de aceite"
```

---

### Task 10: `GET /vehicles/:id/oil-status`

**Files:**
- Create: `src/modules/oil/dto/oil-status-response.dto.ts`
- Modify: `src/modules/oil/oil.service.ts`, `src/modules/oil/vehicles.controller.ts`
- Test: `src/modules/oil/oil-status.service.spec.ts`

**Interfaces:**
- Consumes: `computeOilStatus` (Task 4), `getOwnedVehicle` (Task 8).
- Produces: `OilService.getOilStatus(userId, vehicleId, now?): Promise<OilStatusResponse>` y la ruta `GET /vehicles/:id/oil-status`.

El `now` opcional existe **para los tests**: en producción no se pasa y sale
`new Date()`. Es la única forma de probar "el 2 de diciembre esto está en rojo"
sin tocar el reloj del proceso.

- [ ] **Step 1: Escribir los tests que fallan**

```ts
// src/modules/oil/oil-status.service.spec.ts
// (mismo armado de repositorios en memoria que oil-changes.service.spec.ts)
describe('GET oil-status', () => {
  it('arma el bloque completo desde el último cambio', async () => {
    await service.registerOilChange('u1', vehicleId, dto(45_000, '2026-06-04T00:00:00Z'));

    const r = await service.getOilStatus('u1', vehicleId, utc('2026-07-04T00:00:00Z'));

    expect(r.gauge).toMatchObject({ limitedBy: 'km', status: 'ok' });
    expect(r.odometer).toMatchObject({ km: 45_900, source: 'estimated' });
    expect(r.cycle).toMatchObject({
      lastChangeKm: 45_000,
      nextChangeKm: 50_000,
      intervalKm: 5_000,
      intervalMonths: 6,
    });
    expect(r.oil).toMatchObject({ brand: 'Pennzoil', viscosity: '5W-30' });
    expect(r.computedAt).toEqual(utc('2026-07-04T00:00:00Z'));
  });

  it('un vehículo sin cambios devuelve gauge, cycle y oil en null', async () => {
    const r = await service.getOilStatus('u1', vehicleId, utc('2026-07-04T00:00:00Z'));
    expect(r.gauge).toBeNull();
    expect(r.cycle).toBeNull();
    expect(r.oil).toBeNull();
    expect(r.odometer).toBeNull();
  });

  it('no devuelve el estado de un vehículo ajeno', async () => {
    await expect(
      service.getOilStatus('u2', vehicleId, utc('2026-07-04T00:00:00Z')),
    ).rejects.toMatchObject({ response: { error: 'VEHICLE_NOT_FOUND' } });
  });
});
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

Run: `pnpm test -- oil-status.service.spec`
Expected: FAIL — `service.getOilStatus is not a function`.

- [ ] **Step 3: Implementar el método**

```ts
  /**
   * @param now solo para tests. En producción no se pasa: probar "el 2 de
   *            diciembre esto está en rojo" no puede depender del reloj del
   *            proceso.
   */
  async getOilStatus(
    userId: string,
    vehicleId: string,
    now: Date = new Date(),
  ): Promise<OilStatusResponse> {
    const vehicle = await this.getOwnedVehicle(userId, vehicleId);
    const ultimo = await this.changes.findLatest(vehicleId);
    const lectura = await this.odometer.findLatest(vehicleId);

    const status = computeOilStatus({
      now,
      kmPerDay: vehicle.kmPerDay,
      lastReading: lectura ? { km: lectura.km, readAt: lectura.readAt } : null,
      cycle: ultimo
        ? {
            km: ultimo.km,
            changedAt: ultimo.changedAt,
            intervalKm: ultimo.intervalKm,
            intervalMonths: ultimo.intervalMonths,
          }
        : null,
    });

    return {
      vehicleId,
      computedAt: status.computedAt,
      gauge: status.gauge,
      odometer: status.odometer,
      // El ciclo sale del espejo del vehículo, que es lo que la decisión 6 de
      // la spec existe para poder leer sin derivar.
      cycle: ultimo
        ? {
            lastChangeKm: vehicle.lastChangeKm,
            lastChangeAt: vehicle.lastChangeAt,
            nextChangeKm: vehicle.nextChangeKm,
            nextChangeDueAt: vehicle.nextChangeDueAt,
            intervalKm: ultimo.intervalKm,
            intervalMonths: ultimo.intervalMonths,
          }
        : null,
      oil: ultimo
        ? {
            brand: ultimo.oilBrand,
            tag: ultimo.oilTag,
            viscosity: ultimo.oilViscosity,
            synthetic: ultimo.oilSynthetic,
          }
        : null,
    };
  }
```

`oil-status-response.dto.ts` declara `OilStatusResponse` y las clases
`GaugeDto`, `OdometerDto`, `CycleDto` y `OilDto` con `@ApiProperty`, para que
Swagger muestre el bloque completo. `limitedBy` se documenta con
`enum: ['km', 'time']` y la descripción de para qué sirve (qué eje pinta el
centro del medidor).

- [ ] **Step 4: Agregar la ruta**

```ts
  @ApiOperation({
    summary: 'Estado del aceite del vehículo',
    description: [
      'Devuelve el bloque completo del inicio en una sola llamada: medidor,',
      'odómetro (real o estimado), ciclo vigente y aceite montado.',
      '',
      'El odómetro se **proyecta** desde la última lectura real con el ritmo',
      'de km/día del vehículo cuando no hay una lectura de hoy: `source` dice',
      'cuál de los dos casos es, y la app lo muestra distinto.',
    ].join('\n'),
  })
  @ApiOkResponse({ type: OilStatusResponseDto })
  @Get(':id/oil-status')
  async oilStatus(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.oil.getOilStatus(user.id, id);
  }
```

- [ ] **Step 5: Correr los tests para verificar que pasan**

Run: `pnpm test -- oil-status.service.spec && pnpm build`
Expected: PASS, 3 tests; compila.

- [ ] **Step 6: Commit**

```bash
git add src/modules/oil
git commit -m "feat(aceite): endpoint de estado del aceite en un solo bloque"
```

---

### Task 11: `POST /vehicles/:id/odometer`

**Files:**
- Create: `src/modules/oil/dto/create-odometer-reading.dto.ts`
- Modify: `src/modules/oil/oil.service.ts`, `src/modules/oil/vehicles.controller.ts`
- Test: `src/modules/oil/odometer.service.spec.ts`

**Interfaces:**
- Consumes: `getOwnedVehicle` (Task 8), `getOilStatus` (Task 10), `KM_PER_DAY_MAX` (Task 2), `daysBetween` (Task 3).
- Produces: `OilService.reportOdometer(userId, vehicleId, km, now?)`, que devuelve el mismo `OilStatusResponse` ya recalculado.

- [ ] **Step 1: Escribir los tests que fallan**

```ts
// src/modules/oil/odometer.service.spec.ts
describe('reportar el odómetro', () => {
  beforeEach(async () => {
    await service.registerOilChange('u1', vehicleId, dto(45_000, '2026-06-04T00:00:00Z'));
  });

  it('reancla la estimación y devuelve el bloque recalculado', async () => {
    const r = await service.reportOdometer(
      'u1', vehicleId, 47_250, utc('2026-07-04T00:00:00Z'),
    );
    expect(r.odometer).toMatchObject({ km: 47_250, source: 'reported' });
    expect(r.gauge?.kmLeft).toBe(2_750);
  });

  it('rechaza una lectura menor que la última', async () => {
    await expect(
      service.reportOdometer('u1', vehicleId, 44_000, utc('2026-07-04T00:00:00Z')),
    ).rejects.toMatchObject({ response: { error: 'ODOMETER_BACKWARDS' } });
  });

  it('rechaza un salto imposible', async () => {
    // 30 días después: más de 500 km/día es un dígito de más.
    await expect(
      service.reportOdometer('u1', vehicleId, 200_000, utc('2026-07-04T00:00:00Z')),
    ).rejects.toMatchObject({ response: { error: 'ODOMETER_IMPLAUSIBLE' } });
  });

  it('acepta el salto justo en el borde de 500 km/día', async () => {
    const r = await service.reportOdometer(
      'u1', vehicleId, 45_000 + 500 * 30, utc('2026-07-04T00:00:00Z'),
    );
    expect(r.odometer?.km).toBe(60_000);
  });

  it('no deja reportar en el vehículo de otro', async () => {
    await expect(
      service.reportOdometer('u2', vehicleId, 46_000, utc('2026-07-04T00:00:00Z')),
    ).rejects.toMatchObject({ response: { error: 'VEHICLE_NOT_FOUND' } });
  });
});
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

Run: `pnpm test -- odometer.service.spec`
Expected: FAIL — `service.reportOdometer is not a function`.

- [ ] **Step 3: Implementar el método**

```ts
  /**
   * La lectura manual: la puerta que le dejamos abierta al usuario para el día
   * que SÍ mire el tablero. No se la exigimos —ese es justo el dato que no
   * tiene a mano—, pero cuando llega, la estimación deja de acumular error.
   */
  async reportOdometer(
    userId: string,
    vehicleId: string,
    km: number,
    now: Date = new Date(),
  ): Promise<OilStatusResponse> {
    await this.getOwnedVehicle(userId, vehicleId);

    const anterior = await this.odometer.findLatest(vehicleId);
    if (anterior) {
      if (km < anterior.km) throw Errors.odometerBackwards();

      const dias = Math.max(daysBetween(anterior.readAt, now), 1 / 24);
      if ((km - anterior.km) / dias > KM_PER_DAY_MAX) {
        throw Errors.odometerImplausible();
      }
    }

    await this.odometer.create({ vehicleId, km, readAt: now, source: 'MANUAL' });
    return this.getOilStatus(userId, vehicleId, now);
  }
```

El piso de `1/24` en los días evita que dos lecturas en el mismo minuto den una
división cercana a cero y disparen `ODOMETER_IMPLAUSIBLE` por un salto normal.

- [ ] **Step 4: Agregar el DTO y la ruta**

```ts
// src/modules/oil/dto/create-odometer-reading.dto.ts
export class CreateOdometerReadingDto {
  @ApiProperty({ example: 47250, description: 'Lectura del tablero, en km.' })
  @IsInt()
  @Min(0)
  @Max(2_000_000)
  km!: number;
}
```

```ts
  @ApiOperation({
    summary: 'Reportar una lectura del odómetro',
    description:
      'Reancla la estimación a la realidad y devuelve el bloque de estado ya recalculado.',
  })
  @ApiOkResponse({ type: OilStatusResponseDto })
  @Post(':id/odometer')
  async reportOdometer(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateOdometerReadingDto,
  ) {
    return this.oil.reportOdometer(user.id, id, dto.km);
  }
```

- [ ] **Step 5: Correr los tests para verificar que pasan**

Run: `pnpm test && pnpm build`
Expected: toda la suite en verde; compila.

- [ ] **Step 6: Commit**

```bash
git add src/modules/oil
git commit -m "feat(aceite): lectura manual del odómetro que reancla la estimación"
```

---

### Task 12: E2E de los endpoints

**Files:**
- Create: `test/oil.e2e-spec.ts`

**Interfaces:**
- Consumes: todas las rutas anteriores.
- Produces: nada que consuman otras tareas.

- [ ] **Step 1: Escribir el e2e**

Siguiendo el molde de los e2e existentes en `test/`: levanta la app con
`Test.createTestingModule({ imports: [AppModule] })`, registra un usuario vía
`/auth/register` para obtener el `accessToken`, y desde ahí:

```ts
describe('Estado del aceite (e2e)', () => {
  it('flujo completo: alta, cambio, estado, lectura manual', async () => {
    const { body: vehiculo } = await request(app.getHttpServer())
      .post('/vehicles')
      .set('Authorization', `Bearer ${token}`)
      .send({
        kind: 'CAR', brand: 'Toyota', model: 'Corolla', year: 2019,
        plate: 'AB123CD', color: '#111111', kmPerDay: 40,
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/vehicles/${vehiculo.id}/oil-changes`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        changedAt: '2026-06-04T00:00:00.000Z', km: 45000,
        intervalKm: 5000, intervalMonths: 6,
        oilBrand: 'Pennzoil', oilTag: 'Platinum',
        oilViscosity: '5W-30', oilSynthetic: true,
      })
      .expect(201);

    const { body: estado } = await request(app.getHttpServer())
      .get(`/vehicles/${vehiculo.id}/oil-status`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(estado.cycle.nextChangeKm).toBe(50000);
    expect(estado.oil.viscosity).toBe('5W-30');
    expect(['km', 'time']).toContain(estado.gauge.limitedBy);

    const { body: reanclado } = await request(app.getHttpServer())
      .post(`/vehicles/${vehiculo.id}/odometer`)
      .set('Authorization', `Bearer ${token}`)
      .send({ km: 47250 })
      .expect(201);

    expect(reanclado.odometer).toMatchObject({ km: 47250, source: 'reported' });
  });

  it('el vehículo de otro usuario responde 404 VEHICLE_NOT_FOUND', async () => {
    // registrar un segundo usuario y pedir el vehículo del primero
    const { body } = await request(app.getHttpServer())
      .get(`/vehicles/${vehiculoDelPrimero.id}/oil-status`)
      .set('Authorization', `Bearer ${tokenDelSegundo}`)
      .expect(404);
    expect(body.error).toBe('VEHICLE_NOT_FOUND');
  });

  it('una lectura hacia atrás responde 422 ODOMETER_BACKWARDS', async () => {
    const { body } = await request(app.getHttpServer())
      .post(`/vehicles/${vehiculo.id}/odometer`)
      .set('Authorization', `Bearer ${token}`)
      .send({ km: 100 })
      .expect(422);
    expect(body.error).toBe('ODOMETER_BACKWARDS');
  });

  it('sin token responde 401', async () => {
    await request(app.getHttpServer())
      .get(`/vehicles/${vehiculo.id}/oil-status`)
      .expect(401);
  });
});
```

- [ ] **Step 2: Correr el e2e**

Run: `pnpm db:up && pnpm test:e2e -- oil`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add test/oil.e2e-spec.ts
git commit -m "test(aceite): e2e del flujo completo de estado del aceite"
```

---

# FASE B — App móvil

La fase B consume el contrato de la fase A. Puede ejecutarse como plan aparte
si conviene cortar ahí.

### Task 13: Cliente HTTP del recurso

**Files:**
- Create: `src/api/controllers/oil-status.controller.ts` (en `app-mobile/`)
- Test: `src/api/__tests__/oil-status.controller.test.ts`

**Interfaces:**
- Consumes: `ApiClient` de `src/api/base.ts`.
- Produces: `oilStatusApi.get(vehicleId)`, `oilStatusApi.reportOdometer(vehicleId, km)` y los tipos `OilStatusResponse`, `Gauge`, `Odometer`, `Cycle`, `Oil`.

- [ ] **Step 1: Escribir el cliente**

```ts
// app-mobile/src/api/controllers/oil-status.controller.ts
// Endpoints del estado del aceite. Un archivo por recurso, nombrado
// <recurso>.controller.ts.
import { ApiClient } from '../base';

export type OilStatusLevel = 'ok' | 'warn' | 'danger';
export type LimitedBy = 'km' | 'time';

export type Gauge = {
  pct: number;
  status: OilStatusLevel;
  /** Qué eje pinta el centro del medidor: km restantes o días restantes. */
  limitedBy: LimitedBy;
  kmLeft: number;
  daysLeft: number;
};

export type Odometer = {
  km: number;
  /** 'estimated' se muestra con tilde y es tocable para corregirlo. */
  source: 'reported' | 'estimated';
  asOf: string;
};

export type Cycle = {
  lastChangeKm: number;
  lastChangeAt: string;
  nextChangeKm: number;
  nextChangeDueAt: string;
  intervalKm: number;
  intervalMonths: number;
};

export type Oil = {
  brand: string;
  tag: string;
  viscosity: string;
  synthetic: boolean;
};

export type OilStatusResponse = {
  vehicleId: string;
  /** Si tiene más de un día, la tarjeta lo marca como desactualizado en vez de
   *  fingir que el número es de ahora. */
  computedAt: string;
  gauge: Gauge | null;
  odometer: Odometer | null;
  cycle: Cycle | null;
  oil: Oil | null;
};

class OilStatusController extends ApiClient {
  constructor() {
    super('/vehicles');
  }

  get(vehicleId: string) {
    return this.get<OilStatusResponse>(`/${vehicleId}/oil-status`, { auth: true });
  }

  reportOdometer(vehicleId: string, km: number) {
    return this.post<OilStatusResponse>(`/${vehicleId}/odometer`, {
      auth: true,
      body: { km },
    });
  }
}

export const oilStatusApi = new OilStatusController();
```

- [ ] **Step 2: Escribir el test que verifica las rutas**

Con el mismo molde de `src/api/__tests__/`: mockear el transporte de
`ApiClient` y afirmar que `get` pega a `/vehicles/<id>/oil-status` con
`auth: true`, y que `reportOdometer` hace `POST` a `/vehicles/<id>/odometer`
con `{ km }` en el cuerpo.

- [ ] **Step 3: Correr los tests**

Run: `npm test -- oil-status.controller`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add app-mobile/src/api/controllers/oil-status.controller.ts app-mobile/src/api/__tests__/oil-status.controller.test.ts
git commit -m "feat(aceite): cliente HTTP del estado del aceite"
```

---

### Task 14: La tarjeta única

**Files:**
- Create: `app-mobile/src/home/widgets/OilStatusWidget.tsx`
- Delete: `app-mobile/src/home/widgets/GaugeWidget.tsx`, `app-mobile/src/home/widgets/TechReadoutWidget.tsx`
- Modify: `app-mobile/src/home/layout.ts`, `app-mobile/src/home/registry.tsx`, `app-mobile/src/components/OilGauge.tsx`, `app-mobile/src/store/useStore.ts`
- Test: `app-mobile/src/home/__tests__/layout.test.ts`

**Interfaces:**
- Consumes: `oilStatusApi` (Task 13).
- Produces: el widget `oilStatus`. Ningún otro módulo lo consume.

La fusión de los dos widgets **no necesita código de migración**: `reconcile`
en `layout.ts` ya descarta los ids desconocidos y agrega los nuevos, y como
`gauge` y `techReadout` son ambos `PINNED_WIDGETS`, reemplazarlos por
`oilStatus` en esa lista deja la tarjeta arriba de todo sin tocar nada más.
Lo que sí hace falta es el **test que lo demuestre**.

- [ ] **Step 1: Escribir el test de migración del layout**

```ts
// agregar a app-mobile/src/home/__tests__/layout.test.ts
describe('fusión de gauge y techReadout en oilStatus', () => {
  it('un layout guardado con los dos viejos queda con oilStatus arriba', () => {
    const guardado = {
      order: ['gauge', 'techReadout', 'quickActions', 'kpis', 'recentHistory'],
      hidden: ['recentHistory'],
    };

    const r = reconcile(guardado);

    expect(r.order).not.toContain('gauge');
    expect(r.order).not.toContain('techReadout');
    expect(r.order[0]).toBe('oilStatus');
    // Lo que el usuario había ocultado se respeta.
    expect(r.hidden).toContain('recentHistory');
  });

  it('oilStatus no se puede apagar: es fijo', () => {
    const r = toggleWidget(DEFAULT_LAYOUT, 'oilStatus');
    expect(r.hidden).not.toContain('oilStatus');
  });
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `npm test -- layout.test`
Expected: FAIL — `oilStatus` no es un `WidgetId`.

- [ ] **Step 3: Actualizar `layout.ts`**

```ts
export type WidgetId =
  | 'oilStatus'
  | 'kpis'
  | 'quickActions'
  | 'recentHistory'
  | 'openAlerts';

/** El medidor y la lectura técnica eran dos widgets fijos separados; ahora son
 *  una sola tarjeta, porque salen de un solo bloque del backend y mostrarlos
 *  aparte los dejaba desincronizarse. */
export const PINNED_WIDGETS: WidgetId[] = ['oilStatus', 'quickActions', 'kpis'];
```

`reconcile` hace el resto: los ids `gauge` y `techReadout` guardados ya no
están en `known`, así que se descartan; `oilStatus` es nuevo y, por ser fijo,
entra primero.

- [ ] **Step 4: Escribir el widget**

```tsx
// app-mobile/src/home/widgets/OilStatusWidget.tsx
// El estado del aceite en una sola tarjeta: medidor arriba, y la fila de
// odómetro / próximo / aceite abajo, separadas por una línea.
//
// Eran dos widgets (GaugeWidget y TechReadoutWidget) alimentados por selectores
// locales distintos. Ahora los cuatro números salen del mismo bloque del
// backend: no hay forma de que la barra diga una cosa y la fila otra.
import React from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Box, Col, Row, Touchable, Txt } from '../../ui';
import { OilGauge } from '../../components/OilGauge';
import { fmtKm } from '../../utils/format';
import { useActiveVehicle } from '../../store/useStore';
import { useOilStatus } from '../../hooks/useOilStatus';
import { RootStackParamList } from '../../navigation/types';
import { DarkWidgetSurface } from '../DarkWidgetSurface';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function OilStatusWidget() {
  const navigation = useNavigation<Nav>();
  const active = useActiveVehicle();
  const { data } = useOilStatus(active.id);

  if (!data?.gauge) {
    return (
      <DarkWidgetSurface>
        <Touchable
          fade
          ai="center"
          onPress={() => navigation.navigate('AddOil', { vehicleId: active.id })}
        >
          <Txt fos={13} col="rgba(255,255,255,0.6)">
            Registra tu primer cambio para activar el medidor
          </Txt>
        </Touchable>
      </DarkWidgetSurface>
    );
  }

  const { gauge, odometer, cycle, oil } = data;
  const estimado = odometer?.source === 'estimated';

  const filas = [
    {
      l: 'Odómetro',
      v: `${estimado ? '~' : ''}${fmtKm(odometer?.km ?? 0)}`,
      u: estimado ? 'km · tocar' : 'km',
      onPress: () => navigation.navigate('ReportOdometer', { vehicleId: active.id }),
    },
    { l: 'Próximo', v: fmtKm(cycle?.nextChangeKm ?? 0), u: 'km' },
    { l: 'Aceite', v: oil?.viscosity ?? '—', u: oil?.brand ?? '' },
  ];

  return (
    <DarkWidgetSurface>
      <Touchable
        fade
        ai="center"
        onPress={() => navigation.navigate('AddOil', { vehicleId: active.id })}
      >
        <OilGauge
          pct={gauge.pct}
          status={gauge.status}
          limitedBy={gauge.limitedBy}
          kmLeft={gauge.kmLeft}
          daysLeft={gauge.daysLeft}
          size={220}
        />
      </Touchable>

      {/* La línea que hace que sean dos zonas de una tarjeta y no dos tarjetas */}
      <Box h={1} bg="rgba(255,255,255,0.08)" my="$md" />

      <Row ai="stretch">
        {filas.map((r) => (
          <Touchable key={r.l} f={1} ai="center" fade disabled={!r.onPress} onPress={r.onPress}>
            <Col ai="center">
              <Txt font="bold" fos={9} col="rgba(255,255,255,0.55)" ls={1.2} caps>
                {r.l}
              </Txt>
              <Txt font="mono" fos={16} tone="onDark" mt={2}>{r.v}</Txt>
              <Txt fos={10} col="rgba(255,255,255,0.55)">{r.u}</Txt>
            </Col>
          </Touchable>
        ))}
      </Row>
    </DarkWidgetSurface>
  );
}
```

El hook que lo alimenta, en `app-mobile/src/hooks/useOilStatus.ts`:

```tsx
// Trae el bloque de estado del vehículo y lo deja en memoria por id.
//
// Se recarga al enfocar la pantalla y no en cada render: el bloque cambia con
// el tiempo, pero no tan rápido como para justificar un poll — y `computedAt`
// deja ver cuándo se calculó.
import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  oilStatusApi,
  type OilStatusResponse,
} from '../api/controllers/oil-status.controller';

const cache = new Map<string, OilStatusResponse>();

export function useOilStatus(vehicleId: string) {
  const [data, setData] = useState<OilStatusResponse | null>(
    cache.get(vehicleId) ?? null,
  );
  const [error, setError] = useState<unknown>(null);

  const load = useCallback(async () => {
    try {
      const r = await oilStatusApi.get(vehicleId);
      cache.set(vehicleId, r);
      setData(r);
      setError(null);
    } catch (e) {
      // Offline-first: si falla, se conserva lo último que llegó. La tarjeta
      // ya sabe marcarlo como viejo mirando computedAt.
      setError(e);
    }
  }, [vehicleId]);

  useEffect(() => {
    setData(cache.get(vehicleId) ?? null);
  }, [vehicleId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  /** La usa la pantalla de lectura manual: el POST ya devuelve el bloque
   *  recalculado, así que no hace falta un GET extra. */
  const replace = useCallback(
    (r: OilStatusResponse) => {
      cache.set(vehicleId, r);
      setData(r);
    },
    [vehicleId],
  );

  return { data, error, reload: load, replace };
}
```

- [ ] **Step 5: Ajustar `OilGauge` para que reciba el estado en vez de calcularlo**

`OilGauge` deja de derivar `status` de `pct` (esa era una de las dos
definiciones contradictorias) y pasa a recibir `status`, `limitedBy`, `kmLeft`
y `daysLeft` por props. El centro de la lectura:

```tsx
  const mostrandoKm = limitedBy === 'km';
  // …
  <Txt font="mono" fos={44} lh={48} tone="onDark" ls={-1} mt={4} transition="gauge">
    {mostrandoKm ? fmtKm(kmLeft) : String(daysLeft)}
  </Txt>
  <Txt fos={13} col="rgba(255,255,255,0.6)" mt={2}>
    {mostrandoKm ? 'km restantes' : 'días restantes'}
  </Txt>
```

- [ ] **Step 6: Actualizar `registry.tsx` y borrar los widgets viejos**

Una entrada en lugar de dos:

```tsx
  oilStatus: {
    label: 'Estado del aceite',
    description: 'Medidor, odómetro, próximo cambio y aceite',
    icon: 'gauge',
    render: () => <OilStatusWidget />,
  },
```

Y borrar `GaugeWidget.tsx` y `TechReadoutWidget.tsx`, más `oilPct`, `kmLeft` y
`vehicleStatus` de `useStore.ts`.

- [ ] **Step 7: Correr los tests**

Run: `npm test`
Expected: PASS. Los tests de `layout.test.ts` cubren la migración.

- [ ] **Step 8: Commit**

```bash
git add app-mobile/src
git commit -m "feat(aceite): una sola tarjeta con medidor, odómetro, próximo y aceite"
```

---

### Task 15: Los dos campos nuevos de los formularios

**Files:**
- Modify: `app-mobile/src/screens/AddOilScreen.tsx`, `app-mobile/src/screens/AddVehicleFormScreen.tsx`

**Interfaces:**
- Consumes: el contrato de `POST /vehicles` y `POST /vehicles/:id/oil-changes`.
- Produces: nada que consuman otras tareas.

- [ ] **Step 1: Agregar el intervalo en meses en `AddOilScreen`**

Debajo del slider de intervalo en km, un segundo control con los meses. Se
precarga con `intervalMonths` del ciclo anterior del vehículo — que es el
número que el propio usuario eligió la vez pasada, no una sugerencia inventada
— y con 6 en el primer cambio del vehículo.

El campo "Próximo cambio a" sigue siendo `editable={false}`: ya era derivado
antes de este cambio y lo sigue siendo.

- [ ] **Step 2: Agregar el uso declarado en `AddVehicleFormScreen`**

Un campo en lenguaje llano ("¿Cuánto manejas normalmente?") con opciones que se
traducen a km/día antes de enviarse, más la posibilidad de escribir un número:

```ts
// El backend piensa en km/día porque es la unidad de la proyección; al usuario
// se le pregunta en km/mes, que es como la gente sabe cuánto maneja.
const kmPorDia = Math.round((kmPorMes / 30) * 100) / 100;
```

Se valida en el cliente contra el mismo rango `[1, 500]` que valida el DTO, así
el error se ve antes de viajar.

- [ ] **Step 3: Correr los tests y el typecheck**

Run: `npm test && npx tsc --noEmit`
Expected: PASS; sin errores de tipos.

- [ ] **Step 4: Commit**

```bash
git add app-mobile/src/screens
git commit -m "feat(aceite): intervalo en meses y uso declarado en los formularios"
```

---

### Task 16: Pantalla de lectura manual del odómetro

**Files:**
- Create: `app-mobile/src/screens/ReportOdometerScreen.tsx`
- Modify: `app-mobile/src/navigation/types.ts`, y el navegador que registra las pantallas del stack

**Interfaces:**
- Consumes: `oilStatusApi.reportOdometer` (Task 13), `useOilStatus().replace` (Task 14).
- Produces: la ruta `ReportOdometer` en `RootStackParamList`.

La tarjeta de la Task 14 navega a `ReportOdometer` al tocar el odómetro
estimado. Esta tarea crea esa pantalla: sin ella, la tilde tocable lleva a una
ruta que no existe.

- [ ] **Step 1: Agregar la ruta al tipo del stack**

En `app-mobile/src/navigation/types.ts`, dentro de `RootStackParamList`:

```ts
  ReportOdometer: { vehicleId: string };
```

- [ ] **Step 2: Escribir la pantalla**

```tsx
// app-mobile/src/screens/ReportOdometerScreen.tsx
// Un solo número: lo que dice el tablero ahora.
//
// Existe porque el odómetro es el dato que la app no puede adivinar bien: se
// estima entre cambios, y esta pantalla es la puerta para corregir la
// estimación el día que el usuario sí lo tenga a la vista. Por eso es un campo
// y un botón, y nada más: si cuesta más de diez segundos, no se usa.
import React, { useState } from 'react';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { Box, Col, Txt } from '../ui';
import { Field, Input, PrimaryButton } from '../components/primitives';
import { fmtKm } from '../utils/format';
import { useOilStatus } from '../hooks/useOilStatus';
import { oilStatusApi } from '../api/controllers/oil-status.controller';
import { RootStackParamList } from '../navigation/types';

export function ReportOdometerScreen() {
  const navigation = useNavigation();
  const { params } = useRoute<RouteProp<RootStackParamList, 'ReportOdometer'>>();
  const { data, replace } = useOilStatus(params.vehicleId);

  const [km, setKm] = useState(String(data?.odometer?.km ?? ''));
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const guardar = async () => {
    const valor = parseInt(km, 10);
    if (!Number.isFinite(valor)) return setError('Escribe el kilometraje.');

    setGuardando(true);
    try {
      // El POST devuelve el bloque ya recalculado: se reemplaza el cacheado y
      // la tarjeta del inicio queda al día sin un GET extra.
      replace(await oilStatusApi.reportOdometer(params.vehicleId, valor));
      navigation.goBack();
    } catch (e) {
      // Los dos códigos que el backend puede devolver acá se muestran con su
      // propio texto: "no puede ser menor" y "revísalo" son problemas
      // distintos y el usuario los resuelve distinto.
      const code = (e as { error?: string })?.error;
      setError(
        code === 'ODOMETER_BACKWARDS'
          ? 'Ese número es menor que la última lectura. El odómetro no baja.'
          : code === 'ODOMETER_IMPLAUSIBLE'
            ? 'Ese kilometraje es muy alto para el tiempo que pasó. Revísalo.'
            : 'No se pudo guardar. Intenta de nuevo.',
      );
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Col f={1} p="$lg" gap="$md">
      <Txt fos={13} tone="muted">
        {data?.odometer?.source === 'estimated'
          ? `Ahora estimamos ${fmtKm(data.odometer.km)} km. Corrígelo con lo que marca el tablero.`
          : 'Escribe lo que marca el tablero.'}
      </Txt>

      <Field label="Kilometraje actual" suffix="km">
        <Input
          value={km}
          onChangeText={(t) => {
            setKm(t);
            setError(null);
          }}
          mono
          keyboardType="number-pad"
          autoFocus
        />
      </Field>

      {error ? (
        <Box>
          <Txt fos={12} col="$danger">{error}</Txt>
        </Box>
      ) : null}

      <PrimaryButton onPress={guardar} disabled={guardando}>
        {guardando ? 'Guardando…' : 'Guardar lectura'}
      </PrimaryButton>
    </Col>
  );
}
```

- [ ] **Step 3: Registrar la pantalla en el stack**

Junto a las demás `Stack.Screen`, con el título "Kilometraje".

- [ ] **Step 4: Verificar tipos y tests**

Run: `npm test && npx tsc --noEmit`
Expected: PASS; sin errores de tipos — en particular, `navigation.navigate('ReportOdometer', …)` de la Task 14 ya compila.

- [ ] **Step 5: Commit**

```bash
git add app-mobile/src/screens/ReportOdometerScreen.tsx app-mobile/src/navigation
git commit -m "feat(aceite): pantalla de lectura manual del odómetro"
```
