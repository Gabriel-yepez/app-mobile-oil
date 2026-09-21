# Notificaciones push desde el servidor — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el servidor mande notificaciones push nativas de cambio de aceite —barrido diario más aviso inmediato por evento— y que la app deje de programar avisos locales.

**Architecture:** Un módulo `notifications` en NestJS con la decisión de negocio en una función pura (`planPushes`) que consume el `computeOilStatus` que ya existe. El SDK de Expo entra por un solo adaptador detrás del puerto `PUSH_SENDER`, así que ningún test le pega a la red. El dedupe vive en una firma que describe el **hecho** avisado, no el texto del mensaje, y es lo que hace que el barrido y el aviso por evento no se pisen.

**Tech Stack:** NestJS 11, Prisma 7 (adapter `@prisma/adapter-pg`), PostgreSQL, `expo-server-sdk`, `@nestjs/schedule`, Jest + supertest. App: Expo SDK 57, `expo-notifications`, Zustand, axios.

**Spec:** `docs/superpowers/specs/2026-09-20-push-notifications-design.md`

## Global Constraints

- **Español en todo**: comentarios, mensajes de commit, nombres de test y textos de las notificaciones. El código (identificadores, tipos) sigue en inglés, como el resto del repo.
- **Los servicios piden el token de DI, nunca la clase concreta.** `{ provide: X_REPOSITORY, useClass: PrismaX }` en el módulo.
- **El dominio no importa tipos de Prisma.** `src/modules/notifications/domain/*` se tiene que poder probar sin base.
- **`expo-server-sdk` se importa en un solo archivo**: `src/infra/expo/expo-push.sender.ts`. En ningún otro.
- **Prisma 7: `prisma migrate dev` NO regenera el cliente.** Después de cada migración hay que correr `pnpm db:generate` o el build falla con TS2339 en los modelos nuevos.
- **En los DTO de PATCH, `@Transform` no se pone junto a `@IsOptional` sin guarda.** Si hace falta normalizar, se envuelve con el helper `siViene` de `src/modules/users/dto/update-profile.dto.ts`. Sin la guarda, el campo ausente llega como `''` y rebota un campo que el cliente nunca mandó.
- **Convención del día de la semana: domingo = 1**, igual que el trigger `WEEKLY` de Expo y que `DEFAULT_PREFS` de la app.
- **Zona horaria del barrido: `America/Caracas`**, offset fijo (Venezuela no mueve el reloj).
- **Umbrales por defecto:** `warnThresholdKm = 500`, repetición del vencido cada **14** días, checkin solo si la última lectura real tiene más de **30** días.
- **Los e2e usan el dominio `@e2e.local`** y `limpiarUsuariosE2E` de `test/support/e2e-db.ts`. Fijan `process.env.THROTTLE_AUTH_LIMIT = '1000'` **antes** de importar `AppModule`.
- **Comandos:** `pnpm test` (unitarios), `pnpm test:e2e` (e2e, necesita `pnpm db:up`), `pnpm build`, `pnpm lint`.

---

## Estructura de archivos

### Backend (`backend-oil-app`)

| Archivo | Responsabilidad |
|---|---|
| `prisma/schema.prisma` | + `DevicePlatform`, `DeviceToken`, `NotificationPref`, `NotificationLog` |
| `src/modules/notifications/domain/push-message.ts` | `PushKind`, `PushMessage`, `NotificationPrefs`, `DEFAULT_PREFS`, `esTokenExpo()` |
| `src/modules/notifications/domain/push-planner.ts` | `planPushes()`. PURA. Toda la decisión de negocio |
| `src/modules/notifications/domain/push-sender.ts` | Puerto `PUSH_SENDER`: `PushTicket`, `PushReceipt`, `PushSender` |
| `src/modules/notifications/domain/device-token.repository.ts` | Puerto `DEVICE_TOKEN_REPOSITORY` |
| `src/modules/notifications/domain/notification-pref.repository.ts` | Puerto `NOTIFICATION_PREF_REPOSITORY` |
| `src/modules/notifications/domain/notification-log.repository.ts` | Puerto `NOTIFICATION_LOG_REPOSITORY` |
| `src/infra/prisma/prisma-device-token.repository.ts` | Adaptador |
| `src/infra/prisma/prisma-notification-pref.repository.ts` | Adaptador |
| `src/infra/prisma/prisma-notification-log.repository.ts` | Adaptador |
| `src/infra/expo/expo-push.sender.ts` | Único archivo que importa `expo-server-sdk` |
| `src/modules/notifications/push-dispatch.service.ts` | estado → planner → sender → bitácora |
| `src/modules/notifications/push-sweep.service.ts` | El barrido, con el advisory lock |
| `src/modules/notifications/notifications.cron.ts` | Los dos `@Cron`; delegan y no deciden nada |
| `src/modules/notifications/receipts.service.ts` | Receipts diferidos y apagado de tokens muertos |
| `src/modules/notifications/devices.controller.ts` | `POST /me/devices`, `DELETE /me/devices/:token` |
| `src/modules/notifications/notification-prefs.controller.ts` | `GET`/`PATCH /me/notification-prefs` |
| `src/modules/notifications/dto/*.ts` | DTO de entrada y de respuesta |
| `src/modules/notifications/testing/*.ts` | Repos en memoria y `FakePushSender` |
| `src/config/env.validation.ts` | + `EXPO_ACCESS_TOKEN`, `PUSH_ENABLED` |

### App (`app-mobile`)

| Archivo | Responsabilidad |
|---|---|
| `src/api/controllers/notifications.controller.ts` | Cliente de los cuatro endpoints |
| `src/notifications/push.ts` | Token de Expo y registro contra el API |
| `src/notifications/legacy-cleanup.ts` | Cancela de una vez los avisos locales que quedaron programados |
| `src/store/notifPrefs.ts` | Se reduce a `permissionAskedAt` |
| `src/screens/NotificationsScreen.tsx` | Lee y escribe contra el API |
| Se borran | `plan.ts`, `scheduler.ts`, `useNotificationsSync.ts` y sus tests |

---

## Task 1: Esquema y migración

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_push_notifications/migration.sql` (lo genera Prisma)
- Test: `test/push-schema.e2e-spec.ts`

**Interfaces:**
- Consumes: nada.
- Produces: los modelos `deviceToken`, `notificationPref`, `notificationLog` en `PrismaService`, y el enum `DevicePlatform` (`'IOS' | 'ANDROID'`).

- [ ] **Step 1: Escribir el test que falla**

Este test parece trivial y no lo es: en Prisma 7 `migrate dev` **no** regenera el cliente, así que el modo de fallo real es que el esquema tenga las tablas y `prisma.deviceToken` sea `undefined`. Esto lo agarra antes que el build.

```ts
// test/push-schema.e2e-spec.ts
import 'dotenv/config';
import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from '../src/infra/prisma/prisma.service';
import { validateEnv } from '../src/config/env.validation';

describe('Esquema de notificaciones push (e2e)', () => {
  let prisma: PrismaService;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true, validate: validateEnv })],
      providers: [PrismaService],
    }).compile();
    prisma = mod.get(PrismaService);
    await prisma.onModuleInit();
  });

  afterAll(async () => {
    await prisma.onModuleDestroy();
  });

  it('el cliente generado expone los tres modelos nuevos', () => {
    expect(prisma.deviceToken).toBeDefined();
    expect(prisma.notificationPref).toBeDefined();
    expect(prisma.notificationLog).toBeDefined();
  });

  it('las tablas existen y se pueden consultar', async () => {
    await expect(prisma.deviceToken.count()).resolves.toBeGreaterThanOrEqual(0);
    await expect(prisma.notificationPref.count()).resolves.toBeGreaterThanOrEqual(0);
    await expect(prisma.notificationLog.count()).resolves.toBeGreaterThanOrEqual(0);
  });
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `pnpm db:up && pnpm test:e2e -- push-schema`
Expected: FAIL — `prisma.deviceToken` es `undefined`.

- [ ] **Step 3: Agregar los modelos al esquema**

Al final de `prisma/schema.prisma`:

```prisma
enum DevicePlatform {
  IOS
  ANDROID
}

/// Un token identifica una INSTALACIÓN, no una sesión. Por eso `token` es
/// único a secas y no `@@unique([userId, token])`: si otra persona inicia
/// sesión en el mismo teléfono, el token cambia de dueño en vez de
/// duplicarse. Con dos filas, el dueño anterior seguiría recibiendo avisos de
/// sus vehículos en un teléfono que ya no es suyo.
model DeviceToken {
  id         String         @id @default(uuid()) @db.Uuid
  userId     String         @db.Uuid
  user       User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  token      String         @unique
  platform   DevicePlatform
  lastSeenAt DateTime       @default(now())
  /// `DeviceNotRegistered` lo apaga, no lo borra: si el usuario reinstala,
  /// vuelve a registrar el mismo token y la fila revive.
  disabledAt DateTime?
  createdAt  DateTime       @default(now())

  @@index([userId])
}

model NotificationPref {
  userId          String   @id @db.Uuid
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  enabled         Boolean  @default(true)
  warnEnabled     Boolean  @default(true)
  overdueEnabled  Boolean  @default(true)
  checkinEnabled  Boolean  @default(true)
  warnThresholdKm Int      @default(500)
  /// Domingo = 1, igual que el trigger WEEKLY de Expo y que la app.
  checkinWeekday  Int      @default(1)
  updatedAt       DateTime @updatedAt
}

/// Hace dos trabajos porque son el mismo hecho —"esto se mandó"—: es el dedupe
/// (sin él, el mismo "cambio cerca" sale cada día a las 9 hasta que el usuario
/// cambie el aceite) y es el rastro para casar el ticket con el receipt que
/// Expo entrega unos 15 minutos después.
model NotificationLog {
  id           String    @id @default(uuid()) @db.Uuid
  userId       String    @db.Uuid
  user         User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  vehicleId    String?   @db.Uuid
  kind         String
  sig          String
  ticketId     String?
  sentAt       DateTime  @default(now())
  receiptAt    DateTime?
  receiptError String?

  @@index([userId, kind, sentAt(sort: Desc)])
  @@index([ticketId])
}
```

Y en `model User`, junto a `refreshTokens` y `vehicles`:

```prisma
  deviceTokens     DeviceToken[]
  notificationPref NotificationPref?
  notificationLogs NotificationLog[]
```

- [ ] **Step 4: Migrar y regenerar el cliente**

```bash
pnpm db:migrate --name push_notifications
pnpm db:generate
```

El segundo comando no es opcional. En Prisma 7 `migrate dev` no regenera, y `expo-doctor` no lo detecta.

- [ ] **Step 5: Correr el test para verificar que pasa**

Run: `pnpm test:e2e -- push-schema`
Expected: PASS, los dos casos.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations test/push-schema.e2e-spec.ts
git commit -m "feat(push): tablas de tokens, preferencias y bitacora de avisos"
```

---

## Task 2: El planificador puro

La pieza central. Sin base, sin red, con `now` por parámetro — igual que `computeOilStatus`.

**Files:**
- Create: `src/modules/notifications/domain/push-message.ts`
- Create: `src/modules/notifications/domain/push-planner.ts`
- Test: `src/modules/notifications/domain/push-planner.spec.ts`

**Interfaces:**
- Consumes: `OilStatus`, `Gauge` de `src/modules/oil/domain/oil-status.ts`.
- Produces:
  - `type PushKind = 'warn' | 'overdue' | 'checkin'`
  - `type PushMessage = { kind; userId; vehicleId: string | null; title; body; sig; data }`
  - `type NotificationPrefs = { enabled; warnEnabled; overdueEnabled; checkinEnabled; warnThresholdKm; checkinWeekday }`
  - `const DEFAULT_PREFS: NotificationPrefs`
  - `type PlannerVehicle = { id: string; label: string; kmPerDay: number; status: OilStatus }`
  - `function planPushes(input: { now: Date; userId: string; prefs: NotificationPrefs; vehicles: PlannerVehicle[]; yaEnviado: Set<string> }): PushMessage[]`
  - `function esTokenExpo(v: unknown): boolean`

- [ ] **Step 1: Escribir los tipos (no es el test todavía, es lo que el test importa)**

```ts
// src/modules/notifications/domain/push-message.ts
// Los tipos del subsistema. Sin imports del SDK de Expo ni de Prisma a
// propósito: push-planner.ts depende solo de esto, y así queda testeable sin
// base y sin mocks.
import type { OilStatus } from '../../oil/domain/oil-status';

export type PushKind = 'warn' | 'overdue' | 'checkin';

export type PushRouteData = {
  screen: 'VehicleDetail' | 'Alerts';
  vehicleId?: string;
};

export type PushMessage = {
  kind: PushKind;
  userId: string;
  /** null en el checkin: es del usuario, no de un vehículo. */
  vehicleId: string | null;
  title: string;
  body: string;
  /** La firma del HECHO avisado. Ver el comentario en push-planner.ts. */
  sig: string;
  data: PushRouteData;
};

export type NotificationPrefs = {
  enabled: boolean;
  warnEnabled: boolean;
  overdueEnabled: boolean;
  checkinEnabled: boolean;
  warnThresholdKm: number;
  /** 1..7, domingo = 1: la convención del trigger WEEKLY de Expo. */
  checkinWeekday: number;
};

export const DEFAULT_PREFS: NotificationPrefs = {
  enabled: true,
  warnEnabled: true,
  overdueEnabled: true,
  checkinEnabled: true,
  warnThresholdKm: 500,
  checkinWeekday: 1,
};

export type PlannerVehicle = {
  id: string;
  /** "Toyota Corolla": lo que se lee en el cuerpo de la notificación. */
  label: string;
  /** El ritmo de uso. Es lo que permite llevar `kmLeft` y `daysLeft` —que
   *  miden ejes distintos— a la misma unidad al calcular los días vencido. */
  kmPerDay: number;
  /** El ciclo vigente: es lo que hace única la firma de warn y de overdue.
   *  Sin él, cambiar el aceite no reiniciaría el dedupe. */
  lastChangeKm: number | null;
  lastChangeAt: Date | null;
  status: OilStatus;
};

/** Cada cuántos días vuelve el aviso de un vehículo que sigue vencido. */
export const DIAS_REPETIR_VENCIDO = 14;

/** Antigüedad a partir de la cual se pide confirmar el odómetro. */
export const DIAS_LECTURA_VIEJA = 30;

/**
 * Valida el formato sin arrastrar el SDK. `Expo.isExpoPushToken()` haría lo
 * mismo, pero obligaría a importar expo-server-sdk desde un DTO de HTTP.
 */
export function esTokenExpo(v: unknown): boolean {
  return (
    typeof v === 'string' &&
    /^Expo(nent)?PushToken\[[^\]\s]+\]$/.test(v)
  );
}
```

- [ ] **Step 2: Escribir los tests que fallan**

```ts
// src/modules/notifications/domain/push-planner.spec.ts
import type { OilStatus } from '../../oil/domain/oil-status';
import { DEFAULT_PREFS, type NotificationPrefs, type PlannerVehicle } from './push-message';
import { planPushes } from './push-planner';

const AHORA = new Date('2026-09-20T13:00:00.000Z'); // domingo
const CICLO = { changedAt: new Date('2026-03-01T00:00:00.000Z'), km: 40_000 };

/** Arma un OilStatus a mano: el planificador no calcula el medidor, lo lee. */
const status = (g: {
  kmLeft: number;
  daysLeft: number;
  asOf?: Date;
}): OilStatus => ({
  computedAt: AHORA,
  gauge: {
    pct: 20,
    status: g.kmLeft <= 0 || g.daysLeft <= 0 ? 'danger' : 'warn',
    limitedBy: 'km',
    kmLeft: g.kmLeft,
    daysLeft: g.daysLeft,
  },
  odometer: {
    km: 44_500,
    source: 'estimated',
    asOf: g.asOf ?? new Date('2026-09-15T00:00:00.000Z'),
  },
});

const vehiculo = (over: Partial<PlannerVehicle> = {}): PlannerVehicle => ({
  id: 'veh-1',
  label: 'Toyota Corolla',
  kmPerDay: 40,
  status: status({ kmLeft: 300, daysLeft: 60 }),
  lastChangeKm: CICLO.km,
  lastChangeAt: CICLO.changedAt,
  ...over,
});

const plan = (over: {
  vehicles?: PlannerVehicle[];
  prefs?: Partial<NotificationPrefs>;
  yaEnviado?: string[];
  now?: Date;
} = {}) =>
  planPushes({
    now: over.now ?? AHORA,
    userId: 'user-1',
    prefs: { ...DEFAULT_PREFS, ...(over.prefs ?? {}) },
    vehicles: over.vehicles ?? [vehiculo()],
    yaEnviado: new Set(over.yaEnviado ?? []),
  });

