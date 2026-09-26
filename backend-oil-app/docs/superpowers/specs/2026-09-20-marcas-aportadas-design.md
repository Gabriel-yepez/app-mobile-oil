# Marcas aportadas por los usuarios

Fecha: 2026-09-20
Alcance: backend (`backend-oil-app`) y app (`app-mobile`). Una sola feature,
un solo spec, aunque el trabajo toque las dos carpetas.

## El problema

Al dar de alta un vehículo, la marca se elige de una lista fija de 18 valores
quemados en `app-mobile/src/data/mock.ts` (10 carros, 8 motos). Quien maneja
un Chery, un JAC o una Toro se queda sin su marca y no tiene salida: el
selector no admite texto libre.

La lista no la puede mantener nadie de forma realista, porque el parque
automotor venezolano es más largo y más cambiante que cualquier lista que
escribamos de una sentada.

## Qué se construye

En la misma modal de selección, cuando lo que el usuario escribe no está en la
lista, aparece la opción de agregarlo. La marca queda disponible **para todos
los usuarios**, de inmediato. Aplica igual a carros y a motos.

## Decisiones tomadas

Las cuatro que definieron el diseño, con quién las decidió:

1. **Visibilidad global inmediata.** Decisión del usuario, contra la
   recomendación de un umbral de 2-3 usuarios distintos. Se registra el
   riesgo aceptado más abajo.
2. **Normalizar y sugerir parecidas.** Una marca real debe ser una sola
   entrada.
3. **Se puede agregar sin señal**, por la cola, igual que el resto de las
   escrituras de la app.
4. **Catálogo como tabla propia**, no derivado de los vehículos existentes.

### Por qué tabla propia y no `SELECT DISTINCT` sobre los vehículos

Derivar el catálogo de los vehículos existentes era la alternativa seria: cero
tablas, cero endpoints de escritura, y la basura se filtra sola porque nadie
registra un carro marca `asdf`. Se descartó por tres razones:

- La marca desaparecería al borrar el último vehículo que la usa.
- Nada persistiría si el usuario abandona el alta en el paso 3.
- Con visibilidad global inmediata hace falta poder retirar una marca puntual
  sin tocar los vehículos de nadie.

## Riesgo aceptado

Con visibilidad global inmediata, **cualquier usuario puede hacer que un texto
de su elección aparezca en el selector de todos los demás**. Las defensas de
abajo cubren spam, URLs y dedazos. No cubren groserías cortas y bien escritas;
esas hay que borrarlas a mano. Es una decisión consciente del dueño del
producto, no un descuido del diseño.

---

## Backend

### Modelo

```prisma
model Brand {
  id        String      @id @default(uuid())
  kind      VehicleKind
  name      String      @db.VarChar(40)
  nameKey   String      @db.VarChar(40)
  createdBy String?
  createdAt DateTime    @default(now())

  @@unique([kind, nameKey])
  @@index([kind, name])
}
```

`kind` reusa el enum `VehicleKind` que ya existe. Carros y motos son el mismo
modelo separado por ese campo, así que la feature sale para los dos a la vez.

El índice único es sobre `(kind, nameKey)` y no sobre `nameKey` solo, a
propósito: **Honda, Suzuki y Yamaha son marcas de carro y de moto a la vez.**
Cada una existe como dos filas independientes y eso es correcto — quien agrega
Honda a motos no debe verla aparecer entre los carros.

`createdBy` en `null` marca las marcas semilla. No es una relación a `User`: si
mañana se borra la cuenta que aportó una marca, la marca debe sobrevivir porque
ya es del catálogo común, no suya.

### Normalización

```
nameKey = quitarAcentos(name).toUpperCase().replace(/[^A-Z0-9]/g, '')
```

`"  toyota "`, `"TOYOTA"` y `"Toyotá"` producen los tres `TOYOTA` y caen sobre
la fila existente. `"Empire Keeway"` produce `EMPIREKEEWAY`.

`name` se guarda tal como lo escribió quien la creó, solo con los espacios
recortados y los internos colapsados. **No se aplica Title Case**: cualquier
regla de capitalización rompe los acrónimos reales del catálogo — `MD`, `AVA`
y `BMW` se volverían `Md`, `Ava`, `Bmw`. Como `nameKey` ya hace que `"toyota"`
devuelva la `Toyota` existente, la capitalización solo decide el aspecto de
marcas genuinamente nuevas, y ahí quien la escribe primero es tan buena fuente
como cualquier otra.

### Endpoints

