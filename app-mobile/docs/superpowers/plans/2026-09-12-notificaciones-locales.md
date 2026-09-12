# Notificaciones locales nativas — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que OilTrack VE avise al usuario en el centro de notificaciones del teléfono cuando a un vehículo le quedan menos de 500 km de aceite, cuando el cambio ya está vencido, y una vez por semana para que actualice el kilometraje.

**Architecture:** Motor declarativo de reconciliación. Una función pura `buildSchedule(estado) → PlannedNotification[]` decide qué notificaciones *deberían* existir, cada una con un `id` estable. Una capa fina `syncNotifications()` compara ese plan contra lo que el SO ya tiene programado y aplica solo la diferencia. Toda la lógica vive en el lado puro y testeable; `expo-notifications` queda confinado a tres archivos.

**Tech Stack:** Expo SDK 57, React Native 0.86, TypeScript 6 (strict), `expo-notifications`, `expo-sqlite/kv-store` (persistencia KV), Zustand 5 + middleware `persist`, React Navigation 7, Tamagui (`src/ui`), jest-expo.

**Spec:** `docs/superpowers/specs/2026-09-12-notificaciones-locales-design.md`

## Global Constraints

- **Solo notificaciones locales.** Nada de push remoto, tokens de Expo/EAS ni credenciales FCM/APNs. No se llama `getExpoPushTokenAsync` en ninguna tarea.
- **Documentación:** leer siempre `https://docs.expo.dev/versions/v57.0.0/sdk/notifications/`. Las APIs de notificaciones cambiaron entre SDKs; no escribir de memoria.
- **Iconos:** importar por sub-ruta, nunca del barrel — `import Bell from 'lucide-react-native/icons/bell'`. Si el icono ya está en `src/components/Icon.tsx`, usar `<Icon name="..." />` (regla de `AGENTS.md`).
- **Estilos:** usar las primitivas Tamagui de `src/ui` (`Screen`, `Box`, `Col`, `Row`, `Txt`, `Touchable`, `Scroll`, `useAppColors`) y los componentes de `src/components/primitives.tsx`. **No** usar `className` ni importar de `src/tw` — ese módulo está siendo eliminado en la migración en curso.
- **Prefijo de identificadores:** toda notificación programada por la app usa `oiltrack:`. La reconciliación jamás toca identificadores sin ese prefijo.
- **Umbral por defecto:** 500 km. **Hora de entrega de los avisos de umbral:** 09:00 locales. **Check-in semanal por defecto:** domingo 09:00 (`weekday: 1`, convención de Expo donde domingo = 1).
- **Copy en español de Venezuela**, con `fmtKm` de `src/utils/format.ts` para los kilómetros (78.460, no 78460).
- **TypeScript strict.** Nada de `any` salvo en el único punto donde se lee `content.data` del SDK, que viene tipado como `Record<string, unknown>`.
- **Web es no-op.** Ninguna función del módulo puede romper `npm run web`.
- **Commits frecuentes**, uno por tarea como mínimo, en español, con `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>` al final.

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `src/notifications/types.ts` | Tipos y constantes compartidas. Sin lógica, sin imports del SDK. |
| `src/notifications/plan.ts` | **Pura.** Estado → lista de notificaciones deseadas. Aquí vive toda la lógica de negocio. |
| `src/notifications/channels.ts` | Canal de Android. Único lugar que lo define. |
| `src/notifications/permissions.ts` | Lectura y solicitud del permiso del SO. |
| `src/notifications/scheduler.ts` | Reconciliación: diff del plan contra lo programado en el SO. |
| `src/notifications/useNotificationsSync.ts` | Cuándo se reconcilia (montaje, AppState, cambios de estado). |
| `src/notifications/useNotificationResponse.ts` | Navegación al tocar una notificación. |
| `src/notifications/index.ts` | Punto de entrada: registra el handler y reexporta. |
| `src/store/notifPrefs.ts` | Slice Zustand persistido con las preferencias. |
| `src/navigation/navigationRef.ts` | Ref del navegador + cola para arranque en frío. |
| `src/screens/NotificationsScreen.tsx` | Pantalla de ajustes de notificaciones. |

---

### Task 1: Infraestructura de pruebas + tipos + avisos de umbral

**Files:**
- Create: `src/notifications/types.ts`
- Create: `src/notifications/plan.ts`
- Create: `src/notifications/__tests__/plan.test.ts`
- Create: `jest.config.js`
- Modify: `package.json` (devDependencies + script `test`)

**Interfaces:**
- Consumes: `Vehicle` de `src/data/mock.ts`, `kmLeft` de `src/store/useStore.ts`, `fmtKm` de `src/utils/format.ts`.
- Produces: `NOTIF_PREFIX`, `NotifKind`, `PlannedTrigger`, `PlannedNotification`, `NotifPrefs`, `DEFAULT_PREFS` (en `types.ts`); `buildSchedule(input)`, `nextOccurrence(now, hour, minute?)`, `REMINDER_HOUR` (en `plan.ts`).

- [ ] **Step 1: Instalar jest-expo**

```bash
npx expo install -- --save-dev jest-expo jest @types/jest
```

- [ ] **Step 2: Configurar jest**

Crear `jest.config.js`:

```js
module.exports = {
  preset: 'jest-expo',
  testMatch: ['**/__tests__/**/*.test.ts?(x)'],
};
```

Añadir a `package.json`, dentro de `"scripts"`:

```json
"test": "jest"
```

- [ ] **Step 3: Escribir los tipos**

Crear `src/notifications/types.ts`:

```ts
// Tipos del subsistema de notificaciones. Sin imports del SDK a propósito:
// plan.ts depende solo de esto, y así queda testeable sin mocks de Expo.

/** Prefijo de todo identificador programado por la app. La reconciliación
 *  ignora cualquier notificación que no lo lleve. */
export const NOTIF_PREFIX = 'oiltrack:';

export type NotifKind = 'warn' | 'overdue' | 'checkin';

/** Trigger propio, independiente del SDK. scheduler.ts lo traduce. */
export type PlannedTrigger =
  | { type: 'date'; date: number }
  | { type: 'weekly'; weekday: number; hour: number; minute: number };

export type NotifRouteData = {
  screen: 'VehicleDetail' | 'Alerts';
  vehicleId?: string;
};

export type PlannedNotification = {
  id: string;
  kind: NotifKind;
  title: string;
  body: string;
  /** Firma de contenido + trigger: distingue "ya programada y vigente" de
   *  "programada con datos viejos". */
  sig: string;
  data: NotifRouteData;
  trigger: PlannedTrigger;
};

export type NotifPrefs = {
  enabled: boolean;
  warnEnabled: boolean;
  overdueEnabled: boolean;
  checkinEnabled: boolean;
  warnThresholdKm: number;
  /** 1..7, domingo = 1 (convención del trigger WEEKLY de Expo). */
  checkinWeekday: number;
  checkinHour: number;
  checkinMinute: number;
  /** epoch ms de cuándo se mostró el diálogo nativo; null = nunca. */
  permissionAskedAt: number | null;
};

export const DEFAULT_PREFS: NotifPrefs = {
  enabled: true,
  warnEnabled: true,
  overdueEnabled: true,
  checkinEnabled: true,
  warnThresholdKm: 500,
  checkinWeekday: 1,
  checkinHour: 9,
  checkinMinute: 0,
  permissionAskedAt: null,
};
```

- [ ] **Step 4: Escribir los tests que fallan**

Crear `src/notifications/__tests__/plan.test.ts`:

```ts
import { Vehicle } from '../../data/mock';
import { buildSchedule, nextOccurrence } from '../plan';
import { DEFAULT_PREFS, NotifPrefs } from '../types';

const vehicle = (over: Partial<Vehicle> = {}): Vehicle => ({
  id: 'v1',
  kind: 'car',
  brand: 'Toyota',
  model: 'Corolla',
  year: 2019,
  plate: 'AB123CD',
  color: '#1E3A8A',
  km: 79_600,
  oil: { brand: 'Pennzoil', tag: 'Platinum', viscosity: '5W-30', synthetic: true },
  lastChange: 75_000,
  nextChange: 80_000, // kmLeft = 400 → 'warn'
  daysSince: 40,
  ...over,
});

const prefs = (over: Partial<NotifPrefs> = {}): NotifPrefs => ({ ...DEFAULT_PREFS, ...over });

const run = (vehicles: Vehicle[], p: NotifPrefs = prefs(), now = new Date('2026-09-12T07:00:00')) =>
  buildSchedule({ vehicles, prefs: p, permissionGranted: true, now });

describe('nextOccurrence', () => {
  it('usa hoy cuando la hora aún no ha pasado', () => {
    const now = new Date('2026-09-12T07:00:00');
    expect(new Date(nextOccurrence(now, 9)).toISOString()).toBe(
      new Date('2026-09-12T09:00:00').toISOString()
    );
  });

  it('salta al día siguiente cuando la hora ya pasó', () => {
    const now = new Date('2026-09-12T14:00:00');
    expect(new Date(nextOccurrence(now, 9)).toISOString()).toBe(
      new Date('2026-09-13T09:00:00').toISOString()
    );
  });
});

describe('buildSchedule — avisos de umbral', () => {
  it('no planifica nada para un vehículo por encima del umbral', () => {
    const out = run([vehicle({ nextChange: 80_101 })]); // kmLeft = 501
    expect(out.filter((n) => n.kind !== 'checkin')).toHaveLength(0);
  });

  it('planifica "warn" justo en el umbral (500 km)', () => {
    const out = run([vehicle({ nextChange: 80_100 })]); // kmLeft = 500
    const warn = out.find((n) => n.kind === 'warn');
    expect(warn?.id).toBe('oiltrack:oil-warn:v1');
    expect(warn?.body).toContain('500 km');
  });

  it('planifica "warn" con 1 km restante', () => {
    const out = run([vehicle({ nextChange: 79_601 })]); // kmLeft = 1
    expect(out.find((n) => n.kind === 'warn')).toBeDefined();
  });

  it('planifica "overdue" con 0 km restantes', () => {
    const out = run([vehicle({ nextChange: 79_600 })]); // kmLeft = 0
    expect(out.find((n) => n.kind === 'overdue')?.id).toBe('oiltrack:oil-overdue:v1');
  });

  it('planifica "overdue" y reporta los km pasados cuando es negativo', () => {
    const out = run([vehicle({ nextChange: 79_480 })]); // kmLeft = -120
    const overdue = out.find((n) => n.kind === 'overdue');
    expect(overdue?.body).toContain('120 km');
  });

  it('nunca planifica warn y overdue para el mismo vehículo', () => {
    const out = run([vehicle({ nextChange: 79_480 })]);
    expect(out.filter((n) => n.id.includes(':v1'))).toHaveLength(1);
  });

  it('entrega los avisos de umbral a las 9:00, no de inmediato', () => {
    const now = new Date('2026-09-12T14:00:00');
    const out = buildSchedule({
      vehicles: [vehicle()],
      prefs: prefs(),
      permissionGranted: true,
      now,
    });
    const warn = out.find((n) => n.kind === 'warn');
    expect(warn?.trigger).toEqual({
      type: 'date',
      date: new Date('2026-09-13T09:00:00').getTime(),
    });
  });

  it('usa el kilometraje en formato es-VE', () => {
    const out = run([vehicle({ km: 78_000, nextChange: 79_234 })]); // kmLeft = 1234 → sin aviso
    expect(out.filter((n) => n.kind !== 'checkin')).toHaveLength(0);
    const cerca = run([vehicle({ km: 78_000, nextChange: 78_400 })]); // kmLeft = 400
    expect(cerca.find((n) => n.kind === 'warn')?.body).toContain('400 km');
  });
});
```

- [ ] **Step 5: Correr los tests y verificar que fallan**

Run: `npx jest src/notifications --no-coverage`
Expected: FAIL — `Cannot find module '../plan'`.

- [ ] **Step 6: Implementar `plan.ts`**

Crear `src/notifications/plan.ts`:

```ts
// Motor de planificación — PURO. No importa expo-notifications ni React.
// Recibe estado, devuelve la lista exacta de notificaciones que deberían
// existir. Toda la lógica de negocio del subsistema vive aquí.
import { Vehicle } from '../data/mock';
import { kmLeft } from '../store/useStore';
import { fmtKm } from '../utils/format';
import { NOTIF_PREFIX, NotifPrefs, PlannedNotification, PlannedTrigger } from './types';

/** Hora local a la que se entregan los avisos de umbral. */
export const REMINDER_HOUR = 9;

/**
 * Próxima ocurrencia de `hour:minute` en hora local: hoy si aún no ha pasado,
 * mañana si ya pasó. Los avisos de umbral no se entregan al instante — si no,
 * le llegaría una notificación al usuario mientras mira la pantalla que la causó.
 */
export function nextOccurrence(now: Date, hour: number, minute = 0): number {
  const at = new Date(now.getTime());
  at.setHours(hour, minute, 0, 0);
  if (at.getTime() <= now.getTime()) at.setDate(at.getDate() + 1);
  return at.getTime();
}

const sigOf = (title: string, body: string, trigger: PlannedTrigger) =>
  `${title}|${body}|${JSON.stringify(trigger)}`;

const label = (v: Vehicle) => `${v.brand} ${v.model}`;

export function buildSchedule(input: {
  vehicles: Vehicle[];
  prefs: NotifPrefs;
  permissionGranted: boolean;
  now: Date;
}): PlannedNotification[] {
  const { vehicles, prefs, permissionGranted, now } = input;

  // Sin permiso o con el switch maestro apagado el plan es vacío: la
  // reconciliación entonces cancela todo lo nuestro, sin caso especial.
  if (!permissionGranted || !prefs.enabled) return [];

  const out: PlannedNotification[] = [];
  const trigger: PlannedTrigger = { type: 'date', date: nextOccurrence(now, REMINDER_HOUR) };

  for (const v of vehicles) {
    const left = kmLeft(v);

    // Vencido y próximo son mutuamente excluyentes: un vehículo nunca genera
    // los dos avisos.
    if (left <= 0) {
      if (!prefs.overdueEnabled) continue;
      const title = 'Cambio de aceite vencido';
      const body = `${label(v)} pasó ${fmtKm(Math.abs(left))} km del cambio recomendado.`;
      out.push({
        id: `${NOTIF_PREFIX}oil-overdue:${v.id}`,
        kind: 'overdue',
        title,
        body,
        sig: sigOf(title, body, trigger),
        data: { screen: 'VehicleDetail', vehicleId: v.id },
        trigger,
      });
      continue;
    }

    if (left <= prefs.warnThresholdKm) {
      if (!prefs.warnEnabled) continue;
      const title = 'Cambio de aceite cerca';
      const body = `A ${label(v)} le quedan ${fmtKm(left)} km de aceite.`;
      out.push({
        id: `${NOTIF_PREFIX}oil-warn:${v.id}`,
        kind: 'warn',
        title,
        body,
        sig: sigOf(title, body, trigger),
        data: { screen: 'VehicleDetail', vehicleId: v.id },
        trigger,
      });
    }
  }

  return out;
}
```

- [ ] **Step 7: Correr los tests y verificar que pasan**

Run: `npx jest src/notifications --no-coverage`
Expected: PASS — 10 tests. (Los del check-in aún no existen; llegan en la Task 2.)

