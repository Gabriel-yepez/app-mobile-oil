# La flota al backend, offline-first

**Fecha:** 2026-09-19
**Alcance:** app móvil (capa de datos nueva: caché local + cola de mutaciones) y
backend (cinco rutas que faltan para cubrir lo que la app ya hace).
**Depende de:** `backend-oil-app/docs/superpowers/specs/2026-09-19-estado-del-aceite-design.md`,
cuyo dominio y endpoints de estado ya están implementados y probados.

---

## 1. El problema

El estado del aceite ya se calcula en el backend y se sirve por
`GET /vehicles/:id/oil-status`. Pero la app sigue cargando `MOCK_FLEET` en
memoria:

```ts
// app-mobile/src/store/useStore.ts
vehicles: MOCK_FLEET,
activeVehicleId: MOCK_FLEET[0].id,   // 'v1'
```

Esos ids son `'v1'`, `'v2'`, `'v3'`. Pedir `/vehicles/v1/oil-status` contra el
backend real devuelve `404` siempre. **La tarjeta del inicio no puede montarse
hasta que la flota viva en el backend.**

Y hay un problema de coherencia detrás: `oilPct`, `kmLeft` y `vehicleStatus`
viven en el store y los usan seis archivos (`OpenAlertsWidget`,
`VehiclesScreen`, `AlertsScreen`, `VehicleDetailScreen`, `notifications/plan.ts`
y el propio `useStore`). Si el inicio pasa al backend y esas pantallas no, el
mismo vehículo puede decir "PRÓXIMO" arriba y "AL DÍA" en la lista — que es
exactamente la contradicción que este trabajo vino a eliminar.

## 2. Decisiones

| # | Decisión | Razón |
|---|---|---|
| 1 | **Offline-first de verdad**: caché local de lectura y cola de escrituras. | El store ya lo promete en su primera línea, y el caso de uso central —anotar el cambio parado en el taller— ocurre justo donde no hay señal. |
| 2 | **Los ids los genera la app** (UUID v4) y el backend los acepta. | Un id que nunca cambia elimina de raíz la clase de bugs donde un cambio de aceite queda apuntando a un vehículo con id viejo. No hay remapeo porque no hay nada que remapear. |
| 3 | Las creaciones son **idempotentes por id**: si el id ya existe y es del mismo usuario, se responde el registro existente con `200`. | Es lo que hace segura la cola. Si el envío se cortó *después* de que el servidor guardó, el reintento tiene que ser inofensivo. |
| 4 | `GET /vehicles` devuelve el **gauge de cada vehículo**. | Sin esto, una lista de cinco vehículos son cinco llamadas de estado. |
| 5 | El `pct` cacheado **se muestra con su antigüedad**, no se recalcula en el cliente. | Recalcular sería volver a tener dos implementaciones de la misma fórmula: el bug que la tanda anterior eliminó. |
| 6 | Conflictos: **gana el último en llegar al servidor**. | Es una app de un usuario con sus propios vehículos; la edición simultánea desde dos dispositivos es rara y no justifica versionado. Se documenta para que sea una elección y no un olvido. |

---

## 3. Contrato del backend

Cinco cambios sobre lo ya construido.

### 3.1 `POST /vehicles` acepta `id`

```jsonc
{ "id": "3f1c…", /* UUID v4, opcional */ "kind": "CAR", "brand": "Toyota", … }
```

- Sin `id`: el backend genera uno, como hoy. `201`.
- Con `id` nuevo: lo usa tal cual. `201`.
- Con `id` que ya existe **y es del usuario**: `200` con el registro existente,
  sin modificarlo. No es un error: es un reintento de la cola.
- Con `id` que existe y es **de otro usuario**: `404 VEHICLE_NOT_FOUND`. Nunca
  se confirma que ese id exista.
- La matrícula duplicada del mismo usuario sigue siendo `409 PLATE_TAKEN`
  (restricción `@@unique([userId, plate])`), error nuevo a agregar.

### 3.2 `POST /vehicles/:id/oil-changes` acepta `id`

Mismas reglas. El reintento de un cambio ya guardado devuelve `200` con el
existente en lugar de registrar el cambio dos veces — que en esta app significa
un ciclo nuevo abierto por error y la barra reiniciada sin motivo.

### 3.3 `PATCH /vehicles/:id`

