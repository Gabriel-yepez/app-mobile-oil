# Estado del aceite: simulación del odómetro y bloque único del home

**Fecha:** 2026-09-19
**Alcance:** backend (dominio nuevo: vehículos, cambios de aceite, lecturas de
odómetro) + app móvil (fusión de `GaugeWidget` y `TechReadoutWidget` en una
sola tarjeta alimentada por un solo endpoint).

---

## 1. El problema

El home tiene un medidor radial de vida del aceite que se alimenta de dos
selectores locales sobre data mock:

```ts
// app-mobile/src/store/useStore.ts
export const kmLeft = (v: Vehicle) => v.nextChange - v.km;
export const oilPct = (v: Vehicle) =>
  Math.round(((v.nextChange - v.km) / (v.nextChange - v.lastChange)) * 100);
```

Ambos dependen de `v.km`: el odómetro actual. Y el odómetro **solo se captura
cuando el usuario registra un cambio de aceite** (`AddOilScreen`, campo
"Kilometraje del cambio"). Entre un cambio y el siguiente nadie lo actualiza,
porque el dato solo existe sentado dentro del auto, mirando el tablero.

La consecuencia con un backend real: la barra se congela durante meses en el
valor del último cambio y le dice al usuario "te quedan 5.000 km" el mismo día
que se le vencieron. El medidor deja de informar y pasa a mentir.

Este diseño resuelve eso y, de paso, unifica odómetro / próximo cambio / aceite
en un único bloque de datos y una única tarjeta.

---

## 2. Decisiones

Cada una con su porqué, incluidas las que se tomaron contra la recomendación
inicial — para que dentro de seis meses se sepa que fueron deliberadas.

| # | Decisión | Razón |
|---|---|---|
| 1 | La vida del aceite corre por **dos ejes**: km estimado y tiempo. Vale el peor de los dos. | Es como lo dice el manual de cualquier vehículo: "5.000 km o 6 meses, lo que ocurra primero". Cubre tanto al que maneja 4.000 km/mes como al que tiene el carro parado. |
| 2 | El odómetro entre cambios se **proyecta** con un ritmo de km/día por vehículo. | Es lo único que hace bajar la barra sin exigirle al usuario un dato que no tiene a mano. |
| 3 | El ritmo lo **declara el usuario** al dar de alta el vehículo y el backend lo **recalibra** con cada ciclo medido. | El primer ciclo necesita un número; a partir del segundo, el número es del vehículo real y no un promedio inventado. |
| 4 | Los intervalos (km y meses) **los escribe el usuario**, sin sugerencia del backend por tipo de aceite. | Decisión explícita del dueño del producto. El formulario precarga los valores que **él mismo** usó en el ciclo anterior de ese vehículo: no es una sugerencia inventada, es su propio número. |
| 5 | El cálculo se hace **al vuelo en el backend**, con `now()`, en cada lectura. | Sin columna de porcentaje que quede rancia y sin cron que mantener. La barra baja sola porque el tiempo avanza, no porque algo corra de noche. El servidor sabe el estado real, que es lo que habilita el recordatorio push. |
| 6 | `Vehicle` **espeja el ciclo vigente** en cuatro columnas (`lastChangeKm`, `lastChangeAt`, `nextChangeKm`, `nextChangeDueAt`), aunque sean derivables de la última fila de `OilChange`. | Decisión explícita del dueño del producto: quiere el ciclo actual registrado en la ficha del vehículo. Se acepta la duplicación **a cambio de las dos protecciones de la sección 4.4**. El historial completo no depende de estas columnas: vive en `OilChange`, una fila por cambio, para siempre. |
| 7 | El **umbral de estado** vive en el backend, no en el cliente. | Hoy hay dos definiciones contradictorias del mismo estado (ver 4.5). Una sola fuente lo arregla de raíz. |

---

## 3. Modelo de datos

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
  // por el usuario en el alta y se recalibra solo con cada ciclo medido.
  // Es un hecho del vehículo, no un estado derivado: se persiste con razón.
  kmPerDay       Decimal      @db.Decimal(6, 2)
  kmPerDaySource KmRateSource @default(DECLARED)

  // ── Espejo del ciclo vigente ─────────────────────────────────────────
  // Derivable de la última fila de OilChange. Se persiste porque el ciclo
  // actual se quiere registrado en la ficha. OilCycleService es el ÚNICO
  // que escribe estas cuatro columnas: ni controladores, ni repositorios,
  // ni seeds. Nulas mientras el vehículo no tenga ningún cambio registrado.
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

  // Fecha real del cambio, que no es createdAt: el usuario puede registrar
  // hoy un cambio que hizo la semana pasada.
  changedAt DateTime
  km        Int

  // Los dos ejes del ciclo, escritos por el usuario.
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