- [ ] **Step 8: Commit**

```bash
git add jest.config.js package.json package-lock.json src/notifications
git commit -m "feat: motor de planificación de notificaciones (avisos de umbral)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Recordatorio semanal y compuertas de preferencias

**Files:**
- Modify: `src/notifications/plan.ts`
- Modify: `src/notifications/__tests__/plan.test.ts`

**Interfaces:**
- Consumes: `buildSchedule`, `NOTIF_PREFIX`, `NotifPrefs` de la Task 1.
- Produces: `buildSchedule` ahora emite también `oiltrack:checkin-weekly` y respeta cada switch de `NotifPrefs`.

- [ ] **Step 1: Escribir los tests que fallan**

Añadir al final de `src/notifications/__tests__/plan.test.ts`:

```ts
describe('buildSchedule — recordatorio semanal', () => {
  it('planifica el check-in con el día y hora de las preferencias', () => {
    const out = run([], prefs({ checkinWeekday: 3, checkinHour: 20, checkinMinute: 30 }));
    const checkin = out.find((n) => n.kind === 'checkin');
    expect(checkin?.id).toBe('oiltrack:checkin-weekly');
    expect(checkin?.data).toEqual({ screen: 'Alerts' });
    expect(checkin?.trigger).toEqual({ type: 'weekly', weekday: 3, hour: 20, minute: 30 });
  });

  it('planifica el check-in aunque no haya ningún vehículo en riesgo', () => {
    const out = run([vehicle({ nextChange: 90_000 })]);
    expect(out).toHaveLength(1);
    expect(out[0].kind).toBe('checkin');
  });
});

describe('buildSchedule — compuertas', () => {
  it('devuelve plan vacío sin permiso', () => {
    const out = buildSchedule({
      vehicles: [vehicle()],
      prefs: prefs(),
      permissionGranted: false,
      now: new Date('2026-09-12T07:00:00'),
    });
    expect(out).toEqual([]);
  });

  it('devuelve plan vacío con el switch maestro apagado', () => {
    expect(run([vehicle()], prefs({ enabled: false }))).toEqual([]);
  });

  it('warnEnabled: false quita solo los avisos de próximo', () => {
    const out = run([vehicle()], prefs({ warnEnabled: false }));
    expect(out.find((n) => n.kind === 'warn')).toBeUndefined();
    expect(out.find((n) => n.kind === 'checkin')).toBeDefined();
  });

  it('overdueEnabled: false quita solo los avisos de vencido', () => {
    const out = run([vehicle({ nextChange: 79_000 })], prefs({ overdueEnabled: false }));
    expect(out.find((n) => n.kind === 'overdue')).toBeUndefined();
    expect(out.find((n) => n.kind === 'checkin')).toBeDefined();
  });

  it('un vencido con overdueEnabled: false no cae en warn', () => {
    const out = run([vehicle({ nextChange: 79_000 })], prefs({ overdueEnabled: false }));
    expect(out.find((n) => n.kind === 'warn')).toBeUndefined();
  });

  it('checkinEnabled: false quita solo el recordatorio', () => {
    const out = run([vehicle()], prefs({ checkinEnabled: false }));
    expect(out.find((n) => n.kind === 'checkin')).toBeUndefined();
    expect(out.find((n) => n.kind === 'warn')).toBeDefined();
  });

  it('respeta un umbral personalizado', () => {
    const out = run([vehicle()], prefs({ warnThresholdKm: 300 })); // kmLeft = 400
    expect(out.find((n) => n.kind === 'warn')).toBeUndefined();
  });
});

describe('buildSchedule — firma', () => {
  it('cambia la firma cuando cambia el kilometraje', () => {
    const a = run([vehicle()]).find((n) => n.kind === 'warn');
    const b = run([vehicle({ km: 79_800 })]).find((n) => n.kind === 'warn');
    expect(a?.id).toBe(b?.id);
    expect(a?.sig).not.toBe(b?.sig);
  });

  it('mantiene la firma cuando nada cambia', () => {
    const a = run([vehicle()]).find((n) => n.kind === 'warn');
    const b = run([vehicle()]).find((n) => n.kind === 'warn');
    expect(a?.sig).toBe(b?.sig);
  });
});
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `npx jest src/notifications --no-coverage`
Expected: FAIL — los tests de check-in fallan porque `buildSchedule` nunca emite `kind: 'checkin'`.

- [ ] **Step 3: Implementar el check-in**

En `src/notifications/plan.ts`, justo antes del `return out;` final:

```ts
  if (prefs.checkinEnabled) {
    const weekly: PlannedTrigger = {
      type: 'weekly',
      weekday: prefs.checkinWeekday,
      hour: prefs.checkinHour,
      minute: prefs.checkinMinute,
    };
    const title = '¿Actualizaste el kilometraje?';
    const body = 'Registra los km de tus vehículos para no perder un cambio.';
    out.push({
      id: `${NOTIF_PREFIX}checkin-weekly`,
      kind: 'checkin',
      title,
      body,
      sig: sigOf(title, body, weekly),
      data: { screen: 'Alerts' },
      trigger: weekly,
    });
  }
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `npx jest src/notifications --no-coverage`
Expected: PASS — 21 tests.

- [ ] **Step 5: Commit**

```bash
git add src/notifications
git commit -m "feat: recordatorio semanal y compuertas de preferencias

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Slice persistido de preferencias

**Files:**
- Create: `src/store/notifPrefs.ts`
- Create: `src/store/__tests__/notifPrefs.test.ts`
- Modify: `package.json` (dependencia `expo-sqlite`)

**Interfaces:**
- Consumes: `NotifPrefs`, `DEFAULT_PREFS` de `src/notifications/types.ts`.
- Produces: `useNotifPrefs` — store Zustand con `{ prefs: NotifPrefs; hydrated: boolean; setPref<K>(key, value): void; markPermissionAsked(): void }`. Acceso imperativo con `useNotifPrefs.getState().prefs`.

- [ ] **Step 1: Instalar expo-sqlite**

```bash
npx expo install expo-sqlite
```

Es el backend KV que Expo recomienda en SDK 57 como reemplazo de AsyncStorage; viene incluido en Expo Go.

- [ ] **Step 2: Escribir el test que falla**

Crear `src/store/__tests__/notifPrefs.test.ts`:

```ts
import { DEFAULT_PREFS } from '../../notifications/types';
import { useNotifPrefs } from '../notifPrefs';

// El backend de persistencia es nativo; en Node lo reemplazamos por memoria.
jest.mock('expo-sqlite/kv-store', () => {
  const mem = new Map<string, string>();
  return {
    __esModule: true,
    default: {
      getItem: async (k: string) => mem.get(k) ?? null,
      setItem: async (k: string, v: string) => void mem.set(k, v),
      removeItem: async (k: string) => void mem.delete(k),
    },
  };
});

describe('useNotifPrefs', () => {
  beforeEach(() => {
    useNotifPrefs.setState({ prefs: { ...DEFAULT_PREFS } });
  });

  it('arranca con los valores por defecto', () => {
    expect(useNotifPrefs.getState().prefs).toEqual(DEFAULT_PREFS);
  });

  it('setPref cambia solo la clave indicada', () => {
    useNotifPrefs.getState().setPref('warnEnabled', false);
    const { prefs } = useNotifPrefs.getState();
    expect(prefs.warnEnabled).toBe(false);
    expect(prefs.overdueEnabled).toBe(true);
    expect(prefs.warnThresholdKm).toBe(500);
  });

  it('markPermissionAsked deja un timestamp', () => {
    expect(useNotifPrefs.getState().prefs.permissionAskedAt).toBeNull();
    useNotifPrefs.getState().markPermissionAsked();
    expect(typeof useNotifPrefs.getState().prefs.permissionAskedAt).toBe('number');
  });
});
```

