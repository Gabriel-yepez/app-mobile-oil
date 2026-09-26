# La flota al backend, offline-first — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que la flota viva en el backend con caché local y cola de escrituras, para que la app funcione sin señal y para que toda pantalla que muestre vida del aceite lea el mismo número.

**Architecture:** Los ids los genera la app (UUID v4) y el backend los acepta, así que las creaciones son idempotentes y los reintentos de la cola son inofensivos. Escribir es local primero: la UI se actualiza al instante y un runner FIFO drena la cola cuando hay señal. La lógica de la cola es pura y se prueba sin red.

**Tech Stack:** Backend NestJS 11 + Prisma 7.10. App Expo + React Native, Zustand, `expo-sqlite/kv-store`, `expo-crypto` (para `randomUUID`), Jest.

**Spec:** `app-mobile/docs/superpowers/specs/2026-09-19-flota-offline-first-design.md`

## Global Constraints

- Los ids de vehículos y cambios son **UUID v4 generados por la app**. El backend los acepta tal cual.
- Crear es **idempotente por id**: id existente del mismo usuario → `200` con el registro existente, sin modificarlo. De otro usuario → `404 VEHICLE_NOT_FOUND`.
- La cola es **FIFO estricto y de a una**: enviar en paralelo dejaría llegar un cambio antes que el vehículo que lo contiene.
- Fallo **transitorio** (sin red, timeout, `5xx`, `429`) → reintento con espera 1s, 4s, 15s, 60s, y de ahí cada 60s; la op se queda en la cola. Fallo **permanente** (`4xx` salvo `401` y `429`) → la op sale de la cola y el registro local queda `rechazado` con su `code`. `401` con refresco fallido → la cola se **pausa** entera, no se descarta nada.
- Nada rechazado desaparece en silencio: se le muestra al usuario con el motivo.
- El `pct` cacheado **no se recalcula en el cliente**. Si `computedAt` supera 24 h, la tarjeta muestra su antigüedad.
- `oilPct`, `kmLeft` y `vehicleStatus` de `useStore` se borran **en la última tarea**, cuando ya nadie los usa.
- Backend: errores por `Errors.*` en `src/common/errors.ts`. Tests `*.spec.ts` junto al código; e2e en `test/*.e2e-spec.ts`.
- App: tests en `__tests__/*.test.ts` junto al módulo. Comentarios en español, explicando el porqué.

---

## Mapa de archivos

**Backend — modificar**

| Archivo | Cambio |
|---|---|
| `src/common/errors.ts` | `plateTaken()` (409). |
| `src/modules/oil/dto/create-vehicle.dto.ts` | `id?: string` con `@IsUUID('4')`. |
| `src/modules/oil/dto/create-oil-change.dto.ts` | Ídem. |
| `src/modules/oil/dto/update-vehicle.dto.ts` | **Crear**: `PartialType` de la ficha, sin `id`. |
| `src/modules/oil/dto/oil-change-response.dto.ts` | **Crear**: la fila del historial + página con `nextCursor`. |
| `src/modules/oil/dto/vehicle-response.dto.ts` | Suma `gauge` y `odometer`. |
| `src/modules/oil/domain/vehicle.repository.ts` | `create` acepta `id`; `update`, `remove`. |
| `src/modules/oil/domain/oil-change.repository.ts` | `create` acepta `id`; `findPage`. |
| `src/infra/prisma/prisma-*.repository.ts` | Implementarlos. |
| `src/modules/oil/testing/in-memory-*.repository.ts` | Ídem en los dobles. |
| `src/modules/oil/oil.service.ts` | Idempotencia, `updateVehicle`, `removeVehicle`, `listOilChanges`, `listVehiclesWithStatus`. |
| `src/modules/oil/vehicles.controller.ts` | `PATCH`, `DELETE`, `GET :id/oil-changes`. |

**App — crear**

| Archivo | Responsabilidad |
|---|---|
| `src/data/ids.ts` | `nuevoId()`: UUID v4. Un solo lugar. |
| `src/data/types.ts` | `NewVehicleInput` y `NewOilChangeInput`, espejo de los DTOs del backend. |
| `src/data/sync/queue.ts` | Estructura y transiciones de la cola. **Puro**. |
| `src/data/sync/runner.ts` | Drena la cola contra la API; clasifica fallos. |
| `src/data/local/store.ts` | Persistencia de flota, historial y bloques de estado. |
| `src/store/useVehicles.ts` | El store de vehículos que reemplaza la parte de `useStore`. |
| `src/hooks/useOilStatus.ts` | Bloque de estado por vehículo, con caché. |
| `src/home/widgets/OilStatusWidget.tsx` | La tarjeta única. |
| `src/screens/ReportOdometerScreen.tsx` | Lectura manual del odómetro. |

**App — modificar:** `src/api/controllers/oil-status.controller.ts` (rutas nuevas),
`src/home/layout.ts`, `src/home/registry.tsx`, `src/components/OilGauge.tsx`,
`src/screens/{Vehicles,VehicleDetail,AddVehicleForm,EditVehicle,AddOil,Alerts,History}Screen.tsx`,
`src/home/widgets/{OpenAlerts,RecentHistory}Widget.tsx`, `src/notifications/plan.ts`,
`src/store/useStore.ts`.

**App — borrar:** `src/home/widgets/GaugeWidget.tsx`, `src/home/widgets/TechReadoutWidget.tsx`.

---

# FASE A — Backend (las cinco rutas que faltan)

### Task 1: Crear vehículo idempotente

**Files:**
- Modify: `src/common/errors.ts`, `src/modules/oil/dto/create-vehicle.dto.ts`, `src/modules/oil/domain/vehicle.repository.ts`, `src/infra/prisma/prisma-vehicle.repository.ts`, `src/modules/oil/testing/in-memory-vehicle.repository.ts`, `src/modules/oil/oil.service.ts`, `src/modules/oil/vehicles.controller.ts`
- Test: `src/modules/oil/oil.service.spec.ts`

**Interfaces:**
- Consumes: `OilService.createVehicle` actual.
- Produces: `createVehicle(userId, data)` donde `data.id?: string`, y `Errors.plateTaken()`. `VehicleRepository.create(data: NewVehicle & { id?: string })`.

- [ ] **Step 1: Escribir los tests que fallan**

Agregar a `oil.service.spec.ts`:

```ts
describe('crear vehículo con id del cliente', () => {
  const ID = '3f1c2b4a-0000-4000-8000-000000000001';

  it('usa el id que manda la app', async () => {
    const v = await service.createVehicle('u1', { ...nuevoVehiculo, id: ID });
    expect(v.id).toBe(ID);
  });

  it('el mismo id dos veces devuelve el existente, no duplica', async () => {
    // El caso real: la cola reintentó porque el envío se cortó DESPUÉS de que
    // el servidor guardó.
    const a = await service.createVehicle('u1', { ...nuevoVehiculo, id: ID });
    const b = await service.createVehicle('u1', {
      ...nuevoVehiculo,
      id: ID,
      brand: 'Otra',
    });

    expect(b.id).toBe(a.id);
    // No se modifica: el reintento manda el mismo cuerpo, y si difiere gana
    // lo que ya está guardado. Para cambiarlo está PATCH.
    expect(b.brand).toBe('Toyota');
    expect(await service.listVehicles('u1')).toHaveLength(1);
  });

  it('un id de OTRO usuario responde VEHICLE_NOT_FOUND', async () => {
    await service.createVehicle('u1', { ...nuevoVehiculo, id: ID });
    await expect(
      service.createVehicle('u2', { ...nuevoVehiculo, id: ID }),
    ).rejects.toMatchObject({ response: { error: 'VEHICLE_NOT_FOUND' } });
  });

  it('la matrícula repetida del mismo usuario responde PLATE_TAKEN', async () => {
    await service.createVehicle('u1', nuevoVehiculo);
    await expect(
      service.createVehicle('u1', { ...nuevoVehiculo }),
    ).rejects.toMatchObject({ response: { error: 'PLATE_TAKEN' } });
  });
});
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `npx jest oil.service`
Expected: FAIL — el id se ignora y se crea un segundo vehículo.

- [ ] **Step 3: Agregar el error**

En `src/common/errors.ts`:

```ts
  plateTaken: () =>
    new AppError(
      HttpStatus.CONFLICT,
      'PLATE_TAKEN',
      'Ya tienes un vehículo con esa placa.',
    ),
```

- [ ] **Step 4: Ampliar el repositorio**

En `domain/vehicle.repository.ts`, `create` pasa a aceptar el id y se suma la
búsqueda por placa:

```ts
  create(data: NewVehicle & { id?: string }): Promise<Vehicle>;
  findByPlate(userId: string, plate: string): Promise<Vehicle | null>;
```

En Prisma, `create` pasa `data` tal cual (Prisma usa el `id` si viene) y
`findByPlate` usa el índice único:

```ts
  async findByPlate(userId: string, plate: string): Promise<Vehicle | null> {
    const row = await this.prisma.vehicle.findUnique({
      where: { userId_plate: { userId, plate } },
    });
    return row ? this.toDomain(row) : null;
  }
```

En el doble en memoria, `create` respeta `data.id` si viene y si no genera
`v${++this.seq}`; `findByPlate` filtra por `userId` y `plate`.

- [ ] **Step 5: Implementar la idempotencia en el servicio**

```ts
  async createVehicle(
    userId: string,
    data: Omit<NewVehicle, 'userId'> & { id?: string },
  ): Promise<Vehicle> {
    // Idempotencia por id: es lo que hace segura la cola de la app. Si el
    // envío se cortó DESPUÉS de que el servidor guardó, el reintento tiene
    // que ser inofensivo, no un duplicado.
    if (data.id) {
      const existente = await this.vehicles.findById(data.id);
      if (existente) {
        // De otro usuario: 404 y no 409, para no confirmar que ese id existe.
        if (existente.userId !== userId) throw Errors.vehicleNotFound();
        return existente;
      }
    }

    if (await this.vehicles.findByPlate(userId, data.plate)) {
      throw Errors.plateTaken();
    }

    return this.vehicles.create({ ...data, userId });
  }
```

- [ ] **Step 6: Agregar `id` al DTO**

```ts
  @ApiPropertyOptional({
    format: 'uuid',
    description: [
      'Id generado por la app. Si se manda, el backend lo usa tal cual y la',
      'creación es idempotente: reenviar el mismo id devuelve el registro ya',
      'creado en vez de duplicarlo.',
    ].join(' '),
  })
  @IsOptional()
  @IsUUID('4')
  id?: string;
```

- [ ] **Step 7: Correr los tests**

Run: `npx jest oil.service && pnpm build`
Expected: PASS; compila.

- [ ] **Step 8: Commit**

```bash
git add src/
git commit -m "feat(flota): crear vehículo con id del cliente, idempotente"
```

---

### Task 2: Registrar cambio de aceite idempotente

**Files:**
- Modify: `src/modules/oil/dto/create-oil-change.dto.ts`, `src/modules/oil/domain/oil-change.repository.ts`, `src/infra/prisma/prisma-oil-change.repository.ts`, `src/modules/oil/testing/in-memory-oil-change.repository.ts`, `src/modules/oil/oil.service.ts`
- Test: `src/modules/oil/oil-changes.service.spec.ts`

**Interfaces:**
- Consumes: `OilService.registerOilChange` actual.
- Produces: `registerOilChange(userId, vehicleId, data)` con `data.id?: string`; `OilChangeRepository.create(data: NewOilChange & { id?: string })`.

- [ ] **Step 1: Escribir los tests que fallan**

```ts
describe('registrar un cambio con id del cliente', () => {
  const ID = '3f1c2b4a-0000-4000-8000-0000000000aa';

  it('usa el id que manda la app', async () => {
    const c = await service.registerOilChange('u1', vehicleId, {
      ...cambio(45_000, '2026-06-04T00:00:00Z'),
      id: ID,
    });
    expect(c.id).toBe(ID);
  });

  it('el reintento NO abre un ciclo nuevo', async () => {
    // Registrar dos veces el mismo cambio significaría reiniciar la barra sin
    // motivo: el peor síntoma posible de un reintento mal manejado.
    const datos = { ...cambio(45_000, '2026-06-04T00:00:00Z'), id: ID };
    await service.registerOilChange('u1', vehicleId, datos);
    await service.registerOilChange('u1', vehicleId, datos);

    const historial = await service.listOilChanges('u1', vehicleId);
    expect(historial.items).toHaveLength(1);
  });

  it('el reintento tampoco duplica la lectura de odómetro', async () => {
    const datos = { ...cambio(45_000, '2026-06-04T00:00:00Z'), id: ID };
    await service.registerOilChange('u1', vehicleId, datos);
    await service.registerOilChange('u1', vehicleId, datos);

    const estado = await service.getOilStatus(
      'u1',
      vehicleId,
      utc('2026-06-04T00:00:00Z'),
    );
    expect(estado.odometer?.km).toBe(45_000);
  });
});
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `npx jest oil-changes`
Expected: FAIL — `service.listOilChanges is not a function` y el duplicado se crea.

- [ ] **Step 3: Implementar**

En `registerOilChange`, antes de todo lo demás:

```ts
    // Mismo motivo que en createVehicle. Acá el duplicado es peor: serían dos
    // ciclos abiertos y la barra reiniciada sin que el usuario haya hecho nada.
    if (data.id) {
      const existente = await this.changes.findById(data.id);
      if (existente) {
        await this.getOwnedVehicle(userId, existente.vehicleId);
        return existente;
      }
    }
```

