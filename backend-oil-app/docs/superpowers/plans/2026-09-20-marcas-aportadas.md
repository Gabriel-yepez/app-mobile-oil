# Marcas aportadas por los usuarios — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el selector de marca deje de ser una lista fija de 18 valores y pase a ser un catálogo en el backend que cualquier usuario puede enriquecer, visible de inmediato para todos.

**Architecture:** Tabla `Brand` en el backend con índice único sobre `(kind, nameKey)`, donde `nameKey` es el nombre normalizado. `POST /brands` es idempotente por `nameKey` y por `id`. En la app, un store `useBrands` con caché local y cola propia (reusando las funciones puras `encolar` y `drenar`), y el primitivo `Select` gana búsqueda y una fila "Agregar «X»".

**Tech Stack:** NestJS 11, Prisma 7.10 con `@prisma/adapter-pg`, PostgreSQL, Jest 30 + ts-jest, supertest. Expo / React Native, Zustand, Tamagui, `expo-sqlite/kv-store`.

**Spec:** `backend-oil-app/docs/superpowers/specs/2026-09-20-marcas-aportadas-design.md`

## Global Constraints

- **Largo del nombre: 1 a 40 caracteres.** Igual que `Vehicle.brand`, para que no entre al catálogo una marca que después no cabe en un vehículo.
- **Charset permitido:** letras (incluidas acentuadas), números, espacio, punto, guion y `&`. Obligado a empezar con letra o número. Patrón exacto: `/^[\p{L}\p{N}][\p{L}\p{N} .\-&]*$/u`
- **Tope: 5 marcas nuevas por usuario cada 24 horas.** Cuenta filas efectivamente creadas, no peticiones.
- **`nameKey`** = quitar acentos → mayúsculas → borrar todo lo que no sea `A-Z0-9`.
- **`name` se guarda tal como lo escribió el usuario**, solo con espacios recortados y colapsados. Nunca Title Case: rompería `MD`, `AVA`, `BMW`.
- **Índice único sobre `(kind, nameKey)`, nunca sobre `nameKey` solo.** Honda, Suzuki y Yamaha son marcas de carro y de moto a la vez, y son filas independientes.
- **`Vehicle.brand` sigue siendo texto suelto.** No se convierte en referencia al catálogo: de eso depende que el alta funcione sin señal.
- **Sin endpoint de borrado.** Es una operación manual por `pnpm db:studio`.
- El dominio nunca importa `@prisma/client`. Los tipos de Prisma se traducen en el repositorio (`toDomain`).
- Los servicios piden el `Symbol` del repositorio, nunca la clase concreta.
- Los tests e2e usan `emailE2E()` y `limpiarUsuariosE2E()` de `test/support/e2e-db.ts`.

**Las 18 marcas semilla** (valores exactos, se usan en la migración y en el store de la app):

- CAR: `Toyota`, `Chevrolet`, `Ford`, `Hyundai`, `Kia`, `Renault`, `Fiat`, `Jeep`, `Nissan`, `Mitsubishi`
- MOTO: `Bera`, `Empire Keeway`, `MD`, `Yamaha`, `Suzuki`, `Honda`, `AVA`, `Skygo`

---

## Backend

### Task 1: Normalización y validación del nombre

Funciones puras, sin base de datos. Son la base de todo lo demás: el índice único, la deduplicación y la validación salen de acá.

**Files:**
- Create: `backend-oil-app/src/modules/brands/domain/brand-name.ts`
- Test: `backend-oil-app/src/modules/brands/domain/brand-name.spec.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `claveDeMarca(nombre: string): string`, `normalizarNombre(nombre: string): string`, `nombreValido(nombre: string): boolean`, `LARGO_MAX = 40`.

- [ ] **Step 1: Write the failing test**

Crear `backend-oil-app/src/modules/brands/domain/brand-name.spec.ts`:

```ts
// TABLA COMPARTIDA: estos mismos casos están duplicados en
// app-mobile/src/data/marcas/__tests__/nombre.test.ts. Si cambiás uno,
// cambiá el otro — que las dos normalizaciones no diverjan es justamente
// lo que estos casos protegen.
import {
  claveDeMarca,
  nombreValido,
  normalizarNombre,
} from './brand-name';

describe('claveDeMarca', () => {
  it.each([
    ['  toyota ', 'TOYOTA'],
    ['TOYOTA', 'TOYOTA'],
    ['Toyotá', 'TOYOTA'],
    ['Empire Keeway', 'EMPIREKEEWAY'],
    ['Mercedes-Benz', 'MERCEDESBENZ'],
    ['B.M.W.', 'BMW'],
    ['MD', 'MD'],
  ])('%s → %s', (entrada, esperado) => {
    expect(claveDeMarca(entrada)).toBe(esperado);
  });

  it('colapsa a la misma clave las variantes de una misma marca', () => {
    expect(claveDeMarca('toyota')).toBe(claveDeMarca('  TOYOTÁ  '));
  });
});

describe('normalizarNombre', () => {
  it('recorta los extremos y colapsa los espacios internos', () => {
    expect(normalizarNombre('  Empire   Keeway ')).toBe('Empire Keeway');
  });

  it('NO cambia la capitalización: rompería los acrónimos reales', () => {
    expect(normalizarNombre('MD')).toBe('MD');
    expect(normalizarNombre('AVA')).toBe('AVA');
    expect(normalizarNombre('chery')).toBe('chery');
  });
});

