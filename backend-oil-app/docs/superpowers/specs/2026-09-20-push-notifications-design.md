# Notificaciones push desde el servidor

Fecha: 2026-09-20
Alcance: backend (`backend-oil-app`) y app (`app-mobile`). Una sola feature,
un solo spec, aunque el trabajo toque las dos carpetas.

## El problema

La app ya avisa del cambio de aceite, pero con notificaciones **locales**: el
teléfono las programa, y solo puede programar lo que sabía la última vez que
el usuario abrió la app. El spec de entonces
(`app-mobile/docs/superpowers/specs/2026-09-12-notificaciones-locales-design.md`)
lo decía sin rodeos: *"Push remoto queda fuera"*, porque no había backend.

Ahora sí lo hay, y con él `computeOilStatus`: una función pura que proyecta el
odómetro por `kmPerDay` y devuelve `gauge.kmLeft` y `gauge.daysLeft`. El
servidor puede saber que a un usuario se le venció el aceite **sin que nadie
abra la app**, que es exactamente el caso de uso que las locales no cubren.

## Qué se construye

El servidor pasa a ser la única fuente de avisos de aceite. Manda push nativo
por dos vías que comparten toda la lógica:

- un **barrido diario** a las 9:00 hora de Venezuela sobre todos los
  vehículos, y
- un **aviso inmediato** cuando un evento del usuario deja un vehículo en
  rojo.

La app deja de programar avisos y pasa a recibirlos. Sus preferencias de
notificación se mudan del teléfono al backend.

## Decisiones tomadas

Las cinco que definieron el diseño:

1. **El push reemplaza a las locales**, no convive con ellas. Una sola
   definición de cuándo avisar.
2. **Barrido diario más aviso inmediato por evento.** No son dos motores: son
   el mismo planificador llamado con un vehículo o con todos.
3. **Las preferencias se mudan al backend.** El servidor decide, así que el
   servidor tiene que conocerlas. Como efecto secundario sobreviven a
   reinstalar la app.
4. **Cron dentro del proceso** (`@nestjs/schedule`) con lock de Postgres, no
   cron externo. Se descartó el endpoint interno disparado desde afuera
   porque agrega una pieza de despliegue antes de que exista el despliegue:
   hoy el proyecto corre en `docker-compose` local.
5. **Sin outbox ni worker.** Es la arquitectura correcta cuando un aviso
   perdido cuesta dinero; aquí el barrido del día siguiente ya reintenta lo
   que no salió, y la maquinaria se mantendría sin cobrar el beneficio.

## Arquitectura

```
src/modules/notifications/
├── domain/
│   ├── push-planner.ts            PURA. Toda la decisión de negocio
│   ├── push-message.ts            PushMessage, PushKind, la firma
│   ├── push-sender.ts             puerto PUSH_SENDER
│   ├── device-token.repository.ts
│   ├── notification-pref.repository.ts
│   └── notification-log.repository.ts
├── push-dispatch.service.ts       estado → planner → sender → bitácora
├── push-sweep.service.ts          el barrido (lock incluido)
├── notifications.cron.ts          @Cron de una línea; delega en sweep
├── receipts.service.ts            consulta receipts, apaga tokens muertos
├── devices.controller.ts
├── notification-prefs.controller.ts
├── dto/ · testing/
src/infra/prisma/prisma-device-token.repository.ts   (+ pref, + log)
src/infra/expo/expo-push.sender.ts   ÚNICO archivo que importa expo-server-sdk
```

Mismo criterio que `oil` y `auth`: los servicios piden el token de DI, nunca
la clase concreta. `expo-server-sdk` entra por un solo archivo, detrás del
puerto `PUSH_SENDER`; los tests usan un `FakePushSender` de `testing/` y
nadie le pega a los servidores de Expo, ni en unitarios ni en e2e.

## Modelo de datos

```prisma
enum DevicePlatform { IOS ANDROID }

model DeviceToken {
  id         String   @id @default(uuid()) @db.Uuid
  userId     String   @db.Uuid
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  token      String   @unique          // ExponentPushToken[xxxxxxxx]
  platform   DevicePlatform
  lastSeenAt DateTime @default(now())
  disabledAt DateTime?
  createdAt  DateTime @default(now())
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
  checkinWeekday  Int      @default(1)   // misma convención que la app: domingo = 1
  updatedAt       DateTime @updatedAt
}

model NotificationLog {
  id           String   @id @default(uuid()) @db.Uuid
  userId       String   @db.Uuid
  vehicleId    String?  @db.Uuid
  kind         String                    // 'warn' | 'overdue' | 'checkin'
  sig          String                    // firma del hecho: el dedupe
  ticketId     String?                   // para casar el receipt diferido
  sentAt       DateTime @default(now())
  receiptAt    DateTime?
  receiptError String?
  @@index([userId, kind, sentAt(sort: Desc)])
  @@index([ticketId])
}
```