describe('planPushes', () => {
  describe('el interruptor maestro', () => {
    it('apagado no genera nada, sin caso especial por tipo', () => {
      expect(plan({ prefs: { enabled: false } })).toEqual([]);
    });
  });

  describe('cerca y vencido son mutuamente excluyentes', () => {
    it('un vehículo cerca del límite genera solo warn', () => {
      const r = plan({ vehicles: [vehiculo({ status: status({ kmLeft: 300, daysLeft: 60 }) })] });
      expect(r.map((m) => m.kind)).toEqual(['warn']);
    });

    it('un vehículo pasado del límite genera solo overdue', () => {
      const r = plan({ vehicles: [vehiculo({ status: status({ kmLeft: -800, daysLeft: 20 }) })] });
      expect(r.map((m) => m.kind)).toEqual(['overdue']);
    });

    it('por encima del umbral no genera nada', () => {
      const r = plan({ vehicles: [vehiculo({ status: status({ kmLeft: 2_000, daysLeft: 90 }) })] });
      expect(r).toEqual([]);
    });

    it('un vehículo sin ciclo no genera nada: no hay nada que vencer', () => {
      const sinCiclo: OilStatus = { computedAt: AHORA, gauge: null, odometer: null };
      expect(plan({ vehicles: [vehiculo({ status: sinCiclo })] })).toEqual([]);
    });
  });

  describe('la firma es del hecho, no del texto', () => {
    // EL test de este archivo. Si la firma dependiera del cuerpo del mensaje,
    // el km proyectado cambiaría mañana, la firma también, y al usuario le
    // llegaría el mismo aviso TODOS LOS DÍAS hasta que cambie el aceite.
    it('el warn no se repite aunque el km proyectado haya cambiado', () => {
      const hoy = plan({ vehicles: [vehiculo({ status: status({ kmLeft: 300, daysLeft: 60 }) })] });
      const manana = plan({
        vehicles: [vehiculo({ status: status({ kmLeft: 260, daysLeft: 59 }) })],
        yaEnviado: [hoy[0].sig],
      });
      expect(manana).toEqual([]);
    });

    it('cambiar el aceite arranca ciclo nuevo y el warn vuelve a salir', () => {
      const viejo = plan({ vehicles: [vehiculo()] });
      const nuevoCiclo = vehiculo({
        lastChangeKm: 45_000,
        lastChangeAt: new Date('2026-09-18T00:00:00.000Z'),
        status: status({ kmLeft: 300, daysLeft: 60 }),
      });
      const r = plan({ vehicles: [nuevoCiclo], yaEnviado: [viejo[0].sig] });
      expect(r.map((m) => m.kind)).toEqual(['warn']);
    });

    it('pasar de cerca a vencido sí avisa: son hechos distintos', () => {
      const warn = plan({ vehicles: [vehiculo({ status: status({ kmLeft: 300, daysLeft: 60 }) })] });
      const r = plan({
        vehicles: [vehiculo({ status: status({ kmLeft: -10, daysLeft: 40 }) })],
        yaEnviado: [warn[0].sig],
      });
      expect(r.map((m) => m.kind)).toEqual(['overdue']);
    });
  });

  describe('el vencido vuelve cada 14 días, no cada día', () => {
    // kmPerDay 40 y kmLeft -520 son 13 días vencido: mismo tramo que el día 0.
    it('al día 13 sigue siendo el mismo aviso', () => {
      const dia0 = plan({ vehicles: [vehiculo({ status: status({ kmLeft: -40, daysLeft: 30 }) })] });
      const dia13 = plan({
        vehicles: [vehiculo({ status: status({ kmLeft: -520, daysLeft: 17 }) })],
        yaEnviado: [dia0[0].sig],
      });
      expect(dia13).toEqual([]);
    });

    it('al día 14 el aviso vuelve', () => {
      const dia0 = plan({ vehicles: [vehiculo({ status: status({ kmLeft: -40, daysLeft: 30 }) })] });
      const dia14 = plan({
        vehicles: [vehiculo({ status: status({ kmLeft: -600, daysLeft: 16 }) })],
        yaEnviado: [dia0[0].sig],
      });
      expect(dia14.map((m) => m.kind)).toEqual(['overdue']);
    });

    it('cuenta por el eje que lleva más tiempo vencido', () => {
      // Vencido por tiempo hace 20 días y por km hace 1: manda el de 20.
      const r = plan({ vehicles: [vehiculo({ status: status({ kmLeft: -40, daysLeft: -20 }) })] });
      expect(r[0].sig).toContain(':1'); // floor(20 / 14) = 1
    });
  });

  describe('el checkin pide confirmar el kilometraje', () => {
    it('sale el día de la semana configurado si la lectura está vieja', () => {
      const r = plan({
        vehicles: [vehiculo({ status: status({ kmLeft: 5_000, daysLeft: 90, asOf: new Date('2026-07-01T00:00:00.000Z') }) })],
        prefs: { checkinWeekday: 1 }, // domingo, y AHORA es domingo
      });
      expect(r.map((m) => m.kind)).toEqual(['checkin']);
    });

    it('calla si la última lectura es reciente: no hay nada que pedir', () => {
      const r = plan({
        vehicles: [vehiculo({ status: status({ kmLeft: 5_000, daysLeft: 90, asOf: new Date('2026-09-15T00:00:00.000Z') }) })],
        prefs: { checkinWeekday: 1 },
      });
      expect(r).toEqual([]);
    });

    it('no sale los demás días de la semana', () => {
      const r = plan({
        vehicles: [vehiculo({ status: status({ kmLeft: 5_000, daysLeft: 90, asOf: new Date('2026-07-01T00:00:00.000Z') }) })],
        prefs: { checkinWeekday: 3 }, // martes
      });
      expect(r).toEqual([]);
    });

    it('sale una sola vez por semana', () => {
      const vehs = [vehiculo({ status: status({ kmLeft: 5_000, daysLeft: 90, asOf: new Date('2026-07-01T00:00:00.000Z') }) })];
      const primero = plan({ vehicles: vehs, prefs: { checkinWeekday: 1 } });
      const segundo = plan({ vehicles: vehs, prefs: { checkinWeekday: 1 }, yaEnviado: [primero[0].sig] });
      expect(segundo).toEqual([]);
    });
  });

  describe('cada interruptor apaga solo lo suyo', () => {
    it('warnEnabled en false calla el warn', () => {
      expect(plan({ prefs: { warnEnabled: false } })).toEqual([]);
    });

    it('overdueEnabled en false calla el vencido', () => {
      const r = plan({
        vehicles: [vehiculo({ status: status({ kmLeft: -800, daysLeft: 20 }) })],
        prefs: { overdueEnabled: false },
      });
      expect(r).toEqual([]);
    });

    it('checkinEnabled en false calla el checkin', () => {
      const r = plan({
        vehicles: [vehiculo({ status: status({ kmLeft: 5_000, daysLeft: 90, asOf: new Date('2026-07-01T00:00:00.000Z') }) })],
        prefs: { checkinEnabled: false, checkinWeekday: 1 },
      });
      expect(r).toEqual([]);
    });
  });

  describe('el mensaje lleva a dónde ir', () => {
    it('el warn navega al detalle del vehículo', () => {
      const r = plan();
      expect(r[0].data).toEqual({ screen: 'VehicleDetail', vehicleId: 'veh-1' });
      expect(r[0].vehicleId).toBe('veh-1');
    });

    it('el checkin es del usuario, no de un vehículo', () => {
      const r = plan({
        vehicles: [vehiculo({ status: status({ kmLeft: 5_000, daysLeft: 90, asOf: new Date('2026-07-01T00:00:00.000Z') }) })],
        prefs: { checkinWeekday: 1 },
      });
      expect(r[0].vehicleId).toBeNull();
      expect(r[0].data).toEqual({ screen: 'Alerts' });
    });
  });
});
```

- [ ] **Step 3: Correr los tests para verificar que fallan**

Run: `pnpm test -- push-planner`
Expected: FAIL — `planPushes` no existe (`push-planner.ts` todavía no se escribió).

- [ ] **Step 4: Implementar el planificador**

```ts
// src/modules/notifications/domain/push-planner.ts
// Motor de decisión — PURO. No importa Nest, ni Prisma, ni el SDK de Expo.
// Recibe estado, devuelve la lista exacta de avisos que deberían salir.
// Es el equivalente servidor de app-mobile/src/notifications/plan.ts.
import type { Gauge } from '../../oil/domain/oil-status';
import {
  DIAS_LECTURA_VIEJA,
  DIAS_REPETIR_VENCIDO,
  type NotificationPrefs,
  type PlannerVehicle,
  type PushMessage,
} from './push-message';

const DIA_MS = 86_400_000;

const fmtKm = (n: number) => Math.abs(Math.round(n)).toLocaleString('es-VE');

/** Firma del ciclo vigente: cambiar el aceite la cambia, y solo eso. */
const firmaCiclo = (v: PlannerVehicle) =>
  `${v.lastChangeAt?.toISOString() ?? 'sin-ciclo'}:${v.lastChangeKm ?? 0}`;

/**
 * Días que el vehículo lleva vencido, derivados del MEDIDOR y no de la
 * bitácora — por eso esta función sigue siendo pura.
 *
 * Un vehículo puede estar vencido por km, por tiempo o por los dos, y los dos
 * ejes hablan unidades distintas: `kmLeft` mide km y `daysLeft` mide días.
 * `kmPerDay` es lo que permite traerlos a la misma unidad, y se toma el que
 * lleva más tiempo vencido.
 */
function diasVencido(gauge: Gauge, kmPerDay: number): number {
  const porKm = gauge.kmLeft < 0 && kmPerDay > 0 ? -gauge.kmLeft / kmPerDay : 0;
  const porTiempo = gauge.daysLeft < 0 ? -gauge.daysLeft : 0;
  return Math.max(porKm, porTiempo);
}

/** Año y número de semana ISO: hace que el checkin sea uno por semana. */
function semanaIso(d: Date): string {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  // Al jueves de esa semana: la semana ISO es la que contiene su jueves.
  x.setUTCDate(x.getUTCDate() + 4 - (x.getUTCDay() || 7));
  const inicio = new Date(Date.UTC(x.getUTCFullYear(), 0, 1));
  const semana = Math.ceil(((x.getTime() - inicio.getTime()) / DIA_MS + 1) / 7);
  return `${x.getUTCFullYear()}-W${String(semana).padStart(2, '0')}`;
}

export function planPushes(input: {
  now: Date;
  userId: string;
  prefs: NotificationPrefs;
  vehicles: PlannerVehicle[];
  yaEnviado: Set<string>;
}): PushMessage[] {
  const { now, userId, prefs, vehicles, yaEnviado } = input;

  // Sin el interruptor maestro el plan es vacío, sin caso especial por tipo.
  if (!prefs.enabled) return [];

  const out: PushMessage[] = [];
  const agregar = (m: PushMessage) => {
    if (!yaEnviado.has(m.sig)) out.push(m);
  };

  for (const v of vehicles) {
    const g = v.status.gauge;
    // Sin ciclo no hay nada que vencer.
    if (!g) continue;

    if (g.kmLeft <= 0 || g.daysLeft <= 0) {
      if (!prefs.overdueEnabled) continue;
      const tramo = Math.floor(diasVencido(g, v.kmPerDay) / DIAS_REPETIR_VENCIDO);
      agregar({
        kind: 'overdue',
        userId,
        vehicleId: v.id,
        title: 'Cambio de aceite vencido',
        body:
          g.kmLeft <= 0
            ? `${v.label} pasó ${fmtKm(g.kmLeft)} km del cambio recomendado.`
            : `${v.label} pasó ${fmtKm(g.daysLeft)} días del cambio recomendado.`,
        sig: `overdue:${v.id}:${firmaCiclo(v)}:${tramo}`,
        data: { screen: 'VehicleDetail', vehicleId: v.id },
      });
      continue;
    }

    if (g.kmLeft <= prefs.warnThresholdKm) {
      if (!prefs.warnEnabled) continue;
      agregar({
        kind: 'warn',
        userId,
        vehicleId: v.id,
        title: 'Cambio de aceite cerca',
        body: `A ${v.label} le quedan ${fmtKm(g.kmLeft)} km para el cambio.`,
        // SIN el tramo: el warn es uno por ciclo y punto.
        sig: `warn:${v.id}:${firmaCiclo(v)}`,
        data: { screen: 'VehicleDetail', vehicleId: v.id },
      });
    }
  }

  // El checkin ya no existe porque "el kilometraje no avanza solo" —acá sí
  // avanza, computeOilStatus lo proyecta—. Existe porque esa proyección se
  // degrada mientras nadie confirme un odómetro real.
  if (prefs.checkinEnabled && now.getUTCDay() + 1 === prefs.checkinWeekday) {
    const viejos = vehicles.filter((v) => {
      const asOf = v.status.odometer?.asOf;
      return asOf !== undefined && (now.getTime() - asOf.getTime()) / DIA_MS > DIAS_LECTURA_VIEJA;
    });

    if (viejos.length > 0) {
      agregar({
        kind: 'checkin',
        userId,
        vehicleId: null,
        title: 'Confírmanos tu kilometraje',
        body:
          viejos.length === 1
            ? `Hace rato no nos dices el odómetro de ${viejos[0].label}. Confírmalo para que el cálculo siga siendo fiel.`
            : `Hace rato no nos dices el odómetro de ${viejos.length} de tus vehículos. Confírmalo para que el cálculo siga siendo fiel.`,
        sig: `checkin:${userId}:${semanaIso(now)}`,
        data: { screen: 'Alerts' },
      });
    }
  }

  return out;
}
```

- [ ] **Step 5: Correr los tests para verificar que pasan**

Run: `pnpm test -- push-planner`
Expected: PASS, los 18 casos.

Si falla el caso "cuenta por el eje que lleva más tiempo vencido", revisa que `diasVencido` tome el `max` y no el `min`: el `min` sería el eje que se venció primero, que no es lo mismo.

- [ ] **Step 6: Commit**

```bash
git add src/modules/notifications/domain/
git commit -m "feat(push): planificador puro de avisos, con dedupe por firma del hecho"
```

---

## Task 3: Puertos y repositorios

**Files:**
- Create: `src/modules/notifications/domain/device-token.repository.ts`
- Create: `src/modules/notifications/domain/notification-pref.repository.ts`
- Create: `src/modules/notifications/domain/notification-log.repository.ts`
- Create: `src/modules/notifications/testing/in-memory-device-token.repository.ts`
- Create: `src/modules/notifications/testing/in-memory-notification-pref.repository.ts`
- Create: `src/modules/notifications/testing/in-memory-notification-log.repository.ts`
- Create: `src/infra/prisma/prisma-device-token.repository.ts`
- Create: `src/infra/prisma/prisma-notification-pref.repository.ts`
- Create: `src/infra/prisma/prisma-notification-log.repository.ts`
- Test: `test/prisma-push.repository.e2e-spec.ts`

**Interfaces:**
- Consumes: `NotificationPrefs` de Task 2, `PrismaService`.
- Produces:
  - `DEVICE_TOKEN_REPOSITORY`, `type DeviceToken`, `interface DeviceTokenRepository { registrar(d): Promise<DeviceToken>; eliminar(token): Promise<void>; apagar(token): Promise<void>; activosDe(userId): Promise<DeviceToken[]> }`
  - `NOTIFICATION_PREF_REPOSITORY`, `interface NotificationPrefRepository { obtener(userId): Promise<NotificationPrefs>; guardar(userId, patch): Promise<NotificationPrefs> }`
  - `NOTIFICATION_LOG_REPOSITORY`, `type LogEntry`, `interface NotificationLogRepository { firmasDe(userId): Promise<Set<string>>; registrar(e): Promise<void>; pendientesDeReceipt(limite): Promise<LogEntry[]>; marcarReceipt(ticketId, error): Promise<void> }`

- [ ] **Step 1: Escribir los puertos**

```ts
// src/modules/notifications/domain/device-token.repository.ts
// El token de dispositivo como lo entiende el negocio. Sin tipos de Prisma.
export const DEVICE_TOKEN_REPOSITORY = Symbol('DEVICE_TOKEN_REPOSITORY');

export type DevicePlatform = 'IOS' | 'ANDROID';

export type DeviceToken = {
  id: string;
  userId: string;
  token: string;
  platform: DevicePlatform;
  lastSeenAt: Date;
  disabledAt: Date | null;
};

export type NuevoDeviceToken = {
  userId: string;
  token: string;
  platform: DevicePlatform;
};

export interface DeviceTokenRepository {
  /**
   * Upsert POR TOKEN, no por (usuario, token). Si la fila ya existe con otro
   * dueño, se reasigna: un token identifica una instalación, y el dueño
   * anterior no puede seguir recibiendo avisos en un teléfono ajeno.
   * Revive el token apagado poniendo `disabledAt` en null.
   */
  registrar(data: NuevoDeviceToken): Promise<DeviceToken>;
  /** Baja explícita al cerrar sesión. No falla si no existe. */
  eliminar(token: string): Promise<void>;
  /** Lo que hace `DeviceNotRegistered`: apaga sin perder el historial. */
  apagar(token: string): Promise<void>;
  /** Solo los que no están apagados. */
  activosDe(userId: string): Promise<DeviceToken[]>;
}
```

```ts
// src/modules/notifications/domain/notification-pref.repository.ts
import type { NotificationPrefs } from './push-message';

export const NOTIFICATION_PREF_REPOSITORY = Symbol('NOTIFICATION_PREF_REPOSITORY');

export interface NotificationPrefRepository {
  /** Sin fila devuelve DEFAULT_PREFS y NO escribe: leer no crea nada. */
  obtener(userId: string): Promise<NotificationPrefs>;
  /** Upsert parcial: las claves ausentes del patch no se tocan. */
  guardar(userId: string, patch: Partial<NotificationPrefs>): Promise<NotificationPrefs>;
}
```

```ts
// src/modules/notifications/domain/notification-log.repository.ts
import type { PushKind } from './push-message';

export const NOTIFICATION_LOG_REPOSITORY = Symbol('NOTIFICATION_LOG_REPOSITORY');

export type LogEntry = {
  id: string;
  userId: string;
  vehicleId: string | null;
  kind: PushKind;
  sig: string;
  ticketId: string | null;
  sentAt: Date;
};

export type NuevoLogEntry = Omit<LogEntry, 'id' | 'sentAt'>;

export interface NotificationLogRepository {
  /**
   * Las firmas vigentes del usuario: exactamente lo que `planPushes` recibe
   * como `yaEnviado`. Se limita a los últimos 90 días porque una firma de
   * hace un año no puede repetirse (el ciclo cambió) y la consulta no tiene
   * por qué crecer para siempre.
   */
  firmasDe(userId: string): Promise<Set<string>>;
  registrar(entrada: NuevoLogEntry): Promise<void>;
  /** Enviados con ticket y sin receipt todavía, del más viejo al más nuevo. */
  pendientesDeReceipt(limite: number): Promise<LogEntry[]>;
  marcarReceipt(ticketId: string, error: string | null): Promise<void>;
}
```

- [ ] **Step 2: Escribir el test e2e que falla**

```ts
// test/prisma-push.repository.e2e-spec.ts
import 'dotenv/config';
import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from '../src/config/env.validation';
import { PrismaService } from '../src/infra/prisma/prisma.service';
import { PrismaDeviceTokenRepository } from '../src/infra/prisma/prisma-device-token.repository';
import { PrismaNotificationPrefRepository } from '../src/infra/prisma/prisma-notification-pref.repository';
import { PrismaNotificationLogRepository } from '../src/infra/prisma/prisma-notification-log.repository';
import { DEFAULT_PREFS } from '../src/modules/notifications/domain/push-message';
import { emailE2E, limpiarUsuariosE2E } from './support/e2e-db';