- [ ] **Step 3: Correr el test y verificar que falla**

Run: `npx jest src/store --no-coverage`
Expected: FAIL — `Cannot find module '../notifPrefs'`.

- [ ] **Step 4: Implementar el slice**

Crear `src/store/notifPrefs.ts`:

```ts
// Preferencias de notificación — el ÚNICO estado persistido de la app.
// El resto del store (vehículos, cambios, perfil) sigue en memoria con data
// mock; la persistencia completa llega con el backend.
import AsyncStorage from 'expo-sqlite/kv-store';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { DEFAULT_PREFS, NotifPrefs } from '../notifications/types';

type NotifPrefsStore = {
  prefs: NotifPrefs;
  /** false hasta que termina de leerse el almacenamiento. La reconciliación
   *  espera a esto para no programar con valores por defecto que el usuario
   *  ya había cambiado. */
  hydrated: boolean;
  setPref: <K extends keyof NotifPrefs>(key: K, value: NotifPrefs[K]) => void;
  markPermissionAsked: () => void;
};

export const useNotifPrefs = create<NotifPrefsStore>()(
  persist(
    (set) => ({
      prefs: DEFAULT_PREFS,
      hydrated: false,
      setPref: (key, value) => set((s) => ({ prefs: { ...s.prefs, [key]: value } })),
      markPermissionAsked: () =>
        set((s) => ({ prefs: { ...s.prefs, permissionAskedAt: Date.now() } })),
    }),
    {
      name: 'oiltrack:notif-prefs',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ prefs: s.prefs }),
      // Sin este merge, añadir una preferencia nueva en el futuro la dejaría
      // `undefined` en los usuarios que ya tengan datos guardados.
      merge: (persisted, current) => ({
        ...current,
        prefs: {
          ...DEFAULT_PREFS,
          ...((persisted as { prefs?: Partial<NotifPrefs> } | undefined)?.prefs ?? {}),
        },
      }),
      onRehydrateStorage: () => () => useNotifPrefs.setState({ hydrated: true }),
    }
  )
);
```

- [ ] **Step 5: Correr los tests y verificar que pasan**

Run: `npx jest --no-coverage`
Expected: PASS — 24 tests en total.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/store
git commit -m "feat: preferencias de notificación persistidas

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Canal de Android y permisos

**Files:**
- Create: `src/notifications/channels.ts`
- Create: `src/notifications/permissions.ts`
- Modify: `package.json` (dependencia `expo-notifications`)

**Interfaces:**
- Consumes: `palette` de `src/theme/index.ts`.
- Produces: `CHANNEL_ID = 'oil-reminders'`, `ensureChannel(): Promise<void>` (en `channels.ts`); `PermissionState = 'granted' | 'denied' | 'undetermined'`, `getPermissionState(): Promise<PermissionState>`, `isPermissionGranted(): Promise<boolean>`, `requestPermission(): Promise<PermissionState>`, `openSystemSettings(): void` (en `permissions.ts`).

- [ ] **Step 1: Instalar expo-notifications**

```bash
npx expo install expo-notifications
```

- [ ] **Step 2: Crear el canal de Android**

Crear `src/notifications/channels.ts`:

```ts
// Canal de notificaciones de Android. Debe existir ANTES de pedir el permiso:
// si no, el diálogo de Android 13+ aparece sin nombre de canal.
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { palette } from '../theme';

export const CHANNEL_ID = 'oil-reminders';

export async function ensureChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Recordatorios de aceite',
    description: 'Avisos de cambio próximo, vencido y recordatorio semanal.',
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: palette.accent,
  });
}
```

- [ ] **Step 3: Implementar los permisos**

Crear `src/notifications/permissions.ts`:

```ts
// Lectura y solicitud del permiso del SO.
//
// El estado NO se persiste: se lee del sistema cada vez, porque el usuario
// puede revocarlo desde Ajustes sin que la app se entere.
//
// Ojo con iOS: el diálogo nativo se muestra UNA sola vez por instalación. Si
// el usuario lo deniega, la única vía es openSystemSettings().
import * as Notifications from 'expo-notifications';
import { Linking, Platform } from 'react-native';
import { ensureChannel } from './channels';

export type PermissionState = 'granted' | 'denied' | 'undetermined';

// `status` se tipa como string a propósito: el enum PermissionStatus viene
// reexportado de expo-modules-core y no es parte estable del API público.
const toState = (status: string): PermissionState =>
  status === 'granted' ? 'granted' : status === 'denied' ? 'denied' : 'undetermined';

export async function getPermissionState(): Promise<PermissionState> {
  if (Platform.OS === 'web') return 'denied';
  const { status } = await Notifications.getPermissionsAsync();
  return toState(status);
}

export async function isPermissionGranted(): Promise<boolean> {
  return (await getPermissionState()) === 'granted';
}

export async function requestPermission(): Promise<PermissionState> {
  if (Platform.OS === 'web') return 'denied';
  await ensureChannel();
  const { status } = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: false, allowSound: true },
  });
  return toState(status);
}

/** Abre la ficha de la app en los ajustes del teléfono. */
export function openSystemSettings(): void {
  void Linking.openSettings();
}
```

- [ ] **Step 4: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sin errores en `src/notifications/`.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/notifications
git commit -m "feat: canal de Android y manejo de permisos de notificación

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: Reconciliación contra lo programado en el SO

**Files:**
- Create: `src/notifications/scheduler.ts`
- Create: `src/notifications/__tests__/scheduler.test.ts`

**Interfaces:**
- Consumes: `buildSchedule` (Task 1–2), `isPermissionGranted` (Task 4), `ensureChannel` (Task 4), `useNotifPrefs` (Task 3), `useStore` de `src/store/useStore.ts`.
- Produces: `reconcile(planned, existing)` → `{ toSchedule: PlannedNotification[]; toCancel: string[] }` (pura, testeada); `syncNotifications(): Promise<SyncResult>` con `SyncResult = { scheduled: number; cancelled: number; failed: number }`.

**Nota de diseño:** el diff se extrae a la función pura `reconcile()` para poder probarlo sin mocks del SDK. `syncNotifications()` queda como cableado delgado: leer estado → `reconcile` → aplicar. Solo esa parte se verifica a mano (Task 10).

- [ ] **Step 1: Escribir los tests que fallan**

Crear `src/notifications/__tests__/scheduler.test.ts`:

```ts
import { reconcile, ScheduledSnapshot } from '../scheduler';
import { PlannedNotification } from '../types';

const planned = (over: Partial<PlannedNotification> = {}): PlannedNotification => ({
  id: 'oiltrack:oil-warn:v1',
  kind: 'warn',
  title: 'Cambio de aceite cerca',
  body: 'A Toyota Corolla le quedan 400 km de aceite.',
  sig: 'sig-a',
  data: { screen: 'VehicleDetail', vehicleId: 'v1' },
  trigger: { type: 'date', date: 1_800_000_000_000 },
  ...over,
});

const scheduled = (id: string, sig: string): ScheduledSnapshot => ({ id, sig });

describe('reconcile', () => {
  it('programa lo que no existe todavía', () => {
    const out = reconcile([planned()], []);
    expect(out.toSchedule.map((p) => p.id)).toEqual(['oiltrack:oil-warn:v1']);
    expect(out.toCancel).toEqual([]);
  });

  it('deja intacto lo que ya está programado con la misma firma', () => {
    const out = reconcile([planned()], [scheduled('oiltrack:oil-warn:v1', 'sig-a')]);
    expect(out.toSchedule).toEqual([]);
    expect(out.toCancel).toEqual([]);
  });

  it('reprograma cuando la firma cambió', () => {
    const out = reconcile([planned({ sig: 'sig-b' })], [scheduled('oiltrack:oil-warn:v1', 'sig-a')]);
    expect(out.toSchedule.map((p) => p.id)).toEqual(['oiltrack:oil-warn:v1']);
    expect(out.toCancel).toEqual(['oiltrack:oil-warn:v1']);
  });

  it('cancela lo programado que ya no está en el plan', () => {
    const out = reconcile([], [scheduled('oiltrack:oil-warn:v1', 'sig-a')]);
    expect(out.toSchedule).toEqual([]);
    expect(out.toCancel).toEqual(['oiltrack:oil-warn:v1']);
  });

  it('con plan vacío cancela todo lo nuestro', () => {
    const out = reconcile([], [
      scheduled('oiltrack:oil-warn:v1', 'sig-a'),
      scheduled('oiltrack:checkin-weekly', 'sig-c'),
    ]);
    expect(out.toCancel.sort()).toEqual(['oiltrack:checkin-weekly', 'oiltrack:oil-warn:v1']);
  });

  it('es idempotente: reconciliar el resultado ya aplicado no hace nada', () => {
    const plan = [planned()];
    const applied = [scheduled('oiltrack:oil-warn:v1', 'sig-a')];
    expect(reconcile(plan, applied)).toEqual({ toSchedule: [], toCancel: [] });
  });

  it('no cancela una notificación programada que no cambió, aunque otra sí', () => {
    const out = reconcile(
      [planned(), planned({ id: 'oiltrack:checkin-weekly', kind: 'checkin', sig: 'nueva' })],
      [scheduled('oiltrack:oil-warn:v1', 'sig-a'), scheduled('oiltrack:checkin-weekly', 'vieja')]
    );
    expect(out.toSchedule.map((p) => p.id)).toEqual(['oiltrack:checkin-weekly']);
    expect(out.toCancel).toEqual(['oiltrack:checkin-weekly']);
  });
});
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `npx jest src/notifications/__tests__/scheduler.test.ts --no-coverage`
Expected: FAIL — `Cannot find module '../scheduler'`.

- [ ] **Step 3: Implementar `scheduler.ts`**

Crear `src/notifications/scheduler.ts`:

```ts
// Reconciliación: única capa que habla con expo-notifications.
//
// El diff vive en reconcile(), que es pura y está testeada. syncNotifications()
// es cableado: leer estado → diff → aplicar. Es idempotente, así que llamarla
// de más es inofensivo.
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { useStore } from '../store/useStore';
import { useNotifPrefs } from '../store/notifPrefs';
import { ensureChannel } from './channels';
import { isPermissionGranted } from './permissions';
import { buildSchedule } from './plan';
import { NOTIF_PREFIX, PlannedNotification, PlannedTrigger } from './types';

export type ScheduledSnapshot = { id: string; sig: string };
export type SyncResult = { scheduled: number; cancelled: number; failed: number };

export function reconcile(
  planned: PlannedNotification[],
  existing: ScheduledSnapshot[]
): { toSchedule: PlannedNotification[]; toCancel: string[] } {
  const bySig = new Map(existing.map((e) => [e.id, e.sig]));
  const plannedIds = new Set(planned.map((p) => p.id));

  const toSchedule = planned.filter((p) => bySig.get(p.id) !== p.sig);
  const toCancel = existing
    .filter((e) => !plannedIds.has(e.id) || bySig.get(e.id) !== planned.find((p) => p.id === e.id)?.sig)
    .map((e) => e.id);

  return { toSchedule, toCancel };
}

function toExpoTrigger(t: PlannedTrigger): Notifications.NotificationTriggerInput {
  if (t.type === 'date') {
    return { type: Notifications.SchedulableTriggerInputTypes.DATE, date: t.date };
  }
  return {
    type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
    weekday: t.weekday,
    hour: t.hour,
    minute: t.minute,
  };
}

async function readScheduled(): Promise<ScheduledSnapshot[]> {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  return all
    .filter((r) => r.identifier.startsWith(NOTIF_PREFIX))
    .map((r) => ({
      id: r.identifier,
      // `data` llega del SDK como Record<string, unknown>; la firma la
      // escribimos nosotros al programar.
      sig: String((r.content.data as Record<string, unknown> | undefined)?.sig ?? ''),
    }));
}

export async function syncNotifications(): Promise<SyncResult> {
  const result: SyncResult = { scheduled: 0, cancelled: 0, failed: 0 };
  if (Platform.OS === 'web') return result;

  await ensureChannel();

  const planned = buildSchedule({
    vehicles: useStore.getState().vehicles,
    prefs: useNotifPrefs.getState().prefs,
    permissionGranted: await isPermissionGranted(),
    now: new Date(),
  });

  const { toSchedule, toCancel } = reconcile(planned, await readScheduled());

  // Cancelar primero: reprogramar un identificador ya usado sin cancelarlo
  // deja duplicados en algunos dispositivos Android.
  for (const id of toCancel) {
    try {
      await Notifications.cancelScheduledNotificationAsync(id);
      result.cancelled += 1;
    } catch (e) {
      result.failed += 1;
      console.warn(`[notifications] no se pudo cancelar ${id}`, e);
    }
  }

  for (const p of toSchedule) {
    try {
      await Notifications.scheduleNotificationAsync({
        identifier: p.id,
        content: { title: p.title, body: p.body, data: { ...p.data, sig: p.sig } },
        trigger: toExpoTrigger(p.trigger),
      });
      result.scheduled += 1;
    } catch (e) {
      // Un fallo en una notificación no puede abortar las demás ni tumbar la
      // pantalla que disparó la reconciliación.
      result.failed += 1;
      console.warn(`[notifications] no se pudo programar ${p.id}`, e);
    }
  }

  return result;
}
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `npx jest --no-coverage`
Expected: PASS — 31 tests.

- [ ] **Step 5: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add src/notifications
git commit -m "feat: reconciliación de notificaciones contra el sistema

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: Configuración nativa y arranque de la reconciliación

**Files:**
- Create: `assets/notification-icon.png`
- Create: `src/notifications/useNotificationsSync.ts`
- Create: `src/notifications/index.ts`
- Modify: `app.json` (array `plugins`)
- Modify: `App.tsx`

**Interfaces:**
- Consumes: `syncNotifications` (Task 5), `useNotifPrefs` (Task 3), `useStore`.
- Produces: `useNotificationsSync(): void` — hook que reconcilia al montar, al volver de segundo plano y ante cambios de estado; `src/notifications/index.ts` reexporta el módulo y registra `setNotificationHandler`.

- [ ] **Step 1: Generar el ícono de notificación de Android**

Android exige un PNG monocromo con transparencia (el sistema lo tiñe). Se deriva del que ya existe:

```bash
sips -z 96 96 assets/android-icon-monochrome.png --out assets/notification-icon.png
```

- [ ] **Step 2: Registrar el config plugin**

En `app.json`, reemplazar el array `plugins` por:

```json
"plugins": [
  "expo-font",
  "expo-status-bar",
  [
    "expo-notifications",
    {
      "icon": "./assets/notification-icon.png",
      "color": "#0A2540",
      "defaultChannel": "oil-reminders"
    }
  ]
]
```

El color es `palette.primary` del handoff; el canal debe coincidir con `CHANNEL_ID` de `src/notifications/channels.ts`.

- [ ] **Step 3: Escribir el hook de sincronización**

Crear `src/notifications/useNotificationsSync.ts`:

```ts
// Cuándo se reconcilia. Tres disparadores, todos convergiendo en la misma
// función idempotente con debounce.
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useStore } from '../store/useStore';
import { useNotifPrefs } from '../store/notifPrefs';
import { syncNotifications } from './scheduler';

const DEBOUNCE_MS = 300;

export function useNotificationsSync(): void {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    const run = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        // Antes de rehidratar, `prefs` son los valores por defecto: programar
        // ahora pisaría lo que el usuario ya había configurado.
        if (!useNotifPrefs.getState().hydrated) return;
        void syncNotifications();
      }, DEBOUNCE_MS);
    };

    run();

    // Volver de segundo plano: cubre que el usuario haya revocado el permiso
    // desde los ajustes del teléfono mientras la app no estaba en pantalla.
    const appState = AppState.addEventListener('change', (s) => {
      if (s === 'active') run();
    });

    // Cambios de datos: addOilChange, addVehicle, switches de preferencias y
    // el flag `hydrated` cuando termina de leerse el almacenamiento.
    const unsubVehicles = useStore.subscribe(run);
    const unsubPrefs = useNotifPrefs.subscribe(run);

    return () => {
      if (timer) clearTimeout(timer);
      appState.remove();
      unsubVehicles();
      unsubPrefs();
    };
  }, []);
}
```

- [ ] **Step 4: Escribir el punto de entrada del módulo**

Crear `src/notifications/index.ts`:

```ts
// Punto de entrada del subsistema. Importar este módulo registra el handler
// que decide cómo se presenta una notificación con la app en primer plano.
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export { CHANNEL_ID, ensureChannel } from './channels';
export {
  getPermissionState,
  isPermissionGranted,
  openSystemSettings,
  requestPermission,
  type PermissionState,
} from './permissions';
export { buildSchedule, nextOccurrence, REMINDER_HOUR } from './plan';
export { reconcile, syncNotifications, type SyncResult } from './scheduler';
export { useNotificationsSync } from './useNotificationsSync';
export * from './types';
```

- [ ] **Step 5: Cablear en `App.tsx`**

Añadir el import junto a los demás imports de `src/`:

```ts
import { useNotificationsSync } from './src/notifications';
```

Y dentro del componente `App`, **antes** del `if (!fontsLoaded) return null;` — los hooks deben llamarse siempre en el mismo orden, así que no pueden quedar después de un return temprano:

```ts
  useNotificationsSync();
```

- [ ] **Step 6: Verificar que arranca**

Run: `npx tsc --noEmit && npx expo start --clear`
Expected: compila sin errores y el bundle carga en el simulador sin warnings de `expo-notifications`.

- [ ] **Step 7: Commit**

```bash
git add app.json assets/notification-icon.png App.tsx src/notifications
git commit -m "feat: configuración nativa de notificaciones y arranque de la reconciliación

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: Pedir el permiso al entrar a la app por primera vez

**Files:**
- Create: `src/notifications/useFirstRunPermission.ts`
- Modify: `src/navigation/index.tsx` (componente `Tabs`)
- Modify: `src/notifications/index.ts` (reexport)

**Interfaces:**
- Consumes: `requestPermission` (Task 4), `useNotifPrefs` (Task 3), `syncNotifications` (Task 5).
- Produces: `useFirstRunPermission(): void` — pide el permiso una única vez, la primera vez que se monta `Tabs`.

- [ ] **Step 1: Escribir el hook**

Crear `src/notifications/useFirstRunPermission.ts`:

```ts
// Pide el permiso de notificaciones la primera vez que el usuario entra a la
// app (al montar Tabs, venga de Login o de Signup). Diálogo nativo directo,
// sin pantalla previa.
//
// Se ejecuta UNA sola vez en la vida de la instalación: `permissionAskedAt`
// está persistido. En iOS eso es obligatorio — el sistema solo muestra el
// diálogo una vez; después, la única vía es openSystemSettings().
import { useEffect } from 'react';
import { useNotifPrefs } from '../store/notifPrefs';
import { requestPermission } from './permissions';
import { syncNotifications } from './scheduler';

