# Notificaciones locales nativas — OilTrack VE

**Fecha:** 2026-09-12
**Estado:** diseño aprobado, pendiente de implementación
**Alcance:** notificaciones **locales** (programadas en el dispositivo). Push remoto queda fuera.

## Problema

La app calcula el estado del aceite (`vehicleStatus`, `kmLeft`) y lo muestra en
Home y Alertas, pero solo cuando el usuario abre la app. El caso de uso real es
el contrario: enterarse de que el cambio está por vencerse **sin** abrir la app.

El README ya lo tiene anotado como pendiente: *"Notificaciones locales
(`expo-notifications`) cuando `kmLeft < 500`"*.

## Restricciones del contexto

- **Expo SDK 57.** Las notificaciones locales funcionan en Expo Go; el push
  remoto no (Android, desde SDK 53) — por eso el alcance es solo local.
- **El kilometraje no avanza solo.** `v.km` solo cambia cuando el usuario
  registra un cambio de aceite. Cualquier diseño puramente reactivo al km deja
  de avisar en cuanto el usuario deja de abrir la app.
- **El store es memoria pura.** `useStore` arranca siempre de `MOCK_FLEET`. No
  hay persistencia ni backend conectado.
- **iOS solo permite un diálogo de permiso por instalación.** Si el usuario lo
  deniega, no hay forma de volver a preguntar desde código.

## Decisiones

| Decisión | Elegido | Descartado |
|---|---|---|
| Alcance | Solo notificaciones locales | Push remoto (requiere dev build + EAS + FCM/APNs) |
| Disparador | Umbral de km **+** recordatorio semanal | Solo umbral; estimación por km/día; solo por tiempo |
| Persistencia | Solo el slice de preferencias | Persistir todo el store |
| UI | Pantalla nueva de Notificaciones | Switch suelto en Perfil; panel en Alertas |
| Arquitectura | Motor declarativo de reconciliación | Imperativo en el store; reprogramar solo al arrancar |
| Permiso | Diálogo nativo directo al entrar a `Tabs` | Hoja de contexto previa (descartada por el usuario) |

### Por qué reconciliación declarativa

El bug clásico de esta clase de features son las notificaciones duplicadas o
zombis: el usuario edita un vehículo y le quedan programados avisos de datos
viejos. Una función pura `estado → plan` más una capa que aplica el diff contra
lo que el SO ya tiene programado elimina ese bug por construcción, y confina el
SDK de Expo a un solo archivo.

## Arquitectura

```
src/notifications/
├── types.ts         # PlannedNotification, NotifPrefs
├── plan.ts          # buildSchedule(input) → PlannedNotification[]   ← PURA, sin SDK
├── scheduler.ts     # syncNotifications() — única capa que toca expo-notifications
├── permissions.ts   # getPermissionStatus(), requestPermission()
├── channels.ts      # canal Android 'oil-reminders'
└── index.ts
src/store/notifPrefs.ts       # slice Zustand persistido
src/screens/NotificationsScreen.tsx
```

`plan.ts` no importa nada de Expo ni de React: recibe estado, devuelve intención.
Esa frontera es lo que hace el módulo testeable sin mocks del SDK.

### Modelo de datos

```ts
// src/notifications/types.ts
export type NotifKind = 'warn' | 'overdue' | 'checkin';

export type PlannedNotification = {
  id: string;        // estable: 'oiltrack:oil-warn:<vehicleId>'
  kind: NotifKind;
  title: string;
  body: string;
  sig: string;       // firma de contenido+trigger, para detectar cambios
  data: { screen: 'VehicleDetail' | 'Alerts'; vehicleId?: string };
  trigger:
    | { type: 'date'; date: number }
    | { type: 'weekly'; weekday: number; hour: number; minute: number };
};
```

El `trigger` se modela con un tipo propio (no el `SchedulableTriggerInput` de
Expo) para que `plan.ts` siga siendo independiente del SDK; `scheduler.ts` lo
traduce a `Notifications.SchedulableTriggerInputTypes.*`.

```ts
// src/store/notifPrefs.ts
export type NotifPrefs = {
  enabled: boolean;           // switch maestro
  warnEnabled: boolean;       // avisos de "próximo"
  overdueEnabled: boolean;    // avisos de "vencido"
  checkinEnabled: boolean;    // recordatorio semanal
  warnThresholdKm: number;    // 500
  checkinWeekday: number;     // 1..7, domingo = 1 (convención de Expo)
  checkinHour: number;        // 9
  checkinMinute: number;      // 0
  permissionAskedAt: number | null;  // epoch ms; null = nunca se preguntó
};
```