describe('Repositorios de push contra Postgres (e2e)', () => {
  let prisma: PrismaService;
  let tokens: PrismaDeviceTokenRepository;
  let prefs: PrismaNotificationPrefRepository;
  let logs: PrismaNotificationLogRepository;

  const crearUsuario = async () =>
    prisma.user.create({
      data: {
        email: emailE2E('push'),
        cedula: `V${Math.floor(10_000_000 + Math.random() * 89_999_999)}`,
        passwordHash: 'no-importa',
        fullName: 'Luis Guerrero',
        phone: '+58 414 528 9012',
      },
    });

  beforeAll(async () => {
    const mod = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true, validate: validateEnv })],
      providers: [
        PrismaService,
        PrismaDeviceTokenRepository,
        PrismaNotificationPrefRepository,
        PrismaNotificationLogRepository,
      ],
    }).compile();
    prisma = mod.get(PrismaService);
    await prisma.onModuleInit();
    tokens = mod.get(PrismaDeviceTokenRepository);
    prefs = mod.get(PrismaNotificationPrefRepository);
    logs = mod.get(PrismaNotificationLogRepository);
  });

  afterAll(async () => {
    await limpiarUsuariosE2E(prisma);
    await prisma.onModuleDestroy();
  });

  describe('DeviceToken', () => {
    // EL test de este archivo: es la regla de privacidad del esquema.
    it('registrar el mismo token con otro usuario lo reasigna, no lo duplica', async () => {
      const a = await crearUsuario();
      const b = await crearUsuario();
      const t = `ExponentPushToken[reasignar-${Date.now()}]`;

      await tokens.registrar({ userId: a.id, token: t, platform: 'ANDROID' });
      await tokens.registrar({ userId: b.id, token: t, platform: 'ANDROID' });

      expect(await prisma.deviceToken.count({ where: { token: t } })).toBe(1);
      expect(await tokens.activosDe(a.id)).toEqual([]);
      expect((await tokens.activosDe(b.id)).map((x) => x.token)).toEqual([t]);
    });

    it('registrar un token apagado lo revive', async () => {
      const u = await crearUsuario();
      const t = `ExponentPushToken[revivir-${Date.now()}]`;

      await tokens.registrar({ userId: u.id, token: t, platform: 'IOS' });
      await tokens.apagar(t);
      expect(await tokens.activosDe(u.id)).toEqual([]);

      await tokens.registrar({ userId: u.id, token: t, platform: 'IOS' });
      expect((await tokens.activosDe(u.id)).map((x) => x.token)).toEqual([t]);
    });

    it('eliminar un token que no existe no revienta', async () => {
      await expect(tokens.eliminar('ExponentPushToken[fantasma]')).resolves.toBeUndefined();
    });
  });

  describe('NotificationPref', () => {
    it('sin fila devuelve los valores por defecto y no escribe', async () => {
      const u = await crearUsuario();
      expect(await prefs.obtener(u.id)).toEqual(DEFAULT_PREFS);
      expect(await prisma.notificationPref.count({ where: { userId: u.id } })).toBe(0);
    });

    it('guardar parcial no pisa lo que no vino', async () => {
      const u = await crearUsuario();
      await prefs.guardar(u.id, { warnThresholdKm: 300 });
      const r = await prefs.guardar(u.id, { checkinEnabled: false });

      expect(r.warnThresholdKm).toBe(300);
      expect(r.checkinEnabled).toBe(false);
      expect(r.enabled).toBe(true);
    });
  });

  describe('NotificationLog', () => {
    it('firmasDe devuelve lo registrado del usuario', async () => {
      const u = await crearUsuario();
      await logs.registrar({
        userId: u.id, vehicleId: null, kind: 'checkin',
        sig: 'checkin:x:2026-W38', ticketId: 'tk-1',
      });

      expect(await logs.firmasDe(u.id)).toEqual(new Set(['checkin:x:2026-W38']));
    });

    it('marcarReceipt saca la entrada de las pendientes', async () => {
      const u = await crearUsuario();
      const tk = `tk-${Date.now()}`;
      await logs.registrar({
        userId: u.id, vehicleId: null, kind: 'checkin', sig: `s-${tk}`, ticketId: tk,
      });
      expect((await logs.pendientesDeReceipt(100)).some((e) => e.ticketId === tk)).toBe(true);

      await logs.marcarReceipt(tk, null);
      expect((await logs.pendientesDeReceipt(100)).some((e) => e.ticketId === tk)).toBe(false);
    });
  });
});
```

- [ ] **Step 3: Correr el test para verificar que falla**

Run: `pnpm test:e2e -- prisma-push`
Expected: FAIL — no existen los módulos de los repositorios.

- [ ] **Step 4: Implementar los tres adaptadores de Prisma**

```ts
// src/infra/prisma/prisma-device-token.repository.ts
// Frontera con Prisma. Entra y sale el tipo de DOMINIO.
import { Injectable } from '@nestjs/common';
import type { DeviceToken as Row } from '@prisma/client';
import type {
  DeviceToken,
  DeviceTokenRepository,
  NuevoDeviceToken,
} from '../../modules/notifications/domain/device-token.repository';
import { PrismaService } from './prisma.service';

@Injectable()
export class PrismaDeviceTokenRepository implements DeviceTokenRepository {
  constructor(private readonly prisma: PrismaService) {}

  private toDomain(r: Row): DeviceToken {
    return {
      id: r.id,
      userId: r.userId,
      token: r.token,
      platform: r.platform,
      lastSeenAt: r.lastSeenAt,
      disabledAt: r.disabledAt,
    };
  }

  async registrar(data: NuevoDeviceToken): Promise<DeviceToken> {
    // El `update` reasigna userId a propósito: ver el comentario del puerto.
    const row = await this.prisma.deviceToken.upsert({
      where: { token: data.token },
      create: { userId: data.userId, token: data.token, platform: data.platform },
      update: {
        userId: data.userId,
        platform: data.platform,
        lastSeenAt: new Date(),
        disabledAt: null,
      },
    });
    return this.toDomain(row);
  }

  async eliminar(token: string): Promise<void> {
    await this.prisma.deviceToken.deleteMany({ where: { token } });
  }

  async apagar(token: string): Promise<void> {
    await this.prisma.deviceToken.updateMany({
      where: { token },
      data: { disabledAt: new Date() },
    });
  }

  async activosDe(userId: string): Promise<DeviceToken[]> {
    const rows = await this.prisma.deviceToken.findMany({
      where: { userId, disabledAt: null },
    });
    return rows.map((r) => this.toDomain(r));
  }
}
```

```ts
// src/infra/prisma/prisma-notification-pref.repository.ts
import { Injectable } from '@nestjs/common';
import type { NotificationPref as Row } from '@prisma/client';
import type { NotificationPrefRepository } from '../../modules/notifications/domain/notification-pref.repository';
import {
  DEFAULT_PREFS,
  type NotificationPrefs,
} from '../../modules/notifications/domain/push-message';
import { PrismaService } from './prisma.service';

@Injectable()
export class PrismaNotificationPrefRepository implements NotificationPrefRepository {
  constructor(private readonly prisma: PrismaService) {}

  private toDomain(r: Row): NotificationPrefs {
    return {
      enabled: r.enabled,
      warnEnabled: r.warnEnabled,
      overdueEnabled: r.overdueEnabled,
      checkinEnabled: r.checkinEnabled,
      warnThresholdKm: r.warnThresholdKm,
      checkinWeekday: r.checkinWeekday,
    };
  }

  async obtener(userId: string): Promise<NotificationPrefs> {
    const row = await this.prisma.notificationPref.findUnique({ where: { userId } });
    // Sin fila se devuelven los valores por defecto SIN escribir: un GET no
    // debe crear filas para los usuarios que nunca tocaron la pantalla.
    return row ? this.toDomain(row) : DEFAULT_PREFS;
  }

  async guardar(
    userId: string,
    patch: Partial<NotificationPrefs>,
  ): Promise<NotificationPrefs> {
    const row = await this.prisma.notificationPref.upsert({
      where: { userId },
      create: { userId, ...patch },
      update: patch,
    });
    return this.toDomain(row);
  }
}
```

```ts
// src/infra/prisma/prisma-notification-log.repository.ts
import { Injectable } from '@nestjs/common';
import type { NotificationLog as Row } from '@prisma/client';
import type {
  LogEntry,
  NotificationLogRepository,
  NuevoLogEntry,
} from '../../modules/notifications/domain/notification-log.repository';
import type { PushKind } from '../../modules/notifications/domain/push-message';
import { PrismaService } from './prisma.service';

const DIAS_VIGENCIA = 90;

@Injectable()
export class PrismaNotificationLogRepository implements NotificationLogRepository {
  constructor(private readonly prisma: PrismaService) {}

  private toDomain(r: Row): LogEntry {
    return {
      id: r.id,
      userId: r.userId,
      vehicleId: r.vehicleId,
      kind: r.kind as PushKind,
      sig: r.sig,
      ticketId: r.ticketId,
      sentAt: r.sentAt,
    };
  }

  async firmasDe(userId: string): Promise<Set<string>> {
    const desde = new Date(Date.now() - DIAS_VIGENCIA * 86_400_000);
    const rows = await this.prisma.notificationLog.findMany({
      where: { userId, sentAt: { gte: desde } },
      select: { sig: true },
    });
    return new Set(rows.map((r) => r.sig));
  }

  async registrar(entrada: NuevoLogEntry): Promise<void> {
    await this.prisma.notificationLog.create({ data: entrada });
  }

  async pendientesDeReceipt(limite: number): Promise<LogEntry[]> {
    const rows = await this.prisma.notificationLog.findMany({
      where: { ticketId: { not: null }, receiptAt: null },
      orderBy: { sentAt: 'asc' },
      take: limite,
    });
    return rows.map((r) => this.toDomain(r));
  }

  async marcarReceipt(ticketId: string, error: string | null): Promise<void> {
    await this.prisma.notificationLog.updateMany({
      where: { ticketId },
      data: { receiptAt: new Date(), receiptError: error },
    });
  }
}
```

- [ ] **Step 5: Escribir los tres repositorios en memoria**

Los usan los tests de los servicios (Tasks 7 y 8) para no necesitar base. Siguen el patrón de `src/modules/brands/testing/in-memory-brand.repository.ts`.

```ts
// src/modules/notifications/testing/in-memory-device-token.repository.ts
import type {
  DeviceToken,
  DeviceTokenRepository,
  NuevoDeviceToken,
} from '../domain/device-token.repository';

export class InMemoryDeviceTokenRepository implements DeviceTokenRepository {
  readonly filas = new Map<string, DeviceToken>();
  private n = 0;

  async registrar(data: NuevoDeviceToken): Promise<DeviceToken> {
    const previo = this.filas.get(data.token);
    const fila: DeviceToken = {
      id: previo?.id ?? `dt-${++this.n}`,
      userId: data.userId,
      token: data.token,
      platform: data.platform,
      lastSeenAt: new Date(),
      disabledAt: null,
    };
    this.filas.set(data.token, fila);
    return fila;
  }

  async eliminar(token: string): Promise<void> {
    this.filas.delete(token);
  }

  async apagar(token: string): Promise<void> {
    const f = this.filas.get(token);
    if (f) this.filas.set(token, { ...f, disabledAt: new Date() });
  }

  async activosDe(userId: string): Promise<DeviceToken[]> {
    return [...this.filas.values()].filter(
      (f) => f.userId === userId && f.disabledAt === null,
    );
  }
}
```

```ts
// src/modules/notifications/testing/in-memory-notification-pref.repository.ts
import type { NotificationPrefRepository } from '../domain/notification-pref.repository';
import { DEFAULT_PREFS, type NotificationPrefs } from '../domain/push-message';

export class InMemoryNotificationPrefRepository implements NotificationPrefRepository {
  readonly filas = new Map<string, NotificationPrefs>();

  async obtener(userId: string): Promise<NotificationPrefs> {
    return this.filas.get(userId) ?? DEFAULT_PREFS;
  }

  async guardar(
    userId: string,
    patch: Partial<NotificationPrefs>,
  ): Promise<NotificationPrefs> {
    const actual = this.filas.get(userId) ?? DEFAULT_PREFS;
    const nuevo = { ...actual, ...patch };
    this.filas.set(userId, nuevo);
    return nuevo;
  }
}
```

```ts
// src/modules/notifications/testing/in-memory-notification-log.repository.ts
import type {
  LogEntry,
  NotificationLogRepository,
  NuevoLogEntry,
} from '../domain/notification-log.repository';

export class InMemoryNotificationLogRepository implements NotificationLogRepository {
  readonly filas: (LogEntry & { receiptAt: Date | null })[] = [];
  private n = 0;

  async firmasDe(userId: string): Promise<Set<string>> {
    return new Set(this.filas.filter((f) => f.userId === userId).map((f) => f.sig));
  }

  async registrar(entrada: NuevoLogEntry): Promise<void> {
    this.filas.push({ ...entrada, id: `log-${++this.n}`, sentAt: new Date(), receiptAt: null });
  }

  async pendientesDeReceipt(limite: number): Promise<LogEntry[]> {
    return this.filas.filter((f) => f.ticketId !== null && f.receiptAt === null).slice(0, limite);
  }

  async marcarReceipt(ticketId: string, _error: string | null): Promise<void> {
    for (const f of this.filas) {
      if (f.ticketId === ticketId) f.receiptAt = new Date();
    }
  }
}
```

- [ ] **Step 6: Correr el test para verificar que pasa**

Run: `pnpm test:e2e -- prisma-push`
Expected: PASS, los siete casos.

- [ ] **Step 7: Commit**

```bash
git add src/modules/notifications/domain src/modules/notifications/testing src/infra/prisma test/prisma-push.repository.e2e-spec.ts
git commit -m "feat(push): puertos y repositorios de tokens, preferencias y bitacora"
```

---

## Task 4: El puerto de envío y el adaptador de Expo

**Files:**
- Create: `src/modules/notifications/domain/push-sender.ts`
- Create: `src/modules/notifications/testing/fake-push.sender.ts`
- Create: `src/infra/expo/expo-push.sender.ts`
- Modify: `src/config/env.validation.ts`
- Modify: `.env.example`
- Test: `src/infra/expo/expo-push.sender.spec.ts`
- Test: `src/config/env.validation.spec.ts` (agregar casos)

**Interfaces:**
- Consumes: `PushMessage` de Task 2.
- Produces:
  - `PUSH_SENDER`
  - `type PushTicket = { ok: true; id: string } | { ok: false; code: string; message: string }`
  - `type PushReceipt = { ticketId: string; error: string | null }`
  - `interface PushSender { enviar(envios: EnvioPush[]): Promise<PushTicket[]>; receipts(ticketIds: string[]): Promise<PushReceipt[]> }`
  - `type EnvioPush = { token: string; mensaje: PushMessage }`
  - `FakePushSender` con `readonly enviados: EnvioPush[]` y `ticketsPorDevolver`
  - Env: `EXPO_ACCESS_TOKEN?: string`, `PUSH_ENABLED: boolean` (default `true`)

- [ ] **Step 1: Escribir el puerto y el doble de prueba**

```ts
// src/modules/notifications/domain/push-sender.ts
// El puerto de salida. Lo implementa ExpoPushSender en producción y
// FakePushSender en los tests: ningún test le pega a los servidores de Expo.
import type { PushMessage } from './push-message';

export const PUSH_SENDER = Symbol('PUSH_SENDER');

export type EnvioPush = { token: string; mensaje: PushMessage };

/** Uno por envío y EN EL MISMO ORDEN que la lista que entró. */
export type PushTicket =
  | { ok: true; id: string }
  | { ok: false; code: string; message: string };

export type PushReceipt = { ticketId: string; error: string | null };

export interface PushSender {
  enviar(envios: EnvioPush[]): Promise<PushTicket[]>;
  receipts(ticketIds: string[]): Promise<PushReceipt[]>;
}
```

```ts
// src/modules/notifications/testing/fake-push.sender.ts
import type {
  EnvioPush,
  PushReceipt,
  PushSender,
  PushTicket,
} from '../domain/push-sender';

export class FakePushSender implements PushSender {
  readonly enviados: EnvioPush[] = [];
  /** Se consume en orden; agotada, devuelve tickets ok con id correlativo. */
  ticketsPorDevolver: PushTicket[] = [];
  receiptsPorDevolver: PushReceipt[] = [];
  private n = 0;

  async enviar(envios: EnvioPush[]): Promise<PushTicket[]> {
    this.enviados.push(...envios);
    return envios.map(
      () => this.ticketsPorDevolver.shift() ?? { ok: true as const, id: `tk-${++this.n}` },
    );
  }

  async receipts(ticketIds: string[]): Promise<PushReceipt[]> {
    if (this.receiptsPorDevolver.length > 0) return this.receiptsPorDevolver;
    return ticketIds.map((ticketId) => ({ ticketId, error: null }));
  }
}
```

- [ ] **Step 2: Escribir el test del adaptador que falla**

```ts
// src/infra/expo/expo-push.sender.spec.ts
import { ExpoPushSender } from './expo-push.sender';
import type { PushMessage } from '../../modules/notifications/domain/push-message';

const mensaje = (id: string): PushMessage => ({
  kind: 'warn',
  userId: 'u1',
  vehicleId: id,
  title: 'Cambio de aceite cerca',
  body: 'body',
  sig: `warn:${id}`,
  data: { screen: 'VehicleDetail', vehicleId: id },
});

describe('ExpoPushSender', () => {
  it('traduce un ticket ok del SDK al ticket del dominio', async () => {
    const sender = new ExpoPushSender({
      chunkPushNotifications: (m: unknown[]) => [m],
      sendPushNotificationsAsync: async () => [{ status: 'ok', id: 'XYZ' }],
      chunkPushNotificationReceiptIds: (ids: string[]) => [ids],
      getPushNotificationReceiptsAsync: async () => ({}),
    } as never);

    const r = await sender.enviar([{ token: 'ExponentPushToken[a]', mensaje: mensaje('v1') }]);
    expect(r).toEqual([{ ok: true, id: 'XYZ' }]);
  });

  it('traduce un ticket con error, conservando el código de Expo', async () => {
    const sender = new ExpoPushSender({
      chunkPushNotifications: (m: unknown[]) => [m],
      sendPushNotificationsAsync: async () => [
        { status: 'error', message: 'no registrado', details: { error: 'DeviceNotRegistered' } },
      ],
      chunkPushNotificationReceiptIds: (ids: string[]) => [ids],
      getPushNotificationReceiptsAsync: async () => ({}),
    } as never);

    const r = await sender.enviar([{ token: 'ExponentPushToken[a]', mensaje: mensaje('v1') }]);
    expect(r).toEqual([{ ok: false, code: 'DeviceNotRegistered', message: 'no registrado' }]);
  });

  it('manda los lotes que arma el SDK y respeta el orden de la lista', async () => {
    const enviados: unknown[][] = [];
    const sender = new ExpoPushSender({
      // Parte de dos en dos para comprobar que se concatenan en orden.
      chunkPushNotifications: (m: unknown[]) => [m.slice(0, 2), m.slice(2)],
      sendPushNotificationsAsync: async (lote: unknown[]) => {
        enviados.push(lote);
        return lote.map((_, i) => ({ status: 'ok', id: `id-${enviados.length}-${i}` }));
      },
      chunkPushNotificationReceiptIds: (ids: string[]) => [ids],
      getPushNotificationReceiptsAsync: async () => ({}),
    } as never);

    const r = await sender.enviar([
      { token: 'ExponentPushToken[a]', mensaje: mensaje('v1') },
      { token: 'ExponentPushToken[b]', mensaje: mensaje('v2') },
      { token: 'ExponentPushToken[c]', mensaje: mensaje('v3') },
    ]);

    expect(enviados).toHaveLength(2);
    expect(r).toEqual([
      { ok: true, id: 'id-1-0' },
      { ok: true, id: 'id-1-1' },
      { ok: true, id: 'id-2-0' },
    ]);
  });

  it('un lote que revienta no tumba los demás: devuelve error por envío', async () => {
    const sender = new ExpoPushSender({
      chunkPushNotifications: (m: unknown[]) => [m],
      sendPushNotificationsAsync: async () => {
        throw new Error('sin red');
      },
      chunkPushNotificationReceiptIds: (ids: string[]) => [ids],
      getPushNotificationReceiptsAsync: async () => ({}),
    } as never);

    const r = await sender.enviar([{ token: 'ExponentPushToken[a]', mensaje: mensaje('v1') }]);
    expect(r).toEqual([{ ok: false, code: 'SEND_FAILED', message: 'sin red' }]);
  });

  it('devuelve el error del receipt y null cuando entregó bien', async () => {
    const sender = new ExpoPushSender({
      chunkPushNotifications: (m: unknown[]) => [m],
      sendPushNotificationsAsync: async () => [],
      chunkPushNotificationReceiptIds: (ids: string[]) => [ids],
      getPushNotificationReceiptsAsync: async () => ({
        'tk-1': { status: 'ok' },
        'tk-2': { status: 'error', message: 'x', details: { error: 'DeviceNotRegistered' } },
      }),
    } as never);

    expect(await sender.receipts(['tk-1', 'tk-2'])).toEqual([
      { ticketId: 'tk-1', error: null },
      { ticketId: 'tk-2', error: 'DeviceNotRegistered' },
    ]);
  });
});
```

- [ ] **Step 3: Correr el test para verificar que falla**

Run: `pnpm test -- expo-push.sender`
Expected: FAIL — no existe `src/infra/expo/expo-push.sender.ts`.

- [ ] **Step 4: Instalar la dependencia e implementar el adaptador**

```bash
pnpm add expo-server-sdk
```

```ts
// src/infra/expo/expo-push.sender.ts
// ÚNICO archivo del backend que importa expo-server-sdk. Todo lo demás habla
// con el puerto PUSH_SENDER, y por eso ningún test sale a la red.
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Expo, type ExpoPushMessage } from 'expo-server-sdk';
import type {
  EnvioPush,
  PushReceipt,
  PushSender,
  PushTicket,
} from '../../modules/notifications/domain/push-sender';