describe('nombreValido', () => {
  it.each(['Toyota', 'Mercedes-Benz', 'B.M.W.', 'MD', 'Empire Keeway', 'BYD & Co'])(
    'acepta %s',
    (n) => {
      expect(nombreValido(n)).toBe(true);
    },
  );

  it.each([
    ['', 'vacío'],
    ['   ', 'solo espacios'],
    ['-Toyota', 'arranca con símbolo'],
    [' .Toyota', 'arranca con símbolo tras recortar'],
    ['http://spam.com', 'URL'],
    ['a'.repeat(41), '41 caracteres'],
    ['Toyota\u202Eoo', 'override RTL'],
    ['Toyo\u0000ta', 'byte nulo'],
    ['Toyota/Chevrolet', 'barra'],
    ['<b>Toyota</b>', 'etiquetas'],
  ])('rechaza %s (%s)', (n) => {
    expect(nombreValido(n)).toBe(false);
  });

  it('acepta exactamente 40 caracteres', () => {
    expect(nombreValido('a'.repeat(40))).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend-oil-app && npx jest src/modules/brands/domain/brand-name.spec.ts
```

Expected: FAIL — `Cannot find module './brand-name'`.

- [ ] **Step 3: Write minimal implementation**

Crear `backend-oil-app/src/modules/brands/domain/brand-name.ts`:

```ts
// El nombre de una marca, sin Prisma y sin Nest. Tres funciones puras que
// deciden qué es la misma marca escrita distinto y qué es texto que no puede
// entrar al catálogo.
//
// OJO: `app-mobile/src/data/marcas/nombre.ts` tiene su propia copia de
// `claveDeMarca`. Es deliberado — no hay paquete compartido entre las dos
// carpetas y montarlo por esto es desproporcionado. La asimetría es explícita:
// la del cliente es una heurística de interfaz, ESTA es la restricción. Si
// divergen, lo peor que pasa es un duplicado visual pasajero en la app; nunca
// una fila duplicada, porque el índice único no lo permite.

export const LARGO_MAX = 40;

// Empieza con letra o número y sigue con letras, números, espacio, punto,
// guion o &. Deja pasar `Mercedes-Benz` y `B.M.W.`; corta URLs (no admite
// `/` ni `:`), saltos de línea y etiquetas.
const PATRON = /^[\p{L}\p{N}][\p{L}\p{N} .\-&]*$/u;

/** Recorta los extremos y colapsa los espacios internos. Nada más: la
 *  capitalización se respeta tal cual, porque `MD` y `AVA` son reales. */
export function normalizarNombre(nombre: string): string {
  return nombre.trim().replace(/\s+/g, ' ');
}

/** La clave canónica: lo que decide si dos textos son la misma marca. */
export function claveDeMarca(nombre: string): string {
  return nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

export function nombreValido(nombre: string): boolean {
  const limpio = normalizarNombre(nombre);
  if (limpio.length === 0 || limpio.length > LARGO_MAX) return false;
  if (!PATRON.test(limpio)) return false;
  // Un nombre cuya clave queda vacía no puede entrar: no habría con qué
  // deduplicarlo y el índice único lo trataría como colisión con cualquier
  // otro igual de vacío.
  return claveDeMarca(limpio).length > 0;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd backend-oil-app && npx jest src/modules/brands/domain/brand-name.spec.ts
```

Expected: PASS, todos los casos.

- [ ] **Step 5: Commit**

```bash
git add backend-oil-app/src/modules/brands/domain/brand-name.ts backend-oil-app/src/modules/brands/domain/brand-name.spec.ts
git commit -m "feat(marcas): normalización y validación del nombre de marca"
```

---

### Task 2: Tabla Brand y siembra de las 18 actuales

**Files:**
- Modify: `backend-oil-app/prisma/schema.prisma`
- Create: `backend-oil-app/prisma/migrations/<timestamp>_brands/migration.sql` (lo genera Prisma; después se le agrega la siembra a mano)

**Interfaces:**
- Consumes: el enum `VehicleKind` que ya existe en el schema.
- Produces: el modelo Prisma `Brand` con campos `id, kind, name, nameKey, createdBy, createdAt`.

- [ ] **Step 1: Agregar el modelo al schema**

En `backend-oil-app/prisma/schema.prisma`, al final:

```prisma
/// Catálogo de marcas. Lo siembran las 18 originales y lo enriquecen los
/// usuarios. `Vehicle.brand` NO apunta acá: sigue siendo texto suelto, y de
/// eso depende que dar de alta un vehículo funcione sin señal.
model Brand {
  id        String      @id @default(uuid())
  kind      VehicleKind
  name      String      @db.VarChar(40)
  /// Nombre normalizado. Es lo que decide si dos textos son la misma marca.
  nameKey   String      @db.VarChar(40)
  /// null = semilla. No es relación a User a propósito: si se borra la cuenta
  /// que aportó una marca, la marca sobrevive porque ya es del catálogo común.
  createdBy String?
  createdAt DateTime    @default(now())

  /// Compuesto con `kind`, nunca `nameKey` solo: Honda, Suzuki y Yamaha son
  /// marcas de carro Y de moto, y deben ser filas independientes.
  @@unique([kind, nameKey])
  @@index([kind, name])
}
```

- [ ] **Step 2: Generar la migración**

```bash
cd backend-oil-app && npx prisma migrate dev --name brands --create-only
```

Expected: crea `prisma/migrations/<timestamp>_brands/migration.sql` con el `CREATE TABLE` y los dos índices, sin aplicarla todavía.

- [ ] **Step 3: Agregar la siembra al SQL de la migración**

Al final del `migration.sql` recién generado, pegar:

```sql
-- Las 18 marcas con las que la app venía funcionando. `createdBy` en NULL las
-- marca como semilla: no cuentan contra el tope diario de nadie.
INSERT INTO "Brand" ("id", "kind", "name", "nameKey", "createdBy", "createdAt") VALUES
  (gen_random_uuid(), 'CAR',  'Toyota',        'TOYOTA',       NULL, NOW()),
  (gen_random_uuid(), 'CAR',  'Chevrolet',     'CHEVROLET',    NULL, NOW()),
  (gen_random_uuid(), 'CAR',  'Ford',          'FORD',         NULL, NOW()),
  (gen_random_uuid(), 'CAR',  'Hyundai',       'HYUNDAI',      NULL, NOW()),
  (gen_random_uuid(), 'CAR',  'Kia',           'KIA',          NULL, NOW()),
  (gen_random_uuid(), 'CAR',  'Renault',       'RENAULT',      NULL, NOW()),
  (gen_random_uuid(), 'CAR',  'Fiat',          'FIAT',         NULL, NOW()),
  (gen_random_uuid(), 'CAR',  'Jeep',          'JEEP',         NULL, NOW()),
  (gen_random_uuid(), 'CAR',  'Nissan',        'NISSAN',       NULL, NOW()),
  (gen_random_uuid(), 'CAR',  'Mitsubishi',    'MITSUBISHI',   NULL, NOW()),
  (gen_random_uuid(), 'MOTO', 'Bera',          'BERA',         NULL, NOW()),
  (gen_random_uuid(), 'MOTO', 'Empire Keeway', 'EMPIREKEEWAY', NULL, NOW()),
  (gen_random_uuid(), 'MOTO', 'MD',            'MD',           NULL, NOW()),
  (gen_random_uuid(), 'MOTO', 'Yamaha',        'YAMAHA',       NULL, NOW()),
  (gen_random_uuid(), 'MOTO', 'Suzuki',        'SUZUKI',       NULL, NOW()),
  (gen_random_uuid(), 'MOTO', 'Honda',         'HONDA',        NULL, NOW()),
  (gen_random_uuid(), 'MOTO', 'AVA',           'AVA',          NULL, NOW()),
  (gen_random_uuid(), 'MOTO', 'Skygo',         'SKYGO',        NULL, NOW());
```

- [ ] **Step 4: Aplicar la migración y REGENERAR EL CLIENTE**

```bash
cd backend-oil-app && npx prisma migrate dev && pnpm db:generate
```

`pnpm db:generate` **no es opcional**: bajo pnpm, `prisma migrate dev` no regenera el cliente, y sin ese paso el build falla con 20 errores `TS2339: Property 'brand' does not exist on type 'PrismaService'`. Ya pasó una vez en este proyecto.

- [ ] **Step 5: Verificar la siembra**

```bash
docker exec ruedalo-db psql -U ruedalo -d ruedalo -c \
  'select kind, count(*) from "Brand" group by kind order by kind;'
```

Expected: `CAR | 10` y `MOTO | 8`.

- [ ] **Step 6: Commit**

```bash
git add backend-oil-app/prisma/schema.prisma backend-oil-app/prisma/migrations
git commit -m "feat(marcas): tabla Brand sembrada con las 18 marcas actuales"
```

---

### Task 3: Repositorio de marcas

Interfaz de dominio + token + implementación Prisma + doble en memoria, igual que `VehicleRepository`.

`createIfAbsent` existe porque dos peticiones simultáneas con el mismo `nameKey` pasan las dos el chequeo previo y una choca contra el índice único. Ese choque se atrapa **en la frontera de Prisma**, para que el servicio no tenga que conocer códigos de error de Prisma.

**Files:**
- Create: `backend-oil-app/src/modules/brands/domain/brand.repository.ts`
- Create: `backend-oil-app/src/infra/prisma/prisma-brand.repository.ts`
- Create: `backend-oil-app/src/modules/brands/testing/in-memory-brand.repository.ts`

**Interfaces:**
- Consumes: `VehicleKind` de `../../oil/domain/vehicle.repository`.
- Produces: `BRAND_REPOSITORY` (Symbol), tipos `Brand` y `NewBrand`, interfaz `BrandRepository` con `findByKind`, `findById`, `findByKindAndKey`, `countCreatedBy`, `createIfAbsent`. Clases `PrismaBrandRepository` e `InMemoryBrandRepository`.

- [ ] **Step 1: Escribir la interfaz de dominio**

Crear `backend-oil-app/src/modules/brands/domain/brand.repository.ts`:

```ts
// La marca como la entiende el negocio. Sin tipos de Prisma.
import type { VehicleKind } from '../../oil/domain/vehicle.repository';

export const BRAND_REPOSITORY = Symbol('BRAND_REPOSITORY');

export type Brand = {
  id: string;
  kind: VehicleKind;
  name: string;
  nameKey: string;
  /** null = semilla. */
  createdBy: string | null;
  createdAt: Date;
};

export type NewBrand = {
  /** Lo genera la app, para poder crear sin señal. */
  id?: string;
  kind: VehicleKind;
  name: string;
  nameKey: string;
  createdBy: string;
};

export interface BrandRepository {
  /** Ordenadas por `name`. */
  findByKind(kind: VehicleKind): Promise<Brand[]>;
  findById(id: string): Promise<Brand | null>;
  findByKindAndKey(kind: VehicleKind, nameKey: string): Promise<Brand | null>;
  /** Cuántas creó ese usuario desde `desde`. Para el tope diario. */
  countCreatedBy(userId: string, desde: Date): Promise<number>;
  /**
   * Inserta, o devuelve la que ya estaba si otra petición ganó la carrera.
   *
   * La carrera es real: dos usuarios agregando "Chery" a la vez pasan los dos
   * el chequeo previo del servicio. Que se resuelva acá y no en el servicio es
   * a propósito — atrapar la violación del índice único requiere conocer el
   * código de error del motor, y eso no puede salir de la frontera.
   */
  createIfAbsent(data: NewBrand): Promise<{ brand: Brand; created: boolean }>;
}
```

- [ ] **Step 2: Escribir el doble en memoria**

Crear `backend-oil-app/src/modules/brands/testing/in-memory-brand.repository.ts`:

```ts
// Doble en memoria con las MISMAS garantías que el de Prisma, incluida la
// unicidad de (kind, nameKey). Si el doble deja pasar un duplicado, los tests
// del servicio pasan y producción falla.
import { randomUUID } from 'node:crypto';
import type {
  Brand,
  BrandRepository,
  NewBrand,
} from '../domain/brand.repository';
import type { VehicleKind } from '../../oil/domain/vehicle.repository';

export class InMemoryBrandRepository implements BrandRepository {
  readonly filas: Brand[] = [];

  /** Para sembrar en los tests sin pasar por createIfAbsent. */
  sembrar(kind: VehicleKind, name: string, nameKey: string): Brand {
    const brand: Brand = {
      id: randomUUID(),
      kind,
      name,
      nameKey,
      createdBy: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    };
    this.filas.push(brand);
    return brand;
  }

  findByKind(kind: VehicleKind): Promise<Brand[]> {
    return Promise.resolve(
      this.filas
        .filter((b) => b.kind === kind)
        .sort((a, b) => a.name.localeCompare(b.name, 'es')),
    );
  }

  findById(id: string): Promise<Brand | null> {
    return Promise.resolve(this.filas.find((b) => b.id === id) ?? null);
  }

  findByKindAndKey(kind: VehicleKind, nameKey: string): Promise<Brand | null> {
    return Promise.resolve(
      this.filas.find((b) => b.kind === kind && b.nameKey === nameKey) ?? null,
    );
  }

  countCreatedBy(userId: string, desde: Date): Promise<number> {
    return Promise.resolve(
      this.filas.filter((b) => b.createdBy === userId && b.createdAt >= desde)
        .length,
    );
  }

  createIfAbsent(data: NewBrand): Promise<{ brand: Brand; created: boolean }> {
    const ya = this.filas.find(
      (b) => b.kind === data.kind && b.nameKey === data.nameKey,
    );
    if (ya) return Promise.resolve({ brand: ya, created: false });

    const brand: Brand = {
      id: data.id ?? randomUUID(),
      kind: data.kind,
      name: data.name,
      nameKey: data.nameKey,
      createdBy: data.createdBy,
      createdAt: new Date(),
    };
    this.filas.push(brand);
    return Promise.resolve({ brand, created: true });
  }
}
```

- [ ] **Step 3: Escribir la implementación de Prisma**

Crear `backend-oil-app/src/infra/prisma/prisma-brand.repository.ts`:

```ts
// Frontera con Prisma. Entra y sale el tipo de DOMINIO.
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Brand as PrismaBrand } from '@prisma/client';
import type {
  Brand,
  BrandRepository,
  NewBrand,
} from '../../modules/brands/domain/brand.repository';
import type { VehicleKind } from '../../modules/oil/domain/vehicle.repository';
import { PrismaService } from './prisma.service';

@Injectable()
export class PrismaBrandRepository implements BrandRepository {
  constructor(private readonly prisma: PrismaService) {}

  private toDomain(row: PrismaBrand): Brand {
    return {
      id: row.id,
      kind: row.kind,
      name: row.name,
      nameKey: row.nameKey,
      createdBy: row.createdBy,
      createdAt: row.createdAt,
    };
  }

  async findByKind(kind: VehicleKind): Promise<Brand[]> {
    const rows = await this.prisma.brand.findMany({
      where: { kind },
      orderBy: { name: 'asc' },
    });
    return rows.map((r) => this.toDomain(r));
  }

  async findById(id: string): Promise<Brand | null> {
    const row = await this.prisma.brand.findUnique({ where: { id } });
    return row ? this.toDomain(row) : null;
  }

  async findByKindAndKey(
    kind: VehicleKind,
    nameKey: string,
  ): Promise<Brand | null> {
    const row = await this.prisma.brand.findUnique({
      where: { kind_nameKey: { kind, nameKey } },
    });
    return row ? this.toDomain(row) : null;
  }

  async countCreatedBy(userId: string, desde: Date): Promise<number> {
    return this.prisma.brand.count({
      where: { createdBy: userId, createdAt: { gte: desde } },
    });
  }

  async createIfAbsent(
    data: NewBrand,
  ): Promise<{ brand: Brand; created: boolean }> {
    try {
      const row = await this.prisma.brand.create({
        data: {
          ...(data.id ? { id: data.id } : {}),
          kind: data.kind,
          name: data.name,
          nameKey: data.nameKey,
          createdBy: data.createdBy,
        },
      });
      return { brand: this.toDomain(row), created: true };
    } catch (e) {
      // P2002 = violación de índice único. Otra petición ganó la carrera
      // entre el chequeo del servicio y este insert. No es un error: el
      // resultado que el usuario quería ya existe.
      const esDuplicado =
        e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';
      if (!esDuplicado) throw e;

      const ya = await this.findByKindAndKey(data.kind, data.nameKey);
      // Si el duplicado fue por `id` y no por (kind, nameKey), hay que buscar
      // por id: si no, se devolvería null y el servicio reventaría con un
      // error peor que el original.
      const existente = ya ?? (data.id ? await this.findById(data.id) : null);
      if (!existente) throw e;
      return { brand: existente, created: false };
    }
  }
}
```

- [ ] **Step 4: Verificar que compila**

```bash
cd backend-oil-app && pnpm build
```

Expected: sin errores. Si aparece `Property 'brand' does not exist on type 'PrismaService'`, falta `pnpm db:generate` de la Task 2.

- [ ] **Step 5: Commit**

```bash
git add backend-oil-app/src/modules/brands/domain/brand.repository.ts backend-oil-app/src/modules/brands/testing/in-memory-brand.repository.ts backend-oil-app/src/infra/prisma/prisma-brand.repository.ts
git commit -m "feat(marcas): repositorio de marcas con resolución de carrera en la frontera"
```

---

### Task 4: BrandsService

Toda la lógica: idempotencia por las dos vías, validación y tope diario.

**Files:**
- Create: `backend-oil-app/src/modules/brands/brands.service.ts`
- Create: `backend-oil-app/src/modules/brands/brands.service.spec.ts`
- Modify: `backend-oil-app/src/common/errors.ts`

**Interfaces:**
- Consumes: `BRAND_REPOSITORY`, `BrandRepository`, `Brand` (Task 3); `claveDeMarca`, `normalizarNombre`, `nombreValido` (Task 1).
- Produces: `BrandsService` con `list(kind: VehicleKind): Promise<Brand[]>` y `create(userId: string, input: { id?: string; kind: VehicleKind; name: string }, now?: Date): Promise<{ brand: Brand; created: boolean }>`. Errores `Errors.brandNameInvalid()` y `Errors.brandLimitReached()`.

- [ ] **Step 1: Agregar los dos errores**

En `backend-oil-app/src/common/errors.ts`, dentro del objeto `Errors`:

```ts
  brandNameInvalid: () =>
    new AppError(
      HttpStatus.UNPROCESSABLE_ENTITY,
      'BRAND_NAME_INVALID',
      'Ese nombre de marca no es válido. Usa letras, números, espacios, punto o guion.',
    ),

  // El tope existe porque una marca nueva la ve TODO el mundo de inmediato.
  // Un usuario honesto agrega una cada varios meses; cinco en un día es o un
  // error o alguien probando hasta dónde llega.
  brandLimitReached: () =>
    new AppError(
      HttpStatus.TOO_MANY_REQUESTS,
      'BRAND_LIMIT_REACHED',
      'Agregaste muchas marcas hoy. Intenta de nuevo mañana.',
    ),
```

- [ ] **Step 2: Write the failing test**

Crear `backend-oil-app/src/modules/brands/brands.service.spec.ts`:

```ts
import { InMemoryBrandRepository } from './testing/in-memory-brand.repository';
import { BrandsService } from './brands.service';

const USUARIO = 'user-1';
const AHORA = new Date('2026-09-20T12:00:00.000Z');

function armar() {
  const repo = new InMemoryBrandRepository();
  return { repo, service: new BrandsService(repo) };
}

describe('BrandsService.create', () => {
  it('crea una marca nueva y la marca como creada', async () => {
    const { service } = armar();
    const r = await service.create(
      USUARIO,
      { kind: 'CAR', name: 'Chery' },
      AHORA,
    );
    expect(r.created).toBe(true);
    expect(r.brand.name).toBe('Chery');
    expect(r.brand.nameKey).toBe('CHERY');
    expect(r.brand.createdBy).toBe(USUARIO);
  });

  it('devuelve la existente sin crear nada cuando la clave ya está', async () => {
    const { repo, service } = armar();
    repo.sembrar('CAR', 'Toyota', 'TOYOTA');

    const r = await service.create(
      USUARIO,
      { kind: 'CAR', name: '  toyotá ' },
      AHORA,
    );

    expect(r.created).toBe(false);
    // Devuelve la capitalización del catálogo, no la que escribió el usuario.
    expect(r.brand.name).toBe('Toyota');
    expect(repo.filas).toHaveLength(1);
  });

  it('es idempotente por id: reintentar la cola no duplica', async () => {
    const { repo, service } = armar();
    const primera = await service.create(
      USUARIO,
      { id: 'id-fijo', kind: 'CAR', name: 'Chery' },
      AHORA,
    );
    const reintento = await service.create(
      USUARIO,
      { id: 'id-fijo', kind: 'CAR', name: 'Chery' },
      AHORA,
    );

    expect(primera.created).toBe(true);
    expect(reintento.created).toBe(false);
    expect(reintento.brand.id).toBe('id-fijo');
    expect(repo.filas).toHaveLength(1);
  });

  it('el mismo nombre en CAR y en MOTO son dos marcas distintas', async () => {
    const { repo, service } = armar();
    await service.create(USUARIO, { kind: 'CAR', name: 'Honda' }, AHORA);
    const moto = await service.create(
      USUARIO,
      { kind: 'MOTO', name: 'Honda' },
      AHORA,
    );

    expect(moto.created).toBe(true);
    expect(repo.filas).toHaveLength(2);
  });

  it('rechaza un nombre inválido', async () => {
    const { service } = armar();
    await expect(
      service.create(USUARIO, { kind: 'CAR', name: 'http://spam.com' }, AHORA),
    ).rejects.toMatchObject({ response: { error: 'BRAND_NAME_INVALID' } });
  });

  it('deja pasar la quinta del día y rechaza la sexta', async () => {
    const { service } = armar();
    for (const n of ['Chery', 'JAC', 'BYD', 'Dongfeng', 'Foton']) {
      await service.create(USUARIO, { kind: 'CAR', name: n }, AHORA);
    }
    await expect(
      service.create(USUARIO, { kind: 'CAR', name: 'Haval' }, AHORA),
    ).rejects.toMatchObject({ response: { error: 'BRAND_LIMIT_REACHED' } });
  });

  it('una marca de hace 25 horas no cuenta contra el tope', async () => {
    const { repo, service } = armar();
    for (const n of ['Chery', 'JAC', 'BYD', 'Dongfeng', 'Foton']) {
      await service.create(USUARIO, { kind: 'CAR', name: n }, AHORA);
    }
    // Se envejecen todas 25 horas.
    for (const f of repo.filas) {
      f.createdAt = new Date(AHORA.getTime() - 25 * 3600 * 1000);
    }
    const r = await service.create(
      USUARIO,
      { kind: 'CAR', name: 'Haval' },
      AHORA,
    );
    expect(r.created).toBe(true);
  });

  it('devolver una marca existente NO consume cupo', async () => {
    const { repo, service } = armar();
    repo.sembrar('CAR', 'Toyota', 'TOYOTA');
    // Cinco reintentos sobre una marca que ya existe.
    for (let i = 0; i < 5; i++) {
      await service.create(USUARIO, { kind: 'CAR', name: 'Toyota' }, AHORA);
    }
    const r = await service.create(
      USUARIO,
      { kind: 'CAR', name: 'Chery' },
      AHORA,
    );
    expect(r.created).toBe(true);
  });
});

describe('BrandsService.list', () => {
  it('filtra por kind: una marca de moto no sale entre los carros', async () => {
    const { repo, service } = armar();
    repo.sembrar('CAR', 'Toyota', 'TOYOTA');
    repo.sembrar('MOTO', 'Bera', 'BERA');

    const carros = await service.list('CAR');
    expect(carros.map((b) => b.name)).toEqual(['Toyota']);
  });

  it('las semillas no cuentan contra el tope de nadie', async () => {
    const { repo, service } = armar();
    for (const n of ['Toyota', 'Ford', 'Kia', 'Fiat', 'Jeep']) {
      repo.sembrar('CAR', n, n.toUpperCase());
    }
    const r = await service.create(
      USUARIO,
      { kind: 'CAR', name: 'Chery' },
      AHORA,
    );
    expect(r.created).toBe(true);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
cd backend-oil-app && npx jest src/modules/brands/brands.service.spec.ts
```

Expected: FAIL — `Cannot find module './brands.service'`.

- [ ] **Step 4: Write the implementation**

Crear `backend-oil-app/src/modules/brands/brands.service.ts`:

```ts
import { Inject, Injectable } from '@nestjs/common';
import { Errors } from '../../common/errors';
import type { VehicleKind } from '../oil/domain/vehicle.repository';
import {
  claveDeMarca,
  nombreValido,
  normalizarNombre,
} from './domain/brand-name';
import {
  BRAND_REPOSITORY,
  type Brand,
  type BrandRepository,
} from './domain/brand.repository';

/** Cinco por día por usuario. Ver Errors.brandLimitReached. */
const TOPE_DIARIO = 5;
const VENTANA_MS = 24 * 60 * 60 * 1000;

export type NewBrandInput = {
  id?: string;
  kind: VehicleKind;
  name: string;
};

@Injectable()
export class BrandsService {
  constructor(
    @Inject(BRAND_REPOSITORY) private readonly brands: BrandRepository,
  ) {}

  async list(kind: VehicleKind): Promise<Brand[]> {
    return this.brands.findByKind(kind);
  }

  /**
   * `now` es parámetro para que el tope diario se pueda probar sin esperar un
   * día ni manipular el reloj del proceso.
   */
  async create(
    userId: string,
    input: NewBrandInput,
    now: Date = new Date(),
  ): Promise<{ brand: Brand; created: boolean }> {
    if (!nombreValido(input.name)) throw Errors.brandNameInvalid();

    const name = normalizarNombre(input.name);
    const nameKey = claveDeMarca(name);

    // Idempotencia 1: la marca ya está en el catálogo. Es el caso más común —
    // dos usuarios que manejan un Chery. No consume cupo porque no aporta
    // ninguna fila nueva.
    const porClave = await this.brands.findByKindAndKey(input.kind, nameKey);
    if (porClave) return { brand: porClave, created: false };

    // Idempotencia 2: este id ya se envió. Es un reintento de la cola.
    if (input.id) {
      const porId = await this.brands.findById(input.id);
      if (porId) return { brand: porId, created: false };
    }

    const desde = new Date(now.getTime() - VENTANA_MS);
    const creadasHoy = await this.brands.countCreatedBy(userId, desde);
    if (creadasHoy >= TOPE_DIARIO) throw Errors.brandLimitReached();

    return this.brands.createIfAbsent({
      id: input.id,
      kind: input.kind,
      name,
      nameKey,
      createdBy: userId,
    });
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd backend-oil-app && npx jest src/modules/brands/
```

Expected: PASS, todos.

- [ ] **Step 6: Commit**

```bash
git add backend-oil-app/src/modules/brands/brands.service.ts backend-oil-app/src/modules/brands/brands.service.spec.ts backend-oil-app/src/common/errors.ts
git commit -m "feat(marcas): servicio con idempotencia doble y tope diario"
```

---

### Task 5: DTOs, controlador y módulo

**Files:**
- Create: `backend-oil-app/src/modules/brands/dto/create-brand.dto.ts`
- Create: `backend-oil-app/src/modules/brands/dto/brand-response.dto.ts`
- Create: `backend-oil-app/src/modules/brands/brands.controller.ts`
- Create: `backend-oil-app/src/modules/brands/brands.module.ts`
- Modify: `backend-oil-app/src/app.module.ts`

**Interfaces:**
- Consumes: `BrandsService` (Task 4), `PrismaBrandRepository` y `BRAND_REPOSITORY` (Task 3).
- Produces: `GET /api/v1/brands?kind=CAR|MOTO` y `POST /api/v1/brands`. `BrandResponseDto` con `{ id, kind, name, nameKey }`.

- [ ] **Step 1: Escribir los DTOs**

Crear `backend-oil-app/src/modules/brands/dto/create-brand.dto.ts`:

```ts
import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID, Length } from 'class-validator';
import { LARGO_MAX } from '../domain/brand-name';

export class CreateBrandDto {
  @ApiProperty({
    format: 'uuid',
    required: false,
    description:
      'Lo genera la app para poder agregar sin señal. Si ya existe, la respuesta es 200 con la marca guardada: es un reintento de la cola, no un error.',
  })
  @IsOptional()
  @IsUUID('4')
  id?: string;

  @ApiProperty({ enum: ['CAR', 'MOTO'] })
  @IsIn(['CAR', 'MOTO'])
  kind!: 'CAR' | 'MOTO';

  @ApiProperty({
    minLength: 1,
    maxLength: LARGO_MAX,
    example: 'Chery',
    description:
      'El charset real lo valida el servicio y devuelve BRAND_NAME_INVALID. Acá solo se acota el largo.',
  })
  @IsString()
  @Length(1, LARGO_MAX)
  name!: string;
}

export class ListBrandsQueryDto {
  @ApiProperty({ enum: ['CAR', 'MOTO'] })
  @IsIn(['CAR', 'MOTO'])
  kind!: 'CAR' | 'MOTO';
}
```

Crear `backend-oil-app/src/modules/brands/dto/brand-response.dto.ts`:

```ts
import { ApiProperty } from '@nestjs/swagger';
import type { Brand } from '../domain/brand.repository';

export class BrandResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: ['CAR', 'MOTO'] }) kind!: 'CAR' | 'MOTO';
  @ApiProperty({ example: 'Chery' }) name!: string;

  @ApiProperty({
    example: 'CHERY',
    description:
      'Nombre normalizado. Viaja para que la app deduplique con la clave del servidor en vez de recalcularla.',
  })
  nameKey!: string;
}

export const toBrandResponse = (b: Brand): BrandResponseDto => ({
  id: b.id,
  kind: b.kind,
  name: b.name,
  nameKey: b.nameKey,
});
```

- [ ] **Step 2: Escribir el controlador**

Crear `backend-oil-app/src/modules/brands/brands.controller.ts`:

```ts
// Solo HTTP: recibe DTO, delega, devuelve DTO. Cero reglas de negocio.
import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { User } from '../users/domain/user';
import { BrandsService } from './brands.service';
import { CreateBrandDto, ListBrandsQueryDto } from './dto/create-brand.dto';
import { BrandResponseDto, toBrandResponse } from './dto/brand-response.dto';

@ApiTags('Marcas')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('brands')
export class BrandsController {
  constructor(private readonly brands: BrandsService) {}

  @ApiOperation({
    summary: 'Catálogo de marcas de un tipo de vehículo',
    description:
      'Incluye las semillas y todo lo que aportaron los usuarios. El catálogo es común: lo que agrega uno lo ven todos.',
  })
  @ApiOkResponse({ type: [BrandResponseDto] })
  @Get()
  async list(@Query() q: ListBrandsQueryDto): Promise<BrandResponseDto[]> {
    const marcas = await this.brands.list(q.kind);
    return marcas.map(toBrandResponse);
  }

  @ApiOperation({
    summary: 'Agregar una marca al catálogo común',
    description:
      'Queda visible para todos los usuarios de inmediato. Si el nombre ya existe (comparando normalizado), devuelve la que estaba sin crear nada.',
  })
  @ApiCreatedResponse({ type: BrandResponseDto })
  @ApiOkResponse({
    type: BrandResponseDto,
    description:
      'La marca ya existía, por nombre o por id. Se devuelve la guardada; no es un error.',
  })
  @Post()
  async create(
    @CurrentUser() user: User,
    @Body() dto: CreateBrandDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<BrandResponseDto> {
    const { brand, created } = await this.brands.create(user.id, dto);
    res.status(created ? HttpStatus.CREATED : HttpStatus.OK);
    return toBrandResponse(brand);
  }
}
```

- [ ] **Step 3: Escribir el módulo y registrarlo**

Crear `backend-oil-app/src/modules/brands/brands.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { PrismaBrandRepository } from '../../infra/prisma/prisma-brand.repository';
import { BRAND_REPOSITORY } from './domain/brand.repository';
import { BrandsController } from './brands.controller';
import { BrandsService } from './brands.service';

@Module({
  controllers: [BrandsController],
  providers: [
    BrandsService,
    // Mismo criterio que OilModule: el servicio pide el token, nunca la clase.
    { provide: BRAND_REPOSITORY, useClass: PrismaBrandRepository },
  ],
})
export class BrandsModule {}
```

En `backend-oil-app/src/app.module.ts`, agregar el import y sumar `BrandsModule` al array `imports`, al lado de `OilModule`.

- [ ] **Step 4: Verificar que las rutas se montan**

```bash
cd backend-oil-app && pnpm build && timeout 25 pnpm start 2>&1 | grep -E "brands|BrandsController"
```

Expected: dos líneas, `Mapped {/api/v1/brands, GET}` y `Mapped {/api/v1/brands, POST}`.

- [ ] **Step 5: Commit**

```bash
git add backend-oil-app/src/modules/brands backend-oil-app/src/app.module.ts
git commit -m "feat(marcas): endpoints GET y POST /brands"
```

---

### Task 6: e2e del catálogo

El test que importa es el de visibilidad entre cuentas: **es la premisa entera de la feature**. Sin él no hay prueba de que lo que agrega uno lo vea otro.

**Files:**
- Create: `backend-oil-app/test/brands.e2e-spec.ts`

**Interfaces:**
- Consumes: los endpoints de la Task 5; `emailE2E` y `limpiarUsuariosE2E` de `test/support/e2e-db.ts`.
- Produces: nada que consuman otras tareas.

- [ ] **Step 1: Write the failing test**

Crear `backend-oil-app/test/brands.e2e-spec.ts`:

```ts
import 'dotenv/config';
// Mismo motivo que en auth.e2e: el e2e crea más cuentas por minuto que el
// límite real. Debe fijarse ANTES de importar AppModule.
process.env.THROTTLE_AUTH_LIMIT = '1000';

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
  email: emailE2E('marcas'),
  phone: '+58 414 528 9012',
  state: 'Distrito Capital',
  city: 'Caracas',
  password: 'contrasena1',
});

type CuerpoMarca = { id: string; kind: string; name: string; nameKey: string };
const marca = (r: request.Response) => r.body as CuerpoMarca;
const lista = (r: request.Response) => r.body as CuerpoMarca[];

describe('Catálogo de marcas (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const http = () =>
    request(app.getHttpServer() as Parameters<typeof request>[0]);

  // Nombre único por corrida: el catálogo es global y persiste entre corridas,
  // así que un nombre fijo chocaría con el de la corrida anterior y el test
  // pasaría o fallaría según el orden. Las marcas creadas se borran al final.
  const sufijo = Date.now().toString(36).toUpperCase();
  const MARCA_NUEVA = `Chery${sufijo}`;

  const registrar = async (): Promise<string> => {
    const r = await http()
      .post('/api/v1/auth/register')
      .send(nuevoUsuario())
      .expect(201);
    return (r.body as { accessToken: string }).accessToken;
  };

  beforeAll(async () => {
    const mod = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    // Las marcas no cuelgan de User, así que el barrido de cuentas no se las
    // lleva: hay que borrarlas explícitamente.
    await prisma.brand.deleteMany({ where: { name: { contains: sufijo } } });
    await limpiarUsuariosE2E(prisma);
    await app.close();
  });

  it('el catálogo arranca con las marcas semilla', async () => {
    const token = await registrar();
    const r = await http()
      .get('/api/v1/brands?kind=CAR')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(lista(r).map((b) => b.name)).toEqual(
      expect.arrayContaining(['Toyota', 'Chevrolet']),
    );
  });

  it('lo que agrega un usuario lo ve OTRO usuario', async () => {
    const tokenA = await registrar();
    const tokenB = await registrar();

    const creada = await http()
      .post('/api/v1/brands')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ kind: 'CAR', name: MARCA_NUEVA })
      .expect(201);
    expect(marca(creada).name).toBe(MARCA_NUEVA);

    const vistaPorB = await http()
      .get('/api/v1/brands?kind=CAR')
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);

    expect(lista(vistaPorB).map((b) => b.name)).toContain(MARCA_NUEVA);
  });

  it('dos usuarios creando la misma marca terminan con una sola fila', async () => {
    const tokenA = await registrar();
    const tokenB = await registrar();
    const nombre = `Dongfeng${sufijo}`;

    const primera = await http()
      .post('/api/v1/brands')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ kind: 'CAR', name: nombre })
      .expect(201);

    // B la escribe distinto: debe caer sobre la misma fila.
    const segunda = await http()
      .post('/api/v1/brands')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ kind: 'CAR', name: `  ${nombre.toUpperCase()} ` })
      .expect(200);

    expect(segunda.body).toMatchObject({ id: marca(primera).id });

    const filas = await prisma.brand.count({
      where: { kind: 'CAR', nameKey: nombre.toUpperCase() },
    });
    expect(filas).toBe(1);
  });

  it('una marca de moto no aparece en el catálogo de carros', async () => {
    const token = await registrar();
    const nombre = `Ssenda${sufijo}`;

    await http()
      .post('/api/v1/brands')
      .set('Authorization', `Bearer ${token}`)
      .send({ kind: 'MOTO', name: nombre })
      .expect(201);

    const carros = await http()
      .get('/api/v1/brands?kind=CAR')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(lista(carros).map((b) => b.name)).not.toContain(nombre);
  });

  it('rechaza un nombre con URL', async () => {
    const token = await registrar();
    const r = await http()
      .post('/api/v1/brands')
      .set('Authorization', `Bearer ${token}`)
      .send({ kind: 'CAR', name: 'http://spam.com' })
      .expect(422);

    expect(r.body).toMatchObject({ error: 'BRAND_NAME_INVALID' });
  });

  it('corta al sexto aporte del día', async () => {
    const token = await registrar();
    for (let i = 0; i < 5; i++) {
      await http()
        .post('/api/v1/brands')
        .set('Authorization', `Bearer ${token}`)
        .send({ kind: 'CAR', name: `Tope${i}${sufijo}` })
        .expect(201);
    }
    const r = await http()
      .post('/api/v1/brands')
      .set('Authorization', `Bearer ${token}`)
      .send({ kind: 'CAR', name: `Tope5${sufijo}` })
      .expect(429);

    expect(r.body).toMatchObject({ error: 'BRAND_LIMIT_REACHED' });
  });
});
```

- [ ] **Step 2: Run the e2e suite**

```bash
cd backend-oil-app && pnpm test:e2e
```

Expected: PASS, las 6 nuevas más las 23 que ya existían.

- [ ] **Step 3: Verificar que no dejó basura**

```bash
docker exec ruedalo-db psql -U ruedalo -d ruedalo -c \
  'select count(*) as usuarios from "User"; select count(*) as marcas from "Brand";'