`OilChangeRepository.create` acepta `id` opcional, igual que en la Task 1.

- [ ] **Step 4: Agregar `id` al DTO**

Igual que en `CreateVehicleDto`: `@IsOptional() @IsUUID('4') id?: string`.

- [ ] **Step 5: Correr los tests**

Run: `npx jest && pnpm build`
Expected: PASS (la Task 3 agrega `listOilChanges`; si todavía no existe, mover ese `expect` a la Task 3 y dejar acá la verificación por `findByVehicle` del repositorio).

- [ ] **Step 6: Commit**

```bash
git add src/
git commit -m "feat(flota): registrar cambio de aceite con id del cliente, idempotente"
```

---

### Task 3: Historial paginado

**Files:**
- Create: `src/modules/oil/dto/oil-change-response.dto.ts`
- Modify: `src/modules/oil/domain/oil-change.repository.ts`, los dos repositorios, `src/modules/oil/oil.service.ts`, `src/modules/oil/vehicles.controller.ts`
- Test: `src/modules/oil/oil-changes.service.spec.ts`

**Interfaces:**
- Consumes: `getOwnedVehicle`.
- Produces: `OilService.listOilChanges(userId, vehicleId, { cursor?, limit? })` → `{ items: OilChangeRecord[]; nextCursor: string | null }`; ruta `GET /vehicles/:id/oil-changes`.

- [ ] **Step 1: Escribir los tests que fallan**

```ts
describe('historial del vehículo', () => {
  beforeEach(async () => {
    for (const [fecha, km] of [
      ['2025-06-04T00:00:00Z', 35_000],
      ['2025-12-04T00:00:00Z', 40_000],
      ['2026-06-04T00:00:00Z', 45_000],
    ] as [string, number][]) {
      await service.registerOilChange('u1', vehicleId, cambio(km, fecha));
    }
  });

  it('devuelve del más nuevo al más viejo', async () => {
    const { items } = await service.listOilChanges('u1', vehicleId);
    expect(items.map((c) => c.km)).toEqual([45_000, 40_000, 35_000]);
  });

  it('pagina con cursor', async () => {
    const p1 = await service.listOilChanges('u1', vehicleId, { limit: 2 });
    expect(p1.items).toHaveLength(2);
    expect(p1.nextCursor).not.toBeNull();

    const p2 = await service.listOilChanges('u1', vehicleId, {
      limit: 2,
      cursor: p1.nextCursor!,
    });
    expect(p2.items.map((c) => c.km)).toEqual([35_000]);
    // La última página no ofrece otra: sin esto la app pagina para siempre.
    expect(p2.nextCursor).toBeNull();
  });

  it('no devuelve el historial de un vehículo ajeno', async () => {
    await expect(
      service.listOilChanges('u2', vehicleId),
    ).rejects.toMatchObject({ response: { error: 'VEHICLE_NOT_FOUND' } });
  });
});
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `npx jest oil-changes`
Expected: FAIL — `listOilChanges is not a function`.

- [ ] **Step 3: Implementar el repositorio**

```ts
  /** El cursor es el id del último elemento de la página anterior. */
  findPage(
    vehicleId: string,
    opts: { cursor?: string; limit: number },
  ): Promise<{ items: OilChangeRecord[]; nextCursor: string | null }>;
```

En Prisma, con `cursor` + `skip: 1`, `take: limit + 1` y ordenado por
`changedAt desc`. El `+1` es el truco que permite saber si hay otra página sin
un `count` aparte: si vuelven `limit + 1` filas, se descarta la última y su id
anterior es el `nextCursor`; si vuelven menos, `nextCursor` es `null`.

- [ ] **Step 4: Implementar el servicio y la ruta**

```ts
  async listOilChanges(
    userId: string,
    vehicleId: string,
    opts: { cursor?: string; limit?: number } = {},
  ) {
    await this.getOwnedVehicle(userId, vehicleId);
    // Tope duro: sin esto, un `limit=100000` es una descarga de toda la tabla.
    const limit = Math.min(Math.max(opts.limit ?? 20, 1), 100);
    return this.changes.findPage(vehicleId, { cursor: opts.cursor, limit });
  }
```

Ruta `@Get(':id/oil-changes')` con `@Query()` tipado por un DTO
`ListOilChangesQueryDto` (`@IsOptional() @IsUUID('4') cursor?`, `@IsOptional()
@Type(() => Number) @IsInt() @Min(1) @Max(100) limit?`).

- [ ] **Step 5: Correr los tests**

Run: `npx jest && pnpm build`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/
git commit -m "feat(flota): historial de cambios paginado por cursor"
```

---

### Task 4: Editar y borrar vehículo

**Files:**
- Create: `src/modules/oil/dto/update-vehicle.dto.ts`
- Modify: `src/modules/oil/domain/vehicle.repository.ts`, los dos repositorios, `src/modules/oil/oil.service.ts`, `src/modules/oil/vehicles.controller.ts`
- Test: `src/modules/oil/oil.service.spec.ts`

**Interfaces:**
- Consumes: `getOwnedVehicle`.
- Produces: `OilService.updateVehicle(userId, id, patch)`, `OilService.removeVehicle(userId, id)`; rutas `PATCH` y `DELETE /vehicles/:id`.

- [ ] **Step 1: Escribir los tests que fallan**