@Injectable()
export class ExpoPushSender implements PushSender {
  private readonly expo: Expo;

  // Recibe el cliente ya armado para poder inyectar un doble en los tests. En
  // la app real lo construye la factory del módulo con el access token.
  constructor(expo: Expo) {
    this.expo = expo;
  }

  static desdeConfig(config: ConfigService): ExpoPushSender {
    return new ExpoPushSender(
      new Expo({
        // Sin él, cualquiera que consiga un token de push de la app puede
        // mandarle notificaciones a los usuarios haciéndose pasar por nosotros.
        accessToken: config.get<string>('EXPO_ACCESS_TOKEN'),
        useFcmV1: true,
      }),
    );
  }

  async enviar(envios: EnvioPush[]): Promise<PushTicket[]> {
    if (envios.length === 0) return [];

    const mensajes: ExpoPushMessage[] = envios.map(({ token, mensaje }) => ({
      to: token,
      title: mensaje.title,
      body: mensaje.body,
      data: mensaje.data,
      sound: 'default',
      channelId: 'oil-reminders',
    }));

    const tickets: PushTicket[] = [];
    for (const lote of this.expo.chunkPushNotifications(mensajes)) {
      try {
        const res = await this.expo.sendPushNotificationsAsync(lote);
        for (const t of res) {
          tickets.push(
            t.status === 'ok'
              ? { ok: true, id: t.id }
              : {
                  ok: false,
                  code: t.details?.error ?? 'UNKNOWN',
                  message: t.message,
                },
          );
        }
      } catch (e) {
        // Un lote caído no puede tumbar los demás: se marcan sus envíos como
        // fallidos y el barrido de mañana los vuelve a intentar.
        const message = e instanceof Error ? e.message : 'error desconocido';
        for (let i = 0; i < lote.length; i++) {
          tickets.push({ ok: false, code: 'SEND_FAILED', message });
        }
      }
    }
    return tickets;
  }

  async receipts(ticketIds: string[]): Promise<PushReceipt[]> {
    const out: PushReceipt[] = [];
    for (const lote of this.expo.chunkPushNotificationReceiptIds(ticketIds)) {
      try {
        const res = await this.expo.getPushNotificationReceiptsAsync(lote);
        for (const [ticketId, r] of Object.entries(res)) {
          out.push({
            ticketId,
            error: r.status === 'ok' ? null : (r.details?.error ?? 'UNKNOWN'),
          });
        }
      } catch {
        // Sin receipt no se marca nada: queda pendiente y se reintenta.
      }
    }
    return out;
  }
}
```

- [ ] **Step 5: Agregar las variables de entorno**

En `src/config/env.validation.ts`, dentro de `EnvVars`:

```ts
  // Activa la seguridad reforzada de Expo para push. Opcional porque en
  // desarrollo se envía sin ella, pero en producción debe estar: sin el
  // token, cualquiera que consiga un ExpoPushToken de la app puede mandarle
  // notificaciones a los usuarios haciéndose pasar por nosotros.
  @IsOptional()
  @IsString()
  EXPO_ACCESS_TOKEN?: string;

  // En `false` los cron no se registran. Es lo que permite correr los e2e y
  // el desarrollo local sin que un barrido dispare envíos de verdad.
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value !== 'false' && value !== false)
  PUSH_ENABLED: boolean = true;
```

En `.env.example`:

```
# Notificaciones push. EXPO_ACCESS_TOKEN sale de expo.dev → Access Tokens y
# activa la seguridad reforzada: sin él, cualquiera con un token de push de la
# app puede mandarle notificaciones a tus usuarios.
EXPO_ACCESS_TOKEN=""

# Ponlo en "false" para que los cron de push no se registren (desarrollo, e2e).
PUSH_ENABLED=true
```

- [ ] **Step 6: Agregar los casos al test del entorno**

En `src/config/env.validation.spec.ts`, dentro del describe existente:

```ts
  describe('notificaciones push', () => {
    it('PUSH_ENABLED es true si no se declara', () => {
      expect(validateEnv(base()).PUSH_ENABLED).toBe(true);
    });

    it('la cadena "false" lo apaga', () => {
      expect(validateEnv({ ...base(), PUSH_ENABLED: 'false' }).PUSH_ENABLED).toBe(false);
    });

    it('EXPO_ACCESS_TOKEN es opcional', () => {
      expect(validateEnv(base()).EXPO_ACCESS_TOKEN).toBeUndefined();
    });
  });
```

Usa el helper que ya exista en ese archivo para armar un entorno válido; si se llama distinto de `base()`, ajusta el nombre.

- [ ] **Step 7: Correr los tests para verificar que pasan**

Run: `pnpm test -- expo-push.sender env.validation`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add package.json pnpm-lock.yaml src/infra/expo src/modules/notifications src/config .env.example
git commit -m "feat(push): puerto de envio y adaptador de expo-server-sdk"
```

---

## Task 5: El despachador

Cablea las piezas: lee estado, llama al planificador, envía, apaga tokens muertos y anota en la bitácora. No decide **qué** avisar — eso es del planificador — sino **a qué dispositivos** y **qué queda anotado**.

**Files:**
- Create: `src/modules/notifications/push-dispatch.service.ts`
- Test: `src/modules/notifications/push-dispatch.service.spec.ts`

**Interfaces:**
- Consumes: `planPushes`, `PlannerVehicle` (Task 2); los tres puertos (Task 3); `PUSH_SENDER` (Task 4).
- Produces:
  - `type ResultadoDespacho = { planificados: number; enviados: number; fallidos: number; tokensApagados: number }`
  - `class PushDispatchService { despacharUsuario(userId: string, vehiculos: PlannerVehicle[], now?: Date): Promise<ResultadoDespacho> }`

- [ ] **Step 1: Escribir los tests que fallan**

```ts
// src/modules/notifications/push-dispatch.service.spec.ts
import { Test } from '@nestjs/testing';
import { DEVICE_TOKEN_REPOSITORY } from './domain/device-token.repository';
import { NOTIFICATION_LOG_REPOSITORY } from './domain/notification-log.repository';
import { NOTIFICATION_PREF_REPOSITORY } from './domain/notification-pref.repository';
import { PUSH_SENDER } from './domain/push-sender';
import type { PlannerVehicle } from './domain/push-message';
import type { OilStatus } from '../oil/domain/oil-status';
import { PushDispatchService } from './push-dispatch.service';
import { FakePushSender } from './testing/fake-push.sender';
import { InMemoryDeviceTokenRepository } from './testing/in-memory-device-token.repository';
import { InMemoryNotificationLogRepository } from './testing/in-memory-notification-log.repository';
import { InMemoryNotificationPrefRepository } from './testing/in-memory-notification-pref.repository';

const AHORA = new Date('2026-09-22T13:00:00.000Z'); // martes: no hay checkin
const USER = 'user-1';

const vencido: OilStatus = {
  computedAt: AHORA,
  gauge: { pct: 0, status: 'danger', limitedBy: 'km', kmLeft: -800, daysLeft: 20 },
  odometer: { km: 50_800, source: 'estimated', asOf: new Date('2026-09-20T00:00:00.000Z') },
};

const veh: PlannerVehicle = {
  id: 'veh-1',
  label: 'Toyota Corolla',
  kmPerDay: 40,
  lastChangeKm: 45_000,
  lastChangeAt: new Date('2026-03-01T00:00:00.000Z'),
  status: vencido,
};

describe('PushDispatchService', () => {
  let service: PushDispatchService;
  let devices: InMemoryDeviceTokenRepository;
  let prefs: InMemoryNotificationPrefRepository;
  let logs: InMemoryNotificationLogRepository;
  let sender: FakePushSender;

  beforeEach(async () => {
    devices = new InMemoryDeviceTokenRepository();
    prefs = new InMemoryNotificationPrefRepository();
    logs = new InMemoryNotificationLogRepository();
    sender = new FakePushSender();

    const mod = await Test.createTestingModule({
      providers: [
        PushDispatchService,
        { provide: DEVICE_TOKEN_REPOSITORY, useValue: devices },
        { provide: NOTIFICATION_PREF_REPOSITORY, useValue: prefs },
        { provide: NOTIFICATION_LOG_REPOSITORY, useValue: logs },
        { provide: PUSH_SENDER, useValue: sender },
      ],
    }).compile();

    service = mod.get(PushDispatchService);
  });

  const conDispositivos = async (...tokens: string[]) => {
    for (const t of tokens) {
      await devices.registrar({ userId: USER, token: t, platform: 'ANDROID' });
    }
  };

  it('manda el aviso a cada dispositivo activo del usuario', async () => {
    await conDispositivos('ExponentPushToken[a]', 'ExponentPushToken[b]');

    const r = await service.despacharUsuario(USER, [veh], AHORA);

    expect(sender.enviados.map((e) => e.token)).toEqual([
      'ExponentPushToken[a]',
      'ExponentPushToken[b]',
    ]);
    expect(r.enviados).toBe(2);
    expect(r.planificados).toBe(1);
  });

  // Si anotara la firma sin haber mandado nada, el usuario que registra su
  // teléfono mañana no recibiría el aviso de un vehículo que YA está vencido.
  it('sin dispositivos no anota la firma: el aviso sigue pendiente', async () => {
    const r = await service.despacharUsuario(USER, [veh], AHORA);

    expect(sender.enviados).toEqual([]);
    expect(await logs.firmasDe(USER)).toEqual(new Set());
    expect(r.enviados).toBe(0);
  });

  it('el segundo despacho del mismo hecho no manda nada', async () => {
    await conDispositivos('ExponentPushToken[a]');

    await service.despacharUsuario(USER, [veh], AHORA);
    const segundo = await service.despacharUsuario(USER, [veh], AHORA);

    expect(sender.enviados).toHaveLength(1);
    expect(segundo.planificados).toBe(0);
  });

  it('DeviceNotRegistered apaga el token', async () => {
    await conDispositivos('ExponentPushToken[muerto]');
    sender.ticketsPorDevolver = [
      { ok: false, code: 'DeviceNotRegistered', message: 'desinstalada' },
    ];

    const r = await service.despacharUsuario(USER, [veh], AHORA);

    expect(await devices.activosDe(USER)).toEqual([]);
    expect(r.tokensApagados).toBe(1);
  });

  // El fallo de red no debe "gastar" el aviso: si anotara la firma, el
  // usuario nunca se enteraría de que su aceite está vencido.
  it('un envío fallido no anota la firma y mañana se reintenta', async () => {
    await conDispositivos('ExponentPushToken[a]');
    sender.ticketsPorDevolver = [{ ok: false, code: 'SEND_FAILED', message: 'sin red' }];

    const primero = await service.despacharUsuario(USER, [veh], AHORA);
    expect(primero.fallidos).toBe(1);
    expect(await logs.firmasDe(USER)).toEqual(new Set());

    const segundo = await service.despacharUsuario(USER, [veh], AHORA);
    expect(segundo.planificados).toBe(1);
  });

  it('si un dispositivo recibe y otro falla, la firma queda anotada', async () => {
    await conDispositivos('ExponentPushToken[a]', 'ExponentPushToken[b]');
    sender.ticketsPorDevolver = [
      { ok: true, id: 'tk-ok' },
      { ok: false, code: 'SEND_FAILED', message: 'sin red' },
    ];

    await service.despacharUsuario(USER, [veh], AHORA);
    const segundo = await service.despacharUsuario(USER, [veh], AHORA);

    expect(segundo.planificados).toBe(0);
  });

  it('con las preferencias apagadas no llama al emisor', async () => {
    await conDispositivos('ExponentPushToken[a]');
    await prefs.guardar(USER, { enabled: false });

    await service.despacharUsuario(USER, [veh], AHORA);

    expect(sender.enviados).toEqual([]);
  });
});
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

Run: `pnpm test -- push-dispatch`
Expected: FAIL — no existe `PushDispatchService`.

- [ ] **Step 3: Implementar el despachador**

```ts
// src/modules/notifications/push-dispatch.service.ts
// Cableado, no decisión: quién decide qué avisar es planPushes. Acá se
// resuelve a qué dispositivos va, qué se apaga y qué queda anotado.
import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  DEVICE_TOKEN_REPOSITORY,
  type DeviceTokenRepository,
} from './domain/device-token.repository';
import {
  NOTIFICATION_LOG_REPOSITORY,
  type NotificationLogRepository,
} from './domain/notification-log.repository';
import {
  NOTIFICATION_PREF_REPOSITORY,
  type NotificationPrefRepository,
} from './domain/notification-pref.repository';
import type { PlannerVehicle, PushMessage } from './domain/push-message';
import {
  PUSH_SENDER,
  type EnvioPush,
  type PushSender,
} from './domain/push-sender';
import { planPushes } from './domain/push-planner';

export type ResultadoDespacho = {
  planificados: number;
  enviados: number;
  fallidos: number;
  tokensApagados: number;
};

const VACIO: ResultadoDespacho = {
  planificados: 0,
  enviados: 0,
  fallidos: 0,
  tokensApagados: 0,
};

@Injectable()
export class PushDispatchService {
  private readonly log = new Logger(PushDispatchService.name);

  constructor(
    @Inject(DEVICE_TOKEN_REPOSITORY)
    private readonly devices: DeviceTokenRepository,
    @Inject(NOTIFICATION_PREF_REPOSITORY)
    private readonly prefs: NotificationPrefRepository,
    @Inject(NOTIFICATION_LOG_REPOSITORY)
    private readonly bitacora: NotificationLogRepository,
    @Inject(PUSH_SENDER) private readonly sender: PushSender,
  ) {}

  async despacharUsuario(
    userId: string,
    vehiculos: PlannerVehicle[],
    now: Date = new Date(),
  ): Promise<ResultadoDespacho> {
    const [prefs, yaEnviado] = await Promise.all([
      this.prefs.obtener(userId),
      this.bitacora.firmasDe(userId),
    ]);

    const mensajes = planPushes({ now, userId, prefs, vehicles: vehiculos, yaEnviado });
    if (mensajes.length === 0) return VACIO;

    const tokens = await this.devices.activosDe(userId);
    // Sin dispositivos NO se anota nada: anotar la firma "gastaría" el aviso,
    // y quien registre su teléfono mañana no se enteraría de un vehículo que
    // ya está vencido hoy.
    if (tokens.length === 0) return { ...VACIO, planificados: mensajes.length };

    const envios: EnvioPush[] = [];
    for (const mensaje of mensajes) {
      for (const t of tokens) envios.push({ token: t.token, mensaje });
    }

    const tickets = await this.sender.enviar(envios);

    let enviados = 0;
    let fallidos = 0;
    let tokensApagados = 0;
    // Una entrada de bitácora POR ENVÍO, no por mensaje: el receipt es por
    // ticket, y así cada uno se puede casar con el suyo. El dedupe no se
    // entera, porque `firmasDe` devuelve un Set.
    const anotar: { mensaje: PushMessage; ticketId: string }[] = [];

    for (let i = 0; i < envios.length; i++) {
      const ticket = tickets[i];
      const envio = envios[i];

      if (ticket?.ok) {
        enviados++;
        anotar.push({ mensaje: envio.mensaje, ticketId: ticket.id });
        continue;
      }

      fallidos++;
      if (ticket?.code === 'DeviceNotRegistered') {
        await this.devices.apagar(envio.token);
        tokensApagados++;
      } else if (ticket?.code === 'InvalidCredentials') {
        // No es problema del usuario: es configuración nuestra, y sin esto
        // nadie recibe nada. Tiene que verse.
        this.log.error(`Credenciales de push inválidas: ${ticket.message}`);
      }
    }

    for (const a of anotar) {
      await this.bitacora.registrar({
        userId,
        vehicleId: a.mensaje.vehicleId,
        kind: a.mensaje.kind,
        sig: a.mensaje.sig,
        ticketId: a.ticketId,
      });
    }

    return { planificados: mensajes.length, enviados, fallidos, tokensApagados };
  }
}
```

- [ ] **Step 4: Correr los tests para verificar que pasan**

Run: `pnpm test -- push-dispatch`
Expected: PASS, los siete casos.

- [ ] **Step 5: Commit**

```bash
git add src/modules/notifications/push-dispatch.service.ts src/modules/notifications/push-dispatch.service.spec.ts
git commit -m "feat(push): despachador que envia, apaga tokens muertos y anota la bitacora"
```

---

## Task 6: El barrido, el cron y el módulo

**Files:**
- Create: `src/modules/notifications/push-sweep.service.ts`
- Create: `src/modules/notifications/notifications.cron.ts`
- Create: `src/modules/notifications/notifications.module.ts`
- Modify: `src/app.module.ts`
- Modify: `src/modules/oil/oil.module.ts` (exportar lo que el barrido necesita)
- Test: `src/modules/notifications/push-sweep.service.spec.ts`

**Interfaces:**
- Consumes: `PushDispatchService` (Task 5), `VEHICLE_REPOSITORY`, `OIL_CHANGE_REPOSITORY`, `ODOMETER_REPOSITORY` (módulo oil), `computeOilStatus`.
- Produces:
  - `class PushSweepService { run(now?: Date): Promise<{ usuarios: number; enviados: number }>; vehiculosDe(userId: string, now: Date): Promise<PlannerVehicle[]> }`
  - `NotificationsModule`, que exporta `PushDispatchService` y `PushSweepService`.

- [ ] **Step 1: Escribir los tests que fallan**

```ts
// src/modules/notifications/push-sweep.service.spec.ts
import { Test } from '@nestjs/testing';
import { PushSweepService } from './push-sweep.service';
import { PushDispatchService } from './push-dispatch.service';
import { VEHICLE_REPOSITORY } from '../oil/domain/vehicle.repository';
import { OIL_CHANGE_REPOSITORY } from '../oil/domain/oil-change.repository';
import { ODOMETER_REPOSITORY } from '../oil/domain/odometer.repository';
import { PrismaService } from '../../infra/prisma/prisma.service';