**`OdometerReading` es la base de la proyección.** Cada cambio de aceite
escribe *también* una lectura (`source: OIL_CHANGE`) en la misma transacción,
de modo que la proyección siempre parte de la última lectura real que existe,
sin importar de dónde vino. Las lecturas `MANUAL` son el escape que le damos al
usuario para reanclar la estimación el día que sí mire el tablero.

---

## 4. El cálculo

Vive en un servicio sin estado y sin acceso a base: recibe los datos ya
cargados y devuelve el bloque. Eso lo hace trivial de probar con tablas de
casos y hace que la fecha "ahora" sea un parámetro, no un `new Date()` oculto.

```ts
// oil-status.calculator.ts — función pura
computeOilStatus(input: {
  now: Date;
  kmPerDay: number;
  lastReading: { km: number; readAt: Date } | null;
  cycle: {
    km: number; changedAt: Date;
    intervalKm: number; intervalMonths: number;
  } | null;
}): OilStatus
```

### 4.1 Proyección del odómetro

```
díasDesdeBase = días(now − lastReading.readAt)        // fraccional, ≥ 0
kmEstimado    = lastReading.km + round(kmPorDía × díasDesdeBase)
kmEstimado    = max(kmEstimado, lastReading.km)       // el odómetro nunca baja
```

Si `readAt` es de hoy, `kmEstimado === lastReading.km` y la fuente se reporta
como `reported`. En cualquier otro caso, `estimated`.

### 4.2 Los dos ejes

```
límiteKm    = ciclo.km + ciclo.intervalKm
límiteFecha = addMonths(ciclo.changedAt, ciclo.intervalMonths)

vidaKm     = (límiteKm − kmEstimado) / ciclo.intervalKm
vidaTiempo = (límiteFecha − now) / (límiteFecha − ciclo.changedAt)

vida       = clamp(min(vidaKm, vidaTiempo), 0, 1)
pct        = round(vida × 100)
limitedBy  = vidaKm <= vidaTiempo ? 'km' : 'time'
```

`addMonths` es aritmética de calendario, no "30 días": 4 de junio + 6 meses es
el 4 de diciembre. Si el día no existe en el mes destino (31 de enero + 1 mes),
se recorta al último día del mes. Todo se calcula en UTC.

Los dos restantes son independientes y cada uno mide su propio eje, sin
importar cuál manda: `kmLeft = límiteKm − kmEstimado` y `daysLeft =
días(límiteFecha − now)`. Un vehículo limitado por tiempo puede tener 8.000
en `kmLeft` y 12 en `daysLeft` a la vez; eso no es una contradicción, es el
retrato de un carro parado.

`kmLeft` y `daysLeft` se devuelven **sin recortar**: pueden ser negativos, y ese
negativo es la información útil ("te pasaste 800 km"). El que se recorta a
`[0, 100]` es `pct`, porque la barra no puede dibujar menos que vacío.

### 4.3 Recalibración del ritmo

Al registrar el cambio N, si existe el cambio N−1:

```
kmPorDíaMedido = (km_N − km_{N−1}) / días(fecha_N − fecha_{N−1})
```

`Vehicle.kmPerDay` pasa a ser el **promedio de los últimos 3 ciclos medidos**
(o los que haya), y `kmPerDaySource` pasa a `MEASURED`.

Un ciclo cuyo ritmo caiga fuera de `[1, 500]` km/día **se descarta del
promedio** — el cambio se guarda igual, no se rechaza. Cubre dos casos reales:
el dedazo en el odómetro (un dígito de más da miles de km/día) y el vehículo
que estuvo medio año parado (da casi cero). Sin el filtro, cualquiera de los
dos envenena la estimación por los tres ciclos siguientes.

El valor declarado en el alta también se valida contra `[1, 500]`.

### 4.4 Las dos protecciones del espejo (decisión 6)

**Protección 1 — un único escritor.**

```ts
// oil-cycle.service.ts
// Recalcula el espejo del ciclo desde la fuente de verdad (la última fila de
// OilChange) y lo escribe. Corre DENTRO de la transacción que tocó el
// historial: si se guarda el cambio y no el espejo, no se guarda ninguno.
async syncVehicleCycle(
  tx: Prisma.TransactionClient,
  vehicleId: string,
): Promise<void>
```

Lo llaman las tres rutas que tocan el historial —crear, editar y borrar un
cambio— y ninguna escribe `OilChange` por fuera del servicio. Si se borró el
único cambio del vehículo, las cuatro columnas vuelven a `null`.