Valores por defecto: todo en `true`, umbral 500 km, check-in domingo 9:00,
`permissionAskedAt: null`.

El estado del permiso del SO **no se persiste**: se lee del sistema en cada
reconciliación, porque el usuario puede revocarlo desde Ajustes sin que la app
se entere.

**Persistencia:** `expo-sqlite/kv-store` (el reemplazo de AsyncStorage que Expo
recomienda en SDK 57) con el middleware `persist` de Zustand, clave
`oiltrack:notif-prefs`. Solo este slice se persiste; `useStore` sigue en memoria.

### El plan

```ts
buildSchedule(input: {
  vehicles: Vehicle[];
  prefs: NotifPrefs;
  permissionGranted: boolean;
  now: Date;
}): PlannedNotification[]
```

Reglas, en orden:

1. Si `!permissionGranted` o `!prefs.enabled` → `[]`. (La reconciliación
   entonces cancela todo lo nuestro; no hace falta un caso especial.)
2. Por cada vehículo, con `km = kmLeft(v)`:
   - `km <= 0` y `prefs.overdueEnabled` → `oiltrack:oil-overdue:<id>`
   - `0 < km <= prefs.warnThresholdKm` y `prefs.warnEnabled` → `oiltrack:oil-warn:<id>`
   - en cualquier otro caso, ninguna. **Un vehículo nunca genera las dos**: son
     mutuamente excluyentes.
3. Si `prefs.checkinEnabled` → `oiltrack:checkin-weekly`.

**Contenido** (es-VE, con `fmtKm` de `src/utils/format.ts`):

| id | condición | título / cuerpo |
|---|---|---|
| `oiltrack:oil-warn:<id>` | `0 < kmLeft ≤ 500` | «Cambio de aceite cerca» / «Al Toyota Corolla le quedan 340 km de aceite.» |
| `oiltrack:oil-overdue:<id>` | `kmLeft ≤ 0` | «Cambio de aceite vencido» / «Bera BR-200 pasó 120 km del cambio recomendado.» |
| `oiltrack:checkin-weekly` | semanal | «¿Actualizaste el kilometraje?» / «Registra los km de tus vehículos para no perder un cambio.» |

**Momento de entrega.** Los avisos de umbral **no se entregan al instante**: si
se dispararan al guardar el kilometraje, le llegaría una notificación al usuario
mientras mira la pantalla que la causó. Se programan con trigger `date` a la
**próxima ocurrencia de las 9:00 locales** — hoy a las 9:00 si `now` es anterior,
mañana a las 9:00 si ya pasó. El check-in usa trigger `weekly`.

**Firma.** `sig` es la concatenación `title | body | JSON.stringify(trigger)` y viaja en
`content.data.sig`. Es lo que permite distinguir "esta notificación ya está
programada y sigue vigente" de "está programada pero con datos viejos".

### La reconciliación

```ts
syncNotifications(): Promise<{ scheduled: number; cancelled: number; failed: number }>
```

1. `Platform.OS === 'web'` → no-op inmediato (para no romper `npm run web`).
2. Asegurar el canal Android (`channels.ts`).
3. Leer permiso del SO y preferencias; calcular `planned = buildSchedule(...)`.
4. `existing = (await getAllScheduledNotificationsAsync()).filter(n => n.identifier.startsWith('oiltrack:'))`.
5. Por cada `p` de `planned`: si existe una con el mismo `identifier` **y** el
   mismo `sig` → se deja intacta. Si no, se cancela la vieja (si la hay) y se
   programa con `scheduleNotificationAsync({ identifier: p.id, content, trigger })`.
6. Toda `existing` cuyo `identifier` no esté en `planned` → `cancelScheduledNotificationAsync`.

El filtro por prefijo `oiltrack:` evita pisar notificaciones de otro origen.

**Manejo de errores:** cada programación va en su propio `try/catch`. Un fallo
del SDK en una notificación no aborta las demás ni tumba la pantalla; se
contabiliza en `failed` y se registra con `console.warn`. La función nunca
lanza.

**Cuándo se llama.** Tres momentos, y es idempotente, así que llamarla de más es
inofensivo:

- al montar la app, después de cargar fuentes y rehidratar las preferencias;
- cuando `AppState` vuelve a `active` — cubre que el usuario revoque el permiso
  desde Ajustes mientras la app está en segundo plano;
- en una suscripción de Zustand a `[vehicles, prefs]` con debounce de ~300 ms,
  que cubre `addOilChange`, `addVehicle` y cada switch de la pantalla.

### Permisos

**Primera vez.** Al aterrizar en `Tabs` por primera vez (venga de Login o de
Signup) se llama `requestPermissionsAsync()` y aparece el **diálogo nativo del
sistema**, sin pantalla previa. Se ejecuta una sola vez, controlado por
`permissionAskedAt`; al responder se guarda el timestamp.

- Concedido → `enabled: true` y `syncNotifications()` de inmediato.
- Denegado → `enabled: false`. La pantalla de Notificaciones pasa a ser la única
  vía: muestra «Permiso bloqueado en el sistema» con un botón que abre los
  ajustes del teléfono (`Linking.openSettings()`), porque en iOS el diálogo
  nativo ya no se puede volver a mostrar.

En Android 13+ el canal `oil-reminders` se crea **antes** de pedir el permiso;
si no, el diálogo del sistema sale sin nombre de canal.

### Tocar la notificación

`addNotificationResponseReceivedListener` lee `data.{screen, vehicleId}` y
navega: `VehicleDetail` si el aviso es de un vehículo, `Alerts` si es el
check-in. Se usa la `navigationRef` de React Navigation porque, cuando la app
arranca **desde** una notificación en frío, el navegador aún no está montado: la
respuesta se guarda y se consume en `onReady`.

`setNotificationHandler` se registra a nivel de módulo con
`{ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }`.

### Pantalla de Notificaciones

Nueva ruta `Notifications` en el stack raíz (`RootStackParamList`), con el
estilo navy del handoff. Usa las primitivas Tamagui de `src/ui`
(`Screen`, `Col`, `Row`, `Txt`, `Touchable`, `useAppColors`) más `Card`,
`SectionHead` y `Btn` de `src/components/primitives.tsx` — es decir, la
convención de la migración a Tamagui en curso, **no** los wrappers `className`
de `src/tw`, que están siendo eliminados. Contiene:

- switch maestro **Notificaciones**;
- switches por tipo: **Cambio próximo**, **Cambio vencido**, **Recordatorio
  semanal** (deshabilitados en gris cuando el maestro está apagado);
- selector de día y hora del recordatorio;
- banner de permiso denegado con botón a Ajustes;
- nota del umbral («Te avisamos cuando falten menos de 500 km»).

**Entradas:** la fila «Notificaciones» de `ProfileScreen` (hoy estática, pasa a
ser pulsable y a mostrar el estado real: *Activadas* / *Desactivadas* /
*Bloqueadas*) y el `IconBtn` de ajustes que ya existe en `AlertsScreen`.

### Configuración nativa

`app.json` — plugin `expo-notifications`:

```json
["expo-notifications", {
  "icon": "./assets/notification-icon.png",
  "color": "#0B2545",
  "defaultChannel": "oil-reminders"
}]
```

El ícono de Android debe ser un PNG monocromo con transparencia; se deriva del
`assets/android-icon-monochrome.png` existente.

## Pruebas

El proyecto no tiene infraestructura de tests. Se añade `jest-expo` y se prueba
**solo `plan.ts`**, que es donde vive toda la lógica real:

- umbral en los bordes: `kmLeft` = 501, 500, 1, 0, negativo;
- `warn` y `overdue` son mutuamente excluyentes para un mismo vehículo;
- cada switch apagado elimina exactamente su tipo de notificación;
- `enabled: false` o sin permiso → plan vacío;
- «próxima 9:00»: `now` a las 7:00 → hoy; `now` a las 14:00 → mañana;
- el `sig` cambia cuando cambia el km del vehículo y se mantiene cuando no.

`scheduler.ts` no se prueba con mocks del SDK: se verifica a mano en el
simulador con un trigger de pocos segundos, comprobando además que reconciliar
dos veces seguidas no duplica nada.

## Fuera de alcance

- Push remoto, tokens de Expo/EAS, credenciales FCM/APNs.
- Persistir vehículos y cambios (siguen siendo mock en memoria).
- Notificaciones basadas en tiempo transcurrido desde el último cambio.
- Estimación de km/día para predecir la fecha del próximo cambio.
- Integración con el backend NestJS de `../backend-oil-app`.