const AHORA = new Date('2026-09-22T13:00:00.000Z');

describe('PushSweepService', () => {
  const despachos: string[] = [];
  let service: PushSweepService;
  let lockConcedido = true;

  const vehiculos = [
    {
      id: 'veh-1', userId: 'user-1', kind: 'CAR' as const, brand: 'Toyota',
      model: 'Corolla', year: 2018, plate: 'AB123CD', color: 'Gris',
      kmPerDay: 40, kmPerDaySource: 'DECLARED' as const,
      lastChangeKm: 45_000, lastChangeAt: new Date('2026-03-01T00:00:00.000Z'),
      nextChangeKm: 50_000, nextChangeDueAt: new Date('2026-09-01T00:00:00.000Z'),
    },
    {
      id: 'veh-2', userId: 'user-2', kind: 'MOTO' as const, brand: 'Bera',
      model: 'BR200', year: 2021, plate: 'ZZ999ZZ', color: 'Negro',
      kmPerDay: 15, kmPerDaySource: 'DECLARED' as const,
      lastChangeKm: 8_000, lastChangeAt: new Date('2026-08-01T00:00:00.000Z'),
      nextChangeKm: 10_000, nextChangeDueAt: new Date('2027-02-01T00:00:00.000Z'),
    },
  ];

  beforeEach(async () => {
    despachos.length = 0;
    lockConcedido = true;

    const mod = await Test.createTestingModule({
      providers: [
        PushSweepService,
        {
          provide: PushDispatchService,
          useValue: {
            despacharUsuario: (userId: string) => {
              despachos.push(userId);
              return Promise.resolve({
                planificados: 1, enviados: 1, fallidos: 0, tokensApagados: 0,
              });
            },
          },
        },
        {
          provide: VEHICLE_REPOSITORY,
          useValue: {
            findAll: () => Promise.resolve(vehiculos),
            findByUser: (u: string) =>
              Promise.resolve(vehiculos.filter((v) => v.userId === u)),
          },
        },
        { provide: OIL_CHANGE_REPOSITORY, useValue: { findLatest: () => Promise.resolve(null) } },
        { provide: ODOMETER_REPOSITORY, useValue: { findLatest: () => Promise.resolve(null) } },
        {
          provide: PrismaService,
          useValue: {
            $queryRaw: () => Promise.resolve([{ pg_try_advisory_lock: lockConcedido }]),
            $executeRaw: () => Promise.resolve(1),
          },
        },
      ],
    }).compile();

    service = mod.get(PushSweepService);
  });

  it('despacha una vez por usuario, no una vez por vehículo', async () => {
    const r = await service.run(AHORA);

    expect(despachos.sort()).toEqual(['user-1', 'user-2']);
    expect(r.usuarios).toBe(2);
  });

  // Con dos instancias del API, las dos despiertan a las 9:00. Sin el lock,
  // al usuario le llegan dos notificaciones idénticas.
  it('sin el lock no despacha a nadie', async () => {
    lockConcedido = false;

    const r = await service.run(AHORA);

    expect(despachos).toEqual([]);
    expect(r.usuarios).toBe(0);
  });

  it('un usuario que revienta no aborta el barrido', async () => {
    const mod = await Test.createTestingModule({
      providers: [
        PushSweepService,
        {
          provide: PushDispatchService,
          useValue: {
            despacharUsuario: (userId: string) => {
              if (userId === 'user-1') return Promise.reject(new Error('boom'));
              despachos.push(userId);
              return Promise.resolve({
                planificados: 0, enviados: 0, fallidos: 0, tokensApagados: 0,
              });
            },
          },
        },
        {
          provide: VEHICLE_REPOSITORY,
          useValue: { findAll: () => Promise.resolve(vehiculos) },
        },
        { provide: OIL_CHANGE_REPOSITORY, useValue: { findLatest: () => Promise.resolve(null) } },
        { provide: ODOMETER_REPOSITORY, useValue: { findLatest: () => Promise.resolve(null) } },
        {
          provide: PrismaService,
          useValue: {
            $queryRaw: () => Promise.resolve([{ pg_try_advisory_lock: true }]),
            $executeRaw: () => Promise.resolve(1),
          },
        },
      ],
    }).compile();

    await expect(mod.get(PushSweepService).run(AHORA)).resolves.toBeDefined();
    expect(despachos).toEqual(['user-2']);
  });
});
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

Run: `pnpm test -- push-sweep`
Expected: FAIL — no existe `PushSweepService`, y `VehicleRepository` no tiene `findAll`.

- [ ] **Step 3: Agregar `findAll` al puerto de vehículos**

El barrido necesita recorrer todos los vehículos de todos los usuarios. Ya existe `listAllIds()`, que devuelve solo ids y obligaría a una consulta por vehículo.

En `src/modules/oil/domain/vehicle.repository.ts`, dentro de `VehicleRepository`:

```ts
  /** Todos los vehículos de todos los usuarios. Lo usa el barrido de push. */
  findAll(): Promise<Vehicle[]>;
```

En `src/infra/prisma/prisma-vehicle.repository.ts`, junto a los demás métodos (usa el `toDomain` que ya tiene ese archivo):

```ts
  async findAll(): Promise<Vehicle[]> {
    const rows = await this.prisma.vehicle.findMany();
    return rows.map((r) => this.toDomain(r));
  }
```

Si `src/modules/oil/testing/` tiene un `InMemoryVehicleRepository`, agrégale el método devolviendo todas sus filas, o el build de los tests del módulo oil se rompe.

- [ ] **Step 4: Implementar el barrido**

```ts
// src/modules/notifications/push-sweep.service.ts
// El barrido diario. No lo llama el @Cron directamente por lógica sino por
// delegación: esto es un método normal, así que un test —o un endpoint el día
// que haga falta— lo puede llamar igual.
import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { computeOilStatus } from '../oil/domain/oil-status.calculator';
import {
  OIL_CHANGE_REPOSITORY,
  type OilChangeRepository,
} from '../oil/domain/oil-change.repository';
import {
  ODOMETER_REPOSITORY,
  type OdometerRepository,
} from '../oil/domain/odometer.repository';
import {
  VEHICLE_REPOSITORY,
  type Vehicle,
  type VehicleRepository,
} from '../oil/domain/vehicle.repository';
import type { PlannerVehicle } from './domain/push-message';
import { PushDispatchService } from './push-dispatch.service';

/** Cualquier número fijo sirve; solo tiene que ser el mismo en toda instancia. */
const LOCK_BARRIDO = 815_243;

@Injectable()
export class PushSweepService {
  private readonly log = new Logger(PushSweepService.name);

  constructor(
    private readonly dispatch: PushDispatchService,
    @Inject(VEHICLE_REPOSITORY) private readonly vehicles: VehicleRepository,
    @Inject(OIL_CHANGE_REPOSITORY) private readonly changes: OilChangeRepository,
    @Inject(ODOMETER_REPOSITORY) private readonly odometer: OdometerRepository,
    private readonly prisma: PrismaService,
  ) {}

  /** Traduce un vehículo del dominio a lo que el planificador entiende. */
  private async aPlanner(v: Vehicle, now: Date): Promise<PlannerVehicle> {
    const [ultimo, lectura] = await Promise.all([
      this.changes.findLatest(v.id),
      this.odometer.findLatest(v.id),
    ]);

    const status = computeOilStatus({
      now,
      kmPerDay: v.kmPerDay,
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
      id: v.id,
      label: `${v.brand} ${v.model}`,
      kmPerDay: v.kmPerDay,
      lastChangeKm: v.lastChangeKm,
      lastChangeAt: v.lastChangeAt,
      status,
    };
  }

  /** Los vehículos de un usuario, listos para el planificador. */
  async vehiculosDe(userId: string, now: Date): Promise<PlannerVehicle[]> {
    const suyos = await this.vehicles.findByUser(userId);
    return Promise.all(suyos.map((v) => this.aPlanner(v, now)));
  }

  async run(now: Date = new Date()): Promise<{ usuarios: number; enviados: number }> {
    // Con más de una instancia del API, las dos despiertan a las 9:00 y al
    // usuario le llegarían dos notificaciones idénticas. El lock se suelta
    // solo al cerrar la conexión, así que se libera explícitamente al final.
    const [{ pg_try_advisory_lock: concedido }] = await this.prisma.$queryRaw<
      { pg_try_advisory_lock: boolean }[]
    >`SELECT pg_try_advisory_lock(${LOCK_BARRIDO})`;

    if (!concedido) {
      this.log.log('Barrido saltado: otra instancia lo está corriendo.');
      return { usuarios: 0, enviados: 0 };
    }

    try {
      const todos = await this.vehicles.findAll();

      const porUsuario = new Map<string, Vehicle[]>();
      for (const v of todos) {
        const lista = porUsuario.get(v.userId) ?? [];
        lista.push(v);
        porUsuario.set(v.userId, lista);
      }

      let usuarios = 0;
      let enviados = 0;

      for (const [userId, suyos] of porUsuario) {
        try {
          const planner = await Promise.all(suyos.map((v) => this.aPlanner(v, now)));
          const r = await this.dispatch.despacharUsuario(userId, planner, now);
          usuarios++;
          enviados += r.enviados;
        } catch (e) {
          // Un usuario con datos raros no puede dejar sin avisos a los demás.
          this.log.error(`Barrido: falló el usuario ${userId}`, e as Error);
        }
      }

      this.log.log(`Barrido: ${usuarios} usuarios, ${enviados} envíos.`);
      return { usuarios, enviados };
    } finally {
      await this.prisma.$executeRaw`SELECT pg_advisory_unlock(${LOCK_BARRIDO})`;
    }
  }
}
```

- [ ] **Step 5: Escribir el cron y el módulo**

```ts
// src/modules/notifications/notifications.cron.ts
// Los relojes, y nada más. Toda la lógica está en los servicios, para que un
// test pueda llamarla sin esperar a las 9 de la mañana.
import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ReceiptsService } from './receipts.service';
import { PushSweepService } from './push-sweep.service';

@Injectable()
export class NotificationsCron {
  constructor(
    private readonly sweep: PushSweepService,
    private readonly receipts: ReceiptsService,
  ) {}

  // Venezuela no mueve el reloj en todo el año, así que el offset es fijo y
  // no existe la sorpresa clásica del horario de verano.
  @Cron('0 9 * * *', { timeZone: 'America/Caracas' })
  async barridoDiario(): Promise<void> {
    await this.sweep.run();
  }

  // Expo confirma la entrega real unos 15 minutos después del envío.
  @Cron('*/30 * * * *')
  async revisarReceipts(): Promise<void> {
    await this.receipts.procesarPendientes();
  }
}
```

El cuerpo de `ReceiptsService` llega en la Task 10. Para que el cron compile ahora, créalo con la firma definitiva y una implementación que no hace nada — la Task 10 reemplaza el archivo entero:

```ts
// src/modules/notifications/receipts.service.ts
import { Injectable } from '@nestjs/common';

@Injectable()
export class ReceiptsService {
  /** Lo implementa la Task 10. */
  async procesarPendientes(): Promise<{ revisados: number; tokensApagados: number }> {
    return { revisados: 0, tokensApagados: 0 };
  }
}
```

```ts
// src/modules/notifications/notifications.module.ts
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ExpoPushSender } from '../../infra/expo/expo-push.sender';
import { PrismaDeviceTokenRepository } from '../../infra/prisma/prisma-device-token.repository';
import { PrismaNotificationLogRepository } from '../../infra/prisma/prisma-notification-log.repository';
import { PrismaNotificationPrefRepository } from '../../infra/prisma/prisma-notification-pref.repository';
import { OilModule } from '../oil/oil.module';
import { DEVICE_TOKEN_REPOSITORY } from './domain/device-token.repository';
import { NOTIFICATION_LOG_REPOSITORY } from './domain/notification-log.repository';
import { NOTIFICATION_PREF_REPOSITORY } from './domain/notification-pref.repository';
import { PUSH_SENDER } from './domain/push-sender';
import { NotificationsCron } from './notifications.cron';
import { PushDispatchService } from './push-dispatch.service';
import { PushSweepService } from './push-sweep.service';
import { ReceiptsService } from './receipts.service';
import { DevicesController } from './devices.controller';
import { NotificationPrefsController } from './notification-prefs.controller';

@Module({
  // El barrido necesita los tres repositorios del módulo oil.
  imports: [OilModule],
  controllers: [DevicesController, NotificationPrefsController],
  providers: [
    PushDispatchService,
    PushSweepService,
    ReceiptsService,
    NotificationsCron,
    { provide: DEVICE_TOKEN_REPOSITORY, useClass: PrismaDeviceTokenRepository },
    { provide: NOTIFICATION_PREF_REPOSITORY, useClass: PrismaNotificationPrefRepository },
    { provide: NOTIFICATION_LOG_REPOSITORY, useClass: PrismaNotificationLogRepository },
    {
      provide: PUSH_SENDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ExpoPushSender.desdeConfig(config),
    },
  ],
  exports: [PushDispatchService, PushSweepService],
})
export class NotificationsModule {}
```

`DevicesController` y `NotificationPrefsController` llegan en las Tasks 7 y 8. Para que esta tarea compile, quita las dos líneas de `controllers` y sus imports, y vuelve a ponerlas en la Task 7.

`OilModule` tiene que exportar lo que el barrido inyecta. En `src/modules/oil/oil.module.ts`, agrega al decorador:

```ts
  exports: [VEHICLE_REPOSITORY, OIL_CHANGE_REPOSITORY, ODOMETER_REPOSITORY],
```

- [ ] **Step 6: Registrar el módulo, con el cron detrás del interruptor**

En `src/app.module.ts`, junto a los demás imports:

```ts
import { ScheduleModule } from '@nestjs/schedule';
import { NotificationsModule } from './modules/notifications/notifications.module';
```

y dentro de `imports`, después de `ColorsModule`:

```ts
    // El interruptor decide si los cron llegan a registrarse. Sin él, correr
    // los e2e o levantar la app en local dispararía envíos de verdad.
    ...(process.env.PUSH_ENABLED === 'false' ? [] : [ScheduleModule.forRoot()]),
    NotificationsModule,
```

Instala el paquete:

```bash
pnpm add @nestjs/schedule
```

`NotificationsCron` solo tiene efecto si `ScheduleModule` está registrado: sin él los `@Cron` son decoradores inertes, así que no hace falta condicionar también el provider.

- [ ] **Step 7: Correr los tests y el arranque**

Run: `pnpm test -- push-sweep && pnpm build`
Expected: PASS los tres casos, y el build sin errores de TypeScript.

Run: `PUSH_ENABLED=false pnpm start` y confirma en el log que la app levanta sin trazas de `NotificationsCron`. Corta con Ctrl-C.

- [ ] **Step 8: Commit**

```bash
git add package.json pnpm-lock.yaml src/modules/notifications src/modules/oil src/infra/prisma/prisma-vehicle.repository.ts src/app.module.ts
git commit -m "feat(push): barrido diario con lock de postgres y cron detras de PUSH_ENABLED"
```

---

## Task 7: Endpoints de dispositivos

**Files:**
- Create: `src/modules/notifications/dto/register-device.dto.ts`
- Create: `src/modules/notifications/devices.controller.ts`
- Modify: `src/modules/notifications/notifications.module.ts` (devolver `controllers`)
- Test: `test/push-devices.e2e-spec.ts`

**Interfaces:**
- Consumes: `DEVICE_TOKEN_REPOSITORY` (Task 3), `esTokenExpo` (Task 2), `JwtAuthGuard`, `CurrentUser`.
- Produces: `POST /me/devices` (201, cuerpo `{ token, platform }`), `DELETE /me/devices/:token` (204).

- [ ] **Step 1: Escribir el test e2e que falla**