```ts
describe('editar y borrar vehículo', () => {
  it('edita la ficha', async () => {
    const v = await service.createVehicle('u1', nuevoVehiculo);
    const r = await service.updateVehicle('u1', v.id, { color: '#FF0000' });
    expect(r.color).toBe('#FF0000');
  });

  it('cambiar kmPerDay a mano devuelve la fuente a DECLARED', async () => {
    // El usuario está pisando lo medido a propósito. El próximo ciclo medido
    // lo volverá a calibrar solo.
    const v = await service.createVehicle('u1', nuevoVehiculo);
    await service.registerOilChange(
      'u1',
      v.id,
      cambio(42_000, '2026-02-24T00:00:00Z'),
    );
    await service.registerOilChange(
      'u1',
      v.id,
      cambio(45_000, '2026-06-04T00:00:00Z'),
    );
    expect((await service.getOwnedVehicle('u1', v.id)).kmPerDaySource).toBe(
      'MEASURED',
    );

    const r = await service.updateVehicle('u1', v.id, { kmPerDay: 80 });
    expect(r.kmPerDay).toBe(80);
    expect(r.kmPerDaySource).toBe('DECLARED');
  });

  it('editar la ficha NO toca el espejo del ciclo', async () => {
    const v = await service.createVehicle('u1', nuevoVehiculo);
    await service.registerOilChange(
      'u1',
      v.id,
      cambio(45_000, '2026-06-04T00:00:00Z'),
    );
    await service.updateVehicle('u1', v.id, { color: '#FF0000' });

    const r = await service.getOwnedVehicle('u1', v.id);
    expect(r.lastChangeKm).toBe(45_000);
    expect(r.nextChangeKm).toBe(50_000);
  });

  it('no deja editar el vehículo de otro', async () => {
    const v = await service.createVehicle('u1', nuevoVehiculo);
    await expect(
      service.updateVehicle('u2', v.id, { color: '#FF0000' }),
    ).rejects.toMatchObject({ response: { error: 'VEHICLE_NOT_FOUND' } });
  });

  it('borra el vehículo', async () => {
    const v = await service.createVehicle('u1', nuevoVehiculo);
    await service.removeVehicle('u1', v.id);
    expect(await service.listVehicles('u1')).toHaveLength(0);
  });

  it('no deja borrar el vehículo de otro', async () => {
    const v = await service.createVehicle('u1', nuevoVehiculo);
    await expect(service.removeVehicle('u2', v.id)).rejects.toMatchObject({
      response: { error: 'VEHICLE_NOT_FOUND' },
    });
  });
});
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `npx jest oil.service`
Expected: FAIL — `updateVehicle is not a function`.

- [ ] **Step 3: Implementar**

```ts
  /**
   * Edita la ficha. NO toca el espejo del ciclo ni el historial: eso se cambia
   * registrando o corrigiendo un cambio de aceite, no editando la ficha.
   */
  async updateVehicle(
    userId: string,
    vehicleId: string,
    patch: Partial<Omit<NewVehicle, 'userId'>>,
  ): Promise<Vehicle> {
    await this.getOwnedVehicle(userId, vehicleId);
    return this.vehicles.update(vehicleId, {
      ...patch,
      // Si pisó el ritmo a mano, la fuente vuelve a declarada: el próximo
      // ciclo medido lo recalibra solo.
      ...(patch.kmPerDay !== undefined
        ? { kmPerDaySource: 'DECLARED' as const }
        : {}),
    });
  }

  async removeVehicle(userId: string, vehicleId: string): Promise<void> {
    await this.getOwnedVehicle(userId, vehicleId);
    // Los cambios y las lecturas caen por onDelete: Cascade del esquema.
    await this.vehicles.remove(vehicleId);
  }
```

`VehicleRepository` suma `update(id, patch)` y `remove(id)`. `UpdateVehicleDto`
es `PartialType(CreateVehicleDto)` **sin** `id` (`OmitType` primero).

Rutas: `@Patch(':id')` devolviendo `toVehicleResponse`, y `@Delete(':id')` con
`@HttpCode(HttpStatus.NO_CONTENT)`.

- [ ] **Step 4: Correr los tests**

Run: `npx jest && pnpm build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/
git commit -m "feat(flota): editar y borrar vehículo"
```

---

### Task 5: `GET /vehicles` con el estado de cada uno

**Files:**
- Modify: `src/modules/oil/dto/vehicle-response.dto.ts`, `src/modules/oil/oil.service.ts`, `src/modules/oil/vehicles.controller.ts`
- Test: `src/modules/oil/oil-status.service.spec.ts`

**Interfaces:**
- Consumes: `computeOilStatus`, `listVehicles`.
- Produces: `OilService.listVehiclesWithStatus(userId, now?)` → `VehicleResponseDto[]` con `gauge` y `odometer`.

- [ ] **Step 1: Escribir los tests que fallan**

```ts
describe('lista de vehículos con estado', () => {
  it('cada vehículo trae su gauge', async () => {
    const v = await service.createVehicle('u1', nuevoVehiculo);
    await service.registerOilChange(
      'u1',
      v.id,
      cambio(45_000, '2026-06-04T00:00:00Z'),
    );

    const lista = await service.listVehiclesWithStatus(
      'u1',
      utc('2026-07-04T00:00:00Z'),
    );
    expect(lista[0].gauge).toMatchObject({ status: 'ok', limitedBy: 'km' });
    expect(lista[0].odometer?.source).toBe('estimated');
  });

  it('un vehículo sin ciclo trae gauge en null, no rompe la lista', async () => {
    await service.createVehicle('u1', nuevoVehiculo);
    const lista = await service.listVehiclesWithStatus(
      'u1',
      utc('2026-07-04T00:00:00Z'),
    );
    expect(lista[0].gauge).toBeNull();
    expect(lista[0].odometer).toBeNull();
  });
});
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `npx jest oil-status.service`
Expected: FAIL — `listVehiclesWithStatus is not a function`.

- [ ] **Step 3: Implementar**

```ts
  /**
   * La lista con el estado de cada vehículo.
   *
   * Existe para que la pantalla de la flota sea UNA llamada y no una por
   * vehículo — con cinco vehículos, la diferencia entre abrir al instante y
   * abrir con cinco peticiones en vuelo.
   */
  async listVehiclesWithStatus(
    userId: string,
    now: Date = new Date(),
  ): Promise<VehicleResponseDto[]> {
    const vehiculos = await this.vehicles.findByUser(userId);

    return Promise.all(
      vehiculos.map(async (v) => {
        const ultimo = await this.changes.findLatest(v.id);
        const lectura = await this.odometer.findLatest(v.id);
        const status = computeOilStatus({
          now,
          kmPerDay: v.kmPerDay,
          lastReading: lectura
            ? { km: lectura.km, readAt: lectura.readAt }
            : null,
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
          ...toVehicleResponse(v),
          gauge: status.gauge,
          odometer: status.odometer,
        };
      }),
    );
  }
```

`VehicleResponseDto` suma `gauge: GaugeDto | null` y `odometer: OdometerDto |
null`, importados de `oil-status-response.dto.ts`. La ruta `GET /vehicles` pasa
a llamar a este método.

- [ ] **Step 4: Correr los tests**

Run: `npx jest && pnpm build`
Expected: PASS.

- [ ] **Step 5: Ampliar el e2e**

En `test/oil.e2e-spec.ts`, dos casos:

```ts
  it('crear dos veces con el mismo id no duplica', async () => {
    const id = randomUUID();
    const cuerpo = { ...nuevoVehiculo(), id };

    const a = await http()
      .post('/api/v1/vehicles')
      .set('Authorization', `Bearer ${token}`)
      .send(cuerpo)
      .expect(201);
    await http()
      .post('/api/v1/vehicles')
      .set('Authorization', `Bearer ${token}`)
      .send(cuerpo)
      .expect(200);

    const lista = await http()
      .get('/api/v1/vehicles')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const suyos = (lista.body as { id: string }[]).filter(
      (v) => v.id === veh(a).id,
    );
    expect(suyos).toHaveLength(1);
  });

  it('la lista trae el gauge de cada vehículo', async () => {
    const r = await http()
      .get('/api/v1/vehicles')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(r.body[0]).toHaveProperty('gauge');
  });
```