### `token` es único a secas, no `@@unique([userId, token])`

Un token identifica una **instalación**, no una sesión. Si otra persona inicia
sesión en el mismo teléfono, ese token tiene que cambiar de dueño, no
duplicarse: con dos filas, el dueño anterior seguiría recibiendo avisos de sus
vehículos en un teléfono que ya no es suyo. Es una fuga de privacidad, y la
clave única la hace imposible por construcción. El registro es un upsert por
`token` que reasigna `userId`.

### `disabledAt` en vez de borrar

Cuando Expo responde `DeviceNotRegistered` (app desinstalada), el token se
apaga. Si el usuario reinstala, vuelve a registrar el mismo token y la fila
revive. Borrar y recrear pierde el historial y no gana nada.

### Una tabla para dedupe y receipts

`NotificationLog` hace dos trabajos porque son el mismo hecho — "esto se
mandó". Es el dedupe (sin él, el mismo "cambio cerca" sale cada día a las 9
hasta que el usuario cambie el aceite) y es el rastro para casar el `ticketId`
con el receipt que Expo entrega unos 15 minutos después.

### Lo que no se muda al backend

`permissionAskedAt`. Es un hecho del teléfono, no una preferencia del usuario;
se queda en el slice local.

## El planificador

La pieza central, y la única donde vive la decisión de negocio. Igual que
`computeOilStatus`: sin base, sin red, con `now` por parámetro.

```ts
export type PushKind = 'warn' | 'overdue' | 'checkin';

export type PushMessage = {
  kind: PushKind;
  userId: string;
  vehicleId: string | null;
  title: string;
  body: string;
  sig: string;
  data: { screen: 'VehicleDetail' | 'Alerts'; vehicleId?: string };
};

export function planPushes(input: {
  now: Date;
  userId: string;
  prefs: NotificationPrefs;
  vehicles: {
    id: string;
    label: string;
    kmPerDay: number;
    status: OilStatus;
  }[];
  yaEnviado: Set<string>;
}): PushMessage[];
```

Las reglas de contenido se traducen de `app-mobile/src/notifications/plan.ts`:
vencido y cerca son mutuamente excluyentes, un vehículo sin ciclo no genera
nada, y `!prefs.enabled` devuelve lista vacía.

### La firma es del hecho, no del texto

En la app, `sig` compara contenido contra lo que el sistema operativo tiene
**programado**: si cambió, se reprograma. En el servidor eso no aplica — una
notificación enviada ya llegó, no hay nada que reconciliar. La firma responde
otra pregunta: ¿esto es el mismo hecho del que ya avisé?

Si la firma incluyera el cuerpo del mensaje, mañana el odómetro proyectado
pasa de 480 a 460 km, el texto cambia, la firma cambia, y el mismo aviso sale
**todos los días a las 9** hasta que el usuario cambie el aceite. Ese es el
bug que hunde esta clase de features.

| Aviso | Firma | Consecuencia |
|---|---|---|
| `warn` | `warn:<vehId>:<ciclo>`, ciclo = `lastChangeAt` + `lastChangeKm` | Uno por ciclo. Al cambiar el aceite hay ciclo nuevo, firma nueva, y el próximo warn sí sale |
| `overdue` | `overdue:<vehId>:<ciclo>:<floor(díasVencido / 14)>` | Vuelve cada 14 días mientras siga vencido, sin ser diario |
| `checkin` | `checkin:<userId>:<año-semana ISO>` | Uno por semana, por construcción |

El `overdue` es el único que repite a propósito: un vencido que el usuario
ignoró sigue siendo cierto la quincena siguiente, pero recordárselo cada día
lo entrena a silenciar la app.

`díasVencido` no sale de la bitácora: se deriva del propio medidor, y por eso
el planificador sigue siendo puro. Un vehículo puede estar vencido por
cualquiera de los dos ejes, así que se toma el que lleva más tiempo vencido:

```ts
const porKm = gauge.kmLeft < 0 ? -gauge.kmLeft / kmPerDay : 0;
const porTiempo = gauge.daysLeft < 0 ? -gauge.daysLeft : 0;
const diasVencido = Math.max(porKm, porTiempo);
```

Ese es el motivo de que `kmPerDay` entre al planificador: `gauge.kmLeft` mide
km y `gauge.daysLeft` mide días, y sin el ritmo de uso no hay forma de
llevarlos a la misma unidad.