```ts
// test/push-devices.e2e-spec.ts
import 'dotenv/config';
process.env.THROTTLE_AUTH_LIMIT = '1000';
process.env.PUSH_ENABLED = 'false';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { PrismaService } from '../src/infra/prisma/prisma.service';
import { emailE2E, limpiarUsuariosE2E } from './support/e2e-db';

const nuevoUsuario = () => ({
  fullName: 'Luis Guerrero',
  cedula: `V${Math.floor(10_000_000 + Math.random() * 89_999_999)}`,
  email: emailE2E('devices'),
  phone: '+58 414 528 9012',
  state: 'Distrito Capital',
  city: 'Caracas',
  password: 'contrasena1',
});

describe('Dispositivos para push (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const http = () => request(app.getHttpServer() as Parameters<typeof request>[0]);

  const registrarUsuario = async (): Promise<string> => {
    const r = await http().post('/auth/register').send(nuevoUsuario()).expect(201);
    return (r.body as { accessToken: string }).accessToken;
  };

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await limpiarUsuariosE2E(prisma);
    await app.close();
  });

  const TOKEN = () => `ExponentPushToken[e2e-${Date.now()}-${Math.random().toString(36).slice(2)}]`;

  it('registra un token y responde 201', async () => {
    const jwt = await registrarUsuario();
    const token = TOKEN();

    await http()
      .post('/me/devices')
      .set('Authorization', `Bearer ${jwt}`)
      .send({ token, platform: 'ANDROID' })
      .expect(201);

    expect(await prisma.deviceToken.count({ where: { token } })).toBe(1);
  });

  it('registrar dos veces el mismo token es idempotente', async () => {
    const jwt = await registrarUsuario();
    const token = TOKEN();
    const cuerpo = { token, platform: 'IOS' };

    await http().post('/me/devices').set('Authorization', `Bearer ${jwt}`).send(cuerpo).expect(201);
    await http().post('/me/devices').set('Authorization', `Bearer ${jwt}`).send(cuerpo).expect(201);

    expect(await prisma.deviceToken.count({ where: { token } })).toBe(1);
  });

  it('rechaza un token que no tiene formato de Expo', async () => {
    const jwt = await registrarUsuario();

    await http()
      .post('/me/devices')
      .set('Authorization', `Bearer ${jwt}`)
      .send({ token: 'cualquier-cosa', platform: 'ANDROID' })
      .expect(400);
  });

  it('rechaza una plataforma desconocida', async () => {
    const jwt = await registrarUsuario();

    await http()
      .post('/me/devices')
      .set('Authorization', `Bearer ${jwt}`)
      .send({ token: TOKEN(), platform: 'WINDOWS_PHONE' })
      .expect(400);
  });

  it('da de baja el token y responde 204', async () => {
    const jwt = await registrarUsuario();
    const token = TOKEN();

    await http().post('/me/devices').set('Authorization', `Bearer ${jwt}`).send({ token, platform: 'ANDROID' }).expect(201);
    await http().delete(`/me/devices/${encodeURIComponent(token)}`).set('Authorization', `Bearer ${jwt}`).expect(204);

    expect(await prisma.deviceToken.count({ where: { token } })).toBe(0);
  });

  it('dar de baja un token que no existe también responde 204', async () => {
    const jwt = await registrarUsuario();

    await http()
      .delete(`/me/devices/${encodeURIComponent('ExponentPushToken[fantasma]')}`)
      .set('Authorization', `Bearer ${jwt}`)
      .expect(204);
  });

  it('sin sesión responde 401', async () => {
    await http().post('/me/devices').send({ token: TOKEN(), platform: 'ANDROID' }).expect(401);
  });
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `pnpm test:e2e -- push-devices`
Expected: FAIL — 404 en `/me/devices`.

- [ ] **Step 3: Escribir el DTO**

```ts
// src/modules/notifications/dto/register-device.dto.ts
// Cuerpo de POST /me/devices. Sin @Transform: no hay nada que normalizar y el
// par @Transform + @IsOptional es justo el que convierte un campo ausente en
// '' y rebota lo que el cliente nunca mandó.
import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, Validate, ValidatorConstraint, type ValidatorConstraintInterface } from 'class-validator';
import { esTokenExpo } from '../domain/push-message';

@ValidatorConstraint({ name: 'esTokenExpo' })
export class TokenExpoValido implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return esTokenExpo(value);
  }

  defaultMessage(): string {
    return 'El token no tiene formato de ExpoPushToken.';
  }
}