Run: `pnpm test:e2e -- oil`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/ test/
git commit -m "feat(flota): la lista de vehículos trae el estado de cada uno"
```

---

# FASE B — La capa de datos de la app

### Task 6: Ids del cliente

**Files:**
- Create: `app-mobile/src/data/ids.ts`
- Test: `app-mobile/src/data/__tests__/ids.test.ts`

**Interfaces:**
- Produces: `nuevoId(): string`.

- [ ] **Step 1: Escribir el test que falla**

```ts
import { nuevoId } from '../ids';

describe('nuevoId', () => {
  it('devuelve un UUID v4', () => {
    expect(nuevoId()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it('no repite', () => {
    const muchos = new Set(Array.from({ length: 1000 }, () => nuevoId()));
    expect(muchos.size).toBe(1000);
  });
});
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `npm test -- ids.test`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Implementar**

```ts
// app-mobile/src/data/ids.ts
// Los ids de vehículos y cambios los genera la APP, no el backend.
//
// Es lo que permite guardar sin señal: el registro nace con su id definitivo,
// se pinta de inmediato y, cuando la cola lo sincroniza, el servidor usa ese
// mismo id. Nada se remapea, así que no existe la clase de bugs donde un
// cambio de aceite queda apuntando a un vehículo con id viejo.
import { randomUUID } from 'expo-crypto';

export function nuevoId(): string {
  return randomUUID();
}
```

Si `expo-crypto` no está instalado: `npx expo install expo-crypto`.

- [ ] **Step 4: Correr el test**

Run: `npm test -- ids.test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app-mobile/src/data app-mobile/package.json
git commit -m "feat(flota): ids de cliente para poder crear sin señal"
```

---

### Task 7: La cola

**Files:**
- Create: `app-mobile/src/data/sync/queue.ts`
- Test: `app-mobile/src/data/sync/__tests__/queue.test.ts`

**Interfaces:**
- Consumes: nada. **Puro**: sin red, sin almacenamiento, sin React.
- Produces: `QueueOp`, `QueueEntry`, `encolar(cola, op): QueueEntry[]`, `cabeza(cola)`, `sacar(cola, op)`, `marcarIntento(cola, op)`, `esperaMs(intentos): number`.

Es donde vive el riesgo de toda la tanda, y por eso es puro: los casos difíciles
se prueban con una tabla y sin simular una red.

- [ ] **Step 1: Escribir los tests que fallan**

```ts
import { encolar, cabeza, esperaMs, marcarIntento, sacar } from '../queue';
import type { QueueEntry, QueueOp } from '../queue';

const vacia: QueueEntry[] = [];

const crearVehiculo = (id: string): QueueOp => ({
  op: 'CREATE_VEHICLE',
  id,
  payload: { brand: 'Toyota', model: 'Corolla', plate: 'AB123CD' } as never,
});
const editarVehiculo = (id: string, patch: object): QueueOp => ({
  op: 'UPDATE_VEHICLE',
  id,
  payload: patch as never,
});
const borrarVehiculo = (id: string): QueueOp => ({ op: 'DELETE_VEHICLE', id });
const crearCambio = (id: string, vehicleId: string): QueueOp => ({
  op: 'CREATE_OIL_CHANGE',
  id,
  vehicleId,
  payload: { km: 45_000 } as never,
});

describe('colapso de operaciones', () => {
  it('crear y luego borrar el mismo vehículo deja la cola vacía', () => {
    // El vehículo nunca existió para el servidor: mandar el DELETE de algo que
    // no creamos es un 404 garantizado.
    let c = encolar(vacia, crearVehiculo('v1'));
    c = encolar(c, borrarVehiculo('v1'));
    expect(c).toHaveLength(0);
  });

  it('crear y luego editar se fusionan en una sola creación', () => {
    let c = encolar(vacia, crearVehiculo('v1'));
    c = encolar(c, editarVehiculo('v1', { color: '#FF0000' }));

    expect(c).toHaveLength(1);
    expect(c[0].op.op).toBe('CREATE_VEHICLE');
    expect((c[0].op as { payload: { color: string } }).payload.color).toBe(
      '#FF0000',
    );
  });

  it('dos ediciones del mismo vehículo se fusionan, gana la última por campo', () => {
    let c = encolar(vacia, editarVehiculo('v1', { color: '#FF0000', year: 2019 }));
    c = encolar(c, editarVehiculo('v1', { color: '#00FF00' }));

    expect(c).toHaveLength(1);
    const p = (c[0].op as { payload: { color: string; year: number } }).payload;
    expect(p).toEqual({ color: '#00FF00', year: 2019 });
  });

  it('borrar un vehículo descarta las ops de sus cambios pendientes', () => {
    let c = encolar(vacia, crearCambio('c1', 'v1'));
    c = encolar(c, crearCambio('c2', 'v2'));
    c = encolar(c, borrarVehiculo('v1'));

    // Queda el cambio del OTRO vehículo y el delete.
    expect(c.map((e) => e.op.op)).toEqual(['CREATE_OIL_CHANGE', 'DELETE_VEHICLE']);
    expect((c[0].op as { vehicleId: string }).vehicleId).toBe('v2');
  });

  it('las ops de vehículos distintos conservan su orden', () => {
    let c = encolar(vacia, crearVehiculo('v1'));
    c = encolar(c, crearVehiculo('v2'));
    c = encolar(c, editarVehiculo('v2', { color: '#000000' }));

    expect(c.map((e) => e.op.id)).toEqual(['v1', 'v2']);
  });
});

describe('cabeza y salida', () => {
  it('cabeza devuelve la primera, que es la más vieja', () => {
    let c = encolar(vacia, crearVehiculo('v1'));
    c = encolar(c, crearVehiculo('v2'));
    expect(cabeza(c)?.op.id).toBe('v1');
  });

  it('cabeza de una cola vacía es null', () => {
    expect(cabeza(vacia)).toBeNull();
  });

  it('sacar quita exactamente esa operación', () => {
    let c = encolar(vacia, crearVehiculo('v1'));
    c = encolar(c, crearVehiculo('v2'));
    c = sacar(c, c[0].op);
    expect(c.map((e) => e.op.id)).toEqual(['v2']);
  });

  it('marcarIntento sube el contador sin mover la op de lugar', () => {
    let c = encolar(vacia, crearVehiculo('v1'));
    c = encolar(c, crearVehiculo('v2'));
    c = marcarIntento(c, c[0].op);

    expect(c[0].intentos).toBe(1);
    expect(c[0].op.id).toBe('v1');
  });
});

describe('esperaMs', () => {
  it('crece con los intentos y se estanca en un minuto', () => {
    expect(esperaMs(0)).toBe(1_000);
    expect(esperaMs(1)).toBe(4_000);
    expect(esperaMs(2)).toBe(15_000);
    expect(esperaMs(3)).toBe(60_000);
    expect(esperaMs(10)).toBe(60_000);
  });
});
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `npm test -- queue.test`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Implementar**

```ts
// app-mobile/src/data/sync/queue.ts
// La cola de escrituras pendientes.
//
// PURA a propósito, igual que home/layout.ts: acá vive toda la decisión de qué
// se envía, en qué orden y qué se colapsa contra qué, y eso se prueba con una
// tabla de casos en vez de simulando una red que falla.
import type { NewOilChangeInput, NewVehicleInput } from '../types';

export type QueueOp =
  | { op: 'CREATE_VEHICLE'; id: string; payload: NewVehicleInput }
  | { op: 'UPDATE_VEHICLE'; id: string; payload: Partial<NewVehicleInput> }
  | { op: 'DELETE_VEHICLE'; id: string }
  | {
      op: 'CREATE_OIL_CHANGE';
      id: string;
      vehicleId: string;
      payload: NewOilChangeInput;
    }
  | { op: 'UPDATE_OIL_CHANGE'; id: string; payload: Partial<NewOilChangeInput> }
  | { op: 'DELETE_OIL_CHANGE'; id: string }
  | { op: 'REPORT_ODOMETER'; id: string; vehicleId: string; km: number };

export type QueueEntry = {
  op: QueueOp;
  /** Para la espera creciente y para detectar la que nunca sale. */
  intentos: number;
  encoladaEn: string;
};

const esDeVehiculo = (e: QueueEntry, vehicleId: string): boolean =>
  ('vehicleId' in e.op && e.op.vehicleId === vehicleId) ||
  (e.op.op === 'CREATE_VEHICLE' && e.op.id === vehicleId) ||
  (e.op.op === 'UPDATE_VEHICLE' && e.op.id === vehicleId);

export function encolar(cola: QueueEntry[], op: QueueOp): QueueEntry[] {
  // Borrar algo que todavía no se creó: las dos operaciones se anulan. Mandar
  // el DELETE de un id que el servidor nunca vio es un 404 garantizado.
  if (op.op === 'DELETE_VEHICLE') {
    const pendienteCrear = cola.some(
      (e) => e.op.op === 'CREATE_VEHICLE' && e.op.id === op.id,
    );
    // Sus cambios pendientes se descartan igual: el cascade del backend los
    // haría irrelevantes.
    const resto = cola.filter((e) => !esDeVehiculo(e, op.id));
    return pendienteCrear ? resto : [...resto, nuevaEntrada(op)];
  }

  if (op.op === 'DELETE_OIL_CHANGE') {
    const pendienteCrear = cola.some(
      (e) => e.op.op === 'CREATE_OIL_CHANGE' && e.op.id === op.id,
    );
    const resto = cola.filter((e) => e.op.id !== op.id);
    return pendienteCrear ? resto : [...resto, nuevaEntrada(op)];
  }

  // Editar algo que todavía no se creó (o que ya tenía una edición pendiente):
  // se fusiona el patch en la operación que ya está en la cola, y se envía una
  // sola vez, con los valores finales.
  if (op.op === 'UPDATE_VEHICLE' || op.op === 'UPDATE_OIL_CHANGE') {
    const i = cola.findIndex(
      (e) =>
        e.op.id === op.id &&
        'payload' in e.op &&
        (e.op.op.startsWith('CREATE') || e.op.op === op.op),
    );
    if (i !== -1) {
      const previa = cola[i];
      const fusionada = {
        ...previa,
        op: {
          ...previa.op,
          payload: {
            ...(previa.op as { payload: object }).payload,
            ...op.payload,
          },
        } as QueueOp,
      };
      return [...cola.slice(0, i), fusionada, ...cola.slice(i + 1)];
    }
  }

  return [...cola, nuevaEntrada(op)];
}

const nuevaEntrada = (op: QueueOp): QueueEntry => ({
  op,
  intentos: 0,
  encoladaEn: new Date().toISOString(),
});

/** La más vieja: la cola es FIFO estricto. Enviar en paralelo dejaría llegar
 *  un cambio de aceite antes que el vehículo que lo contiene. */
export function cabeza(cola: QueueEntry[]): QueueEntry | null {
  return cola[0] ?? null;
}

export function sacar(cola: QueueEntry[], op: QueueOp): QueueEntry[] {
  return cola.filter((e) => !(e.op.op === op.op && e.op.id === op.id));
}

export function marcarIntento(cola: QueueEntry[], op: QueueOp): QueueEntry[] {
  return cola.map((e) =>
    e.op.op === op.op && e.op.id === op.id
      ? { ...e, intentos: e.intentos + 1 }
      : e,
  );
}

const ESPERAS = [1_000, 4_000, 15_000, 60_000];

/** Espera creciente, con techo de un minuto: sin techo, tras un día sin señal
 *  el próximo reintento caería dentro de varias horas. */
export function esperaMs(intentos: number): number {
  return ESPERAS[Math.min(intentos, ESPERAS.length - 1)];
}
```

`app-mobile/src/data/types.ts` declara `NewVehicleInput` y `NewOilChangeInput`,
espejo de los DTOs del backend.

- [ ] **Step 4: Correr los tests**

Run: `npm test -- queue.test`
Expected: PASS, 11 tests.

- [ ] **Step 5: Commit**

```bash
git add app-mobile/src/data
git commit -m "feat(flota): cola de escrituras con colapso de operaciones"
```

---

### Task 8: El runner

**Files:**
- Create: `app-mobile/src/data/sync/runner.ts`
- Test: `app-mobile/src/data/sync/__tests__/runner.test.ts`

**Interfaces:**
- Consumes: `queue.ts`, `oilStatusController` y el controlador de vehículos.
- Produces: `clasificarFallo(e): 'transitorio' | 'permanente' | 'sesion'`, `drenar(deps): Promise<DrenajeResultado>`.

La clasificación del fallo es la regla más importante del diseño: sin ella, un
solo registro inválido bloquea para siempre todo lo que venga detrás.

- [ ] **Step 1: Escribir los tests que fallan**

```ts
import { ApiError } from '../../../api/base';
import { clasificarFallo } from '../runner';

describe('clasificarFallo', () => {
  it('sin red es transitorio', () => {
    expect(clasificarFallo(new ApiError(0, 'NETWORK', 'sin red'))).toBe(
      'transitorio',
    );
  });

  it.each([500, 502, 503, 504])('%i es transitorio', (status) => {
    expect(clasificarFallo(new ApiError(status, 'SERVER', 'x'))).toBe(
      'transitorio',
    );
  });

  it('429 es transitorio: hay que esperar, no descartar', () => {
    expect(clasificarFallo(new ApiError(429, 'THROTTLED', 'x'))).toBe(
      'transitorio',
    );
  });

  it.each([
    [422, 'OIL_CHANGE_BACKWARDS'],
    [409, 'PLATE_TAKEN'],
    [404, 'VEHICLE_NOT_FOUND'],
    [400, 'VALIDATION'],
  ])('%i %s es permanente', (status, code) => {
    // Reintentarlo mil veces da mil veces el mismo error y traba la cola.
    expect(clasificarFallo(new ApiError(status, code, 'x'))).toBe('permanente');
  });

  it('401 es de sesión: pausa la cola, no descarta', () => {
    expect(clasificarFallo(new ApiError(401, 'TOKEN_EXPIRED', 'x'))).toBe(
      'sesion',
    );
  });
});

describe('drenar', () => {
  it('un fallo transitorio deja la op en la cola y sube intentos', async () => { /* … */ });
  it('un fallo permanente saca la op y marca el registro como rechazado', async () => { /* … */ });
  it('un 401 pausa la cola entera sin descartar nada', async () => { /* … */ });
  it('el 200 de un create ya guardado se trata como éxito', async () => { /* … */ });
  it('envía de a una, en orden', async () => { /* … */ });
});
```

Los cinco casos de `drenar` se escriben con un doble del cliente API
(`{ crearVehiculo: jest.fn(), … }`) inyectado por parámetro: `drenar` recibe sus
dependencias en vez de importarlas, justamente para que el test no tenga que
mockear módulos.

- [ ] **Step 2: Correr y verificar que falla**

Run: `npm test -- runner.test`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Implementar**

```ts
// app-mobile/src/data/sync/runner.ts
// Drena la cola contra la API.
//
// Toda la gracia está en clasificar el fallo. Un error de red hay que
// reintentarlo; un 422 no: reintentarlo mil veces da mil veces el mismo error
// y deja trabado todo lo que venga detrás. Sin esta distinción, un solo
// registro inválido congela la sincronización del usuario para siempre.
import { ApiError } from '../../api/base';

export type TipoFallo = 'transitorio' | 'permanente' | 'sesion';

export function clasificarFallo(e: unknown): TipoFallo {
  if (!(e instanceof ApiError)) return 'transitorio';
  if (e.status === 401) return 'sesion';
  // status 0 es "no salió de acá": sin red o timeout.
  if (e.status === 0 || e.status === 429 || e.status >= 500) {
    return 'transitorio';
  }
  return 'permanente';
}
```

`drenar(deps)` toma la cabeza, la envía según `op.op`, y según el resultado:
éxito → `sacar`; `transitorio` → `marcarIntento` y frenar hasta `esperaMs`;
`permanente` → `sacar` y llamar a `deps.marcarRechazado(op, code)`; `sesion` →
frenar sin tocar la cola y devolver `{ pausada: true }`.

- [ ] **Step 4: Correr los tests**

Run: `npm test -- runner.test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app-mobile/src/data
git commit -m "feat(flota): runner de la cola con clasificación de fallos"
```

---

### Task 9: Persistencia local

**Files:**
- Create: `app-mobile/src/data/local/store.ts`
- Test: `app-mobile/src/data/local/__tests__/store.test.ts`

**Interfaces:**
- Consumes: `expo-sqlite/kv-store` (el mismo que ya usa `homeLayout`).
- Produces: `guardarFlota`, `leerFlota`, `guardarCola`, `leerCola`, `guardarEstado`, `leerEstado`, todos `Promise`.

- [ ] **Step 1: Escribir los tests que fallan**

Con el mock de `expo-sqlite/kv-store` que ya existe en `jest.setup.js` (o
agregándolo si no está):

```ts
describe('persistencia local', () => {
  it('lo guardado vuelve igual', async () => { /* … */ });
  it('leer sin nada guardado devuelve el vacío, no explota', async () => { /* … */ });
  it('un JSON corrupto devuelve el vacío en vez de tirar la app', async () => {
    // Lo mismo que hace reconcile con el layout: el almacenamiento puede venir
    // roto y eso no puede ser una pantalla blanca.
  });
  it('las fechas vuelven como Date y no como string', async () => {
    // JSON.parse no revive Date: sin esto, todo cálculo con changedAt falla
    // silenciosamente.
  });
});
```

- [ ] **Step 2 a 5:** correr (falla) → implementar con `AsyncStorage.getItem` /
`setItem` bajo las claves `ruedalo:flota`, `ruedalo:cola` y
`ruedalo:estado:<vehicleId>`, con `try/catch` que devuelve el vacío y un
reviver que convierte las claves de fecha conocidas (`changedAt`, `readAt`,
`computedAt`, `lastChangeAt`, `nextChangeDueAt`, `asOf`) a `Date` → correr
(pasa) → commit.

```bash
git commit -m "feat(flota): persistencia local de flota, cola y estado"
```

---

### Task 10: El store de vehículos

**Files:**
- Create: `app-mobile/src/store/useVehicles.ts`
- Test: `app-mobile/src/store/__tests__/useVehicles.test.ts`

**Interfaces:**
- Consumes: Tasks 6 a 9, y el controlador de vehículos de la API.
- Produces: `useVehicles()` con `{ vehicles, hydrated, syncing, addVehicle, updateVehicle, removeVehicle, refresh }`, y `useActiveVehicle()`.

- [ ] **Step 1: Escribir los tests que fallan**

```ts
describe('useVehicles', () => {
  it('hidrata de local antes de que responda la red', async () => { /* … */ });
  it('al refrescar, lo de la red reemplaza lo local y se persiste', async () => { /* … */ });
  it('addVehicle actualiza la UI al instante y encola', async () => { /* … */ });
  it('si la red falla, el vehículo sigue en la lista, marcado como pendiente', async () => { /* … */ });
  it('removeVehicle lo saca de la UI al instante', async () => { /* … */ });
  it('el vehículo activo sobrevive a un refresco', async () => { /* … */ });
  it('si se borra el activo, el puntero se mueve al primero que quede', async () => {
    // El bug que ya resolvió useStore.removeVehicle: sin esto el inicio pide
    // un vehículo que ya no está.
  });
});
```

- [ ] **Step 2 a 5:** correr (falla) → implementar el store con `persist` de
zustand, mismo patrón que `homeLayout` (hidrata → pinta → refresca → guarda) →
correr (pasa) → commit.

```bash
git commit -m "feat(flota): store de vehículos con caché local y cola"
```

---

# FASE C — Las pantallas

### Task 11: Flota y detalle

**Files:**
- Modify: `app-mobile/src/screens/VehiclesScreen.tsx`, `VehicleDetailScreen.tsx`, `AddVehicleFormScreen.tsx`, `EditVehicleScreen.tsx`, `src/store/useStore.ts`

**Interfaces:**
- Consumes: `useVehicles` (Task 10).
- Produces: nada nuevo. `MOCK_FLEET` deja de cargarse.

- [ ] **Step 1: Cambiar la fuente de datos**

Las cuatro pantallas pasan de `useStore((s) => s.vehicles)` a `useVehicles()`.
`VehiclesScreen` y `VehicleDetailScreen` leen `v.gauge.pct` y `v.gauge.status`
del backend en vez de llamar a `oilPct(v)` y `vehicleStatus(v)`.

- [ ] **Step 2: Agregar el campo de uso declarado en el alta**

En `AddVehicleFormScreen`, un campo en lenguaje llano ("¿Cuánto manejas
normalmente?") en km/mes, que se convierte antes de enviarse:

```ts
// El backend piensa en km/día porque es la unidad de la proyección; al usuario
// se le pregunta en km/mes, que es como la gente sabe cuánto maneja.
const kmPorDia = Math.round((kmPorMes / 30) * 100) / 100;
```

Se valida contra `[1, 500]` en el cliente, igual que el DTO, así el error se ve
antes de viajar.

- [ ] **Step 3: Marcar lo pendiente y lo rechazado**

Un vehículo con operaciones en la cola lleva un punto discreto; uno `rechazado`
muestra el motivo y dos salidas, corregir o descartar. Nada desaparece en
silencio.

- [ ] **Step 4: Verificar**

Run: `npm test && npx tsc --noEmit`
Expected: PASS. `useStore` conserva `oilPct`, `kmLeft` y `vehicleStatus`: los
borra la Task 14.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(flota): la flota y el detalle leen del backend"
```

---

### Task 12: La tarjeta única del inicio

Es la **Task 14 del plan anterior**, ahora ejecutable porque los ids son reales.
Sus pasos, el código del widget y el ajuste de `OilGauge` están en
`backend-oil-app/docs/superpowers/plans/2026-09-19-estado-del-aceite.md`, con
dos correcciones:

- El hook usa `oilStatusController.status(id)`, no `.get(id)` — `get` es el
  verbo protegido de `ApiClient`.
- El widget suma la línea de antigüedad cuando `computedAt` pasa de 24 h.

- [ ] **Step 1: Test de migración del layout** (el del plan anterior, más la
  actualización de los tres tests existentes que afirman los ids viejos:
  `layout.test.ts` líneas 163, 220, 225 y 227, y `homeLayout.test.ts` 20 y 43).
- [ ] **Step 2:** correr y verificar que falla.
- [ ] **Step 3:** `layout.ts` — `oilStatus` reemplaza a `gauge` y `techReadout`
  en `WidgetId` y `PINNED_WIDGETS`. `reconcile` hace la migración sola: descarta
  los ids desconocidos y, por ser fijo, `oilStatus` entra primero.
- [ ] **Step 4:** `OilStatusWidget`, `useOilStatus`, `OilGauge` por props,
  `registry.tsx` con una entrada, y borrar `GaugeWidget` y `TechReadoutWidget`.
- [ ] **Step 5:** `npm test && npx tsc --noEmit`.
- [ ] **Step 6:** commit — `feat(aceite): una sola tarjeta con medidor, odómetro, próximo y aceite`.

---

### Task 13: Registrar cambio y lectura del odómetro

Son las **Tasks 15 y 16 del plan anterior**: el campo de intervalo en meses en
`AddOilScreen` (precargado con lo que el usuario mismo usó en el ciclo anterior)
y `ReportOdometerScreen`, con su ruta en `RootStackParamList`. El código
completo de la pantalla está en aquel plan.

Se suma acá: `AddOilScreen` genera el id con `nuevoId()` y escribe por
`useVehicles`, así registrar un cambio funciona sin señal — que es el caso de
uso que motivó toda la tanda.

- [ ] **Step 1:** ruta `ReportOdometer` en `navigation/types.ts`.
- [ ] **Step 2:** `ReportOdometerScreen` y su registro en el stack.
- [ ] **Step 3:** campo de meses en `AddOilScreen` + `nuevoId()` + escritura por el store.
- [ ] **Step 4:** `npm test && npx tsc --noEmit`.
- [ ] **Step 5:** commit — `feat(aceite): intervalo en meses y lectura manual del odómetro`.

---

### Task 14: El resto de las pantallas, y borrar los selectores

**Files:**
- Modify: `app-mobile/src/screens/AlertsScreen.tsx`, `HistoryScreen.tsx`, `src/home/widgets/OpenAlertsWidget.tsx`, `RecentHistoryWidget.tsx`, `src/notifications/plan.ts`, `src/store/useStore.ts`
- Test: `app-mobile/src/notifications/__tests__/plan.test.ts`

**Interfaces:**
- Consumes: el `gauge` que ya traen los vehículos (Task 5) y el historial (Task 3).
- Produces: nada. Se **eliminan** `oilPct`, `kmLeft` y `vehicleStatus`.

Es la tarea que cierra el círculo: cuando termina, existe **una sola**
definición de la vida del aceite en todo el producto.

- [ ] **Step 1: Migrar los consumidores**

`AlertsScreen` y `OpenAlertsWidget` filtran por `v.gauge.status` en vez de
`vehicleStatus(v)`, y muestran `v.gauge.kmLeft`. `HistoryScreen` y
`RecentHistoryWidget` leen el historial paginado del backend.

- [ ] **Step 2: Migrar `notifications/plan.ts`**

Hoy usa `kmLeft(v)`. Pasa a `v.gauge.kmLeft`, y **sus tests se actualizan** para
construir vehículos con `gauge` en vez de con `nextChange`/`km`. Son 10 casos
([plan.test.ts](../../src/notifications/__tests__/plan.test.ts)) y hay que
mantenerlos todos: cubren los bordes exactos del umbral de aviso.

- [ ] **Step 3: Borrar los selectores**

Recién ahora, de `src/store/useStore.ts`:

```ts
export const kmLeft = …
export const oilPct = …
export const vehicleStatus = …
```

Y con ellos, la línea 125 que cuenta alertas abiertas, que pasa a contar por
`gauge.status`.

- [ ] **Step 4: Verificar que no queda ninguna referencia**

Run: `grep -rn "oilPct\|vehicleStatus\|kmLeft(" app-mobile/src --include=*.ts --include=*.tsx | grep -v oil-status.controller`
Expected: sin resultados (salvo el tipo `kmLeft` del bloque de la API).

- [ ] **Step 5: Correr todo**

Run: `npm test && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git commit -m "refactor(aceite): una sola definición de la vida del aceite en toda la app"
```