```

Expected: `usuarios` igual que antes de correr, y `marcas` exactamente 18.

- [ ] **Step 4: Commit**

```bash
git add backend-oil-app/test/brands.e2e-spec.ts
git commit -m "test(marcas): e2e del catálogo, incluida la visibilidad entre cuentas"
```

---

## App

### Task 7: Módulo puro de marcas — clave y sugerencia de parecidas

**Files:**
- Create: `app-mobile/src/data/marcas/nombre.ts`
- Test: `app-mobile/src/data/marcas/__tests__/nombre.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `claveDeMarca(nombre: string): string`, `nombreValido(nombre: string): boolean`, `normalizarNombre(nombre: string): string`, `distancia(a: string, b: string): number`, `sugerirParecida(texto: string, existentes: string[]): string | null`.

- [ ] **Step 1: Write the failing test**

Crear `app-mobile/src/data/marcas/__tests__/nombre.test.ts`:

```ts
// TABLA COMPARTIDA: los casos de `claveDeMarca` están duplicados en
// backend-oil-app/src/modules/brands/domain/brand-name.spec.ts. Si cambiás
// uno, cambiá el otro — que las dos normalizaciones no diverjan es justamente
// lo que estos casos protegen.
import {
  claveDeMarca,
  distancia,
  nombreValido,
  sugerirParecida,
} from '../nombre';

describe('claveDeMarca', () => {
  it.each([
    ['  toyota ', 'TOYOTA'],
    ['TOYOTA', 'TOYOTA'],
    ['Toyotá', 'TOYOTA'],
    ['Empire Keeway', 'EMPIREKEEWAY'],
    ['Mercedes-Benz', 'MERCEDESBENZ'],
    ['B.M.W.', 'BMW'],
    ['MD', 'MD'],
  ])('%s → %s', (entrada, esperado) => {
    expect(claveDeMarca(entrada)).toBe(esperado);
  });
});

describe('nombreValido', () => {
  it.each(['Toyota', 'Mercedes-Benz', 'B.M.W.', 'MD', 'Empire Keeway'])(
    'acepta %s',
    (n) => {
      expect(nombreValido(n)).toBe(true);
    },
  );

  it.each(['', '   ', '-Toyota', 'http://spam.com', 'a'.repeat(41)])(
    'rechaza %s',
    (n) => {
      expect(nombreValido(n)).toBe(false);
    },
  );
});

describe('distancia', () => {
  it.each([
    ['TOYOTA', 'TOYOTA', 0],
    ['TOYTA', 'TOYOTA', 1],
    ['CHEVORLET', 'CHEVROLET', 2],
    ['MD', 'AVA', 3],
  ])('%s vs %s → %i', (a, b, esperado) => {
    expect(distancia(a, b)).toBe(esperado);
  });
});

describe('sugerirParecida', () => {
  const CARROS = ['Toyota', 'Chevrolet', 'Ford', 'Kia'];

  it('sugiere Toyota para un dedazo', () => {
    expect(sugerirParecida('toyta', CARROS)).toBe('Toyota');
  });

  it('sugiere Chevrolet para letras transpuestas', () => {
    expect(sugerirParecida('chevorlet', CARROS)).toBe('Chevrolet');
  });

  it('no sugiere nada si la marca ya existe exacta', () => {
    expect(sugerirParecida('Toyota', CARROS)).toBeNull();
    expect(sugerirParecida('  TOYOTA ', CARROS)).toBeNull();
  });

  it('no sugiere nada para una marca genuinamente nueva', () => {
    expect(sugerirParecida('Chery', CARROS)).toBeNull();
  });

  // El umbral por largo existe por ESTE caso: MD y AVA están a distancia 2 y
  // son dos marcas reales y distintas del catálogo de motos. Con un umbral
  // fijo de 2, la app ofrecería reemplazar una por la otra.
  it('no sugiere AVA cuando el usuario escribe MD', () => {
    expect(sugerirParecida('MD', ['AVA', 'Bera', 'Yamaha'])).toBeNull();
  });

  it('elige la más parecida cuando hay varias candidatas', () => {
    expect(sugerirParecida('Yamah', ['Yamaha', 'Yamahaa'])).toBe('Yamaha');
  });

  it('devuelve null con texto vacío', () => {
    expect(sugerirParecida('   ', CARROS)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd app-mobile && npx jest src/data/marcas
```