export function useFirstRunPermission(): void {
  useEffect(() => {
    let cancelled = false;

    const ask = async () => {
      const { prefs, hydrated, markPermissionAsked, setPref } = useNotifPrefs.getState();
      if (!hydrated || prefs.permissionAskedAt !== null) return;

      const state = await requestPermission();
      if (cancelled) return;

      markPermissionAsked();
      setPref('enabled', state === 'granted');
      // Sale del diálogo con sus recordatorios ya programados.
      void syncNotifications();
    };

    void ask();
    // Si el store aún no había rehidratado al montar, reintentar cuando lo haga.
    const unsub = useNotifPrefs.subscribe(() => void ask());

    return () => {
      cancelled = true;
      unsub();
    };
  }, []);
}
```

- [ ] **Step 2: Reexportar desde el índice del módulo**

En `src/notifications/index.ts`, añadir junto a los demás export:

```ts
export { useFirstRunPermission } from './useFirstRunPermission';
```

- [ ] **Step 3: Llamarlo al montar `Tabs`**

En `src/navigation/index.tsx`, añadir el import:

```ts
import { useFirstRunPermission } from '../notifications';
```

Y en el componente `Tabs`, como primera línea del cuerpo:

```tsx
function Tabs() {
  useFirstRunPermission();
  return (
```

- [ ] **Step 4: Verificar a mano en el simulador**

Run: `npx expo start --ios`
Expected: pasar Onboarding → Login → al entrar a las tabs aparece el diálogo nativo del sistema pidiendo permiso. Cerrar y reabrir la app: **no** vuelve a aparecer.

- [ ] **Step 5: Commit**

```bash
git add src/navigation/index.tsx src/notifications
git commit -m "feat: pedir el permiso de notificaciones al entrar por primera vez

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 8: Navegar al tocar una notificación

**Files:**
- Create: `src/navigation/navigationRef.ts`
- Create: `src/notifications/useNotificationResponse.ts`
- Modify: `src/navigation/types.ts` (añadir `TabParamList`, tipar `Tabs`)
- Modify: `src/navigation/index.tsx` (ref + `onReady` + tabs tipadas)
- Modify: `src/notifications/index.ts` (reexport)
- Modify: `App.tsx` (llamar al hook)

**Interfaces:**
- Consumes: `NotifRouteData` (Task 1), `RootStackParamList`.
- Produces: `navigationRef`, `runWhenReady(fn)`, `flushPendingRoute()` (en `navigationRef.ts`); `TabParamList` (en `types.ts`); `useNotificationResponse(): void`.

- [ ] **Step 1: Crear la ref del navegador con cola**

Crear `src/navigation/navigationRef.ts`:

```ts
// Ref imperativa del navegador + cola de una sola entrada.
//
// Cuando la app arranca DESDE una notificación (proceso frío), el navegador
// todavía no está montado: la navegación se guarda y se ejecuta en onReady.
import { createNavigationContainerRef } from '@react-navigation/native';
import { RootStackParamList } from './types';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

let pending: (() => void) | null = null;

export function runWhenReady(fn: () => void): void {
  if (navigationRef.isReady()) fn();
  else pending = fn;
}

export function flushPendingRoute(): void {
  const fn = pending;
  pending = null;
  fn?.();
}
```

- [ ] **Step 2: Tipar las tabs**

En `src/navigation/types.ts`, añadir el import y el tipo:

```ts
import type { NavigatorScreenParams } from '@react-navigation/native';

export type TabParamList = {
  Home: undefined;
  Vehicles: undefined;
  Alerts: undefined;
  Me: undefined;
};
```

Y cambiar la entrada `Tabs` de `RootStackParamList`:

```ts
  Tabs: NavigatorScreenParams<TabParamList> | undefined;
```

- [ ] **Step 3: Conectar la ref en el navegador**

En `src/navigation/index.tsx`:

```ts
import { navigationRef, flushPendingRoute } from './navigationRef';
import { RootStackParamList, TabParamList } from './types';
```

Tipar el navegador de tabs:

```ts
const Tab = createBottomTabNavigator<TabParamList>();
```

Y en `AppNavigator`, pasar la ref y el callback al contenedor:

```tsx
    <NavigationContainer theme={navThemes[scheme]} ref={navigationRef} onReady={flushPendingRoute}>
```

- [ ] **Step 4: Escribir el hook de respuesta**

Crear `src/notifications/useNotificationResponse.ts`:

```ts
// Qué pasa al tocar una notificación: navegar al vehículo del aviso, o a la
// pestaña de Alertas si es el recordatorio semanal.
import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { navigationRef, runWhenReady } from '../navigation/navigationRef';
import { NotifRouteData } from './types';

function navigate(data: NotifRouteData): void {
  runWhenReady(() => {
    if (data.screen === 'VehicleDetail' && data.vehicleId) {
      navigationRef.navigate('VehicleDetail', { vehicleId: data.vehicleId });
      return;
    }
    navigationRef.navigate('Tabs', { screen: 'Alerts' });
  });
}

function toRouteData(response: Notifications.NotificationResponse | null): NotifRouteData | null {
  const data = response?.notification.request.content.data as
    | Record<string, unknown>
    | undefined;
  if (!data) return null;
  const screen = data.screen;
  if (screen !== 'VehicleDetail' && screen !== 'Alerts') return null;
  return {
    screen,
    vehicleId: typeof data.vehicleId === 'string' ? data.vehicleId : undefined,
  };
}

export function useNotificationResponse(): void {
  useEffect(() => {
    if (Platform.OS === 'web') return;

    // Arranque en frío: la app se abrió tocando una notificación.
    void Notifications.getLastNotificationResponseAsync().then((response) => {
      const data = toRouteData(response);
      if (data) navigate(data);
    });

    // App ya viva (primer o segundo plano).
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = toRouteData(response);
      if (data) navigate(data);
    });

    return () => sub.remove();
  }, []);
}
```

- [ ] **Step 5: Reexportar y cablear**

En `src/notifications/index.ts`:

```ts
export { useNotificationResponse } from './useNotificationResponse';
```

En `App.tsx`, junto a `useNotificationsSync()` y antes del return temprano:

```ts
  useNotificationResponse();
```

Actualizando el import a:

```ts
import { useNotificationResponse, useNotificationsSync } from './src/notifications';
```

- [ ] **Step 6: Verificar tipos y tests**

Run: `npx tsc --noEmit && npx jest --no-coverage`
Expected: sin errores de tipos (en particular, `navigate('Tabs', { screen: 'Alerts' })` compila gracias a `NavigatorScreenParams`), 31 tests en verde.

- [ ] **Step 7: Commit**

```bash
git add App.tsx src/navigation src/notifications
git commit -m "feat: navegar al tocar una notificación

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 9: Pantalla de ajustes de notificaciones

**Files:**
- Create: `src/screens/NotificationsScreen.tsx`
- Modify: `src/navigation/types.ts` (ruta `Notifications`)
- Modify: `src/navigation/index.tsx` (registrar la pantalla)
- Modify: `src/screens/ProfileScreen.tsx` (fila pulsable con estado real)
- Modify: `src/screens/AlertsScreen.tsx` (`IconBtn` de ajustes → la pantalla)

**Interfaces:**
- Consumes: `useNotifPrefs` (Task 3), `getPermissionState`, `requestPermission`, `openSystemSettings` (Task 4), primitivas de `src/ui` y `src/components/primitives.tsx`.
- Produces: ruta `Notifications: undefined` en `RootStackParamList`; componente `NotificationsScreen`.

- [ ] **Step 1: Registrar la ruta**

En `src/navigation/types.ts`, dentro de `RootStackParamList`:

```ts
  Notifications: undefined;
```

- [ ] **Step 2: Escribir la pantalla**

Crear `src/screens/NotificationsScreen.tsx`:

```tsx
// Ajustes de notificaciones — switch maestro, tipos de aviso, día y hora del
// recordatorio, y salida a los ajustes del sistema si el permiso está bloqueado.
import React, { useCallback, useState } from 'react';
import { Switch } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Box, Col, Row, Screen, Scroll, Txt, useAppColors } from '../ui';
import { Btn, Card, IconBtn, SectionHead, Select } from '../components/primitives';
import { Icon } from '../components/Icon';
import { fmtKm } from '../utils/format';
import { useNotifPrefs } from '../store/notifPrefs';
import {
  getPermissionState,
  openSystemSettings,
  requestPermission,
  type PermissionState,
} from '../notifications';

const WEEKDAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const HOURS = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, '0')}:00`);

export function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const c = useAppColors();
  const prefs = useNotifPrefs((s) => s.prefs);
  const setPref = useNotifPrefs((s) => s.setPref);
  const markPermissionAsked = useNotifPrefs((s) => s.markPermissionAsked);
  const [permission, setPermission] = useState<PermissionState>('undetermined');

  // Al volver a la pantalla: el usuario puede haber cambiado el permiso en los
  // ajustes del teléfono mientras tanto.
  useFocusEffect(
    useCallback(() => {
      void getPermissionState().then(setPermission);
    }, [])
  );

  const blocked = permission === 'denied';
  const master = prefs.enabled && !blocked;

  const onActivate = async () => {
    const state = await requestPermission();
    markPermissionAsked();
    setPermission(state);
    setPref('enabled', state === 'granted');
  };

  const toggle = (label: string, hint: string, value: boolean, onChange: (v: boolean) => void, disabled = false) => (
    <Row jc="space-between" ai="center" gap="$md" px="$lg" py={14}>
      <Col f={1} gap={2}>
        <Txt font="semi" fos={14} tone={disabled ? 'muted2' : 'ink'}>
          {label}
        </Txt>
        <Txt fos={12} tone="muted">
          {hint}
        </Txt>
      </Col>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ false: c.line, true: c.accent }}
      />
    </Row>
  );

  return (
    <Screen>
      <Row jc="space-between" ai="center" px="$lg" pb="$md" style={{ paddingTop: insets.top + 12 }}>
        <IconBtn icon={<Icon name="chevL" color={c.ink} size={20} />} onPress={() => navigation.goBack()} />
        <Txt font="display" fos={18}>
          Notificaciones
        </Txt>
        <Box w={36} />
      </Row>

      <Scroll contentContainerStyle={{ paddingBottom: 48, gap: 18 }} showsVerticalScrollIndicator={false}>
        {blocked ? (
          <Box px="$lg">
            <Card>
              <Col gap="$sm" p="$lg">
                <Row gap="$sm" ai="center">
                  <Icon name="bell" color={c.danger} size={18} />
                  <Txt font="semi" fos={14} tone="danger">
                    Permiso bloqueado en el sistema
                  </Txt>
                </Row>
                <Txt fos={13} tone="muted">
                  Tu teléfono tiene bloqueadas las notificaciones de OilTrack VE. Actívalas desde los
                  ajustes para volver a recibir avisos.
                </Txt>
                <Btn size="sm" onPress={openSystemSettings}>
                  Abrir ajustes
                </Btn>
              </Col>
            </Card>
          </Box>
        ) : permission === 'undetermined' ? (
          <Box px="$lg">
            <Card>
              <Col gap="$sm" p="$lg">
                <Txt fos={13} tone="muted">
                  Activa los avisos para enterarte del cambio de aceite sin abrir la app.
                </Txt>
                <Btn size="sm" onPress={() => void onActivate()}>
                  Activar
                </Btn>
              </Col>
            </Card>
          </Box>
        ) : null}

        <Col gap="$sm">
          <SectionHead>Avisos</SectionHead>
          <Box px="$lg">
            <Card padded={false}>
              {toggle(
                'Notificaciones',
                'Interruptor general de todos los avisos',
                master,
                (v) => setPref('enabled', v),
                blocked
              )}
              {toggle(
                'Cambio próximo',
                `Cuando falten menos de ${fmtKm(prefs.warnThresholdKm)} km`,
                prefs.warnEnabled,
                (v) => setPref('warnEnabled', v),
                !master
              )}
              {toggle(
                'Cambio vencido',
                'Cuando el vehículo pasó el kilometraje recomendado',
                prefs.overdueEnabled,
                (v) => setPref('overdueEnabled', v),
                !master
              )}
              {toggle(
                'Recordatorio semanal',
                'Para que actualices el kilometraje',
                prefs.checkinEnabled,
                (v) => setPref('checkinEnabled', v),
                !master
              )}
            </Card>
          </Box>
        </Col>

        <Col gap="$sm">
          <SectionHead>Recordatorio semanal</SectionHead>
          <Box px="$lg">
            <Card>
              <Col gap="$md" p="$lg">
                <Col gap={6}>
                  <Txt fos={12} tone="muted" caps ls={1}>
                    Día
                  </Txt>
                  <Select
                    value={WEEKDAYS[prefs.checkinWeekday - 1]}
                    options={WEEKDAYS}
                    onChange={(v) => setPref('checkinWeekday', WEEKDAYS.indexOf(v) + 1)}
                  />
                </Col>
                <Col gap={6}>
                  <Txt fos={12} tone="muted" caps ls={1}>
                    Hora
                  </Txt>
                  <Select
                    value={`${String(prefs.checkinHour).padStart(2, '0')}:00`}
                    options={HOURS}
                    onChange={(v) => setPref('checkinHour', Number(v.slice(0, 2)))}
                  />
                </Col>
                <Txt fos={12} tone="muted">
                  Los avisos de cambio próximo y vencido se entregan a las 09:00.
                </Txt>
              </Col>
            </Card>
          </Box>
        </Col>
      </Scroll>
    </Screen>
  );
}
```