| Ruta | Qué hace |
|------|----------|
| `GET /brands?kind=CAR\|MOTO` | Lista del `kind`, ordenada por `name`. Devuelve `{ id, name, nameKey }`. |
| `POST /brands` | Cuerpo `{ id, kind, name }`. El `id` es un UUID v4 generado por el cliente. |

`POST` es idempotente por dos vías independientes:

- Si el `nameKey` ya existe para ese `kind`, devuelve **200 con la marca
  existente** y no crea nada.
- Si el `id` ya existe, devuelve **200** con esa marca.

Ambas importan porque la cola reintenta. Sin la primera, dos teléfonos
agregando "Chery" a la vez producirían un error en vez de converger al mismo
resultado.

`nameKey` viaja en la respuesta del `GET` para que el cliente deduplique con la
clave del servidor en lugar de recalcularla.

### Las tres defensas

1. **Largo 1–40.** Igual que `Vehicle.brand`, para que no pueda entrar al
   catálogo una marca que después no cabe en un vehículo.
2. **Charset.** Letras (incluidas acentuadas), números, espacio, punto, guion
   y `&`; obligado a empezar con letra o número. Deja pasar `Mercedes-Benz`,
   `B.M.W.` y `Empire Keeway`; corta URLs, saltos de línea y la mayor parte del
   spam.
3. **Tope de 5 marcas nuevas por usuario cada 24 horas**, contadas por
   `createdBy`. Un usuario honesto agrega una cada varios meses.
   Cuenta **filas efectivamente creadas**, no peticiones: un `POST` que
   devuelve una marca ya existente no consume cupo, porque no aportó nada al
   catálogo. Sin esa distinción, la cola reintentando podría agotarle el cupo
   a alguien que no creó nada.

### Borrado

**No hay endpoint de borrado en v1.** La app no tiene roles ni noción de
administrador, y montar uno solo para esto es desproporcionado. La salida es
borrar la fila con `pnpm db:studio` o SQL.

Borrar una marca no afecta a ningún vehículo: `Vehicle.brand` sigue siendo
texto suelto y no una referencia. El catálogo existe únicamente para poblar el
selector.

### Migración

Una migración de Prisma crea la tabla, el índice único y siembra las 18 marcas
actuales con `createdBy = null`, todo en el mismo SQL versionado.

No hace falta backfill desde los vehículos existentes: hasta hoy la marca solo
se podía elegir de esas 18, así que no hay ningún valor fuera del catálogo.

---

## App

### Piezas

- `src/api/controllers/brands.controller.ts` — `list(kind)` y `crear(id, kind, name)`.
- `src/store/useBrands.ts` — `hidratar / refresh / agregar`. Mismo ciclo que la
  flota: hidrata del disco, pinta, refresca, guarda.
- Caché local bajo `ruedalo:marcas`; cola propia bajo `ruedalo:cola-marcas`.

El selector muestra **la lista del servidor unida a las marcas agregadas que
todavía no salieron**, deduplicadas por `nameKey`.

Para las marcas que vienen del servidor el cliente usa el `nameKey` que el
servidor ya calculó. Solo calcula uno propio para las que agregó y todavía no
sincronizó, que son las únicas sin respuesta del servidor. Esa es toda la
superficie donde la normalización del cliente puede divergir de la del
servidor; ver más abajo.

### Por qué una cola aparte

La cola de escrituras vive hoy dentro de `useVehicles`: el estado `cola`,
`encolarOp` y `sincronizar` están ahí. Meter marcas obligaba a ensuciar ese
store con algo ajeno, o a extraer una cola compartida.

`useBrands` lleva su propia cola, reusando las funciones puras `encolar` y
`drenar`, que ya son genéricas. Es reuso, no duplicación: no se copia lógica.

Esto se apoya en un hecho del modelo: **las operaciones de marca y de vehículo
son independientes.** Un vehículo con marca "Chery" no necesita que exista la
fila Chery, porque la marca viaja como texto. No hay orden que respetar entre
las dos colas, que es lo único que haría obligatorio unificarlas.

Costo aceptado: dos bucles de drenado. **Cuando aparezca un tercer escritor hay
que extraer un `useSync` de verdad**; con dos todavía no se paga el riesgo de
refactorizar código recién integrado y cubierto por tests.

`CREATE_BRAND` no necesita ninguna regla de colapso nueva: una marca no se
puede editar ni borrar desde la app.

### La modal

`Select` es un primitivo genérico que también usan las viscosidades. No recibe
el concepto de "marca". Gana dos props opcionales:

- `searchable` — campo de búsqueda. Con 18 opciones no hacía falta; con un
  catálogo que crece, sí.