### Por qué el barrido y el evento no se pisan

Son el mismo planificador con el mismo dedupe. Si al registrar una lectura de
odómetro el evento ya mandó el `warn` de ese ciclo, el barrido de mañana
calcula la misma firma, la encuentra en la bitácora y calla. No hay "modo
evento" ni bandera: hay una función pura que se llama con un vehículo o con
todos.

### El checkin cambia de propósito

En la app, el recordatorio semanal existía porque *"el kilometraje no avanza
solo"*. En el servidor sí avanza: `computeOilStatus` lo proyecta con
`kmPerDay`, así que ese motivo desaparece.

Pero esa proyección se degrada mientras nadie confirme un odómetro real. El
checkin semanal pasa a ser **"confírmanos tu kilometraje"**. El barrido solo
lo considera el día de la semana que diga `prefs.checkinWeekday` — los demás
días ni lo evalúa — y aun ese día solo se manda si la última lectura real
(`status.odometer.asOf`) tiene más de 30 días. Si el
usuario reportó el odómetro la semana pasada, no hay nada que pedirle y el
aviso no sale. Deja de ser ruido semanal y pasa a ser lo que mantiene honesto
al medidor.

## Superficie HTTP

Todos bajo `JwtAuthGuard` con `@CurrentUser()`.

| Ruta | Qué hace |
|---|---|
| `POST /me/devices` | Registra el token. Upsert por `token`: reasigna `userId`, pone `disabledAt = null`, refresca `lastSeenAt`. Idempotente |
| `DELETE /me/devices/:token` | Baja al cerrar sesión. 204 aunque no exista |
| `GET /me/notification-prefs` | Devuelve las preferencias; sin fila, responde los valores por defecto sin escribir |
| `PATCH /me/notification-prefs` | Actualización parcial |

`POST /me/devices` lleva `@SkipThrottle({ auth: true })`: la app lo llama en
cada arranque, igual que `refresh` y `me`. Es comportamiento normal, no
alguien adivinando credenciales.

El DTO del PATCH **no** usa `@Transform` junto a `@IsOptional`. Ese par ya
causó un fallo en el DTO de perfil: el campo ausente llega como `''` y rebota
un campo que el cliente nunca mandó.

El formato del token (`ExponentPushToken[...]`) se valida con una función pura
en `domain/`, no con `Expo.isExpoPushToken()`: el DTO no debe arrastrar el SDK.

## Envío y receipts

`ExpoPushSender` delega lo aburrido en la librería: `chunkPushNotifications`
parte en lotes de 100 y `sendPushNotificationsAsync` envía. Los fallos llegan
por dos caminos, y se tratan distinto:

- **Ticket con error inmediato.** `DeviceNotRegistered` apaga el token con
  `disabledAt`. `MessageRateExceeded` se reintenta en la corrida siguiente.
  `InvalidCredentials` es configuración, no usuario: se registra a nivel error.
- **Receipt diferido.** Expo confirma la entrega real unos 15 minutos después.
  Un cron cada 30 minutos junta los `ticketId` con `receiptAt` nulo, consulta
  en lotes de 300 y aplica lo mismo.

## El barrido

`@Cron('0 9 * * *', { timeZone: 'America/Caracas' })`. Venezuela no mueve el
reloj en todo el año, así que el offset es fijo y no existe la sorpresa
clásica del horario de verano.

El decorador no hace trabajo: llama a `PushSweepService.run()`, que es lo mismo
que podría llamar un endpoint o un test. Antes de empezar pide
`pg_try_advisory_lock`; si no lo consigue, esa instancia se salta la corrida
porque otra la está haciendo. Un error procesando a un usuario no aborta el
barrido: se registra y sigue con el siguiente.

El aviso inmediato por evento es **fuego y olvido**. Se dispara después de que
`OilCycleService` haya confirmado la transacción, y su fallo se registra pero
nunca se propaga: si Expo está caído, el cambio de aceite del usuario ya quedó
guardado y la petición responde bien. El barrido de mañana recoge lo que no
salió.

## Configuración

| Variable | Para qué |
|---|---|
| `EXPO_ACCESS_TOKEN` | Opcional pero recomendada. Activa la seguridad reforzada de Expo: sin ella, cualquiera que consiga un token de push de la app puede mandarle notificaciones a los usuarios haciéndose pasar por nosotros |
| `PUSH_ENABLED` | Por defecto `true`. En `false` el cron no se registra: desarrollo local y e2e |

Ambas entran en `EnvVars` con su validación. Arrancar con configuración a
medias en silencio es justo lo que ese archivo existe para impedir.