- [ ] **Step 3: Registrar la pantalla en el stack**

En `src/navigation/index.tsx`, añadir el import:

```ts
import { NotificationsScreen } from '../screens/NotificationsScreen';
```

Y la pantalla, después de `<Stack.Screen name="History" ... />`:

```tsx
        <Stack.Screen name="Notifications" component={NotificationsScreen} />
```

- [ ] **Step 4: Entrada desde el Perfil**

En `src/screens/ProfileScreen.tsx`, añadir los imports:

```ts
import { useNotifPrefs } from '../store/notifPrefs';
```

Dentro del componente, antes de `prefRows`:

```ts
  const notifEnabled = useNotifPrefs((s) => s.prefs.enabled);
```

Cambiar el tipo y la primera fila de `prefRows` para que lleve `onPress` y estado real:

```ts
  const prefRows: { k: string; v: string; icon: IconName; onPress?: () => void }[] = [
    {
      k: 'Notificaciones',
      v: notifEnabled ? 'Activadas' : 'Desactivadas',
      icon: 'bell',
      onPress: () => navigation.navigate('Notifications'),
    },
    { k: 'Unidad', v: 'Kilómetros', icon: 'gauge' },
    { k: 'Idioma', v: 'Español (VE)', icon: 'flag' },
    { k: 'Privacidad', v: '', icon: 'shield' },
  ];
```

Y en el `Touchable` que renderiza cada fila, añadir la prop:

```tsx
                  onPress={r.onPress}
```

- [ ] **Step 5: Entrada desde Alertas**

En `src/screens/AlertsScreen.tsx`, el `IconBtn` de la barra superior ya existe sin acción. Añadirle el `onPress`:

```tsx
        <IconBtn
          icon={<Icon name="settings" color={T.ink} size={20} />}
          size={40}
          onPress={() => navigation.navigate('Notifications')}
        />
```

- [ ] **Step 6: Verificar tipos y correr la app**

Run: `npx tsc --noEmit && npx expo start --ios`
Expected: sin errores de tipos. En el simulador: Perfil → Notificaciones abre la pantalla; los switches responden; apagar el maestro deshabilita los tres de abajo; el estado de la fila del Perfil cambia entre *Activadas* y *Desactivadas*.

- [ ] **Step 7: Commit**

```bash
git add src/navigation src/screens
git commit -m "feat: pantalla de ajustes de notificaciones

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 10: Verificación end-to-end y documentación

**Files:**
- Modify: `README.md`
- Temporal (revertir al terminar): `src/notifications/plan.ts`

**Interfaces:**
- Consumes: todo lo anterior.
- Produces: evidencia de que la entrega real funciona en el dispositivo, y el README actualizado.

- [ ] **Step 1: Acelerar el trigger para poder observarlo**

`scheduler.ts` no se prueba con mocks del SDK, así que la entrega se verifica a mano. En `src/notifications/plan.ts`, sustituir **temporalmente** el cálculo del trigger de umbral:

```ts
  // TEMPORAL — verificación manual, revertir en el Step 5
  const trigger: PlannedTrigger = { type: 'date', date: Date.now() + 10_000 };
```

- [ ] **Step 2: Verificar la entrega**

Run: `npx expo start --ios`

Comprobar, en orden:

1. Conceder el permiso al entrar a las tabs.
2. Registrar un cambio de aceite que deje el vehículo con menos de 500 km restantes (pantalla *Registrar cambio*).
3. Mandar la app a segundo plano. A los ~10 s llega la notificación con el nombre del vehículo y los km correctos en formato es-VE.
4. Tocarla: la app abre el detalle de **ese** vehículo.
5. Volver a Notificaciones y apagar el switch maestro; repetir el paso 2: no llega nada.

- [ ] **Step 3: Verificar la idempotencia**

Con la app abierta, cambiar un switch de la pantalla de Notificaciones cinco veces seguidas (encender/apagar), dejarlo encendido y luego forzar cierre + reapertura de la app. Ejecutar en la consola de Metro, o añadir un log temporal en `syncNotifications`:

```ts
console.log('[notifications]', await Notifications.getAllScheduledNotificationsAsync());
```

Expected: **una sola** notificación programada por vehículo en riesgo, más el `oiltrack:checkin-weekly`. Ningún identificador repetido.

- [ ] **Step 4: Verificar que la web no se rompe**

Run: `npx expo start --web`
Expected: la app carga sin errores en consola relacionados con `expo-notifications`.

- [ ] **Step 5: Revertir el trigger temporal**

Restaurar en `src/notifications/plan.ts`:

```ts
  const trigger: PlannedTrigger = { type: 'date', date: nextOccurrence(now, REMINDER_HOUR) };
```

Run: `npx jest --no-coverage`
Expected: PASS — 31 tests (el test «entrega los avisos de umbral a las 9:00» vuelve a pasar, que es la red de seguridad contra dejar el trigger temporal puesto).

- [ ] **Step 6: Actualizar el README**

En la sección **Stack**, añadir:

```md
- **expo-notifications** — notificaciones locales: cambio próximo, vencido y recordatorio semanal
- **expo-sqlite/kv-store + zustand/persist** — preferencias de notificación persistidas
```

En **Estructura**, dentro del bloque `src/`:

```
├── notifications/  # plan puro + reconciliación con el SO + permisos
```

En **Pantallas**, añadir al final de la lista:

```md
13. **Notificaciones** — switch maestro, tipos de aviso, día y hora del recordatorio
```

En **Pendiente**, quitar la línea de notificaciones locales (ya está hecha) y añadir:

```md
- Push remoto (`getExpoPushTokenAsync` + backend) — requiere development build y EAS
```

- [ ] **Step 7: Commit**

```bash
git add README.md src/notifications
git commit -m "docs: documentar el subsistema de notificaciones locales

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```