- `onAddNew(texto)` — cuando está presente y lo escrito no calza exacto con
  ninguna opción, aparece al final una fila `+ Agregar «Chery»`.

La lógica de dominio queda en las pantallas que lo usan
(`AddVehicleFormScreen` y `EditVehicleScreen`).

### Sugerencia de parecidas

Corre **en el cliente**, contra la lista cacheada, con distancia de Levenshtein:
umbral ≤2 para textos de 4 o más caracteres, ≤1 para más cortos.

Va en el cliente y no en el servidor porque tiene que funcionar sin señal y
porque es instantáneo. El servidor sigue siendo la autoridad: su índice único
sobre `nameKey` hace imposible crear un duplicado exacto aunque la caché esté
vieja.

El umbral por largo no es adorno: **`MD` y `AVA` están a distancia 2 y son
marcas distintas y reales.** Con un umbral fijo de 2 la app sugeriría
reemplazar una por la otra.

Al tocar `+ Agregar «Toyta»` sale un `Alert` nativo: *"¿Quisiste decir
Toyota?"*, con **[Usar Toyota]** y **[Crear «Toyta»]**. El usuario puede
insistir y crear la suya.

### Las 18 marcas actuales

Se siembran en el backend y **además quedan en el cliente como valor inicial de
`useBrands`**. Sin eso, una instalación nueva sin señal abriría el selector
vacío. La lista del servidor las pisa en el primer refresco exitoso.

Costo aceptado: 18 strings estáticos en dos lugares. Es preferible a un
selector vacío en el paso 2 del alta.

### Errores

La validación del cliente replica el largo y el charset del servidor, así que
un rechazo permanente es casi imposible. Si ocurre, `clasificarFallo` ya lo
clasifica como permanente y descarta la operación; la marca local desaparece en
el siguiente refresco. No se agrega un canal de errores nuevo.

---

## La normalización duplicada

El cliente normaliza para deduplicar y sugerir; el servidor normaliza para el
índice único. Son dos implementaciones de lo mismo en dos paquetes y van a
divergir.

No se resuelve compartiendo código: no hay paquete común entre las dos carpetas
y montarlo por esto es desproporcionado. Se resuelve con una asimetría
explícita: **la del cliente es una heurística de UX, la del servidor es la
restricción.** Si divergen, lo peor que pasa es un duplicado visual pasajero
hasta el próximo refresco, nunca una fila duplicada.

Las dos se prueban contra **la misma tabla de casos**, para que la divergencia
se note temprano.

---

## Pruebas

### Backend, unitarios

| Qué | Casos |
|-----|-------|
| `nameKey` | `"  toyota "`, `"TOYOTA"`, `"Toyotá"` → `TOYOTA`; `"Empire Keeway"` → `EMPIREKEEWAY` |
| Charset | acepta `Mercedes-Benz`, `B.M.W.`, `MD`; rechaza URLs, saltos de línea, arranque con símbolo, 41 caracteres |
| Idempotencia | `nameKey` repetido → 200 y cero filas nuevas; `id` repetido → 200 |
| Tope diario | la 5ª pasa, la 6ª se rechaza, una de hace 25h no cuenta |
| `kind` | una marca de moto nunca aparece en la lista de carros |
| Semillas | `createdBy = null` y no cuentan contra el tope de nadie |

### Backend, e2e

- **Visibilidad entre cuentas**: el usuario A agrega "Chery" y el `GET` del
  usuario B la trae. Es la premisa entera de la feature; sin este test no hay
  prueba de que se cumpla.
- Alta y aparición en el listado del mismo usuario.
- Dos usuarios creando la misma marca terminan con una sola fila.

Los tests nuevos usan el dominio `@e2e.local` y el barrido de
`test/support/e2e-db.ts`, como el resto.

### App, unitarios

- Sugerencia: `"toyta"` → Toyota, `"chevorlet"` → Chevrolet.
- Umbral por largo: **`MD` no sugiere `AVA`**.
- La unión local + remoto no muestra duplicados.
- `CREATE_BRAND` sobrevive el ida y vuelta de la cola sin colapsar.
- La tabla de casos de normalización compartida con el backend.

---

## Fuera de alcance

- Moderación, umbrales de adopción y cola de aprobación.
- Endpoint de borrado y sistema de roles.
- Fusionar dos marcas existentes en una.
- Modelos por marca. Este spec cubre la marca; el modelo sigue siendo texto
  libre.
- Convertir `Vehicle.brand` en una referencia al catálogo. Sigue siendo texto,
  y de eso depende que el alta funcione sin señal.