Edita la ficha: `kind`, `brand`, `model`, `year`, `plate`, `color`, `kmPerDay`.
**No toca** el espejo del ciclo ni el historial: eso se cambia registrando o
corrigiendo un cambio de aceite, no editando la ficha. Si se cambia `kmPerDay`
a mano, `kmPerDaySource` vuelve a `DECLARED`: el usuario está pisando lo medido
a propósito, y el siguiente ciclo medido lo volverá a calibrar.

### 3.4 `DELETE /vehicles/:id`

Borra el vehículo. Los cambios y las lecturas caen por `onDelete: Cascade`, que
el esquema ya declara. `204`.

### 3.5 `GET /vehicles/:id/oil-changes`

Historial del vehículo, del más nuevo al más viejo, paginado por `cursor` y
`limit` (por defecto 20, máximo 100). Alimenta `RecentHistoryWidget` (los
últimos tres) y `HistoryScreen`.

### 3.6 `GET /vehicles` incluye el gauge

Cada elemento de la lista suma el bloque `gauge` (`pct`, `status`, `limitedBy`,
`kmLeft`, `daysLeft`) y `odometer`, calculados igual que en `oil-status`. Un
vehículo sin ciclo los trae en `null`.

Se computa en una pasada: se traen los vehículos del usuario, y para cada uno su
último cambio y su última lectura. Son dos consultas más, no dos por vehículo.

---

## 4. La capa de datos de la app

```
src/data/local/store.ts       persistencia (expo-sqlite/kv-store, el mismo de homeLayout)
src/data/sync/queue.ts        la cola: estructura y transiciones. PURO, sin red ni almacenamiento
src/data/sync/runner.ts       drena la cola contra la API
src/store/useVehicles.ts      el store de vehículos que reemplaza la parte de useStore
```

`queue.ts` es puro a propósito, igual que `home/layout.ts`: toda la lógica de
qué se envía, en qué orden y qué pasa cuando algo falla se prueba sin montar un
componente ni simular la red.

### 4.1 El ciclo de vida

Todas las pantallas siguen el mismo: **hidrata de local → pinta ya → refresca de
red → guarda local**. Nunca hay una pantalla en blanco esperando a la red.

Escribir es siempre local primero: la UI se actualiza al instante, la operación
entra a la cola, y el runner la envía cuando hay señal. Como el id lo puso la
app, el registro que se ve antes y después de sincronizar es el mismo: no hay
parpadeo ni salto de posición.

### 4.2 La cola

```ts
export type QueueOp =
  | { op: 'CREATE_VEHICLE'; id: string; payload: NewVehicleInput }
  | { op: 'UPDATE_VEHICLE'; id: string; payload: Partial<NewVehicleInput> }
  | { op: 'DELETE_VEHICLE'; id: string }
  | { op: 'CREATE_OIL_CHANGE'; id: string; vehicleId: string; payload: NewOilChangeInput }
  | { op: 'UPDATE_OIL_CHANGE'; id: string; payload: Partial<NewOilChangeInput> }
  | { op: 'DELETE_OIL_CHANGE'; id: string }
  | { op: 'REPORT_ODOMETER'; id: string; vehicleId: string; km: number };

export type QueueEntry = {
  op: QueueOp;
  /** Para el backoff y para detectar la que nunca sale. */
  intentos: number;
  encoladaEn: string;
};
```

**Orden:** FIFO estricto y de a una. Enviar en paralelo permitiría que el cambio
de aceite llegue antes que el vehículo que lo contiene.

**Colapso de operaciones.** Al encolar se revisa lo que ya está pendiente:

| Llega | Ya pendiente | Resultado |
|---|---|---|
| `DELETE_VEHICLE` de X | `CREATE_VEHICLE` de X | Se borran ambas. El vehículo nunca existió para el servidor; mandar el delete de algo que no creamos sería un `404` garantizado. |
| `UPDATE_VEHICLE` de X | `CREATE_VEHICLE` de X | Se fusiona el patch dentro del create. Se envía una sola operación, ya con los valores finales. |
| `UPDATE_VEHICLE` de X | `UPDATE_VEHICLE` de X | Se fusionan los patches. |
| `DELETE_VEHICLE` de X | cualquier op de un cambio de ese vehículo | Se descartan esas ops: el cascade del backend las haría irrelevantes igual. |

**Fallos.** La distinción es la que decide si la cola avanza o se traba:

- **Transitorio** (sin red, `timeout`, `5xx`, `429`): se reintenta con espera
  creciente (1s, 4s, 15s, 60s, y de ahí en más cada 60s). La operación **se
  queda** a la cabeza de la cola.