Expected: FAIL — `Cannot find module '../nombre'`.

- [ ] **Step 3: Write the implementation**

Crear `app-mobile/src/data/marcas/nombre.ts`:

```ts
// El nombre de una marca del lado del cliente. PURO a propósito: se prueba con
// una tabla de casos en vez de montar pantallas.
//
// OJO: `backend-oil-app/src/modules/brands/domain/brand-name.ts` tiene su
// propia copia de `claveDeMarca` y `nombreValido`. Es deliberado — no hay
// paquete compartido entre las dos carpetas. La asimetría es explícita: ESTA
// es una heurística de interfaz, la del servidor es la restricción. Si
// divergen, lo peor que pasa es un duplicado visual hasta el próximo refresco;
// nunca una fila duplicada, porque el índice único del servidor no lo permite.

export const LARGO_MAX = 40;

const PATRON = /^[\p{L}\p{N}][\p{L}\p{N} .\-&]*$/u;

export function normalizarNombre(nombre: string): string {
  return nombre.trim().replace(/\s+/g, ' ');
}

export function claveDeMarca(nombre: string): string {
  return nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

export function nombreValido(nombre: string): boolean {
  const limpio = normalizarNombre(nombre);
  if (limpio.length === 0 || limpio.length > LARGO_MAX) return false;
  if (!PATRON.test(limpio)) return false;
  return claveDeMarca(limpio).length > 0;
}

/** Levenshtein con una sola fila: alcanza para textos de 40 caracteres. */
export function distancia(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let fila = Array.from({ length: b.length + 1 }, (_, i) => i);

  for (let i = 1; i <= a.length; i++) {
    const siguiente = [i];
    for (let j = 1; j <= b.length; j++) {
      const costo = a[i - 1] === b[j - 1] ? 0 : 1;
      siguiente[j] = Math.min(
        fila[j] + 1, // borrar
        siguiente[j - 1] + 1, // insertar
        fila[j - 1] + costo, // sustituir
      );
    }
    fila = siguiente;
  }

  return fila[b.length];
}

/**
 * La marca existente más parecida a lo que escribió, o null.
 *
 * Devuelve null cuando la marca YA existe exacta: ahí no hay nada que
 * sugerir, es la misma, y la pantalla ni siquiera ofrece agregarla.
 *
 * El umbral depende del largo por un caso real: `MD` y `AVA` están a
 * distancia 2 y son dos marcas distintas del catálogo de motos. Con un umbral
 * fijo la app ofrecería cambiar una por la otra.
 */
export function sugerirParecida(
  texto: string,
  existentes: string[],
): string | null {
  const clave = claveDeMarca(texto);
  if (clave.length === 0) return null;

  const umbral = clave.length >= 4 ? 2 : 1;
  let mejor: { nombre: string; d: number } | null = null;

  for (const candidata of existentes) {
    const d = distancia(clave, claveDeMarca(candidata));
    if (d === 0) return null;
    if (d <= umbral && (mejor === null || d < mejor.d)) {
      mejor = { nombre: candidata, d };
    }
  }

  return mejor === null ? null : mejor.nombre;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd app-mobile && npx jest src/data/marcas
```