Dependencias nuevas: `expo-server-sdk` y `@nestjs/schedule`.

## La app móvil

- **`src/notifications/push.ts`** (nuevo): pide permiso, obtiene el token con
  `getExpoPushTokenAsync({ projectId })` — el `projectId` ya está en
  `app.json` — y lo registra contra el API. Se llama al iniciar sesión y en
  cada arranque con sesión viva. En Expo Go no hace nada: no puede.
- **Cierre de sesión**: `DELETE /me/devices/:token` antes de borrar las
  credenciales. Si falla, se cierra igual: una sesión que no cierra porque el
  servidor no contesta es peor que un token huérfano, y el
  `DeviceNotRegistered` lo limpia solo.
- **`plan.ts`, `scheduler.ts` y compañía se retiran.** Con el servidor
  decidiendo, dejarlos vivos duplica avisos. Al arrancar, la app cancela una
  vez todo lo que lleve el prefijo `ruedalo:`, para limpiar lo que quedó
  programado en los teléfonos que ya tienen la versión anterior instalada; sin
  eso, esos avisos zombis siguen saliendo durante semanas.
- **`NotificationsScreen`** pasa a leer y escribir contra el API, igual que ya
  hace Perfil. El slice de Zustand se reduce a `permissionAskedAt`.
- **`useNotificationResponse`** se queda tal cual: el `data.screen` /
  `data.vehicleId` que manda el servidor tiene la misma forma que el que ponía
  `plan.ts`, así que la navegación al tocar la notificación no se entera del
  cambio.

## Pruebas y verificación

Las credenciales de FCM y APNs no están configuradas todavía, así que la
verificación va por etapas: cada una se completa antes de que la siguiente
dependa de ella.

### Etapa 1 — sin red, sin credenciales

Unitarios del planificador, con Jest y sin base:

- El `warn` sale una vez por ciclo y **no** se repite al día siguiente aunque
  cambie el km proyectado.
- El `overdue` vuelve al día 14, no al 13.
- El `checkin` calla si hay una lectura de odómetro de hace una semana, y sale
  si la última tiene más de 30 días.
- `!prefs.enabled` devuelve lista vacía.
- Un vehículo sin ciclo no genera nada.
- `warn` y `overdue` nunca salen juntos para el mismo vehículo.

E2e de los endpoints con `FakePushSender`, sobre la base real de
`test/support/e2e-db.ts` y el dominio `@e2e.local`, como el resto:

- Registrar el mismo token con dos usuarios distintos deja **una** fila, con
  el segundo como dueño.
- Registrar un token apagado lo revive.
- `DELETE` de un token inexistente responde 204.
- `PATCH` parcial de preferencias no pisa los campos ausentes.
- `GET` sin fila previa devuelve los valores por defecto y no escribe.

### Etapa 2 — contra Expo, sin teléfono

La Expo Push API acepta envíos a un token inventado y responde con un ticket
de error bien formado. Sirve para verificar el chunking, el manejo de tickets
y el ciclo de receipts de verdad, sin haber tocado FCM todavía.

### Etapa 3 — con teléfono

Aquí entran las credenciales: proyecto en Firebase, la Service Account de
FCM v1 subida a EAS, la key de APNs, y un development build instalado — Expo
Go no sirve para push en Android. Se registra el token real y se dispara el
barrido a mano.

Las etapas 1 y 2 dejan el backend terminado y probado. La 3 es configuración
de cuentas, casi nada de código, y es la única que puede quedarse trancada por
algo que no depende de nosotros.

## Riesgos aceptados

- **El cron vive dentro del API.** Con más de una instancia se dispararía dos
  veces; el `pg_try_advisory_lock` lo cubre. Si algún día el barrido crece lo
  suficiente para competir por CPU con las peticiones, el camino de salida ya
  está: `PushSweepService.run()` es llamable desde un endpoint, y mover el
  reloj afuera no toca la lógica.
- **Dependencia de FCM y APNs.** Al retirar las locales, un problema de
  credenciales deja a los usuarios sin ningún aviso. Por eso la etapa 3 se
  verifica antes de retirar el scheduler local en una versión publicada.

---

## Fuera de alcance

- Notificaciones que no sean de aceite (promociones, avisos del sistema).
- Hora de entrega configurable por usuario. El barrido es a las 9:00 para
  todos.
- Agrupar varios avisos del mismo usuario en un solo push. Se consideró y se
  descartó por ahora.
- Centro de notificaciones dentro de la app (historial de lo recibido).
  `NotificationLog` guarda lo necesario para construirlo después, pero no hay
  endpoint que lo exponga.
- Web push. `DevicePlatform` solo contempla iOS y Android.