Se agrega además `recomputeAllCycles()` como comando de mantenimiento: si algo
se desincroniza alguna vez (una migración, un arreglo a mano en producción), se
repara con un comando y no con un `UPDATE` manual.

**Protección 2 — el test de invariante.** Ver sección 7.

### 4.5 El umbral de estado

Hoy hay dos definiciones contradictorias del mismo estado en la app:

- `OilGauge.tsx`: `pct > 40 ? 'ok' : pct > 15 ? 'warn' : 'danger'`
- `useStore.ts`:  `pct > 40 ? 'ok' : pct > 0  ? 'warn' : 'danger'`

Un vehículo al 10% se pinta **amarillo en la lista y rojo en el medidor**, en
la misma pantalla y al mismo tiempo. Se resuelve con una sola definición, en el
backend:

| `status` | Condición | Etiqueta |
|---|---|---|
| `ok` | `pct > 40` | AL DÍA |
| `warn` | `0 < pct <= 40` | PRÓXIMO |
| `danger` | `pct <= 0` | VENCIDO |

Se adopta el corte de `useStore` y no el de `OilGauge` porque la etiqueta tiene
que ser verdadera: un aceite al 10% **no está vencido**, le queda poco. El
medidor puede seguir poniéndose más rojo a medida que baja —eso es color, no
contrato—, pero `status` es lo que se muestra en texto y viaja a las
notificaciones.

---

## 5. Contrato de API

### `GET /vehicles/:id/oil-status`

Autenticado (`JwtAuthGuard`) y alcanzado al dueño: un vehículo de otro usuario
responde `404`, no `403`, para no confirmar que ese id existe.

```json
{
  "vehicleId": "9f3c…",
  "computedAt": "2026-09-19T14:02:11Z",
  "gauge": {
    "pct": 62,
    "status": "ok",
    "limitedBy": "km",
    "kmLeft": 3100,
    "daysLeft": 74
  },
  "odometer": {
    "km": 46900,
    "source": "estimated",
    "asOf": "2026-06-04T00:00:00Z"
  },
  "cycle": {
    "lastChangeKm": 45000,
    "lastChangeAt": "2026-06-04",
    "nextChangeKm": 50000,
    "nextChangeDueAt": "2026-12-04",
    "intervalKm": 5000,
    "intervalMonths": 6
  },
  "oil": {
    "brand": "Pennzoil", "tag": "Platinum",
    "viscosity": "5W-30", "synthetic": true
  }
}
```

- `computedAt` existe para el offline: la app cachea el bloque y, si tiene más
  de un día, lo marca como desactualizado en vez de fingir que es de ahora.
- `limitedBy` le dice al medidor **qué eje mostrar en el centro**: `km` →
  "km restantes", `time` → "días restantes". Sin esto, a un vehículo parado al
  que se le vence el aceite por tiempo se le muestra un tranquilizador
  "8.000 km restantes" que es cierto y a la vez engañoso.
- Vehículo sin ningún cambio registrado: `gauge`, `cycle` y `oil` en `null`
  (y `odometer` en `null` si tampoco hay lecturas). La app muestra el CTA de
  registrar el primer cambio en lugar del medidor.

### `POST /vehicles/:id/odometer`

```json
{ "km": 47250 }
```

Devuelve el mismo bloque de `oil-status`, ya recalculado con la lectura nueva
como base. Es la pieza que cierra el problema del enunciado: no se le exige al
usuario que mire el odómetro, pero el día que lo mire se lo acepta en dos
toques y la simulación deja de acumular error.

### Errores

Siguiendo `common/errors.ts` (`AppError` con `code` estable y mensaje en
español para el usuario):

| `code` | HTTP | Cuándo |
|---|---|---|
| `VEHICLE_NOT_FOUND` | 404 | El vehículo no existe o no es del usuario autenticado. |
| `ODOMETER_BACKWARDS` | 422 | La lectura es menor que la última registrada. El odómetro no retrocede. |
| `ODOMETER_IMPLAUSIBLE` | 422 | El salto supera 500 km/día desde la última lectura. Protege la base del dedazo. |
| `OIL_CHANGE_BACKWARDS` | 422 | El km del cambio es menor que el del cambio anterior. |

---

## 6. Cambios en la app móvil

**`OilStatusWidget` reemplaza a `GaugeWidget` + `TechReadoutWidget`.** Un solo
`DarkWidgetSurface` con dos zonas separadas por una línea de 1px al 8% de
opacidad:

```
┌─────────────────────────────────────┐
│            ╭─────────╮              │
│          ╭─ 3.100 ───╮              │  ← el eje que manda (limitedBy)
│         │  km restantes │           │
│          ╰─ [AL DÍA] ──╯            │
│            ╰─────────╯              │
│ ─────────────────────────────────── │
│  ODÓMETRO     PRÓXIMO      ACEITE   │
│  ~46.900      50.000       5W-30    │
│  km · tocar   km           Pennzoil │
└─────────────────────────────────────┘
```

- El medidor conserva su geometría y su animación: arco de 270°, ticks cada
  27°, lectura mono de 44px, 800ms ease-out. No se rediseña, se le cambia la
  fuente de datos y el rótulo del centro.
- La tilde de `~46.900` marca el número como estimado y **es tocable**: abre el
  input de lectura manual → `POST /odometer` → el bloque vuelve reanclado.
  Cuando `source` es `reported`, no hay tilde.
- El medidor sigue navegando a `AddOil`; la zona de abajo abre el odómetro.
- `src/home/registry.tsx` pasa de dos entradas a una. Hace falta **migrar el
  layout guardado** (`store/homeLayout.ts`): quien ya tenga `gauge` y
  `techReadout` colocados queda con un solo `oilStatus` en la posición del
  primero de los dos, y el otro se descarta.
- Se eliminan `oilPct`, `kmLeft` y `vehicleStatus` de `useStore.ts`: el cálculo
  deja de existir en el cliente. Los consume el bloque del endpoint, a través
  de un `oil-status.controller.ts` nuevo bajo `src/api/controllers/`, siguiendo
  el patrón de `ApiClient` que ya usan los demás recursos.
- `AddOilScreen` suma el campo de **intervalo en meses** junto al slider de
  intervalo en km, precargado con los valores del ciclo anterior del vehículo.
- El alta de vehículo suma el campo de **km/día declarado** (pregunta en
  lenguaje llano: "¿cuánto manejás aproximadamente?", con conversión a km/día
  bajo el capó).

---

## 7. Estrategia de pruebas

**Unitarias del calculador** (función pura, tabla de casos):

- Lectura de hoy → `source: reported`, `kmEstimado === lectura`.
- 30 días a 40 km/día → 1.200 km proyectados.
- Limitado por km → `limitedBy: 'km'` y el centro pide km restantes.
- Limitado por tiempo (vehículo parado, km de sobra) → `limitedBy: 'time'`.
- Ciclo vencido por km → `pct: 0`, `kmLeft` negativo, `status: 'danger'`.
- Ciclo vencido por tiempo → ídem con `daysLeft` negativo.
- `addMonths` sobre el 31 de enero → 28/29 de febrero.
- Sin ciclo → `gauge`, `cycle` y `oil` en `null`.
- `kmPerDay` en los bordes 1 y 500.

**Recalibración:**

- Dos cambios con ritmo válido → `kmPerDay` medido, `source: MEASURED`.
- Ciclo con ritmo fuera de `[1, 500]` → se guarda el cambio, **no** entra al
  promedio.
- Más de tres ciclos → promedia solo los tres últimos válidos.

**Invariante del espejo (protección 2)** — integración contra base real:

| Caso | Se afirma |
|---|---|
| Registrar un cambio | las cuatro columnas == lo derivado de `OilChange` |
| Registrar un segundo cambio | == derivado (el ciclo nuevo) |
| Editar el km del último cambio | == derivado (el caso de la corrección) |
| Editar un cambio **viejo** | las columnas **no** cambian |
| Borrar el último cambio | == derivado (el espejo **retrocede** al anterior) |
| Borrar el único cambio | las cuatro en `null` |

El quinto caso es el que más se olvida y el que deja la barra mintiendo en
silencio; por eso es un test y no un comentario.

**E2E de los endpoints:** 404 ante vehículo ajeno, los tres 422 de validación,
y `POST /odometer` devolviendo el bloque ya recalculado.

---

## 8. Fuera de alcance

- **Notificaciones push de "te toca cambio".** El job diario que consulta
  estados y decide a quién avisar va en su propia tanda; este diseño solo se
  asegura de que el servidor tenga el dato para poder decidirlo.
- **Límites por plan** (`maxVehicles`, `maxChangesPerMonth` de `PLANS`).
- **`Vehicle.currentOilChangeId`** como puntero al ciclo vigente: es la
  optimización correcta si algún día el `[vehicleId, changedAt desc]` deja de
  alcanzar, pero hoy no hay un problema de lectura que resolver.
- **Historial en el home más allá del bloque:** `RecentHistoryWidget` sigue
  como está hasta que se migre el historial completo al backend.