Expected: PASS, todos.

- [ ] **Step 5: Commit**

```bash
git add app-mobile/src/data/marcas
git commit -m "feat(marcas): clave canónica y sugerencia de marca parecida en el cliente"
```

---

### Task 8: Controlador de API y operación en la cola

**Files:**
- Create: `app-mobile/src/api/controllers/brands.controller.ts`
- Modify: `app-mobile/src/data/sync/queue.ts`
- Modify: `app-mobile/src/data/sync/runner.ts`
- Test: `app-mobile/src/data/sync/__tests__/queue.test.ts` (agregar casos)

**Interfaces:**
- Consumes: `ApiClient` de `../base`, `VehicleKind` de `../../data/types`.
- Produces: tipo `ApiBrand = { id: string; kind: VehicleKind; name: string; nameKey: string }`; `brandsController` con `listar(kind: VehicleKind): Promise<ApiBrand[]>` y `crearMarca(id: string, kind: VehicleKind, name: string): Promise<ApiBrand>`. Variante de `QueueOp`: `{ op: 'CREATE_BRAND'; id: string; kind: VehicleKind; payload: { name: string } }`.

**Por qué `crearMarca` y no `crear`:** `vehiclesController` ya expone `crear`, y `RunnerDeps['api']` es una intersección de `Pick<>` sobre los dos controladores. Dos `crear` con firmas distintas en una intersección producen un tipo imposible de llamar, y el `case 'CREATE_VEHICLE'` deja de compilar. Nombres distintos desde el principio evitan el problema en vez de arreglarlo después.