export class RegisterDeviceDto {
  @ApiProperty({
    example: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]',
    description: 'El token que devuelve getExpoPushTokenAsync en el dispositivo.',
  })
  @IsString()
  @Validate(TokenExpoValido)
  token!: string;

  @ApiProperty({ enum: ['IOS', 'ANDROID'], example: 'ANDROID' })
  @IsIn(['IOS', 'ANDROID'])
  platform!: 'IOS' | 'ANDROID';
}
```

- [ ] **Step 4: Escribir el controlador**

```ts
// src/modules/notifications/devices.controller.ts
// Solo HTTP: recibe DTO, delega, responde. Cero reglas de negocio.
import {
  Body, Controller, Delete, HttpCode, HttpStatus, Inject, Param, Post, UseGuards,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiNoContentResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { User } from '../users/domain/user';
import {
  DEVICE_TOKEN_REPOSITORY,
  type DeviceTokenRepository,
} from './domain/device-token.repository';
import { RegisterDeviceDto } from './dto/register-device.dto';

@ApiTags('Notificaciones')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('me/devices')
export class DevicesController {
  constructor(
    @Inject(DEVICE_TOKEN_REPOSITORY)
    private readonly devices: DeviceTokenRepository,
  ) {}

  @ApiOperation({
    summary: 'Registrar el dispositivo para recibir notificaciones',
    description:
      'Idempotente: la app lo llama en cada arranque. Si el token ya existía con otro dueño, se reasigna — un token identifica una instalación, no una sesión.',
  })
  // La app lo llama en cada arranque, igual que refresh y me: es
  // comportamiento normal, no alguien adivinando credenciales.
  @SkipThrottle({ auth: true })
  @Post()
  async registrar(
    @CurrentUser() user: User,
    @Body() dto: RegisterDeviceDto,
  ): Promise<{ ok: true }> {
    await this.devices.registrar({
      userId: user.id,
      token: dto.token,
      platform: dto.platform,
    });
    return { ok: true };
  }

  @ApiOperation({
    summary: 'Dar de baja el dispositivo',
    description: 'Se llama al cerrar sesión. Responde 204 aunque el token no exista.',
  })
  @ApiNoContentResponse()
  @SkipThrottle({ auth: true })
  @Delete(':token')
  @HttpCode(HttpStatus.NO_CONTENT)
  async eliminar(@Param('token') token: string): Promise<void> {
    await this.devices.eliminar(token);
  }
}
```

- [ ] **Step 5: Devolver los controladores al módulo**

En `src/modules/notifications/notifications.module.ts`, repón `controllers: [DevicesController]` y su import. `NotificationPrefsController` llega en la Task 8.

- [ ] **Step 6: Correr el test para verificar que pasa**

Run: `pnpm test:e2e -- push-devices`
Expected: PASS, los siete casos.

- [ ] **Step 7: Commit**

```bash
git add src/modules/notifications test/push-devices.e2e-spec.ts
git commit -m "feat(push): endpoints para registrar y dar de baja un dispositivo"
```

---

## Task 8: Endpoints de preferencias

**Files:**
- Create: `src/modules/notifications/dto/update-prefs.dto.ts`
- Create: `src/modules/notifications/dto/prefs-response.dto.ts`
- Create: `src/modules/notifications/notification-prefs.controller.ts`
- Modify: `src/modules/notifications/notifications.module.ts`
- Test: `src/modules/notifications/dto/update-prefs.dto.spec.ts`
- Test: `test/push-prefs.e2e-spec.ts`

**Interfaces:**
- Consumes: `NOTIFICATION_PREF_REPOSITORY` (Task 3), `NotificationPrefs` (Task 2).
- Produces: `GET /me/notification-prefs` y `PATCH /me/notification-prefs`, ambos devolviendo `PrefsResponseDto` (la forma de `NotificationPrefs`).

- [ ] **Step 1: Escribir el test unitario del DTO que falla**

El PATCH parcial es donde este repo ya tropezó una vez. Este test existe para que no vuelva a pasar.

```ts
// src/modules/notifications/dto/update-prefs.dto.spec.ts
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { UpdatePrefsDto } from './update-prefs.dto';

const construir = (cuerpo: Record<string, unknown>) => plainToInstance(UpdatePrefsDto, cuerpo);

const errores = (cuerpo: Record<string, unknown>) =>
  validateSync(construir(cuerpo), { whitelist: true, forbidNonWhitelisted: true }).map(
    (e) => e.property,
  );

describe('UpdatePrefsDto', () => {
  it('deja en undefined lo que no se mandó', () => {
    const dto = construir({ enabled: false });

    expect(dto.enabled).toBe(false);
    expect(dto.warnEnabled).toBeUndefined();
    expect(dto.warnThresholdKm).toBeUndefined();
    expect(dto.checkinWeekday).toBeUndefined();
  });

  it('valida sin errores mandando un solo campo', () => {
    expect(errores({ enabled: false })).toEqual([]);
  });

  it('acepta un cuerpo vacío: guardar sin cambiar nada no es un error', () => {
    expect(errores({})).toEqual([]);
  });

  it('rechaza un umbral fuera de rango', () => {
    expect(errores({ warnThresholdKm: 0 })).toContain('warnThresholdKm');
    expect(errores({ warnThresholdKm: 20_000 })).toContain('warnThresholdKm');
  });

  it('rechaza un día de la semana fuera de 1..7', () => {
    expect(errores({ checkinWeekday: 0 })).toContain('checkinWeekday');
    expect(errores({ checkinWeekday: 8 })).toContain('checkinWeekday');
  });

  it('rechaza campos que no son del recurso', () => {
    expect(errores({ userId: 'x' })).toContain('userId');
  });
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `pnpm test -- update-prefs.dto`
Expected: FAIL — no existe el DTO.

- [ ] **Step 3: Escribir los DTO**

```ts
// src/modules/notifications/dto/update-prefs.dto.ts
// Cuerpo de PATCH /me/notification-prefs: todo opcional.
//
// Deliberadamente SIN ningún @Transform. Los @Transform corren también sobre
// las claves ausentes, y ese par —@Transform junto a @IsOptional— es el que
// convierte un `undefined` en `''` y hace rebotar un campo que el cliente
// nunca mandó. Acá no hay nada que normalizar, así que la tentación no existe;
// si algún día hace falta, se envuelve con el helper `siViene` de
// users/dto/update-profile.dto.ts.
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';

export class UpdatePrefsDto {
  @ApiPropertyOptional({ description: 'Interruptor maestro. En false no sale ningún aviso.' })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ description: 'Avisar cuando falte poco para el cambio.' })
  @IsOptional()
  @IsBoolean()
  warnEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Avisar cuando el cambio ya esté vencido.' })
  @IsOptional()
  @IsBoolean()
  overdueEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Recordatorio semanal para confirmar el kilometraje.' })
  @IsOptional()
  @IsBoolean()
  checkinEnabled?: boolean;

  @ApiPropertyOptional({ minimum: 100, maximum: 5_000, example: 500 })
  @IsOptional()
  @IsInt()
  @Min(100)
  @Max(5_000)
  warnThresholdKm?: number;

  @ApiPropertyOptional({
    minimum: 1, maximum: 7, example: 1,
    description: 'Día del recordatorio semanal. Domingo = 1, como el trigger WEEKLY de Expo.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(7)
  checkinWeekday?: number;
}
```

```ts
// src/modules/notifications/dto/prefs-response.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import type { NotificationPrefs } from '../domain/push-message';

export class PrefsResponseDto {
  @ApiProperty() enabled!: boolean;
  @ApiProperty() warnEnabled!: boolean;
  @ApiProperty() overdueEnabled!: boolean;
  @ApiProperty() checkinEnabled!: boolean;
  @ApiProperty({ example: 500 }) warnThresholdKm!: number;
  @ApiProperty({ example: 1, description: 'Domingo = 1.' }) checkinWeekday!: number;
}

export const toPrefsResponse = (p: NotificationPrefs): PrefsResponseDto => ({
  enabled: p.enabled,
  warnEnabled: p.warnEnabled,
  overdueEnabled: p.overdueEnabled,
  checkinEnabled: p.checkinEnabled,
  warnThresholdKm: p.warnThresholdKm,
  checkinWeekday: p.checkinWeekday,
});
```

- [ ] **Step 4: Escribir el controlador**

```ts
// src/modules/notifications/notification-prefs.controller.ts
import { Body, Controller, Get, Inject, Patch, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { User } from '../users/domain/user';
import {
  NOTIFICATION_PREF_REPOSITORY,
  type NotificationPrefRepository,
} from './domain/notification-pref.repository';
import { PrefsResponseDto, toPrefsResponse } from './dto/prefs-response.dto';
import { UpdatePrefsDto } from './dto/update-prefs.dto';

@ApiTags('Notificaciones')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('me/notification-prefs')
export class NotificationPrefsController {
  constructor(
    @Inject(NOTIFICATION_PREF_REPOSITORY)
    private readonly prefs: NotificationPrefRepository,
  ) {}

  @ApiOperation({
    summary: 'Preferencias de notificación de la cuenta',
    description:
      'Quien nunca las tocó recibe los valores por defecto. Leerlas no crea la fila.',
  })
  @ApiOkResponse({ type: PrefsResponseDto })
  @SkipThrottle({ auth: true })
  @Get()
  async obtener(@CurrentUser() user: User): Promise<PrefsResponseDto> {
    return toPrefsResponse(await this.prefs.obtener(user.id));
  }

  @ApiOperation({
    summary: 'Cambiar las preferencias de notificación',
    description: 'Parcial: lo que no venga en el cuerpo no se toca.',
  })
  @ApiOkResponse({ type: PrefsResponseDto })
  @SkipThrottle({ auth: true })
  @Patch()
  async actualizar(
    @CurrentUser() user: User,
    @Body() dto: UpdatePrefsDto,
  ): Promise<PrefsResponseDto> {
    return toPrefsResponse(await this.prefs.guardar(user.id, dto));
  }
}
```

Repón `NotificationPrefsController` en `controllers` de `notifications.module.ts`.

- [ ] **Step 5: Escribir el test e2e**

```ts
// test/push-prefs.e2e-spec.ts
import 'dotenv/config';
process.env.THROTTLE_AUTH_LIMIT = '1000';
process.env.PUSH_ENABLED = 'false';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { PrismaService } from '../src/infra/prisma/prisma.service';
import { DEFAULT_PREFS } from '../src/modules/notifications/domain/push-message';
import { emailE2E, limpiarUsuariosE2E } from './support/e2e-db';

const nuevoUsuario = () => ({
  fullName: 'Luis Guerrero',
  cedula: `V${Math.floor(10_000_000 + Math.random() * 89_999_999)}`,
  email: emailE2E('prefs'),
  phone: '+58 414 528 9012',
  state: 'Distrito Capital',
  city: 'Caracas',
  password: 'contrasena1',
});

describe('Preferencias de notificación (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const http = () => request(app.getHttpServer() as Parameters<typeof request>[0]);

  const sesion = async (): Promise<string> => {
    const r = await http().post('/auth/register').send(nuevoUsuario()).expect(201);
    return (r.body as { accessToken: string }).accessToken;
  };

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await limpiarUsuariosE2E(prisma);
    await app.close();
  });

  it('quien nunca las tocó recibe los valores por defecto', async () => {
    const jwt = await sesion();

    const r = await http().get('/me/notification-prefs').set('Authorization', `Bearer ${jwt}`).expect(200);

    expect(r.body).toEqual(DEFAULT_PREFS);
  });

  it('leerlas no crea la fila', async () => {
    const jwt = await sesion();
    const me = await http().get('/auth/me').set('Authorization', `Bearer ${jwt}`).expect(200);
    const userId = (me.body as { id: string }).id;

    await http().get('/me/notification-prefs').set('Authorization', `Bearer ${jwt}`).expect(200);

    expect(await prisma.notificationPref.count({ where: { userId } })).toBe(0);
  });

  it('el PATCH parcial no pisa lo que no vino', async () => {
    const jwt = await sesion();

    await http().patch('/me/notification-prefs').set('Authorization', `Bearer ${jwt}`)
      .send({ warnThresholdKm: 300 }).expect(200);
    const r = await http().patch('/me/notification-prefs').set('Authorization', `Bearer ${jwt}`)
      .send({ checkinEnabled: false }).expect(200);

    expect(r.body).toEqual({ ...DEFAULT_PREFS, warnThresholdKm: 300, checkinEnabled: false });
  });

  it('rechaza un umbral fuera de rango', async () => {
    const jwt = await sesion();

    await http().patch('/me/notification-prefs').set('Authorization', `Bearer ${jwt}`)
      .send({ warnThresholdKm: 99 }).expect(400);
  });

  it('sin sesión responde 401', async () => {
    await http().get('/me/notification-prefs').expect(401);
  });
});
```

- [ ] **Step 6: Correr los tests para verificar que pasan**

Run: `pnpm test -- update-prefs.dto && pnpm test:e2e -- push-prefs`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/modules/notifications test/push-prefs.e2e-spec.ts
git commit -m "feat(push): endpoints de preferencias de notificacion"
```

---

## Task 9: El aviso inmediato por evento

**Files:**
- Modify: `src/modules/oil/oil.service.ts`
- Modify: `src/modules/oil/oil.module.ts`
- Test: `src/modules/oil/oil.service.spec.ts` (agregar casos)

**Interfaces:**
- Consumes: `PushDispatchService` y `PushSweepService.vehiculosDe` (Tasks 5 y 6).
- Produces: nada nuevo hacia afuera. `OilService` gana un método privado `avisarSiCambioElEstado(userId)`.

- [ ] **Step 1: Escribir los tests que fallan**

`OilService` se construye por POSICIÓN en ese archivo (`new OilService(vehicles, changes, odometer, new OilCycleService(...))`), así que sumar dos dependencias al constructor rompe **todos** los `beforeEach` del spec. Hay que pasarles los dos dobles nuevos a cada uno.

Agrega este describe al final de `src/modules/oil/oil.service.spec.ts`:

```ts
describe('OilService — aviso inmediato por push', () => {
  let service: OilService;
  let despachados: string[];
  let dispatch: { despacharUsuario: (userId: string) => Promise<unknown> };

  // El aviso es fuego y olvido: se dispara con `void` y no se espera. Sin
  // vaciar la cola de microtareas, la aserción corre ANTES que el despacho y
  // el test fallaría por carrera, no por un error real.
  const vaciarCola = () => new Promise((r) => setImmediate(r));

  beforeEach(() => {
    despachados = [];
    const vehicles = new InMemoryVehicleRepository();
    const changes = new InMemoryOilChangeRepository();
    const odometer = new InMemoryOdometerRepository();

    dispatch = {
      despacharUsuario: (userId: string) => {
        despachados.push(userId);
        return Promise.resolve({
          planificados: 0, enviados: 0, fallidos: 0, tokensApagados: 0,
        });
      },
    };
    const sweep = { vehiculosDe: () => Promise.resolve([]) };

    service = new OilService(
      vehicles,
      changes,
      odometer,
      new OilCycleService(vehicles, changes),
      dispatch as never,
      sweep as never,
    );
  });

  it('despacha al usuario después de registrar una lectura de odómetro', async () => {
    const v = await service.createVehicle('u1', nuevoVehiculo);

    await service.reportOdometer('u1', v.id, 52_000);
    await vaciarCola();

    expect(despachados).toEqual(['u1']);
  });

  it('despacha al usuario después de registrar un cambio de aceite', async () => {
    const v = await service.createVehicle('u1', nuevoVehiculo);

    await service.registerOilChange('u1', v.id, {
      changedAt: new Date('2026-09-20T00:00:00.000Z'),
      km: 50_000,
      intervalKm: 5_000,
      intervalMonths: 6,
      oilBrand: 'Mobil',
      oilTag: 'Super',
      oilViscosity: '20W50',
      oilSynthetic: false,
      shop: null,
      costUsd: null,
    });
    await vaciarCola();

    expect(despachados).toEqual(['u1']);
  });

  // El push es un extra: si Expo está caído, el cambio del usuario YA quedó
  // guardado y la petición tiene que responder bien igual.
  it('un fallo del push no tumba la operación', async () => {
    const v = await service.createVehicle('u1', nuevoVehiculo);
    dispatch.despacharUsuario = () => Promise.reject(new Error('Expo caído'));

    await expect(service.reportOdometer('u1', v.id, 53_000)).resolves.toBeDefined();
    await vaciarCola();
  });
});
```

Ajusta el cuerpo del cambio de aceite a lo que `NewOilChange` pida de verdad: si algún campo no existe o falta uno obligatorio, TypeScript lo dice al correr el test.

- [ ] **Step 2: Correr los tests para verificar que fallan**

Run: `pnpm test -- oil.service`
Expected: FAIL — `despachados` queda vacío.

- [ ] **Step 3: Implementar el aviso**

En `src/modules/oil/oil.service.ts`, agrega al constructor:

```ts
    private readonly dispatch: PushDispatchService,
    private readonly sweep: PushSweepService,
```

y el método privado:

```ts
  /**
   * Avisa por push si el evento dejó algún vehículo en rojo.
   *
   * FUEGO Y OLVIDO, y a propósito: corre después de que la escritura ya está
   * confirmada, y su fallo se registra pero nunca se propaga. Si Expo está
   * caído, el cambio de aceite del usuario ya quedó guardado y la petición
   * tiene que responder bien; el barrido de mañana recoge lo que no salió.
   *
   * No duplica el barrido porque comparte su dedupe: si el aviso de este ciclo
   * ya salió, planPushes calcula la misma firma y calla.
   */
  private avisarPorEvento(userId: string): void {
    void (async () => {
      try {
        const now = new Date();
        const vehiculos = await this.sweep.vehiculosDe(userId, now);
        await this.dispatch.despacharUsuario(userId, vehiculos, now);
      } catch (e) {
        this.log.warn(`No se pudo avisar por push a ${userId}`, e as Error);
      }
    })();
  }
```

Si `OilService` todavía no tiene un `Logger`, agrégalo: `private readonly log = new Logger(OilService.name);`

Llama a `this.avisarPorEvento(userId)` como **última línea** de `reportOdometer`, `registerOilChange` y `registerOilChangeIdempotent`, justo antes del `return` y después de que `OilCycleService` haya sincronizado el ciclo — si se llama antes, el planificador lee el ciclo viejo y decide con datos que ya no son ciertos.

En `src/modules/oil/oil.module.ts`, agrega `NotificationsModule` a `imports`.

**Ojo con la dependencia circular:** `NotificationsModule` ya importa `OilModule`. Nest la resuelve con `forwardRef`, así que en los dos módulos usa:

```ts
  imports: [forwardRef(() => NotificationsModule)],   // en oil.module.ts
  imports: [forwardRef(() => OilModule)],             // en notifications.module.ts
```

y en `OilService`, los dos servicios inyectados llevan `@Inject(forwardRef(() => PushDispatchService))` y su equivalente para `PushSweepService`.

- [ ] **Step 4: Correr los tests para verificar que pasan**

Run: `pnpm test -- oil.service && pnpm build`
Expected: PASS, y el build sin errores de dependencia circular.

Si Nest se queja al arrancar con "Cannot read properties of undefined", falta un `forwardRef` en alguno de los dos lados.

- [ ] **Step 5: Correr toda la suite: es el cambio con más superficie de todo el plan**

Run: `pnpm test && pnpm test:e2e`
Expected: PASS todo. `oil.e2e-spec.ts` es el que avisaría si el aviso por evento rompió algo.

- [ ] **Step 6: Commit**

```bash
git add src/modules/oil
git commit -m "feat(push): avisar al instante cuando un evento deja el vehiculo en rojo"
```

---

## Task 10: Receipts diferidos

**Files:**
- Modify: `src/modules/notifications/receipts.service.ts` (reemplaza el vacío de la Task 6)
- Test: `src/modules/notifications/receipts.service.spec.ts`

**Interfaces:**
- Consumes: `NOTIFICATION_LOG_REPOSITORY`, `DEVICE_TOKEN_REPOSITORY`, `PUSH_SENDER`.
- Produces: `class ReceiptsService { procesarPendientes(): Promise<{ revisados: number; tokensApagados: number }> }`

- [ ] **Step 1: Escribir los tests que fallan**

```ts
// src/modules/notifications/receipts.service.spec.ts
import { Test } from '@nestjs/testing';
import { DEVICE_TOKEN_REPOSITORY } from './domain/device-token.repository';
import { NOTIFICATION_LOG_REPOSITORY } from './domain/notification-log.repository';
import { PUSH_SENDER } from './domain/push-sender';
import { ReceiptsService } from './receipts.service';
import { FakePushSender } from './testing/fake-push.sender';
import { InMemoryDeviceTokenRepository } from './testing/in-memory-device-token.repository';
import { InMemoryNotificationLogRepository } from './testing/in-memory-notification-log.repository';

describe('ReceiptsService', () => {
  let service: ReceiptsService;
  let logs: InMemoryNotificationLogRepository;
  let devices: InMemoryDeviceTokenRepository;
  let sender: FakePushSender;

  beforeEach(async () => {
    logs = new InMemoryNotificationLogRepository();
    devices = new InMemoryDeviceTokenRepository();
    sender = new FakePushSender();

    const mod = await Test.createTestingModule({
      providers: [
        ReceiptsService,
        { provide: NOTIFICATION_LOG_REPOSITORY, useValue: logs },
        { provide: DEVICE_TOKEN_REPOSITORY, useValue: devices },
        { provide: PUSH_SENDER, useValue: sender },
      ],
    }).compile();

    service = mod.get(ReceiptsService);
  });

  it('sin pendientes no llama al emisor', async () => {
    const r = await service.procesarPendientes();

    expect(r).toEqual({ revisados: 0, tokensApagados: 0 });
  });

  it('marca como revisadas las entregas correctas', async () => {
    await logs.registrar({ userId: 'u1', vehicleId: null, kind: 'checkin', sig: 's1', ticketId: 'tk-1' });

    const r = await service.procesarPendientes();

    expect(r.revisados).toBe(1);
    expect(await logs.pendientesDeReceipt(10)).toEqual([]);
  });

  // Es el caso que justifica todo el ciclo de receipts: el ticket salió bien y
  // el fallo aparece 15 minutos después, cuando Expo confirma la entrega real.
  it('un DeviceNotRegistered diferido apaga el token', async () => {
    await devices.registrar({ userId: 'u1', token: 'ExponentPushToken[muerto]', platform: 'IOS' });
    await logs.registrar({ userId: 'u1', vehicleId: null, kind: 'checkin', sig: 's1', ticketId: 'tk-1' });
    sender.receiptsPorDevolver = [{ ticketId: 'tk-1', error: 'DeviceNotRegistered' }];

    const r = await service.procesarPendientes();

    expect(r.tokensApagados).toBe(1);
    expect(await devices.activosDe('u1')).toEqual([]);
  });
});
```

El tercer caso necesita saber **qué token** corresponde a un ticket. La bitácora guarda `ticketId` pero no el token. Agrega la columna:

- En `prisma/schema.prisma`, dentro de `NotificationLog`: `token String?`
- En `LogEntry` y `NuevoLogEntry` (`notification-log.repository.ts`): `token: string | null`
- En `PushDispatchService`, al anotar: `token: envio.token`
- En el repositorio en memoria y en el de Prisma, propagar el campo
- `pnpm db:migrate --name log_token && pnpm db:generate`

- [ ] **Step 2: Correr los tests para verificar que fallan**

Run: `pnpm test -- receipts.service`
Expected: FAIL — `procesarPendientes` devuelve ceros fijos.

- [ ] **Step 3: Implementar el servicio**

```ts
// src/modules/notifications/receipts.service.ts
// Expo confirma la entrega REAL unos 15 minutos después del envío. Un ticket
// correcto no garantiza nada: el DeviceNotRegistered de una app desinstalada
// suele llegar acá, no en el ticket.
import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  DEVICE_TOKEN_REPOSITORY,
  type DeviceTokenRepository,
} from './domain/device-token.repository';
import {
  NOTIFICATION_LOG_REPOSITORY,
  type NotificationLogRepository,
} from './domain/notification-log.repository';
import { PUSH_SENDER, type PushSender } from './domain/push-sender';

const POR_TANDA = 300;

@Injectable()
export class ReceiptsService {
  private readonly log = new Logger(ReceiptsService.name);

  constructor(
    @Inject(NOTIFICATION_LOG_REPOSITORY)
    private readonly bitacora: NotificationLogRepository,
    @Inject(DEVICE_TOKEN_REPOSITORY)
    private readonly devices: DeviceTokenRepository,
    @Inject(PUSH_SENDER) private readonly sender: PushSender,
  ) {}

  async procesarPendientes(): Promise<{ revisados: number; tokensApagados: number }> {
    const pendientes = await this.bitacora.pendientesDeReceipt(POR_TANDA);
    if (pendientes.length === 0) return { revisados: 0, tokensApagados: 0 };

    const porTicket = new Map(
      pendientes.filter((p) => p.ticketId !== null).map((p) => [p.ticketId as string, p]),
    );

    const receipts = await this.sender.receipts([...porTicket.keys()]);

    let revisados = 0;
    let tokensApagados = 0;

    for (const r of receipts) {
      await this.bitacora.marcarReceipt(r.ticketId, r.error);
      revisados++;

      if (r.error === 'DeviceNotRegistered') {
        const entrada = porTicket.get(r.ticketId);
        if (entrada?.token) {
          await this.devices.apagar(entrada.token);
          tokensApagados++;
        }
      } else if (r.error !== null) {
        this.log.warn(`Receipt con error ${r.error} para el ticket ${r.ticketId}`);
      }
    }

    return { revisados, tokensApagados };
  }
}
```

- [ ] **Step 4: Correr los tests para verificar que pasan**

Run: `pnpm test -- receipts.service`
Expected: PASS, los tres casos.

- [ ] **Step 5: Commit**

```bash
git add prisma src/modules/notifications src/infra/prisma
git commit -m "feat(push): receipts diferidos y apagado de tokens muertos"
```

- [ ] **Step 6: Verificar el backend completo**

Run: `pnpm lint && pnpm build && pnpm test && pnpm test:e2e`
Expected: todo PASS. Acá termina la Etapa 1 del spec: el backend está terminado y probado sin haber tocado la red ni las credenciales.

---

# Fase 2 — La app (`app-mobile`)

Todo lo que sigue se hace en `../app-mobile`, no en el backend. Comandos de esa carpeta: `npm test`, `npm run lint`, `npx tsc --noEmit`.

---

## Task 11: Cliente de los endpoints

**Files:**
- Create: `app-mobile/src/api/controllers/notifications.controller.ts`
- Test: `app-mobile/src/api/__tests__/notifications.controller.test.ts`

**Interfaces:**
- Consumes: `ApiClient` de `src/api/base.ts`.
- Produces:
  - `type ApiNotifPrefs = { enabled; warnEnabled; overdueEnabled; checkinEnabled; warnThresholdKm; checkinWeekday }`
  - `notificationsController.registrarDispositivo(token: string, platform: 'IOS' | 'ANDROID'): Promise<void>`
  - `notificationsController.darDeBaja(token: string): Promise<void>`
  - `notificationsController.obtenerPrefs(): Promise<ApiNotifPrefs>`
  - `notificationsController.guardarPrefs(patch: Partial<ApiNotifPrefs>): Promise<ApiNotifPrefs>`

- [ ] **Step 1: Escribir el test que falla**

Sigue el patrón de `src/api/__tests__/oil-status.controller.test.ts`: mockea el módulo `http` y verifica ruta, método y cuerpo.

```ts
// app-mobile/src/api/__tests__/notifications.controller.test.ts
import { notificationsController } from '../controllers/notifications.controller';
import { http } from '../base';

jest.mock('../base', () => {
  const actual = jest.requireActual('../base');
  return { ...actual, http: { request: jest.fn() } };
});

const pedido = () => (http.request as jest.Mock).mock.calls[0][0] as Record<string, unknown>;

describe('notificationsController', () => {
  beforeEach(() => {
    (http.request as jest.Mock).mockReset().mockResolvedValue({ data: {} });
  });

  it('registra el dispositivo con POST /me/devices', async () => {
    await notificationsController.registrarDispositivo('ExponentPushToken[a]', 'ANDROID');

    expect(pedido()).toMatchObject({
      url: '/me/devices',
      method: 'POST',
      data: { token: 'ExponentPushToken[a]', platform: 'ANDROID' },
    });
  });

  // El token va en la ruta, así que los corchetes TIENEN que ir codificados o
  // la petición sale malformada.
  it('codifica el token al dar de baja', async () => {
    await notificationsController.darDeBaja('ExponentPushToken[a b]');

    expect(pedido().url).toBe('/me/devices/ExponentPushToken%5Ba%20b%5D');
    expect(pedido().method).toBe('DELETE');
  });

  it('pide las preferencias con GET', async () => {
    await notificationsController.obtenerPrefs();

    expect(pedido()).toMatchObject({ url: '/me/notification-prefs', method: 'GET' });
  });

  it('guarda solo lo que cambió', async () => {
    await notificationsController.guardarPrefs({ enabled: false });

    expect(pedido()).toMatchObject({
      url: '/me/notification-prefs',
      method: 'PATCH',
      data: { enabled: false },
    });
  });
});
```

Si `src/api/base.ts` no exporta `http`, adapta el mock a lo que sí exporte — el test de `oil-status.controller` ya resuelve esto y es la referencia.

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `npm test -- notifications.controller`
Expected: FAIL — el módulo no existe.

- [ ] **Step 3: Implementar el controlador**

```ts
// app-mobile/src/api/controllers/notifications.controller.ts
// Endpoints de notificaciones. Un archivo por recurso, como el resto.
import { ApiClient } from '../base';

export type ApiNotifPrefs = {
  enabled: boolean;
  warnEnabled: boolean;
  overdueEnabled: boolean;
  checkinEnabled: boolean;
  warnThresholdKm: number;
  /** 1..7, domingo = 1. */
  checkinWeekday: number;
};

export type DevicePlatform = 'IOS' | 'ANDROID';

class NotificationsController extends ApiClient {
  constructor() {
    super('');
  }

  async registrarDispositivo(token: string, platform: DevicePlatform): Promise<void> {
    await this.post<{ ok: true }>('/me/devices', { body: { token, platform }, auth: true });
  }

  async darDeBaja(token: string): Promise<void> {
    // El token viaja en la ruta y trae corchetes: sin codificar, la petición
    // sale malformada.
    await this.delete<void>(`/me/devices/${encodeURIComponent(token)}`, { auth: true });
  }

  async obtenerPrefs(): Promise<ApiNotifPrefs> {
    return this.get<ApiNotifPrefs>('/me/notification-prefs', { auth: true });
  }

  async guardarPrefs(patch: Partial<ApiNotifPrefs>): Promise<ApiNotifPrefs> {
    return this.patch<ApiNotifPrefs>('/me/notification-prefs', { body: patch, auth: true });
  }
}

export const notificationsController = new NotificationsController();
```

Ajusta las llamadas a los métodos que `ApiClient` realmente expone (`get`/`post`/`patch`/`delete` y su firma de opciones): mira `src/api/controllers/brands.controller.ts`, que ya usa POST con cuerpo.

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `npm test -- notifications.controller`
Expected: PASS, los cuatro casos.

- [ ] **Step 5: Commit**

```bash
git add src/api
git commit -m "feat(push): cliente de los endpoints de notificaciones"
```

---

## Task 12: Token de Expo y registro

**Files:**
- Create: `app-mobile/src/notifications/push.ts`
- Test: `app-mobile/src/notifications/__tests__/push.test.ts`
- Modify: `app-mobile/src/notifications/index.ts`
- Modify: `app-mobile/src/store/auth.ts`
- Modify: `app-mobile/App.tsx`

**Interfaces:**
- Consumes: `notificationsController` (Task 11), `expo-notifications`, `expo-constants`.
- Produces:
  - `registrarDispositivo(): Promise<string | null>` — devuelve el token registrado, o `null` si no se pudo (sin permiso, en web, en Expo Go).
  - `darDeBajaDispositivo(): Promise<void>` — silenciosa.

- [ ] **Step 1: Escribir los tests que fallan**

```ts
// app-mobile/src/notifications/__tests__/push.test.ts
import * as Notifications from 'expo-notifications';
import { notificationsController } from '../../api/controllers/notifications.controller';
import { darDeBajaDispositivo, registrarDispositivo } from '../push';

jest.mock('expo-notifications');
jest.mock('../../api/controllers/notifications.controller', () => ({
  notificationsController: { registrarDispositivo: jest.fn(), darDeBaja: jest.fn() },
}));
jest.mock('../permissions', () => ({ isPermissionGranted: jest.fn() }));

import { isPermissionGranted } from '../permissions';

describe('registrarDispositivo', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (isPermissionGranted as jest.Mock).mockResolvedValue(true);
    (Notifications.getExpoPushTokenAsync as jest.Mock).mockResolvedValue({
      data: 'ExponentPushToken[abc]',
    });
  });

  it('pide el token y lo registra contra el API', async () => {
    const r = await registrarDispositivo();

    expect(r).toBe('ExponentPushToken[abc]');
    expect(notificationsController.registrarDispositivo).toHaveBeenCalledWith(
      'ExponentPushToken[abc]',
      expect.stringMatching(/^(IOS|ANDROID)$/),
    );
  });

  it('sin permiso no pide token ni llama al API', async () => {
    (isPermissionGranted as jest.Mock).mockResolvedValue(false);

    expect(await registrarDispositivo()).toBeNull();
    expect(Notifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
    expect(notificationsController.registrarDispositivo).not.toHaveBeenCalled();
  });

  // Se llama en CADA arranque: si un fallo del API reventara, la app no abre.
  it('un fallo del API no propaga', async () => {
    (notificationsController.registrarDispositivo as jest.Mock).mockRejectedValue(
      new Error('sin red'),
    );

    await expect(registrarDispositivo()).resolves.toBeNull();
  });

  it('en Expo Go devuelve null sin intentar nada', async () => {
    (Notifications.getExpoPushTokenAsync as jest.Mock).mockRejectedValue(
      new Error('Expo Go no soporta push remoto'),
    );

    expect(await registrarDispositivo()).toBeNull();
  });
});