- **Permanente** (`4xx` que no sea `401` ni `429`, p.ej. `422
  OIL_CHANGE_BACKWARDS` o `409 PLATE_TAKEN`): la operación **se saca** de la
  cola y el registro local se marca como `rechazado`, con el `code` del error.
  Es la regla más importante del diseño: sin ella, un solo registro inválido
  bloquea para siempre todo lo que venga detrás.
- **`401`**: lo resuelve `ApiClient`, que ya refresca el token y reintenta. Si
  el refresco falla, la sesión murió: la cola se **pausa** entera y se reanuda
  al volver a entrar. No se descarta nada.

**Lo rechazado se le muestra al usuario.** Un registro marcado `rechazado`
aparece en su pantalla con el motivo y dos salidas: corregirlo (vuelve a la
cola) o descartarlo. Nada desaparece en silencio.

### 4.3 El estado rancio

El `pct` se calcula en el servidor con `now()`. Sin señal, el valor cacheado
envejece y la barra queda congelada en el de la última sincronización.

La tarjeta lo dice en vez de disimularlo: si `computedAt` tiene más de 24 horas,
debajo del medidor aparece *"calculado hace N días"* en el tono apagado. No se
recalcula en el cliente: eso sería volver a tener dos implementaciones de la
misma fórmula.

---

## 5. Orden de migración

Cada paso deja la app funcionando; ninguno la parte a la mitad.

1. **Backend**: las cinco rutas de la sección 3.
2. **Capa de datos**: `queue.ts`, `runner.ts`, `local/store.ts` — con sus tests,
   sin que ninguna pantalla los use todavía.
3. **`useVehicles`**: el store nuevo, alimentando `VehiclesScreen`,
   `VehicleDetailScreen`, `AddVehicleFormScreen` y `EditVehicleScreen`.
   `MOCK_FLEET` deja de cargarse.
4. **La tarjeta del inicio**: las Tasks 14, 15 y 16 que quedaron pendientes del
   plan anterior (`OilStatusWidget`, los campos nuevos de los formularios y
   `ReportOdometerScreen`).
5. **El resto**: `AlertsScreen`, `OpenAlertsWidget`, `HistoryScreen`,
   `RecentHistoryWidget` y `notifications/plan.ts` pasan al `gauge` del backend.
   **Recién acá** se borran `oilPct`, `kmLeft` y `vehicleStatus` de `useStore`:
   si se borran antes, media app deja de compilar.

---

## 6. Pruebas

**`queue.ts`** (puro, tabla de casos) — es donde vive el riesgo:

- Encolar un create y un update del mismo id → una sola operación fusionada.
- Encolar un create y un delete del mismo id → la cola queda vacía.
- Borrar un vehículo con cambios pendientes → esas ops se descartan.
- Dos updates del mismo id → patches fusionados, el último pisa campo a campo.
- FIFO: las ops de vehículos distintos conservan su orden relativo.

**`runner.ts`** (con la API mockeada):

- Fallo de red → la op sigue en la cola, `intentos` sube, espera creciente.
- `422` → la op sale de la cola y el registro queda `rechazado` con su `code`.
- `401` con refresco fallido → la cola se pausa entera, no se descarta nada.
- Reintento de un create ya guardado → el `200` del backend se trata como éxito,
  no como error.

**Backend**: idempotencia (`POST` dos veces con el mismo id → un solo registro),
`404` con id de otro usuario, `409 PLATE_TAKEN`, y que `PATCH` de `kmPerDay`
devuelva `kmPerDaySource` a `DECLARED`.

**E2E de la app**: no se agregan en esta tanda; la cola y el runner quedan
cubiertos por unitarios, que es donde están los casos difíciles.

---

## 7. Fuera de alcance

- **Sincronización en tiempo real** entre dispositivos. La app refresca al
  enfocar cada pantalla y al drenar la cola; no hay websockets ni push de datos.
- **Versionado de conflictos.** Gana el último en llegar (decisión 6).
- **Migrar el historial completo** más allá de lo que piden
  `RecentHistoryWidget` y `HistoryScreen`.
- **Las notificaciones push del servidor.** Siguen siendo locales, como hasta
  ahora.
- **Límites por plan** (`maxVehicles`, `maxChangesPerMonth`), que siguen sin
  aplicarse en el backend.