- [ ] **Step 1: Escribir el controlador de API**

Crear `app-mobile/src/api/controllers/brands.controller.ts`:

```ts
// Endpoints de /brands. Un archivo por recurso.
import { ApiClient } from '../base';
import type { VehicleKind } from '../../data/types';

/** Como la ve la app: `kind` en minúsculas, igual que el resto del código. */
export type ApiBrand = {
  id: string;
  kind: VehicleKind;
  name: string;
  /** Lo calcula el servidor. La app lo usa para deduplicar sin recalcularlo. */
  nameKey: string;
};

type MarcaCruda = Omit<ApiBrand, 'kind'> & { kind: 'CAR' | 'MOTO' };

const aDominio = (b: MarcaCruda): ApiBrand => ({
  ...b,
  kind: b.kind === 'CAR' ? 'car' : 'moto',
});

const aBackend = (k: VehicleKind): 'CAR' | 'MOTO' =>
  k === 'car' ? 'CAR' : 'MOTO';

class BrandsController extends ApiClient {
  constructor() {
    super('/brands');
  }

  async listar(kind: VehicleKind): Promise<ApiBrand[]> {
    const crudas = await this.get<MarcaCruda[]>(`?kind=${aBackend(kind)}`, {
      auth: true,
    });
    return crudas.map(aDominio);
  }

  /**
   * `id` lo genera la app: el backend lo usa como clave de idempotencia.
   *
   * Se llama `crearMarca` y no `crear` porque `vehiclesController` ya tiene un
   * `crear`, y el runner los junta en una intersección de tipos.
   */
  async crearMarca(
    id: string,
    kind: VehicleKind,
    name: string,
  ): Promise<ApiBrand> {
    return aDominio(
      await this.post<MarcaCruda>('', {
        auth: true,
        body: { id, kind: aBackend(kind), name },
      }),
    );
  }
}

export const brandsController = new BrandsController();
```

La ruta base va en `super()` y los métodos reciben solo el resto del path, igual que `VehiclesController`. El `{ auth: true }` no es opcional: sin él la petición sale sin el token y el backend responde 401.

- [ ] **Step 2: Agregar la operación a la cola**

En `app-mobile/src/data/sync/queue.ts`, agregar al final de la unión `QueueOp`:

```ts
  | {
      op: 'CREATE_BRAND';
      id: string;
      kind: VehicleKind;
      payload: { name: string };
    }
```

y el import del tipo:

```ts
import type { NewOilChangeInput, NewVehicleInput, VehicleKind } from '../types';
```

No hace falta ninguna regla de colapso nueva: una marca no se puede editar ni borrar desde la app, así que `CREATE_BRAND` nunca tiene con qué fusionarse. La rama por defecto de `encolar` —agregar al final— es la correcta.

- [ ] **Step 3: Agregar el caso al runner**

En `app-mobile/src/data/sync/runner.ts`:

En el import, sumar el controlador:

```ts
import type { brandsController } from '../../api/controllers/brands.controller';
```

Reemplazar el tipo `api` de `RunnerDeps` por uno **parcial**, porque ahora hay dos dueños de cola y cada uno solo puede proveer los métodos de sus propias operaciones:

```ts
/**
 * Los métodos que el runner sabe invocar.
 *
 * Es `Partial` porque hay dos colas con dueños distintos: la de vehículos no
 * tiene por qué conocer el controlador de marcas ni al revés. Cada dueño pasa
 * los métodos de SUS operaciones.
 */
export type RunnerApi = Partial<
  Pick<
    typeof vehiclesController,
    'crear' | 'editar' | 'borrar' | 'registrarCambio' | 'editarCambio' | 'borrarCambio'
  > &
    Pick<typeof oilStatusController, 'reportOdometer'> &
    Pick<typeof brandsController, 'crearMarca'>
>;

/**
 * Que falte un método no es un fallo del usuario sino un error de cableado:
 * alguien encoló una operación en una cola cuyo dueño no provee cómo enviarla.
 * Revienta fuerte y temprano — en el primer drenado, en desarrollo — en vez de
 * fallar en silencio.
 */
function requerido<F>(metodo: F | undefined, nombre: string): F {
  if (metodo === undefined) {
    throw new Error(`El runner no recibió api.${nombre}`);
  }
  return metodo;
}
```

y en `RunnerDeps` usar `api: RunnerApi;`.

Cada `case` de `enviar` pasa a envolver su método. Los siete que ya existen quedan así:

```ts
    case 'CREATE_VEHICLE':
      await requerido(api.crear, 'crear')(op.id, op.payload);
      return;
    case 'UPDATE_VEHICLE':
      await requerido(api.editar, 'editar')(op.id, op.payload);
      return;
    case 'DELETE_VEHICLE':
      await requerido(api.borrar, 'borrar')(op.id);
      return;
    case 'CREATE_OIL_CHANGE':
      await requerido(api.registrarCambio, 'registrarCambio')(
        op.id,
        op.vehicleId,
        op.payload,
      );
      return;
    case 'UPDATE_OIL_CHANGE':
      await requerido(api.editarCambio, 'editarCambio')(op.id, op.payload);
      return;
    case 'DELETE_OIL_CHANGE':
      await requerido(api.borrarCambio, 'borrarCambio')(op.id);
      return;
    case 'REPORT_ODOMETER':
      await requerido(api.reportOdometer, 'reportOdometer')(
        op.vehicleId,
        op.km,
      );
      return;
    case 'CREATE_BRAND':
      await requerido(api.crearMarca, 'crearMarca')(
        op.id,
        op.kind,
        op.payload.name,
      );
      return;
```

Verificar contra el archivo real que las firmas de los siete primeros coincidan con las que ya estaban; si alguna difiere, mandan las del archivo.

- [ ] **Step 4: Agregar los casos de cola al test existente**

En `app-mobile/src/data/sync/__tests__/queue.test.ts`, agregar:

```ts
describe('CREATE_BRAND', () => {
  const marca = (id: string, name: string): QueueOp => ({
    op: 'CREATE_BRAND',
    id,
    kind: 'car',
    payload: { name },
  });

  it('se agrega al final sin colapsar con nada', () => {
    let cola = encolar([], marca('m1', 'Chery'));
    cola = encolar(cola, marca('m2', 'JAC'));

    expect(cola).toHaveLength(2);
    expect(cola.map((e) => e.op.op)).toEqual(['CREATE_BRAND', 'CREATE_BRAND']);
  });

  it('sobrevive el ida y vuelta sin perder el kind ni el nombre', () => {
    const cola = encolar([], marca('m1', 'Chery'));
    expect(cola[0].op).toMatchObject({
      op: 'CREATE_BRAND',
      id: 'm1',
      kind: 'car',
      payload: { name: 'Chery' },
    });
  });

  it('borrar un vehículo no se lleva marcas pendientes por delante', () => {
    let cola = encolar([], marca('m1', 'Chery'));
    cola = encolar(cola, { op: 'DELETE_VEHICLE', id: 'v1' });

    expect(cola.some((e) => e.op.op === 'CREATE_BRAND')).toBe(true);
  });
});
```

El tercer caso no es decorativo: `encolar` descarta entradas "del vehículo" al borrarlo, y `esDelVehiculo` mira `'vehicleId' in e.op` y los ids de CREATE/UPDATE_VEHICLE. Una marca no debe caer nunca en ese filtro.

- [ ] **Step 5: Verificar tipos y tests**

```bash
cd app-mobile && npx tsc --noEmit && npx jest src/data/sync
```

Expected: `tsc` sin salida y los tests de cola en verde, los viejos y los nuevos.

- [ ] **Step 6: Commit**

```bash
git add app-mobile/src/api/controllers/brands.controller.ts app-mobile/src/data/sync
git commit -m "feat(marcas): controlador de API y operación CREATE_BRAND en la cola"
```

---

### Task 9: Caché local y store `useBrands`

**Files:**
- Modify: `app-mobile/src/data/local/store.ts`
- Create: `app-mobile/src/store/useBrands.ts`
- Test: `app-mobile/src/store/__tests__/useBrands.test.ts`

**Interfaces:**
- Consumes: `brandsController` (Task 8), `claveDeMarca` (Task 7), `encolar`/`drenar` de `../data/sync`, `nuevoId` de `../data/ids`.
- Produces: `useBrands` con estado `{ marcas: Record<VehicleKind, ApiBrand[]>, cola, hydrated }` y acciones `hidratar()`, `refresh()`, `agregar(kind, name): string`, `sincronizar()`. Selector `useMarcasDe(kind): string[]`.

- [ ] **Step 1: Agregar las dos claves al almacén local**

En `app-mobile/src/data/local/store.ts`:

```ts
import type { ApiBrand } from '../../api/controllers/brands.controller';
import type { VehicleKind } from '../types';

const CLAVE_MARCAS = 'ruedalo:marcas';
const CLAVE_COLA_MARCAS = 'ruedalo:cola-marcas';

export type MarcasPorTipo = Record<VehicleKind, ApiBrand[]>;

const MARCAS_VACIAS: MarcasPorTipo = { car: [], moto: [] };

export async function guardarMarcas(m: MarcasPorTipo): Promise<void> {
  await guardarJson(CLAVE_MARCAS, m);
}

export async function leerMarcas(): Promise<MarcasPorTipo> {
  const m = await leerJson<unknown>(CLAVE_MARCAS, MARCAS_VACIAS);
  // Mismo criterio que leerFlota: que el JSON parsee no garantiza la forma.
  // Una versión vieja pudo guardar otra cosa y un `.map` sobre eso revienta
  // el selector de marcas justo en el paso 2 del alta.
  if (typeof m !== 'object' || m === null) return MARCAS_VACIAS;
  const cand = m as Partial<MarcasPorTipo>;
  return {
    car: Array.isArray(cand.car) ? cand.car : [],
    moto: Array.isArray(cand.moto) ? cand.moto : [],
  };
}

export async function guardarColaMarcas(cola: QueueEntry[]): Promise<void> {
  await guardarJson(CLAVE_COLA_MARCAS, cola);
}

export async function leerColaMarcas(): Promise<QueueEntry[]> {
  const c = await leerJson<unknown>(CLAVE_COLA_MARCAS, []);
  return Array.isArray(c) ? (c as QueueEntry[]) : [];
}
```

- [ ] **Step 2: Write the failing test**

Crear `app-mobile/src/store/__tests__/useBrands.test.ts`:

```ts
import { unirMarcas } from '../useBrands';
import type { ApiBrand } from '../../api/controllers/brands.controller';

const marca = (id: string, name: string, nameKey: string): ApiBrand => ({
  id,
  kind: 'car',
  name,
  nameKey,
});

describe('unirMarcas', () => {
  it('une las del servidor con las pendientes, ordenadas', () => {
    const servidor = [marca('1', 'Toyota', 'TOYOTA')];
    const pendientes = [marca('2', 'Chery', 'CHERY')];

    expect(unirMarcas(servidor, pendientes).map((b) => b.name)).toEqual([
      'Chery',
      'Toyota',
    ]);
  });

  it('no muestra duplicados cuando la pendiente ya llegó al servidor', () => {
    // El caso real: se agregó sin señal, la cola la envió, el refresco la trajo
    // de vuelta, y la pendiente todavía no se limpió del estado local.
    const servidor = [marca('1', 'Chery', 'CHERY')];
    const pendientes = [marca('2', 'chery', 'CHERY')];

    const r = unirMarcas(servidor, pendientes);
    expect(r).toHaveLength(1);
    // Gana la del servidor: es la que van a ver los demás.
    expect(r[0].name).toBe('Chery');
  });

  it('ordena ignorando mayúsculas y acentos', () => {
    const servidor = [
      marca('1', 'ávila', 'AVILA'),
      marca('2', 'Bera', 'BERA'),
      marca('3', 'AVA', 'AVA'),
    ];
    expect(unirMarcas(servidor, []).map((b) => b.name)).toEqual([
      'AVA',
      'ávila',
      'Bera',
    ]);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
cd app-mobile && npx jest src/store/__tests__/useBrands.test.ts
```

Expected: FAIL — `Cannot find module '../useBrands'`.

- [ ] **Step 4: Escribir el store**

Crear `app-mobile/src/store/useBrands.ts`. Antes de escribirlo, **abrir `app-mobile/src/store/useVehicles.ts` y copiar su estructura**: el ciclo hidratar → pintar → refrescar → guardar, la forma de `encolarOp` y cómo llama a `drenar`. Este store es el mismo patrón sobre otro recurso.

```ts
// El catálogo de marcas: lo que el selector ofrece en el alta y en la edición.
//
// Lleva SU PROPIA cola, separada de la de vehículos, reusando las mismas
// funciones puras `encolar` y `drenar`. Es reuso, no duplicación.
//
// Se puede porque las dos son independientes: un vehículo con marca "Chery" no
// necesita que exista la fila Chery, ya que `Vehicle.brand` viaja como texto.
// No hay orden que respetar entre las dos colas, que es lo único que obligaría
// a unificarlas.
//
// CUÁNDO REVERTIR ESTO: en cuanto aparezca un tercer escritor con cola propia,
// hay que extraer un `useSync` de verdad. Con dos todavía no se paga el riesgo.
import { create } from 'zustand';
import { brandsController } from '../api/controllers/brands.controller';
import type { ApiBrand } from '../api/controllers/brands.controller';
import { nuevoId } from '../data/ids';
import {
  guardarColaMarcas,
  guardarMarcas,
  leerColaMarcas,
  leerMarcas,
  type MarcasPorTipo,
} from '../data/local/store';
import { claveDeMarca, normalizarNombre } from '../data/marcas/nombre';
import { encolar } from '../data/sync/queue';
import type { QueueEntry } from '../data/sync/queue';
import { drenar } from '../data/sync/runner';
import type { VehicleKind } from '../data/types';

/**
 * Las del servidor más las que todavía no salieron, sin duplicados.
 *
 * Deduplica por `nameKey` y deja ganar a la del servidor: es la versión que
 * ven los demás usuarios, así que mostrar otra sería mentir sobre el catálogo.
 */
export function unirMarcas(
  servidor: ApiBrand[],
  pendientes: ApiBrand[],
): ApiBrand[] {
  const porClave = new Map<string, ApiBrand>();
  for (const p of pendientes) porClave.set(p.nameKey, p);
  for (const s of servidor) porClave.set(s.nameKey, s);
  return [...porClave.values()].sort((a, b) =>
    a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }),
  );
}

type Estado = {
  marcas: MarcasPorTipo;
  pendientes: MarcasPorTipo;
  cola: QueueEntry[];
  hydrated: boolean;
  hidratar: () => Promise<void>;
  refresh: () => Promise<void>;
  /** Devuelve el id generado. Pinta al instante y encola el envío. */
  agregar: (kind: VehicleKind, name: string) => string;
  sincronizar: () => Promise<void>;
};

export const useBrands = create<Estado>((set, get) => {
  const persistir = (marcas: MarcasPorTipo, cola: QueueEntry[]) => {
    void guardarMarcas(marcas);
    void guardarColaMarcas(cola);
  };

  return {
    marcas: SEMILLA,
    pendientes: { car: [], moto: [] },
    cola: [],
    hydrated: false,

    hidratar: async () => {
      const [marcas, cola] = await Promise.all([leerMarcas(), leerColaMarcas()]);
      set({
        // Si la caché está vacía (instalación nueva) se queda la semilla: un
        // selector vacío en el paso 2 del alta es peor que una lista corta.
        marcas:
          marcas.car.length + marcas.moto.length > 0 ? marcas : SEMILLA,
        cola,
        hydrated: true,
      });
    },

    refresh: async () => {
      const [car, moto] = await Promise.all([
        brandsController.listar('car'),
        brandsController.listar('moto'),
      ]);
      const marcas = { car, moto };
      set({ marcas });
      void guardarMarcas(marcas);
    },

    agregar: (kind, name) => {
      const id = nuevoId();
      const limpio = normalizarNombre(name);
      const nueva: ApiBrand = {
        id,
        kind,
        name: limpio,
        nameKey: claveDeMarca(limpio),
      };

      const pendientes = {
        ...get().pendientes,
        [kind]: [...get().pendientes[kind], nueva],
      };
      const cola = encolar(get().cola, {
        op: 'CREATE_BRAND',
        id,
        kind,
        payload: { name: limpio },
      });

      set({ pendientes, cola });
      persistir(get().marcas, cola);
      void get().sincronizar();
      return id;
    },

    sincronizar: async () => {
      const r = await drenar({
        leerCola: () => get().cola,
        guardarCola: (cola) => {
          set({ cola });
          void guardarColaMarcas(cola);
        },
        marcarRechazado: (op) => {
          // Una marca rechazada no se le muestra al usuario: la validación del
          // cliente replica la del servidor, así que llegar acá es casi
          // imposible. Si pasa, se saca de las pendientes y listo — el próximo
          // refresco deja la lista consistente y el usuario la reescribe. No
          // se inventa un canal de errores nuevo para esto.
          set((st) => ({
            pendientes: {
              car: st.pendientes.car.filter((b) => b.id !== op.id),
              moto: st.pendientes.moto.filter((b) => b.id !== op.id),
            },
          }));
        },
        api: {
          crearMarca: brandsController.crearMarca.bind(brandsController),
        },
      });

      // Mismo criterio que useVehicles.sincronizar: mientras quede algo y no
      // esté pausada, se sigue. El resultado trae la espera si el fallo fue
      // transitorio, y en ese caso se corta acá.
      if (!r.vacia && !r.pausada && r.esperarMs === null) {
        await get().sincronizar();
      }
    },
  };
});

/** Los nombres que el selector debe ofrecer para ese tipo. */
export const useMarcasDe = (kind: VehicleKind): string[] =>
  useBrands((s) => unirMarcas(s.marcas[kind], s.pendientes[kind])).map(
    (b) => b.name,
  );
```

El objeto `api` pasa solo `crearMarca` y eso compila porque la Task 8 dejó `RunnerApi` como `Partial`. Si acá aparece un error de tipos exigiendo los métodos de vehículos, es que la Task 8 quedó a medias.

Cuando una op muere, la pendiente se saca de `pendientes` pero **no se toca `marcas`**: esa lista es lo que dijo el servidor y no le corresponde a un fallo local modificarla.

`SEMILLA` queda definida en la **Task 11**, que es donde las 18 marcas salen de `mock.ts`. Para que esta tarea compile y sus tests corran, definirla provisionalmente al tope de este archivo con los valores exactos de **Global Constraints**; la Task 11 la reemplaza por la versión final con comentario.

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd app-mobile && npx tsc --noEmit && npx jest src/store/__tests__/useBrands.test.ts
```

Expected: `tsc` limpio y los tres casos de `unirMarcas` en verde.

- [ ] **Step 6: Commit**

```bash
git add app-mobile/src/data/local/store.ts app-mobile/src/store/useBrands.ts app-mobile/src/store/__tests__/useBrands.test.ts app-mobile/src/data/sync/runner.ts
git commit -m "feat(marcas): store de marcas con caché local y cola propia"
```

---

### Task 10: `Select` con búsqueda y fila de agregar

**Files:**
- Modify: `app-mobile/src/components/primitives.tsx` (el componente `Select`, alrededor de la línea 318)

**Interfaces:**
- Consumes: nada nuevo.
- Produces: `Select` acepta dos props opcionales más — `searchable?: boolean` y `onAddNew?: (texto: string) => void`.

- [ ] **Step 1: Extender el tipo de props**

En `app-mobile/src/components/primitives.tsx`, en `SelectProps`:

```ts
  /** Campo de búsqueda arriba de la lista. Para catálogos que crecen. */
  searchable?: boolean;
  /**
   * Habilita la fila "+ Agregar «X»" al final, cuando lo escrito no calza
   * exacto con ninguna opción. `Select` NO sabe qué es lo que se agrega: la
   * pantalla que lo usa decide qué hacer con el texto.
   */
  onAddNew?: (texto: string) => void;
```

- [ ] **Step 2: Implementar búsqueda y fila de agregar**

Dentro de `Select`, junto al `useState` de `open`:

```ts
  const [busqueda, setBusqueda] = useState('');

  const visibles = busqueda.trim()
    ? options.filter((o) =>
        o.toLocaleLowerCase('es').includes(busqueda.trim().toLocaleLowerCase('es')),
      )
    : options;

  // Solo se ofrece agregar si lo escrito no es ya una opción. La comparación
  // es laxa (sin mayúsculas ni espacios de más) para no ofrecer "Agregar
  // «toyota»" cuando Toyota está tres filas más arriba.
  const yaExiste = options.some(
    (o) => o.trim().toLocaleLowerCase('es') === busqueda.trim().toLocaleLowerCase('es'),
  );
  const puedeAgregar = Boolean(onAddNew) && busqueda.trim().length > 0 && !yaExiste;