describe('darDeBajaDispositivo', () => {
  it('no revienta si el API falla: la sesión se cierra igual', async () => {
    (Notifications.getExpoPushTokenAsync as jest.Mock).mockResolvedValue({
      data: 'ExponentPushToken[abc]',
    });
    (notificationsController.darDeBaja as jest.Mock).mockRejectedValue(new Error('sin red'));

    await expect(darDeBajaDispositivo()).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

Run: `npm test -- push.test`
Expected: FAIL — no existe `src/notifications/push.ts`.

- [ ] **Step 3: Implementar**

```ts
// app-mobile/src/notifications/push.ts
// Token de push y registro contra el API. Es la única capa de la app que
// conoce el ExpoPushToken.
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import {
  notificationsController,
  type DevicePlatform,
} from '../api/controllers/notifications.controller';
import { isPermissionGranted } from './permissions';

const plataforma = (): DevicePlatform => (Platform.OS === 'ios' ? 'IOS' : 'ANDROID');

/** El projectId de EAS. Sin él, getExpoPushTokenAsync no sabe a qué proyecto pedirle el token. */
const projectId = (): string | undefined =>
  (Constants.expoConfig?.extra?.eas as { projectId?: string } | undefined)?.projectId;

async function tokenDelDispositivo(): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  if (!(await isPermissionGranted())) return null;

  try {
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId: projectId() });
    return data;
  } catch {
    // En Expo Go el push remoto no existe (Android, desde SDK 53), así que
    // esto lanza. No es un error: es la app corriendo donde no puede.
    return null;
  }
}

/**
 * Registra el dispositivo. Se llama al iniciar sesión y en cada arranque con
 * sesión viva, así que es idempotente y NUNCA propaga: un fallo de red no
 * puede impedir que la app abra.
 */
export async function registrarDispositivo(): Promise<string | null> {
  const token = await tokenDelDispositivo();
  if (!token) return null;

  try {
    await notificationsController.registrarDispositivo(token, plataforma());
    return token;
  } catch {
    return null;
  }
}

/**
 * Baja al cerrar sesión. Silenciosa a propósito: dejar al usuario dentro de su
 * cuenta porque el servidor no contesta sería peor que un token huérfano, y el
 * DeviceNotRegistered lo limpia solo.
 */
export async function darDeBajaDispositivo(): Promise<void> {
  const token = await tokenDelDispositivo();
  if (!token) return;

  try {
    await notificationsController.darDeBaja(token);
  } catch {
    // Silencio deliberado.
  }
}
```

Exporta las dos desde `src/notifications/index.ts`.

- [ ] **Step 4: Cablear el registro y la baja**

En `src/store/auth.ts`:

- al final de `signIn` y de `signUp`, después del `set({ user, status: 'authed' })`:
  ```ts
      // Fuego y olvido: registrar el dispositivo no puede demorar la entrada.
      void registrarDispositivo();
  ```
- en `signOut`, **antes** de `await tokenStorage.clear()` — hace falta el access token vivo para que la petición vaya autenticada:
  ```ts
      await darDeBajaDispositivo();
  ```

En `App.tsx`, donde hoy está `useNotificationsSync()`, un efecto que registra al arrancar con sesión viva:

```tsx
  const status = useAuth((s) => s.status);
  useEffect(() => {
    if (status === 'authed') void registrarDispositivo();
  }, [status]);
```

- [ ] **Step 5: Correr los tests para verificar que pasan**

Run: `npm test -- push.test && npx tsc --noEmit`
Expected: PASS los cinco casos, y sin errores de tipos.

- [ ] **Step 6: Commit**

```bash
git add src/notifications src/store/auth.ts App.tsx
git commit -m "feat(push): obtener el ExpoPushToken y registrarlo contra el API"
```

---

## Task 13: Retirar las notificaciones locales

Con el servidor decidiendo, dejar el planificador local vivo significa avisos duplicados.

**Files:**
- Delete: `app-mobile/src/notifications/plan.ts`, `scheduler.ts`, `useNotificationsSync.ts` y sus tests en `__tests__/`
- Create: `app-mobile/src/notifications/legacy-cleanup.ts`
- Test: `app-mobile/src/notifications/__tests__/legacy-cleanup.test.ts`
- Modify: `app-mobile/src/notifications/index.ts`, `App.tsx`

**Interfaces:**
- Consumes: `expo-notifications`, `NOTIF_PREFIX` de `types.ts`.
- Produces: `limpiarAvisosLocales(): Promise<number>` — cancela lo programado con el prefijo y devuelve cuántos canceló.

- [ ] **Step 1: Escribir el test que falla**

```ts
// app-mobile/src/notifications/__tests__/legacy-cleanup.test.ts
import * as Notifications from 'expo-notifications';
import { limpiarAvisosLocales } from '../legacy-cleanup';

jest.mock('expo-notifications');

describe('limpiarAvisosLocales', () => {
  beforeEach(() => jest.clearAllMocks());

  // Los teléfonos que ya tienen la versión anterior instalada llevan avisos
  // programados. Sin esto siguen saliendo durante SEMANAS, junto a los push.
  it('cancela lo que programó la versión anterior', async () => {
    (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValue([
      { identifier: 'ruedalo:oil-warn:v1' },
      { identifier: 'ruedalo:checkin' },
    ]);

    expect(await limpiarAvisosLocales()).toBe(2);
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('ruedalo:oil-warn:v1');
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('ruedalo:checkin');
  });

  it('no toca lo que no programó esta app', async () => {
    (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValue([
      { identifier: 'otra-app:algo' },
    ]);

    expect(await limpiarAvisosLocales()).toBe(0);
    expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
  });

  it('un fallo del SDK no propaga', async () => {
    (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockRejectedValue(new Error('x'));

    await expect(limpiarAvisosLocales()).resolves.toBe(0);
  });
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `npm test -- legacy-cleanup`
Expected: FAIL — el módulo no existe.

- [ ] **Step 3: Implementar la limpieza**

```ts
// app-mobile/src/notifications/legacy-cleanup.ts
// Retirada de las notificaciones locales. Los avisos ya programados viven en
// el sistema operativo y sobreviven a la actualización de la app: sin esta
// limpieza seguirían saliendo durante semanas, además de los push.
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { NOTIF_PREFIX } from './types';

export async function limpiarAvisosLocales(): Promise<number> {
  if (Platform.OS === 'web') return 0;

  try {
    const todas = await Notifications.getAllScheduledNotificationsAsync();
    const nuestras = todas.filter((n) => n.identifier.startsWith(NOTIF_PREFIX));

    for (const n of nuestras) {
      await Notifications.cancelScheduledNotificationAsync(n.identifier);
    }
    return nuestras.length;
  } catch {
    // Que la limpieza falle no puede impedir que la app arranque.
    return 0;
  }
}
```

- [ ] **Step 4: Borrar el planificador local y cablear la limpieza**

```bash
git rm src/notifications/plan.ts src/notifications/scheduler.ts src/notifications/useNotificationsSync.ts
git rm src/notifications/__tests__/plan.test.ts src/notifications/__tests__/scheduler.test.ts
```

Ajusta los nombres a los que existan en `__tests__/`. En `src/notifications/index.ts`, quita los `export` de `buildSchedule`, `nextOccurrence`, `REMINDER_HOUR`, `reconcile`, `syncNotifications`, `SyncResult` y `useNotificationsSync`, y agrega `limpiarAvisosLocales`.

En `App.tsx`, reemplaza `useNotificationsSync()` por la limpieza de una sola vez:

```tsx
  useEffect(() => {
    void limpiarAvisosLocales();
  }, []);
```

`PlannedNotification` y `PlannedTrigger` en `types.ts` quedan sin uso: bórralos y deja `NOTIF_PREFIX`, `NotifKind` y `NotifRouteData`, que los sigue usando `useNotificationResponse`.

- [ ] **Step 5: Correr toda la suite de la app**

Run: `npm test && npx tsc --noEmit && npm run lint`
Expected: PASS. Los errores de tipos acá son la señal de qué quedó importando lo borrado.

- [ ] **Step 6: Commit**

```bash
git add -A src/notifications App.tsx
git commit -m "feat(push): retirar el planificador local y cancelar los avisos que quedaron"
```

---

## Task 14: La pantalla contra el API

**Files:**
- Modify: `app-mobile/src/store/notifPrefs.ts`
- Modify: `app-mobile/src/screens/NotificationsScreen.tsx`
- Modify: `app-mobile/src/notifications/types.ts`
- Test: `app-mobile/src/store/__tests__/notifPrefs.test.ts`

**Interfaces:**
- Consumes: `notificationsController` (Task 11).
- Produces: `useNotifPrefs` con `{ prefs: ApiNotifPrefs; cargando: boolean; permissionAskedAt: number | null; cargar(): Promise<void>; setPref(k, v): Promise<void>; markPermissionAsked(): void }`

- [ ] **Step 1: Escribir los tests que fallan**

```ts
// app-mobile/src/store/__tests__/notifPrefs.test.ts
import { notificationsController } from '../../api/controllers/notifications.controller';
import { useNotifPrefs } from '../notifPrefs';

jest.mock('../../api/controllers/notifications.controller', () => ({
  notificationsController: { obtenerPrefs: jest.fn(), guardarPrefs: jest.fn() },
}));

const PREFS = {
  enabled: true, warnEnabled: true, overdueEnabled: true, checkinEnabled: true,
  warnThresholdKm: 500, checkinWeekday: 1,
};

describe('useNotifPrefs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useNotifPrefs.setState({ prefs: PREFS, cargando: false });
  });

  it('carga las preferencias del backend', async () => {
    (notificationsController.obtenerPrefs as jest.Mock).mockResolvedValue({
      ...PREFS, warnThresholdKm: 300,
    });

    await useNotifPrefs.getState().cargar();

    expect(useNotifPrefs.getState().prefs.warnThresholdKm).toBe(300);
    expect(useNotifPrefs.getState().cargando).toBe(false);
  });

  // El switch tiene que moverse al tocarlo, no cuando el servidor conteste.
  it('aplica el cambio de inmediato y manda solo lo que cambió', async () => {
    (notificationsController.guardarPrefs as jest.Mock).mockResolvedValue({
      ...PREFS, enabled: false,
    });

    const promesa = useNotifPrefs.getState().setPref('enabled', false);
    expect(useNotifPrefs.getState().prefs.enabled).toBe(false);

    await promesa;
    expect(notificationsController.guardarPrefs).toHaveBeenCalledWith({ enabled: false });
  });

  it('si el guardado falla, el switch vuelve a donde estaba', async () => {
    (notificationsController.guardarPrefs as jest.Mock).mockRejectedValue(new Error('sin red'));

    await useNotifPrefs.getState().setPref('enabled', false);

    expect(useNotifPrefs.getState().prefs.enabled).toBe(true);
  });
});
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

Run: `npm test -- notifPrefs`
Expected: FAIL — el store no tiene `cargar` ni `cargando`, y `setPref` no es asíncrona.

- [ ] **Step 3: Reescribir el store**

```ts
// app-mobile/src/store/notifPrefs.ts
// Las preferencias viven en el backend: es el servidor el que decide a quién
// avisar, así que tiene que conocerlas, y de paso sobreviven a reinstalar la
// app. Lo único que sigue siendo del teléfono es permissionAskedAt: eso es un
// hecho del dispositivo, no una preferencia de la cuenta.
import AsyncStorage from 'expo-sqlite/kv-store';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import {
  notificationsController,
  type ApiNotifPrefs,
} from '../api/controllers/notifications.controller';

export const DEFAULT_PREFS: ApiNotifPrefs = {
  enabled: true,
  warnEnabled: true,
  overdueEnabled: true,
  checkinEnabled: true,
  warnThresholdKm: 500,
  checkinWeekday: 1,
};

type Store = {
  prefs: ApiNotifPrefs;
  cargando: boolean;
  permissionAskedAt: number | null;
  cargar: () => Promise<void>;
  setPref: <K extends keyof ApiNotifPrefs>(k: K, v: ApiNotifPrefs[K]) => Promise<void>;
  markPermissionAsked: () => void;
};

export const useNotifPrefs = create<Store>()(
  persist(
    (set, get) => ({
      prefs: DEFAULT_PREFS,
      cargando: false,
      permissionAskedAt: null,

      cargar: async () => {
        set({ cargando: true });
        try {
          set({ prefs: await notificationsController.obtenerPrefs() });
        } catch {
          // Sin red se sigue mostrando lo último conocido: una pantalla de
          // ajustes en blanco es peor que una desactualizada.
        } finally {
          set({ cargando: false });
        }
      },

      setPref: async (k, v) => {
        // Optimista: el switch se mueve al tocarlo, no cuando el servidor
        // conteste. Si falla, vuelve solo.
        const previo = get().prefs;
        set({ prefs: { ...previo, [k]: v } });
        try {
          set({ prefs: await notificationsController.guardarPrefs({ [k]: v }) });
        } catch {
          set({ prefs: previo });
        }
      },

      markPermissionAsked: () => set({ permissionAskedAt: Date.now() }),
    }),
    {
      name: 'ruedalo:notif-prefs',
      storage: createJSONStorage(() => AsyncStorage),
      // Solo se persiste el hecho del dispositivo. Las preferencias son del
      // servidor y guardarlas acá crearía una segunda verdad.
      partialize: (s) => ({ permissionAskedAt: s.permissionAskedAt }),
    },
  ),
);
```

- [ ] **Step 4: Ajustar la pantalla**

En `src/screens/NotificationsScreen.tsx`:

- llamar `cargar()` al montar: `useEffect(() => { void cargar(); }, [cargar]);`
- los switches pasan a `onValueChange={(v) => void setPref('warnEnabled', v)}`
- mientras `cargando` es `true` y no hay datos previos, mostrar el mismo indicador de carga que usan las otras pantallas del repo
- quitar cualquier referencia a `checkinHour`, `checkinMinute` y a `syncNotifications`: el horario lo fija el servidor (9:00 hora de Venezuela) y ya no es configurable

En `src/notifications/types.ts`, borra `NotifPrefs` y `DEFAULT_PREFS`: la forma buena ahora es `ApiNotifPrefs`. Corrige los imports que queden apuntando ahí.

- [ ] **Step 5: Correr toda la suite de la app**

Run: `npm test && npx tsc --noEmit && npm run lint`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/store src/screens src/notifications
git commit -m "feat(push): la pantalla de notificaciones lee y escribe contra el API"
```

---

# Fase 3 — Verificación real

## Task 15: Etapa 2 — contra Expo, sin teléfono

La Expo Push API acepta envíos a un token inventado y responde con un ticket de error bien formado. Sirve para verificar el chunking, los tickets y el ciclo de receipts de verdad, sin haber tocado FCM todavía.

**Files:**
- Create: `backend-oil-app/test/manual/push-humo.md` (la bitácora de lo que se probó)

- [ ] **Step 1: Levantar el backend con push encendido**

```bash
cd backend-oil-app && pnpm db:up && PUSH_ENABLED=true pnpm start:dev
```

- [ ] **Step 2: Registrar un dispositivo falso y forzar un barrido**

Con una cuenta de prueba que tenga un vehículo vencido, registra un token con formato válido pero inventado:

```bash
curl -X POST http://localhost:3000/me/devices \
  -H "Authorization: Bearer $JWT" -H 'Content-Type: application/json' \
  -d '{"token":"ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]","platform":"ANDROID"}'
```

Dispara el barrido desde el REPL de Node o adelantando el reloj del contenedor; lo más simple es agregar temporalmente un `void this.sweep.run()` en el constructor de `NotificationsCron`, arrancar, y quitarlo después.

- [ ] **Step 3: Confirmar el comportamiento esperado**

Expected:
- El log muestra el barrido con al menos un envío intentado.
- Expo responde `DeviceNotRegistered` y el token queda con `disabledAt` puesto: compruébalo con `pnpm db:studio`.
- `NotificationLog` **no** tiene fila para ese envío: falló, así que la firma no se anotó y mañana se reintenta.

Si en vez de eso aparece `InvalidCredentials` en el log, el `EXPO_ACCESS_TOKEN` está mal: bórralo del `.env` y vuelve a probar, porque sin él el envío también funciona.

- [ ] **Step 4: Anotar los resultados y commitear la bitácora**

```bash
git add test/manual/push-humo.md
git commit -m "docs(push): bitacora de la prueba de humo contra la Expo Push API"
```

---

## Task 16: Etapa 3 — con teléfono

Esta es configuración de cuentas, casi nada de código, y es la única parte que puede quedarse trancada por algo que no depende de nosotros.

**Files:**
- Modify: `app-mobile/README.md` (sección de push y qué credenciales hacen falta)

- [ ] **Step 1: Credenciales**

- Crear el proyecto en Firebase y subir la Service Account de **FCM v1** a EAS (`eas credentials`, plataforma Android).
- Subir la key de **APNs** para iOS.
- Confirmar con `eas credentials` que las dos aparecen asociadas al `projectId` `d44dca15-f396-4837-bc2c-f0579a4e322a` de `app.json`.

- [ ] **Step 2: Development build**

```bash
cd app-mobile && npx expo run:android     # o run:ios
```

Expo Go **no** sirve para push remoto en Android desde el SDK 53. Si el build de Android falla con un error de CMake, revisa que el JDK sea el 17 y no el JBR 25 de Android Studio. Si el de iOS falla con un error de Unicode en CocoaPods, es el locale del shell: `export LANG=en_US.UTF-8`.

- [ ] **Step 3: Registrar el token real y verificar**

- Inicia sesión en la app y confirma en `pnpm db:studio` que apareció la fila en `DeviceToken` con el token real.
- Con un vehículo vencido, dispara el barrido a mano como en la Task 15.
- Expected: la notificación llega al teléfono. Tocarla abre el detalle del vehículo — eso prueba que `data.screen` y `data.vehicleId` siguen encajando con `useNotificationResponse`.
- Vuelve a disparar el barrido. Expected: **no** llega nada. Es el dedupe funcionando de punta a punta.

- [ ] **Step 4: Verificar el receipt**

A los 30 minutos, comprueba en `pnpm db:studio` que la fila de `NotificationLog` tiene `receiptAt` puesto y `receiptError` en null.

- [ ] **Step 5: Documentar y commitear**

```bash
git add README.md
git commit -m "docs(push): credenciales y development build para notificaciones"
```

---

## Notas de ejecución

**El orden importa en dos puntos y en ningún otro:**

- La Task 6 crea `ReceiptsService` vacío para que el cron compile; la Task 10 lo reemplaza. Si se ejecutan en desorden, la Task 10 se encuentra un archivo que ya existe — reemplázalo entero.
- La Task 6 comenta los `controllers` del módulo y las Tasks 7 y 8 los reponen. Si alguien hace la 7 antes que la 6, el módulo no existe todavía.

**La Task 9 es la de más riesgo.** Introduce una dependencia circular entre `OilModule` y `NotificationsModule`, que Nest resuelve con `forwardRef` pero que falla en tiempo de arranque, no de compilación. El síntoma es un "Cannot read properties of undefined" al levantar la app, no un error de TypeScript. Por eso su Step 5 corre la suite completa y no solo sus propios tests.

**Si la Task 16 se traba por credenciales**, el resto del trabajo ya está verificado y la app queda en un estado sano: los push no llegan, pero nada está roto. Lo que **no** se puede hacer es publicar una versión con la Task 13 hecha y la 16 sin verificar — ahí el usuario se queda sin avisos locales y sin push. Es el riesgo que el spec anota, y el orden de tareas no lo cubre solo: es una decisión de cuándo publicar.