```

Al cerrar la modal (en el `onPress` del fondo y al elegir una opción), limpiar la búsqueda con `setBusqueda('')`, para que la próxima apertura no arranque filtrada.

Dentro del `Box` de la hoja, antes del `FlatList`:

```tsx
            {searchable ? (
              <Box px="$2xl" pb="$sm">
                <Input
                  value={busqueda}
                  onChangeText={setBusqueda}
                  placeholder="Buscar"
                  autoCapitalize="words"
                />
              </Box>
            ) : null}
```

Y como `ListFooterComponent` del `FlatList`:

```tsx
              ListFooterComponent={
                puedeAgregar ? (
                  <Touchable
                    fd="row"
                    ai="center"
                    gap="$sm"
                    px="$2xl"
                    py={15}
                    pressStyle={{ bg: '$bg2' }}
                    onPress={() => {
                      onAddNew?.(busqueda.trim());
                      setBusqueda('');
                      setOpen(false);
                    }}
                  >
                    <Icon name="plus" color={c.accent} size={18} />
                    <Txt f={1} fos={15} font="semi" tone="accent">
                      Agregar «{busqueda.trim()}»
                    </Txt>
                  </Touchable>
                ) : null
              }
```

Pasar `data={visibles}` en vez de `data={options}`.

- [ ] **Step 3: Verificar que no se rompió ningún uso existente**

```bash
cd app-mobile && npx tsc --noEmit && npx jest
```

Expected: `tsc` limpio y los 172 tests en verde. Las dos props son opcionales, así que los usos actuales (viscosidades, tipos de aceite) no cambian de comportamiento.

- [ ] **Step 4: Commit**

```bash
git add app-mobile/src/components/primitives.tsx
git commit -m "feat(ui): Select con búsqueda y fila para agregar una opción nueva"
```

---

### Task 11: Cablear las dos pantallas y retirar la lista quemada

**Files:**
- Modify: `app-mobile/src/screens/AddVehicleFormScreen.tsx:9,25`
- Modify: `app-mobile/src/screens/EditVehicleScreen.tsx:15,60`
- Modify: `app-mobile/src/data/mock.ts:111-112`
- Modify: `app-mobile/src/store/useBrands.ts` (mover ahí la constante `SEMILLA`)
- Modify: `app-mobile/App.tsx`

**Interfaces:**
- Consumes: `useMarcasDe`, `useBrands` (Task 9); `sugerirParecida`, `nombreValido` (Task 7); `Select` con `searchable`/`onAddNew` (Task 10).
- Produces: nada que consuman otras tareas. Cierra la feature.

- [ ] **Step 1: Mover las 18 marcas de `mock.ts` al store**

Borrar las líneas 111 y 112 de `app-mobile/src/data/mock.ts` (`VE_BRANDS_CAR` y `VE_BRANDS_MOTO`).

En `app-mobile/src/store/useBrands.ts`, dejar la constante definitiva:

```ts
/**
 * Las 18 con las que la app venía funcionando. Siguen acá además de estar
 * sembradas en el backend, y no es redundancia por descuido: sin esto, una
 * instalación nueva sin señal abriría el selector VACÍO justo en el paso 2 del
 * alta. La lista del servidor las pisa en el primer refresco exitoso.
 *
 * Si agregás o quitás una acá, hacé lo mismo en la migración `_brands`.
 */
const nombres = (kind: VehicleKind, xs: string[]): ApiBrand[] =>
  xs.map((name) => ({
    id: `semilla-${kind}-${claveDeMarca(name)}`,
    kind,
    name,
    nameKey: claveDeMarca(name),
  }));

const SEMILLA: MarcasPorTipo = {
  car: nombres('car', [
    'Toyota', 'Chevrolet', 'Ford', 'Hyundai', 'Kia',
    'Renault', 'Fiat', 'Jeep', 'Nissan', 'Mitsubishi',
  ]),
  moto: nombres('moto', [
    'Bera', 'Empire Keeway', 'MD', 'Yamaha',
    'Suzuki', 'Honda', 'AVA', 'Skygo',
  ]),
};
```

- [ ] **Step 2: Hidratar y sincronizar al arrancar**

En `app-mobile/App.tsx`, al lado de los hooks de la flota:

```ts
  const hidratarMarcas = useBrands((s) => s.hidratar);
  const refrescarMarcas = useBrands((s) => s.refresh);
  const sincronizarMarcas = useBrands((s) => s.sincronizar);

  useEffect(() => {
    void hidratarMarcas();
  }, [hidratarMarcas]);

  useEffect(() => {
    if (authStatus !== 'authed') return;
    // Igual que la flota: primero se drena lo pendiente y después se refresca.
    // Al revés, la respuesta del servidor pisaría una marca que el usuario
    // agregó sin señal y que todavía no se envió.
    void sincronizarMarcas().then(() => refrescarMarcas());
  }, [authStatus, refrescarMarcas, sincronizarMarcas]);
```

- [ ] **Step 3: Cablear el alta**

En `app-mobile/src/screens/AddVehicleFormScreen.tsx`, reemplazar el import de la línea 9 y el cálculo de la línea 25:

```ts
import { Alert } from 'react-native';
import { useBrands, useMarcasDe } from '../store/useBrands';
import { nombreValido, sugerirParecida } from '../data/marcas/nombre';
```

```ts
  const brands = useMarcasDe(kind);
  const agregarMarca = useBrands((s) => s.agregar);

  const pedirMarcaNueva = (texto: string) => {
    if (!nombreValido(texto)) {
      Alert.alert(
        'Ese nombre no sirve',
        'Usa letras, números, espacios, punto o guion. Máximo 40 caracteres.',
      );
      return;
    }

    const parecida = sugerirParecida(texto, brands);
    if (parecida) {
      Alert.alert(
        `¿Quisiste decir ${parecida}?`,
        `Escribiste «${texto}».`,
        [
          { text: `Usar ${parecida}`, onPress: () => setBrand(parecida) },
          {
            text: `Crear «${texto}»`,
            style: 'destructive',
            onPress: () => {
              agregarMarca(kind, texto);
              setBrand(texto);
            },
          },
        ],
      );
      return;
    }

    agregarMarca(kind, texto);
    setBrand(texto);
  };
```

Y en el `Select` de la marca:

```tsx
                <Select
                  value={brand}
                  placeholder="Selecciona la marca"
                  options={brands}
                  onChange={setBrand}
                  searchable
                  onAddNew={pedirMarcaNueva}
                />
```

- [ ] **Step 4: Cablear la edición**

En `app-mobile/src/screens/EditVehicleScreen.tsx`, borrar el import de la línea 15 y poner:

```ts
import { Alert } from 'react-native';
import { useBrands, useMarcasDe } from '../store/useBrands';
import { nombreValido, sugerirParecida } from '../data/marcas/nombre';
```

Reemplazar la línea 60 y agregar el handler:

```ts
  const brands = useMarcasDe(vehicle.kind);
  const agregarMarca = useBrands((s) => s.agregar);

  const pedirMarcaNueva = (texto: string) => {
    if (!nombreValido(texto)) {
      Alert.alert(
        'Ese nombre no sirve',
        'Usa letras, números, espacios, punto o guion. Máximo 40 caracteres.',
      );
      return;
    }

    const parecida = sugerirParecida(texto, brands);
    if (parecida) {
      Alert.alert(
        `¿Quisiste decir ${parecida}?`,
        `Escribiste «${texto}».`,
        [
          { text: `Usar ${parecida}`, onPress: () => setBrand(parecida) },
          {
            text: `Crear «${texto}»`,
            style: 'destructive',
            onPress: () => {
              agregarMarca(vehicle.kind, texto);
              setBrand(texto);
            },
          },
        ],
      );
      return;
    }

    agregarMarca(vehicle.kind, texto);
    setBrand(texto);
  };
```

Y en su `Select` de marca:

```tsx
                <Select
                  value={brand}
                  placeholder="Selecciona la marca"
                  options={brands}
                  onChange={setBrand}
                  searchable
                  onAddNew={pedirMarcaNueva}
                />
```

Antes de pegarlo, confirmar cómo se llama el setter de la marca en esta pantalla: si no es `setBrand`, usar el que haya.

El bloque se repite en vez de extraerse a un hook compartido a propósito: son dos usos y difieren en de dónde sale el `kind`. Si aparece un tercero, ahí sí conviene extraer `useAgregarMarca(kind, onElegida)`.

- [ ] **Step 5: Verificar que no quedó ninguna referencia a la lista vieja**

```bash
cd app-mobile && grep -rn "VE_BRANDS" src App.tsx || echo "sin referencias"
npx tsc --noEmit && npx jest
```

Expected: `sin referencias`, `tsc` limpio, todos los tests en verde.

- [ ] **Step 6: Probarlo a mano contra el backend**

```bash
cd backend-oil-app && pnpm start:dev
```

En otra terminal, `cd app-mobile && npx expo run:ios`. Después, en el simulador:

1. Alta de vehículo → paso 2 → abrir Marca. Deben verse las 10 de carro.
2. Buscar `Chery` → aparece `+ Agregar «Chery»` → tocarla → la marca queda elegida.
3. Reabrir el selector: `Chery` ahora está en la lista.
4. Buscar `Toyta` → `+ Agregar «Toyta»` → debe salir el aviso *"¿Quisiste decir Toyota?"*.
5. Confirmar contra la base que se creó una sola fila:

```bash
docker exec ruedalo-db psql -U ruedalo -d ruedalo -c \
  "select kind, name, \"nameKey\" from \"Brand\" where \"createdBy\" is not null;"
```

**Nota para quien ejecute esto en el simulador:** escribir con el teclado de hardware cuando ningún campo tiene el foco dispara el atajo de recarga de React Native — cualquier texto con una `r` reinicia la app y la navegación vuelve a Inicio. Si pasa, no es un bug de la app: asegurate de que el campo esté enfocado antes de escribir.

- [ ] **Step 7: Commit**

```bash
git add app-mobile/src
git add app-mobile/App.tsx
git commit -m "feat(marcas): el selector lee el catálogo del backend y permite aportar"
```

---

## Verificación final

- [ ] **Backend**

```bash
cd backend-oil-app && pnpm build && pnpm test && pnpm test:e2e
```

Expected: build limpio, los 144 unitarios anteriores más los nuevos de `brands`, y los 23 e2e anteriores más los 6 de marcas.

- [ ] **App**

```bash
cd app-mobile && npx tsc --noEmit && npx jest
```

Expected: `tsc` sin salida, los 172 anteriores más los nuevos.

- [ ] **La base quedó limpia después de los e2e**

```bash
docker exec ruedalo-db psql -U ruedalo -d ruedalo -c \
  'select count(*) from "Brand";'
```

Expected: 18. Si hay más, el `afterAll` de `brands.e2e-spec.ts` no está borrando lo que creó.
