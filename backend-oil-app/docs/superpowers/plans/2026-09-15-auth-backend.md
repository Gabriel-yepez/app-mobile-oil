# Backend de autenticación — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que un usuario pueda registrarse, iniciar sesión, mantener la sesión abierta entre aperturas de la app y cerrarla, con la app móvil conectada de punta a punta.

**Architecture:** Módulos de feature en NestJS con tres capas de frontera real — el controlador solo habla HTTP, el servicio solo reglas de negocio, Prisma solo persistencia. El servicio depende de la interfaz `UserRepository` a través del token de inyección `USER_REPOSITORY`, nunca de Prisma: por eso los tests unitarios corren sin base de datos y cambiar de motor es una línea. En el móvil, un envoltorio de `fetch` mete el `Bearer`, refresca el token una sola vez ante un `401` y reintenta.

**Tech Stack:** NestJS 11, PostgreSQL 16 (Docker en desarrollo), Prisma, `@nestjs/jwt` + `passport-jwt`, Argon2id, `class-validator`, `@nestjs/throttler`, Jest + Supertest. Del lado móvil: Expo SDK 57, `expo-secure-store`, zustand 5.

**Spec:** `docs/superpowers/specs/2026-09-15-auth-backend-design.md`

## Global Constraints

- **Gestor de paquetes: `pnpm`** (hay `pnpm-lock.yaml`). Nunca `npm install` en el backend.
- **Los servicios jamás importan de `@prisma/client`.** Solo `infra/prisma/**` puede. El repositorio devuelve el tipo de dominio `User`; si un tipo de Prisma se filtra a un servicio, la promesa de «cambiar de motor es una línea» deja de ser cierta.
- **Prefijo `/api/v1`** en todas las rutas.
- **Correo inexistente y contraseña equivocada devuelven el mismo `401 INVALID_CREDENTIALS`.** Nunca distinguirlos en el login.
- **Ningún endpoint devuelve `passwordHash`.** Las respuestas se arman con DTO de lista blanca, no excluyendo campos.
- **Contraseña: mínimo 8 caracteres, máximo 72**, al menos una letra y un dígito.
- **Idioma:** comentarios de código y mensajes de error de cara al usuario, en español. Nombres de código, en inglés.
- **Cada tarea termina con `pnpm lint` y `pnpm test` en verde** antes del commit.
- **TDD:** el test se escribe primero y se ejecuta para verlo fallar antes de implementar.

---

# Fase 1 — Backend

### Task 1: Cimientos — configuración validada, validación global y errores uniformes

Va primero porque todas las tareas siguientes dependen del `ValidationPipe`, del filtro de errores y del env tipado.

**Files:**
- Create: `src/config/env.validation.ts`, `src/config/configuration.ts`
- Create: `src/common/filters/all-exceptions.filter.ts`, `src/common/errors.ts`
- Create: `.env.example`
- Modify: `src/main.ts`, `src/app.module.ts`, `tsconfig.json`, `package.json`

**Interfaces:**
- Produces: `AppConfig` (tipo del env), `AllExceptionsFilter`, y las fábricas de error de `src/common/errors.ts` — que todas las tareas siguientes usan para lanzar errores.

- [ ] **Step 1: Instalar dependencias base**

```bash
pnpm add @nestjs/config class-validator class-transformer helmet
```

- [ ] **Step 2: Activar `strict` en TypeScript**

En `tsconfig.json`, dentro de `compilerOptions`, cambiar/añadir:

```json
"strict": true,
"noImplicitAny": true,
"strictBindCallApply": true
```

El starter son cuatro archivos triviales, así que el coste es cero hoy y evita que el código de autenticación —donde un `undefined` no visto es un agujero— se escriba sin red.

Verificar que sigue compilando: `pnpm exec tsc --noEmit`. Debe pasar sin errores.

- [ ] **Step 3: Escribir el test del validador de env**

Crear `src/config/env.validation.spec.ts`:

```ts
import { validateEnv } from './env.validation';

describe('validateEnv', () => {
  const valid = {
    DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
    JWT_ACCESS_SECRET: 'a'.repeat(32),
    JWT_REFRESH_SECRET: 'b'.repeat(32),
  };

  it('acepta un entorno válido y aplica los valores por defecto', () => {
    const env = validateEnv(valid);
    expect(env.PORT).toBe(3000);
    expect(env.JWT_ACCESS_TTL).toBe('15m');
  });

  it('falla si falta JWT_ACCESS_SECRET', () => {
    const { JWT_ACCESS_SECRET, ...sinSecreto } = valid;
    expect(() => validateEnv(sinSecreto)).toThrow(/JWT_ACCESS_SECRET/);
  });

  // Un secreto corto es adivinable: arrancar con él es peor que no arrancar.
  it('falla si un secreto es demasiado corto', () => {
    expect(() => validateEnv({ ...valid, JWT_ACCESS_SECRET: 'corto' })).toThrow();
  });

  // Reusar el mismo secreto para ambos tokens permite presentar un access
  // token como si fuera refresh: la separación tiene que ser obligatoria.
  it('falla si los dos secretos son iguales', () => {
    expect(() =>
      validateEnv({ ...valid, JWT_REFRESH_SECRET: valid.JWT_ACCESS_SECRET }),
    ).toThrow(/distinto/i);
  });
});
```

- [ ] **Step 4: Ejecutar el test y verlo fallar**

Run: `pnpm test src/config/env.validation.spec.ts`
Expected: FAIL — `Cannot find module './env.validation'`.

- [ ] **Step 5: Implementar el validador de env**

Crear `src/config/env.validation.ts`:

```ts
// Valida el entorno AL ARRANCAR. Si algo falta, el proceso no levanta.
// Arrancar con un secreto por defecto es peor que no arrancar: el fallo
// sería silencioso y en producción.
import { plainToInstance, Transform } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString, MinLength, validateSync } from 'class-validator';

export class EnvVars {
  @IsString()
  @IsNotEmpty()
  DATABASE_URL!: string;

  @IsString()
  @MinLength(32, { message: 'JWT_ACCESS_SECRET debe tener al menos 32 caracteres' })
  JWT_ACCESS_SECRET!: string;

  @IsString()
  @MinLength(32, { message: 'JWT_REFRESH_SECRET debe tener al menos 32 caracteres' })
  JWT_REFRESH_SECRET!: string;

  @IsOptional() @IsString()
  JWT_ACCESS_TTL: string = '15m';

  @IsOptional() @IsString()
  JWT_REFRESH_TTL: string = '30d';

  @IsOptional() @IsInt() @Transform(({ value }) => Number(value ?? 3000))
  PORT: number = 3000;

  @IsOptional() @IsString()
  CORS_ORIGINS: string = '';
}

export function validateEnv(raw: Record<string, unknown>): EnvVars {
  const env = plainToInstance(EnvVars, raw, { enableImplicitConversion: true });
  const errores = validateSync(env, { skipMissingProperties: false });

  if (errores.length > 0) {
    const detalle = errores
      .map((e) => Object.values(e.constraints ?? {}).join(', '))
      .join('\n  - ');
    throw new Error(`Configuración inválida:\n  - ${detalle}`);
  }

  if (env.JWT_ACCESS_SECRET === env.JWT_REFRESH_SECRET) {
    throw new Error(
      'JWT_REFRESH_SECRET debe ser distinto de JWT_ACCESS_SECRET: ' +
        'con el mismo secreto, un access token vale como refresh token.',
    );
  }

  return env;
}
```

- [ ] **Step 6: Ejecutar el test y verlo pasar**

Run: `pnpm test src/config/env.validation.spec.ts`
Expected: PASS — 4 tests.

- [ ] **Step 7: Crear los errores de la aplicación**

Crear `src/common/errors.ts`:

```ts
// Todo error de negocio sale de acá. El `code` es el contrato estable con la
// app (ramifica por él); el `message` es texto para el usuario y puede cambiar.
import { HttpException, HttpStatus } from '@nestjs/common';

export class AppError extends HttpException {
  constructor(status: HttpStatus, code: string, message: string) {
    super({ error: code, message }, status);
  }
}

export const Errors = {
  invalidCredentials: () =>
    new AppError(HttpStatus.UNAUTHORIZED, 'INVALID_CREDENTIALS', 'Correo o contraseña incorrectos.'),

  invalidRefreshToken: () =>
    new AppError(HttpStatus.UNAUTHORIZED, 'INVALID_REFRESH_TOKEN', 'Tu sesión expiró. Inicia sesión de nuevo.'),

  emailTaken: () =>
    new AppError(HttpStatus.CONFLICT, 'EMAIL_TAKEN', 'Ese correo ya tiene una cuenta.'),

  cedulaTaken: () =>
    new AppError(HttpStatus.CONFLICT, 'CEDULA_TAKEN', 'Esa cédula ya tiene una cuenta.'),
};
```

- [ ] **Step 8: Escribir el test del filtro de excepciones**

Crear `src/common/filters/all-exceptions.filter.spec.ts`:

```ts
import { ArgumentsHost, BadRequestException } from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';
import { Errors } from '../errors';

function hostFalso() {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({ getResponse: () => ({ status }), getRequest: () => ({ url: '/x' }) }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
}

describe('AllExceptionsFilter', () => {
  const filtro = new AllExceptionsFilter();

  it('da forma uniforme a un error de negocio', () => {
    const { host, status, json } = hostFalso();
    filtro.catch(Errors.emailTaken(), host);

    expect(status).toHaveBeenCalledWith(409);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 409, error: 'EMAIL_TAKEN' }),
    );
  });

  it('traduce el error del ValidationPipe a VALIDATION_ERROR con el detalle', () => {
    const { host, json } = hostFalso();
    filtro.catch(new BadRequestException(['email debe ser un correo']), host);

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'VALIDATION_ERROR', details: ['email debe ser un correo'] }),
    );
  });

  // Un stack trace en la respuesta le regala al atacante el mapa de la casa.
  it('no filtra detalles internos en un error inesperado', () => {
    const { host, status, json } = hostFalso();
    filtro.catch(new Error('la conexión a la base explotó en la tabla users'), host);

    expect(status).toHaveBeenCalledWith(500);
    const cuerpo = json.mock.calls[0][0];
    expect(cuerpo.error).toBe('INTERNAL_ERROR');
    expect(JSON.stringify(cuerpo)).not.toContain('tabla users');
  });
});
```

- [ ] **Step 9: Ejecutar el test y verlo fallar**

Run: `pnpm test src/common/filters/all-exceptions.filter.spec.ts`
Expected: FAIL — módulo no encontrado.

- [ ] **Step 10: Implementar el filtro**

Crear `src/common/filters/all-exceptions.filter.ts`:

```ts
// Una sola forma de error para toda la API. La app ramifica por `error`.
import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let error = 'INTERNAL_ERROR';
    let message = 'Ocurrió un error inesperado.';
    let details: string[] | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const cuerpo = exception.getResponse();

      if (typeof cuerpo === 'object' && cuerpo !== null && 'error' in cuerpo) {
        // Error nuestro, ya con código.
        const c = cuerpo as { error: string; message: string };
        error = c.error;
        message = c.message;
      } else if (status === HttpStatus.BAD_REQUEST) {
        // Viene del ValidationPipe: su `message` es el array de fallos.
        const c = cuerpo as { message?: string | string[] };
        error = 'VALIDATION_ERROR';
        message = 'Revisa los datos enviados.';
        details = Array.isArray(c.message) ? c.message : [String(c.message)];
      } else if (status === HttpStatus.TOO_MANY_REQUESTS) {
        error = 'TOO_MANY_REQUESTS';
        message = 'Demasiados intentos. Espera un momento.';
      } else {
        error = 'HTTP_ERROR';
        message = typeof cuerpo === 'string' ? cuerpo : message;
      }
    } else {
      // Inesperado: al log va todo, a la respuesta nada. Un stack trace en el
      // cuerpo le entrega al atacante la estructura interna.
      this.logger.error(`${req.method} ${req.url}`, exception instanceof Error ? exception.stack : String(exception));
    }

    res.status(status).json({
      statusCode: status,
      error,
      message,
      ...(details ? { details } : {}),
      timestamp: new Date().toISOString(),
    });
  }
}
```

- [ ] **Step 11: Ejecutar el test y verlo pasar**

Run: `pnpm test src/common/filters/all-exceptions.filter.spec.ts`
Expected: PASS — 3 tests.

- [ ] **Step 12: Cablear `main.ts` y `app.module.ts`**

Crear `src/config/configuration.ts`:

```ts
import { EnvVars } from './env.validation';

export type AppConfig = EnvVars;

export const configuration = (): AppConfig => process.env as unknown as AppConfig;
```

Reemplazar `src/main.ts`:

```ts
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.setGlobalPrefix('api/v1');
  app.use(helmet());

  const origins = config.get<string>('CORS_ORIGINS', '');
  app.enableCors({ origin: origins ? origins.split(',').map((o) => o.trim()) : true });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,            // borra lo que no está en el DTO
      forbidNonWhitelisted: true, // y si viene de más, rechaza en vez de ignorar
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());

  await app.listen(config.get<number>('PORT', 3000));
}
void bootstrap();
```

Reemplazar `src/app.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './config/env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv, cache: true }),
  ],
})
export class AppModule {}
```

Borrar `src/app.controller.ts`, `src/app.service.ts` y `src/app.controller.spec.ts`: eran del scaffold y ya no aplican.

- [ ] **Step 13: Crear `.env.example` y el `.env` local**

Crear `.env.example`:

```
DATABASE_URL="postgresql://ruedalo:ruedalo@localhost:5432/ruedalo?schema=public"
JWT_ACCESS_SECRET="cambiame-por-32-caracteres-o-mas-aleatorios"
JWT_REFRESH_SECRET="otro-distinto-de-32-caracteres-o-mas"
JWT_ACCESS_TTL="15m"
JWT_REFRESH_TTL="30d"
PORT=3000
CORS_ORIGINS=""
```

Generar el `.env` real con secretos de verdad:

```bash
cp .env.example .env
node -e "const c=require('crypto');console.log('JWT_ACCESS_SECRET='+c.randomBytes(48).toString('hex'));console.log('JWT_REFRESH_SECRET='+c.randomBytes(48).toString('hex'))"
```

Pegar esos dos valores en `.env`. El `.env` ya está en `.gitignore`: verificar con `git check-ignore .env` (debe imprimir `.env`).

- [ ] **Step 14: Verificar que arranca y que falla sin secretos**

```bash
pnpm start
```
Debe levantar en el puerto 3000.

Luego, la comprobación que importa:

```bash
JWT_ACCESS_SECRET= pnpm start
```
Expected: el proceso **muere** con `Configuración inválida: ... JWT_ACCESS_SECRET`. Si arranca, el Step 5 está mal.

- [ ] **Step 15: Commit**

```bash
git add -A
git commit -m "feat(config): env validado al arrancar, validación global y errores uniformes"
```

---

### Task 2: Postgres en Docker, esquema Prisma y migración

**Files:**
- Create: `docker-compose.yml`, `prisma/schema.prisma`
- Create: `src/infra/prisma/prisma.service.ts`, `src/infra/prisma/prisma.module.ts`
- Modify: `package.json` (scripts), `src/app.module.ts`

**Interfaces:**
- Produces: `PrismaService` (extiende `PrismaClient`) y `PrismaModule`, que exporta `PrismaService`. Los modelos `User` y `RefreshToken` en la base.

- [ ] **Step 1: Levantar Postgres**

Crear `docker-compose.yml`:

```yaml
services:
  db:
    image: postgres:16-alpine
    container_name: ruedalo-db
    restart: unless-stopped
    environment:
      POSTGRES_USER: ruedalo
      POSTGRES_PASSWORD: ruedalo
      POSTGRES_DB: ruedalo
    ports: ['5432:5432']
    volumes: ['ruedalo-pgdata:/var/lib/postgresql/data']
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U ruedalo']
      interval: 5s
      retries: 10

volumes:
  ruedalo-pgdata:
```

```bash
docker compose up -d
docker compose ps
```
Expected: el servicio `db` en estado `healthy`.

- [ ] **Step 2: Instalar Prisma y definir el esquema**

```bash
pnpm add @prisma/client
pnpm add -D prisma
pnpm exec prisma init --datasource-provider postgresql
```

Reemplazar el contenido de `prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Currency {
  USD
  BS
  BOTH
}

model User {
  id            String   @id @default(uuid()) @db.Uuid
  email         String   @unique
  cedula        String   @unique
  passwordHash  String
  fullName      String
  phone         String
  state         String?
  city          String?
  currency      Currency @default(BOTH)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  refreshTokens RefreshToken[]
}

model RefreshToken {
  id         String    @id @default(uuid()) @db.Uuid
  tokenHash  String    @unique
  userId     String    @db.Uuid
  user       User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  expiresAt  DateTime
  revokedAt  DateTime?
  replacedBy String?
  createdAt  DateTime  @default(now())

  @@index([userId])
}
```

Cuidado: `prisma init` sobrescribe `.env` añadiendo su propio `DATABASE_URL`. Verificar que el `.env` conserva los secretos JWT del Task 1 y que hay un solo `DATABASE_URL`.

- [ ] **Step 3: Crear la migración**

```bash
pnpm exec prisma migrate dev --name init_auth
```
Expected: crea `prisma/migrations/<fecha>_init_auth/` y genera el cliente.

Comprobar que las tablas existen:

```bash
docker compose exec db psql -U ruedalo -d ruedalo -c '\dt'
```
Expected: aparecen `User` y `RefreshToken`.

- [ ] **Step 4: Añadir los scripts de base de datos**

En `package.json`, dentro de `scripts`:

```json
"db:up": "docker compose up -d",
"db:migrate": "prisma migrate dev",
"db:generate": "prisma generate",
"db:studio": "prisma studio"
```

- [ ] **Step 5: Implementar `PrismaService` y `PrismaModule`**

Crear `src/infra/prisma/prisma.service.ts`:

```ts
// Único punto del backend que conoce Prisma, junto con los repositorios.
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  // Sin esto, al apagar el proceso quedan conexiones colgadas y los tests e2e
  // no terminan nunca.
  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
```

Crear `src/infra/prisma/prisma.module.ts`:

```ts
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({ providers: [PrismaService], exports: [PrismaService] })
export class PrismaModule {}
```

Añadir `PrismaModule` a los `imports` de `AppModule`.

- [ ] **Step 6: Verificar que arranca conectado**

```bash
pnpm start
```
Expected: levanta sin errores de conexión. Si falla, revisar que `docker compose ps` diga `healthy`.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(db): Postgres en Docker, esquema Prisma y migración inicial"
```

---

### Task 3: Dominio de usuario — tipo, contrato del repositorio y doble en memoria

Esta tarea no escribe ninguna consulta: define el contrato y el doble que hace posible testear el negocio sin base de datos. Es la pieza que sostiene el «cambiar de motor es una línea».

**Files:**
- Create: `src/modules/users/domain/user.ts`
- Create: `src/modules/users/domain/user.repository.ts`
- Create: `src/modules/users/testing/in-memory-user.repository.ts`
- Create: `src/modules/users/testing/in-memory-user.repository.spec.ts`

**Interfaces:**
- Produces:
  - `type User = { id, email, cedula, passwordHash, fullName, phone, state, city, currency, createdAt, updatedAt }`
  - `type NewUser = Omit<User, 'id' | 'createdAt' | 'updatedAt'>`
  - `const USER_REPOSITORY: symbol`
  - `interface UserRepository { findByEmail(email: string): Promise<User | null>; findById(id: string): Promise<User | null>; existsByEmail(email: string): Promise<boolean>; existsByCedula(cedula: string): Promise<boolean>; create(data: NewUser): Promise<User> }`
  - `class InMemoryUserRepository implements UserRepository` — lo consumen los tests de las Tasks 5, 6 y 7.

- [ ] **Step 1: Definir el tipo de dominio**

Crear `src/modules/users/domain/user.ts`:

```ts
// El usuario como lo entiende el negocio. Deliberadamente SIN tipos de Prisma:
// si el dominio importara `@prisma/client`, cambiar de motor dejaría de ser
// una línea porque el acoplamiento se filtraría por los tipos a toda la app.
export type Currency = 'USD' | 'BS' | 'BOTH';

export type User = {
  id: string;
  email: string;
  cedula: string;
  passwordHash: string;
  fullName: string;
  phone: string;
  state: string | null;
  city: string | null;
  currency: Currency;
  createdAt: Date;
  updatedAt: Date;
};

/** Lo que hace falta para crear uno: el id y las fechas los pone el almacén. */
export type NewUser = Omit<User, 'id' | 'createdAt' | 'updatedAt'>;
```

- [ ] **Step 2: Definir el contrato y el token de inyección**

Crear `src/modules/users/domain/user.repository.ts`:

```ts
import type { NewUser, User } from './user';

/** Token de inyección: los servicios piden ESTO, no una clase concreta. */
export const USER_REPOSITORY = Symbol('USER_REPOSITORY');

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  existsByEmail(email: string): Promise<boolean>;
  existsByCedula(cedula: string): Promise<boolean>;
  create(data: NewUser): Promise<User>;
}
```

- [ ] **Step 3: Escribir el test del doble en memoria**

Crear `src/modules/users/testing/in-memory-user.repository.spec.ts`:

```ts
import { InMemoryUserRepository } from './in-memory-user.repository';
import type { NewUser } from '../domain/user';

const nuevo = (over: Partial<NewUser> = {}): NewUser => ({
  email: 'luis@correo.com',
  cedula: 'V25481073',
  passwordHash: 'hash',
  fullName: 'Luis Guerrero',
  phone: '+58 414 528 9012',
  state: null,
  city: null,
  currency: 'BOTH',
  ...over,
});

describe('InMemoryUserRepository', () => {
  let repo: InMemoryUserRepository;
  beforeEach(() => { repo = new InMemoryUserRepository(); });

  it('crea y recupera por id y por correo', async () => {
    const creado = await repo.create(nuevo());
    expect(creado.id).toBeTruthy();
    await expect(repo.findById(creado.id)).resolves.toMatchObject({ email: 'luis@correo.com' });
    await expect(repo.findByEmail('luis@correo.com')).resolves.toMatchObject({ id: creado.id });
  });

  it('devuelve null cuando no existe', async () => {
    await expect(repo.findByEmail('nadie@correo.com')).resolves.toBeNull();
  });

  it('informa de correo y cédula ya usados', async () => {
    await repo.create(nuevo());
    await expect(repo.existsByEmail('luis@correo.com')).resolves.toBe(true);
    await expect(repo.existsByCedula('V25481073')).resolves.toBe(true);
    await expect(repo.existsByCedula('V99999999')).resolves.toBe(false);
  });
});
```

- [ ] **Step 4: Ejecutar el test y verlo fallar**

Run: `pnpm test in-memory-user`
Expected: FAIL — módulo no encontrado.

- [ ] **Step 5: Implementar el doble en memoria**

Crear `src/modules/users/testing/in-memory-user.repository.ts`:

```ts
// Doble de test: cumple el mismo contrato que el repositorio de Prisma, así
// que el negocio se testea entero sin levantar una base de datos.
// Vive en src/ (no en test/) porque es código tipado que el compilador debe
// verificar contra la interfaz: si el contrato cambia, esto rompe primero.
import { randomUUID } from 'node:crypto';
import type { NewUser, User } from '../domain/user';
import type { UserRepository } from '../domain/user.repository';

export class InMemoryUserRepository implements UserRepository {
  private readonly users = new Map<string, User>();

  findById(id: string): Promise<User | null> {
    return Promise.resolve(this.users.get(id) ?? null);
  }

  findByEmail(email: string): Promise<User | null> {
    const found = [...this.users.values()].find((u) => u.email === email);
    return Promise.resolve(found ?? null);
  }

  existsByEmail(email: string): Promise<boolean> {
    return Promise.resolve([...this.users.values()].some((u) => u.email === email));
  }

  existsByCedula(cedula: string): Promise<boolean> {
    return Promise.resolve([...this.users.values()].some((u) => u.cedula === cedula));
  }

  create(data: NewUser): Promise<User> {
    const now = new Date();
    const user: User = { ...data, id: randomUUID(), createdAt: now, updatedAt: now };
    this.users.set(user.id, user);
    return Promise.resolve(user);
  }
}
```

- [ ] **Step 6: Ejecutar el test y verlo pasar**

Run: `pnpm test in-memory-user`
Expected: PASS — 3 tests.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(users): tipo de dominio, contrato del repositorio y doble en memoria"
```

---

### Task 4: `PrismaUserRepository` y el cableado del módulo

Acá aparece la línea que hace intercambiable el motor.

**Files:**
- Create: `src/infra/prisma/prisma-user.repository.ts`
- Create: `src/modules/users/users.module.ts`
- Create: `test/prisma-user.repository.e2e-spec.ts`

**Interfaces:**
- Consumes: `UserRepository`, `USER_REPOSITORY`, `User`, `NewUser` (Task 3); `PrismaService` (Task 2).
- Produces: `UsersModule`, que exporta `USER_REPOSITORY` ya resuelto a `PrismaUserRepository`.

- [ ] **Step 1: Escribir el test de integración**

Este test sí toca la base: es el único que puede demostrar que el mapeo y los índices únicos funcionan de verdad. Va en `test/` porque usa el runner e2e.

Crear `test/prisma-user.repository.e2e-spec.ts`:

```ts
import { PrismaService } from '../src/infra/prisma/prisma.service';
import { PrismaUserRepository } from '../src/infra/prisma/prisma-user.repository';
import type { NewUser } from '../src/modules/users/domain/user';

const nuevo = (over: Partial<NewUser> = {}): NewUser => ({
  email: `luis-${Date.now()}-${Math.random()}@correo.com`,
  cedula: `V${Math.floor(Math.random() * 1e8)}`,
  passwordHash: 'hash',
  fullName: 'Luis Guerrero',
  phone: '+58 414 528 9012',
  state: null,
  city: null,
  currency: 'BOTH',
  ...over,
});

describe('PrismaUserRepository (integración)', () => {
  const prisma = new PrismaService();
  const repo = new PrismaUserRepository(prisma);

  afterAll(async () => { await prisma.$disconnect(); });

  it('crea y recupera devolviendo el tipo de dominio', async () => {
    const data = nuevo();
    const creado = await repo.create(data);

    expect(creado.id).toBeTruthy();
    expect(creado.currency).toBe('BOTH');
    await expect(repo.findByEmail(data.email)).resolves.toMatchObject({ id: creado.id });
    await expect(repo.findById(creado.id)).resolves.toMatchObject({ email: data.email });
  });

  it('devuelve null cuando no existe', async () => {
    await expect(repo.findByEmail('no-existe@correo.com')).resolves.toBeNull();
    await expect(repo.findById('00000000-0000-0000-0000-000000000000')).resolves.toBeNull();
  });

  it('detecta correo y cédula ya usados', async () => {
    const data = nuevo();
    await repo.create(data);
    await expect(repo.existsByEmail(data.email)).resolves.toBe(true);
    await expect(repo.existsByCedula(data.cedula)).resolves.toBe(true);
  });
});
```

- [ ] **Step 2: Ejecutar el test y verlo fallar**

Run: `pnpm test:e2e prisma-user`
Expected: FAIL — módulo `prisma-user.repository` no encontrado.

- [ ] **Step 3: Implementar el repositorio**

Crear `src/infra/prisma/prisma-user.repository.ts`:

```ts
// Frontera con Prisma. Entra/sale el tipo de DOMINIO: el mapeo se hace acá y
// no más arriba, que es lo que mantiene a los servicios ignorantes del motor.
import { Injectable } from '@nestjs/common';
import type { User as PrismaUser } from '@prisma/client';
import type { NewUser, User } from '../../modules/users/domain/user';
import type { UserRepository } from '../../modules/users/domain/user.repository';
import { PrismaService } from './prisma.service';

@Injectable()
export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  private toDomain(row: PrismaUser): User {
    return {
      id: row.id,
      email: row.email,
      cedula: row.cedula,
      passwordHash: row.passwordHash,
      fullName: row.fullName,
      phone: row.phone,
      state: row.state,
      city: row.city,
      currency: row.currency,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async findById(id: string): Promise<User | null> {
    const row = await this.prisma.user.findUnique({ where: { id } });
    return row ? this.toDomain(row) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const row = await this.prisma.user.findUnique({ where: { email } });
    return row ? this.toDomain(row) : null;
  }

  async existsByEmail(email: string): Promise<boolean> {
    return (await this.prisma.user.count({ where: { email } })) > 0;
  }

  async existsByCedula(cedula: string): Promise<boolean> {
    return (await this.prisma.user.count({ where: { cedula } })) > 0;
  }

  async create(data: NewUser): Promise<User> {
    return this.toDomain(await this.prisma.user.create({ data }));
  }
}
```

Nota: `findById` con un id que no es un UUID válido hace que Prisma lance en vez de devolver `null`. El test usa un UUID nulo válido justamente por eso; los ids siempre vendrán del JWT, que los emitimos nosotros.

- [ ] **Step 4: Crear `UsersModule` — la línea del cambio de motor**

Crear `src/modules/users/users.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { PrismaUserRepository } from '../../infra/prisma/prisma-user.repository';
import { USER_REPOSITORY } from './domain/user.repository';

@Module({
  providers: [
    // ─────────────────────────────────────────────────────────────────
    // ESTA es la línea. Cambiar de motor = escribir otra clase que
    // cumpla UserRepository y cambiar el useClass. Nada más se toca.
    { provide: USER_REPOSITORY, useClass: PrismaUserRepository },
    // ─────────────────────────────────────────────────────────────────
  ],
  exports: [USER_REPOSITORY],
})
export class UsersModule {}
```

- [ ] **Step 5: Ejecutar el test y verlo pasar**

```bash
docker compose up -d
pnpm test:e2e prisma-user
```
Expected: PASS — 3 tests.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(users): repositorio Prisma tras el token USER_REPOSITORY"
```

---

### Task 5: Hash de contraseña con Argon2id

**Files:**
- Create: `src/modules/auth/domain/password-hasher.ts`
- Create: `src/modules/auth/hashing/argon2.hasher.ts`
- Create: `src/modules/auth/hashing/argon2.hasher.spec.ts`

**Interfaces:**
- Produces: `const PASSWORD_HASHER: symbol`; `interface PasswordHasher { hash(plain: string): Promise<string>; verify(hash: string, plain: string): Promise<boolean> }`; `class Argon2Hasher implements PasswordHasher`.

- [ ] **Step 1: Instalar argon2**

```bash
pnpm add argon2
```

- [ ] **Step 2: Definir el contrato**

Crear `src/modules/auth/domain/password-hasher.ts`:

```ts
/** Token de inyección: el servicio pide ESTO, no Argon2 directamente. */
export const PASSWORD_HASHER = Symbol('PASSWORD_HASHER');

export interface PasswordHasher {
  hash(plain: string): Promise<string>;
  /** `false` en vez de lanzar si el hash está corrupto: un registro dañado no
   *  debe tumbar el login, solo negar el acceso. */
  verify(hash: string, plain: string): Promise<boolean>;
}
```

- [ ] **Step 3: Escribir el test**

Crear `src/modules/auth/hashing/argon2.hasher.spec.ts`:

```ts
import { Argon2Hasher } from './argon2.hasher';

describe('Argon2Hasher', () => {
  const hasher = new Argon2Hasher();

  it('verifica la contraseña correcta', async () => {
    const hash = await hasher.hash('contraseña1');
    await expect(hasher.verify(hash, 'contraseña1')).resolves.toBe(true);
  });

  it('rechaza la incorrecta', async () => {
    const hash = await hasher.hash('contraseña1');
    await expect(hasher.verify(hash, 'contraseña2')).resolves.toBe(false);
  });

  // Si dos usuarios con la misma clave tuvieran el mismo hash, una tabla
  // precalculada los rompería a todos de una vez. La sal lo impide.
  it('produce hashes distintos para la misma contraseña', async () => {
    const [a, b] = await Promise.all([hasher.hash('igual'), hasher.hash('igual')]);
    expect(a).not.toBe(b);
  });

  it('usa argon2id', async () => {
    expect(await hasher.hash('x')).toMatch(/^\$argon2id\$/);
  });

  it('devuelve false con un hash corrupto en vez de lanzar', async () => {
    await expect(hasher.verify('esto-no-es-un-hash', 'x')).resolves.toBe(false);
  });
});
```

- [ ] **Step 4: Ejecutar el test y verlo fallar**

Run: `pnpm test argon2`
Expected: FAIL — módulo no encontrado.

- [ ] **Step 5: Implementar**

Crear `src/modules/auth/hashing/argon2.hasher.ts`:

```ts
// Argon2id: recomendación actual de OWASP. A diferencia de bcrypt es costoso
// en MEMORIA, no solo en CPU, que es lo que le quita la ventaja al atacante
// con GPU.
import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import type { PasswordHasher } from '../domain/password-hasher';

const OPCIONES: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 19456, // 19 MiB — mínimo que recomienda OWASP
  timeCost: 2,
  parallelism: 1,
};

@Injectable()
export class Argon2Hasher implements PasswordHasher {
  hash(plain: string): Promise<string> {
    return argon2.hash(plain, OPCIONES);
  }

  async verify(hash: string, plain: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, plain);
    } catch {
      // Hash corrupto o de otro formato: es un "no pasa", no una caída.
      return false;
    }
  }
}
```

- [ ] **Step 6: Ejecutar el test y verlo pasar**

Run: `pnpm test argon2`
Expected: PASS — 5 tests.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(auth): hash de contraseñas con Argon2id tras un token de inyección"
```

---

### Task 6: DTOs de registro con normalización

**Files:**
- Create: `src/modules/auth/dto/register.dto.ts`, `src/modules/auth/dto/login.dto.ts`, `src/modules/auth/dto/refresh.dto.ts`
- Create: `src/modules/auth/dto/user-response.dto.ts`
- Create: `src/modules/auth/dto/register.dto.spec.ts`

**Interfaces:**
- Produces: `RegisterDto { fullName, cedula, email, phone, password }` (ya normalizados), `LoginDto { email, password }`, `RefreshDto { refreshToken }`, `UserResponse` + `toUserResponse(user: User): UserResponse`.

- [ ] **Step 1: Escribir el test de normalización y validación**

Crear `src/modules/auth/dto/register.dto.spec.ts`:

```ts
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { RegisterDto } from './register.dto';

const base = {
  fullName: 'Luis Guerrero',
  cedula: 'V-25.481.073',
  email: '  Luis.Guerrero@Correo.COM ',
  phone: '+58 414 528 9012',
  password: 'contrasena1',
};

const construir = (over: Partial<typeof base> = {}) =>
  plainToInstance(RegisterDto, { ...base, ...over });

describe('RegisterDto', () => {
  it('normaliza el correo a minúsculas y sin espacios', () => {
    expect(construir().email).toBe('luis.guerrero@correo.com');
  });

  // Sin esto, "V-25.481.073" y "25481073" crearían dos cuentas de la misma
  // persona y el índice único no serviría de nada.
  it.each([
    ['V-25.481.073', 'V25481073'],
    ['25.481.073', 'V25481073'],
    ['v25481073', 'V25481073'],
    ['E-84.123.456', 'E84123456'],
  ])('normaliza la cédula %s → %s', (entrada, esperado) => {
    expect(construir({ cedula: entrada }).cedula).toBe(esperado);
  });

  it('acepta un registro válido', () => {
    expect(validateSync(construir())).toHaveLength(0);
  });

  it.each([
    ['contraseña de 7', { password: 'abc123x' }],
    ['contraseña sin dígito', { password: 'solamenteletras' }],
    ['contraseña sin letra', { password: '12345678' }],
    ['correo inválido', { email: 'no-es-correo' }],
    ['nombre vacío', { fullName: '   ' }],
    ['cédula corta', { cedula: 'V-123' }],
  ])('rechaza %s', (_, over) => {
    expect(validateSync(construir(over)).length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Ejecutar el test y verlo fallar**

Run: `pnpm test register.dto`
Expected: FAIL — módulo no encontrado.

- [ ] **Step 3: Implementar los DTOs de entrada**

Crear `src/modules/auth/dto/register.dto.ts`:

```ts
// La normalización vive acá, en la frontera de entrada, y no en el servicio:
// así el servicio y el repositorio ven SIEMPRE el valor canónico y el índice
// único de la base puede hacer su trabajo.
import { Transform } from 'class-transformer';
import { IsEmail, IsString, Length, Matches } from 'class-validator';

const texto = (v: unknown) => (typeof v === 'string' ? v : '');

/** "V-25.481.073" → "V25481073". Sin letra se asume V (venezolano). */
export function normalizarCedula(valor: string): string {
  const limpio = valor.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const conLetra = /^[VEJG]/.test(limpio) ? limpio : `V${limpio}`;
  return conLetra.replace(/[^A-Z0-9]/g, '');
}

export class RegisterDto {
  @Transform(({ value }) => texto(value).trim())
  @IsString()
  @Length(2, 80, { message: 'El nombre debe tener entre 2 y 80 caracteres' })
  fullName!: string;

  @Transform(({ value }) => normalizarCedula(texto(value)))
  @IsString()
  @Matches(/^[VEJG]\d{6,9}$/, { message: 'La cédula no tiene un formato válido' })
  cedula!: string;

  @Transform(({ value }) => texto(value).trim().toLowerCase())
  @IsEmail({}, { message: 'El correo no es válido' })
  @Length(5, 160)
  email!: string;

  @Transform(({ value }) => texto(value).trim())
  @IsString()
  @Matches(/^[\d+\-() ]{7,20}$/, { message: 'El teléfono no tiene un formato válido' })
  phone!: string;

  // 72 es el límite práctico de las funciones de hash: cortar en silencio una
  // contraseña más larga sería peor que rechazarla.
  @IsString()
  @Length(8, 72, { message: 'La contraseña debe tener entre 8 y 72 caracteres' })
  @Matches(/(?=.*[A-Za-zÀ-ÿ])(?=.*\d)/, {
    message: 'La contraseña debe incluir al menos una letra y un número',
  })
  password!: string;
}
```

Crear `src/modules/auth/dto/login.dto.ts`:

```ts
import { Transform } from 'class-transformer';
import { IsEmail, IsString, Length } from 'class-validator';

export class LoginDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : ''))
  @IsEmail({}, { message: 'El correo no es válido' })
  email!: string;

  // A propósito sin reglas de fuerza: en el login la clave o coincide o no.
  // Validar aquí el formato solo le diría al atacante cómo son las válidas.
  @IsString()
  @Length(1, 72)
  password!: string;
}
```

Crear `src/modules/auth/dto/refresh.dto.ts`:

```ts
import { IsString, Length } from 'class-validator';

export class RefreshDto {
  @IsString()
  @Length(20, 200)
  refreshToken!: string;
}
```

- [ ] **Step 4: Implementar el DTO de respuesta**

Crear `src/modules/auth/dto/user-response.dto.ts`:

```ts
// Lista BLANCA a propósito. Excluir campos es frágil: olvidar excluir uno es
// silencioso, olvidar incluirlo se ve de inmediato en la respuesta.
import type { Currency, User } from '../../users/domain/user';

export type UserResponse = {
  id: string;
  fullName: string;
  cedula: string;
  email: string;
  phone: string;
  state: string | null;
  city: string | null;
  currency: Currency;
};

export function toUserResponse(user: User): UserResponse {
  return {
    id: user.id,
    fullName: user.fullName,
    cedula: user.cedula,
    email: user.email,
    phone: user.phone,
    state: user.state,
    city: user.city,
    currency: user.currency,
  };
}
```

- [ ] **Step 5: Ejecutar el test y verlo pasar**

Run: `pnpm test register.dto`
Expected: PASS — 11 casos.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(auth): DTOs de entrada con normalización y respuesta de lista blanca"
```

---

### Task 7: `TokenService` — emisión, rotación y detección de reuso

El corazón de la seguridad de la sesión. Se hace antes que `AuthService` porque éste lo consume.

**Files:**
- Create: `src/modules/auth/domain/refresh-token.repository.ts`
- Create: `src/modules/auth/testing/in-memory-refresh-token.repository.ts`
- Create: `src/infra/prisma/prisma-refresh-token.repository.ts`
- Create: `src/modules/auth/token.service.ts`, `src/modules/auth/token.service.spec.ts`

**Interfaces:**
- Consumes: `User` (Task 3).
- Produces:
  - `const REFRESH_TOKEN_REPOSITORY: symbol`
  - `type RefreshTokenRecord = { id, tokenHash, userId, expiresAt, revokedAt, replacedBy }`
  - `interface RefreshTokenRepository { create(d: { tokenHash: string; userId: string; expiresAt: Date }): Promise<RefreshTokenRecord>; findByHash(h: string): Promise<RefreshTokenRecord | null>; markRotated(id: string, replacedById: string): Promise<void>; revokeByHash(h: string): Promise<void>; revokeAllForUser(userId: string): Promise<void> }`
  - `type TokenPair = { accessToken: string; refreshToken: string }`
  - `class TokenService { issuePair(user: User): Promise<TokenPair>; rotate(refreshToken: string): Promise<{ pair: TokenPair; userId: string }>; revoke(refreshToken: string): Promise<void> }`

- [ ] **Step 1: Instalar JWT**

```bash
pnpm add @nestjs/jwt @nestjs/passport passport passport-jwt
pnpm add -D @types/passport-jwt
```

- [ ] **Step 2: Definir el contrato del repositorio de refresh**

Crear `src/modules/auth/domain/refresh-token.repository.ts`:

```ts
export const REFRESH_TOKEN_REPOSITORY = Symbol('REFRESH_TOKEN_REPOSITORY');

export type RefreshTokenRecord = {
  id: string;
  tokenHash: string;
  userId: string;
  expiresAt: Date;
  revokedAt: Date | null;
  replacedBy: string | null;
};

export interface RefreshTokenRepository {
  create(data: { tokenHash: string; userId: string; expiresAt: Date }): Promise<RefreshTokenRecord>;
  findByHash(tokenHash: string): Promise<RefreshTokenRecord | null>;
  /** Marca el token como rotado, apuntando al que lo sucede. */
  markRotated(id: string, replacedById: string): Promise<void>;
  revokeByHash(tokenHash: string): Promise<void>;
  /** Respuesta ante reuso detectado: se caen todas las sesiones del usuario. */
  revokeAllForUser(userId: string): Promise<void>;
}
```

- [ ] **Step 3: Implementar el doble en memoria**

Crear `src/modules/auth/testing/in-memory-refresh-token.repository.ts`:

```ts
import { randomUUID } from 'node:crypto';
import type { RefreshTokenRecord, RefreshTokenRepository } from '../domain/refresh-token.repository';

export class InMemoryRefreshTokenRepository implements RefreshTokenRepository {
  readonly records = new Map<string, RefreshTokenRecord>();

  create(data: { tokenHash: string; userId: string; expiresAt: Date }): Promise<RefreshTokenRecord> {
    const record: RefreshTokenRecord = { ...data, id: randomUUID(), revokedAt: null, replacedBy: null };
    this.records.set(record.id, record);
    return Promise.resolve(record);
  }

  findByHash(tokenHash: string): Promise<RefreshTokenRecord | null> {
    return Promise.resolve([...this.records.values()].find((r) => r.tokenHash === tokenHash) ?? null);
  }

  markRotated(id: string, replacedById: string): Promise<void> {
    const r = this.records.get(id);
    if (r) { r.revokedAt = new Date(); r.replacedBy = replacedById; }
    return Promise.resolve();
  }

  revokeByHash(tokenHash: string): Promise<void> {
    for (const r of this.records.values()) {
      if (r.tokenHash === tokenHash) r.revokedAt = new Date();
    }
    return Promise.resolve();
  }

  revokeAllForUser(userId: string): Promise<void> {
    for (const r of this.records.values()) {
      if (r.userId === userId && !r.revokedAt) r.revokedAt = new Date();
    }
    return Promise.resolve();
  }
}
```

- [ ] **Step 4: Escribir el test del `TokenService`**

Crear `src/modules/auth/token.service.spec.ts`:

```ts
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { TokenService } from './token.service';
import { InMemoryRefreshTokenRepository } from './testing/in-memory-refresh-token.repository';
import type { User } from '../users/domain/user';

const usuario: User = {
  id: '11111111-1111-1111-1111-111111111111',
  email: 'luis@correo.com',
  cedula: 'V25481073',
  passwordHash: 'hash',
  fullName: 'Luis Guerrero',
  phone: '+58 414 528 9012',
  state: null, city: null, currency: 'BOTH',
  createdAt: new Date(), updatedAt: new Date(),
};

const config = new ConfigService({
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'b'.repeat(32),
  JWT_ACCESS_TTL: '15m',
  JWT_REFRESH_TTL: '30d',
});

describe('TokenService', () => {
  let repo: InMemoryRefreshTokenRepository;
  let service: TokenService;

  beforeEach(() => {
    repo = new InMemoryRefreshTokenRepository();
    service = new TokenService(new JwtService({}), config, repo);
  });

  it('emite un par y guarda el refresh HASHEADO, nunca en claro', async () => {
    const { accessToken, refreshToken } = await service.issuePair(usuario);

    expect(accessToken.split('.')).toHaveLength(3);
    const guardados = [...repo.records.values()];
    expect(guardados).toHaveLength(1);
    // Lo que importa: un volcado de la base no entrega sesiones vivas.
    expect(guardados[0].tokenHash).not.toBe(refreshToken);
    expect(guardados[0].userId).toBe(usuario.id);
  });

  it('el access token lleva el id del usuario', async () => {
    const { accessToken } = await service.issuePair(usuario);
    const payload = JSON.parse(Buffer.from(accessToken.split('.')[1], 'base64').toString());
    expect(payload.sub).toBe(usuario.id);
  });

  it('rota: devuelve un par nuevo y revoca el anterior', async () => {
    const primero = await service.issuePair(usuario);
    const { pair, userId } = await service.rotate(primero.refreshToken);

    expect(userId).toBe(usuario.id);
    expect(pair.refreshToken).not.toBe(primero.refreshToken);

    const viejo = [...repo.records.values()].find((r) => r.replacedBy !== null);
    expect(viejo?.revokedAt).toBeInstanceOf(Date);
  });

  it('rechaza un refresh token desconocido', async () => {
    await expect(service.rotate('token-inventado')).rejects.toThrow();
  });

  // EL caso que justifica la rotación: si un token ya rotado vuelve a
  // aparecer, hay dos copias circulando → alguien lo robó.
  it('ante reuso de un token ya rotado, revoca TODAS las sesiones', async () => {
    const primero = await service.issuePair(usuario);
    const segundo = await service.issuePair(usuario); // otro dispositivo
    await service.rotate(primero.refreshToken);

    await expect(service.rotate(primero.refreshToken)).rejects.toThrow();

    // La sesión del otro dispositivo también cae: no sabemos cuál fue robada.
    const vivos = [...repo.records.values()].filter((r) => r.revokedAt === null);
    expect(vivos).toHaveLength(0);
    await expect(service.rotate(segundo.refreshToken)).rejects.toThrow();
  });

  it('revoca en el cierre de sesión', async () => {
    const { refreshToken } = await service.issuePair(usuario);
    await service.revoke(refreshToken);
    await expect(service.rotate(refreshToken)).rejects.toThrow();
  });
});
```

- [ ] **Step 5: Ejecutar el test y verlo fallar**

Run: `pnpm test token.service`
Expected: FAIL — módulo `./token.service` no encontrado.

- [ ] **Step 6: Implementar `TokenService`**

Crear `src/modules/auth/token.service.ts`:

```ts
// Todo lo que tiene que ver con tokens vive acá: firmar, guardar, rotar y
// revocar. AuthService orquesta; esto es el mecanismo.
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'node:crypto';
import { Errors } from '../../common/errors';
import type { User } from '../users/domain/user';
import {
  REFRESH_TOKEN_REPOSITORY,
  type RefreshTokenRepository,
} from './domain/refresh-token.repository';

export type TokenPair = { accessToken: string; refreshToken: string };
export type AccessPayload = { sub: string; email: string };

/** Convierte "30d" / "15m" / "45s" a milisegundos. */
function ttlAMs(ttl: string): number {
  const m = /^(\d+)([smhd])$/.exec(ttl);
  if (!m) throw new Error(`TTL inválido: ${ttl}`);
  const factor = { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 }[m[2] as 's' | 'm' | 'h' | 'd'];
  return Number(m[1]) * factor;
}

@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    @Inject(REFRESH_TOKEN_REPOSITORY) private readonly refreshRepo: RefreshTokenRepository,
  ) {}

  // SHA-256 y no Argon2: el token son 256 bits aleatorios, no una contraseña
  // adivinable. No hay diccionario que probar, así que un hash lento solo
  // gastaría CPU en cada refresco sin añadir seguridad.
  private hashear(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private firmarAccess(user: User): string {
    const payload: AccessPayload = { sub: user.id, email: user.email };
    return this.jwt.sign(payload, {
      secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn: this.config.get<string>('JWT_ACCESS_TTL', '15m'),
    });
  }

  private async crearRefresh(userId: string): Promise<{ token: string; id: string }> {
    const token = randomBytes(48).toString('base64url');
    const expiresAt = new Date(Date.now() + ttlAMs(this.config.get<string>('JWT_REFRESH_TTL', '30d')));
    const record = await this.refreshRepo.create({ tokenHash: this.hashear(token), userId, expiresAt });
    return { token, id: record.id };
  }

  async issuePair(user: User): Promise<TokenPair> {
    const { token } = await this.crearRefresh(user.id);
    return { accessToken: this.firmarAccess(user), refreshToken: token };
  }

  async rotate(refreshToken: string): Promise<{ pair: TokenPair; userId: string }> {
    const record = await this.refreshRepo.findByHash(this.hashear(refreshToken));
    if (!record) throw Errors.invalidRefreshToken();

    if (record.revokedAt !== null) {
      // Un token ya rotado que vuelve a presentarse significa que existen dos
      // copias: la legítima y una robada. No hay forma de saber cuál es cuál,
      // así que se caen todas las sesiones y el dueño vuelve a entrar.
      await this.refreshRepo.revokeAllForUser(record.userId);
      throw Errors.invalidRefreshToken();
    }

    if (record.expiresAt.getTime() <= Date.now()) throw Errors.invalidRefreshToken();

    const nuevo = await this.crearRefresh(record.userId);
    await this.refreshRepo.markRotated(record.id, nuevo.id);

    // El access token se firma con lo que va en el payload; no hace falta
    // releer el usuario en cada refresco.
    const accessToken = this.jwt.sign(
      { sub: record.userId, email: '' } satisfies AccessPayload,
      {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: this.config.get<string>('JWT_ACCESS_TTL', '15m'),
      },
    );

    return { pair: { accessToken, refreshToken: nuevo.token }, userId: record.userId };
  }

  async revoke(refreshToken: string): Promise<void> {
    await this.refreshRepo.revokeByHash(this.hashear(refreshToken));
  }
}
```

- [ ] **Step 7: Ejecutar el test y verlo pasar**

Run: `pnpm test token.service`
Expected: PASS — 6 tests. El de reuso es el que más importa: si falla, la rotación no protege de nada.

- [ ] **Step 8: Implementar el repositorio Prisma de refresh**

Crear `src/infra/prisma/prisma-refresh-token.repository.ts`:

```ts
import { Injectable } from '@nestjs/common';
import type {
  RefreshTokenRecord,
  RefreshTokenRepository,
} from '../../modules/auth/domain/refresh-token.repository';
import { PrismaService } from './prisma.service';

@Injectable()
export class PrismaRefreshTokenRepository implements RefreshTokenRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: { tokenHash: string; userId: string; expiresAt: Date }): Promise<RefreshTokenRecord> {
    const r = await this.prisma.refreshToken.create({ data });
    return { id: r.id, tokenHash: r.tokenHash, userId: r.userId, expiresAt: r.expiresAt, revokedAt: r.revokedAt, replacedBy: r.replacedBy };
  }

  async findByHash(tokenHash: string): Promise<RefreshTokenRecord | null> {
    const r = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });
    return r ? { id: r.id, tokenHash: r.tokenHash, userId: r.userId, expiresAt: r.expiresAt, revokedAt: r.revokedAt, replacedBy: r.replacedBy } : null;
  }

  async markRotated(id: string, replacedById: string): Promise<void> {
    await this.prisma.refreshToken.update({
      where: { id },
      data: { revokedAt: new Date(), replacedBy: replacedById },
    });
  }

  async revokeByHash(tokenHash: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
```

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(auth): tokens con rotación de refresh y revocación ante reuso"
```

---

### Task 8: `AuthService` — registro y login

**Files:**
- Create: `src/modules/auth/auth.service.ts`, `src/modules/auth/auth.service.spec.ts`

**Interfaces:**
- Consumes: `USER_REPOSITORY`/`UserRepository`, `PASSWORD_HASHER`/`PasswordHasher`, `TokenService`, `RegisterDto`, `LoginDto`, `toUserResponse`, `Errors`.
- Produces: `type AuthResult = { user: UserResponse } & TokenPair`; `class AuthService { register(dto: RegisterDto): Promise<AuthResult>; login(dto: LoginDto): Promise<AuthResult>; refresh(token: string): Promise<TokenPair>; logout(token: string): Promise<void> }`.

- [ ] **Step 1: Escribir el test**

Crear `src/modules/auth/auth.service.spec.ts`:

```ts
import { AuthService } from './auth.service';
import { InMemoryUserRepository } from '../users/testing/in-memory-user.repository';
import type { PasswordHasher } from './domain/password-hasher';
import type { TokenService } from './token.service';
import type { RegisterDto } from './dto/register.dto';

// Hasher falso: determinista y rápido. El Argon2 real ya se testeó aparte.
const hasher: PasswordHasher = {
  hash: (p) => Promise.resolve(`hash:${p}`),
  verify: (h, p) => Promise.resolve(h === `hash:${p}`),
};

const registro = (over: Partial<RegisterDto> = {}): RegisterDto => ({
  fullName: 'Luis Guerrero',
  cedula: 'V25481073',
  email: 'luis@correo.com',
  phone: '+58 414 528 9012',
  password: 'contrasena1',
  ...over,
}) as RegisterDto;

describe('AuthService', () => {
  let users: InMemoryUserRepository;
  let tokens: jest.Mocked<Pick<TokenService, 'issuePair' | 'rotate' | 'revoke'>>;
  let service: AuthService;

  beforeEach(() => {
    users = new InMemoryUserRepository();
    tokens = {
      issuePair: jest.fn().mockResolvedValue({ accessToken: 'acc', refreshToken: 'ref' }),
      rotate: jest.fn(),
      revoke: jest.fn().mockResolvedValue(undefined),
    };
    service = new AuthService(users, hasher, tokens as unknown as TokenService);
  });

  describe('register', () => {
    it('crea el usuario y devuelve el par de tokens', async () => {
      const r = await service.register(registro());

      expect(r.accessToken).toBe('acc');
      expect(r.user.email).toBe('luis@correo.com');
      await expect(users.existsByEmail('luis@correo.com')).resolves.toBe(true);
    });

    // Un passwordHash filtrado en la respuesta es un regalo al atacante.
    it('nunca devuelve el hash de la contraseña', async () => {
      const r = await service.register(registro());
      expect(JSON.stringify(r)).not.toContain('hash:');
      expect(r.user).not.toHaveProperty('passwordHash');
    });

    it('guarda la contraseña hasheada, jamás en claro', async () => {
      await service.register(registro());
      const guardado = await users.findByEmail('luis@correo.com');
      expect(guardado?.passwordHash).toBe('hash:contrasena1');
    });

    it('rechaza correo duplicado con EMAIL_TAKEN', async () => {
      await service.register(registro());
      await expect(service.register(registro({ cedula: 'V99999999' })))
        .rejects.toMatchObject({ response: { error: 'EMAIL_TAKEN' } });
    });

    it('rechaza cédula duplicada con CEDULA_TAKEN', async () => {
      await service.register(registro());
      await expect(service.register(registro({ email: 'otro@correo.com' })))
        .rejects.toMatchObject({ response: { error: 'CEDULA_TAKEN' } });
    });
  });

  describe('login', () => {
    beforeEach(async () => { await service.register(registro()); });

    it('entra con credenciales correctas', async () => {
      const r = await service.login({ email: 'luis@correo.com', password: 'contrasena1' });
      expect(r.accessToken).toBe('acc');
      expect(r.user.fullName).toBe('Luis Guerrero');
    });

    // Distinguir los dos casos convierte el login en un oráculo para saber
    // qué correos están registrados.
    it('da el MISMO error con contraseña errada que con correo inexistente', async () => {
      const malaClave = await service.login({ email: 'luis@correo.com', password: 'otra1234' })
        .catch((e) => e.response);
      const noExiste = await service.login({ email: 'nadie@correo.com', password: 'contrasena1' })
        .catch((e) => e.response);

      expect(malaClave).toEqual(noExiste);
      expect(malaClave.error).toBe('INVALID_CREDENTIALS');
    });

    // Si con correo inexistente se respondiera sin verificar nada, el tiempo
    // de respuesta delataría qué correos existen.
    it('verifica contra un hash señuelo cuando el correo no existe', async () => {
      const espia = jest.spyOn(hasher, 'verify');
      await service.login({ email: 'nadie@correo.com', password: 'x' }).catch(() => undefined);
      expect(espia).toHaveBeenCalled();
      espia.mockRestore();
    });
  });
});
```

- [ ] **Step 2: Ejecutar el test y verlo fallar**

Run: `pnpm test auth.service`
Expected: FAIL — módulo no encontrado.

- [ ] **Step 3: Implementar `AuthService`**

Crear `src/modules/auth/auth.service.ts`:

```ts
import { Inject, Injectable } from '@nestjs/common';
import { Errors } from '../../common/errors';
import { USER_REPOSITORY, type UserRepository } from '../users/domain/user.repository';
import { PASSWORD_HASHER, type PasswordHasher } from './domain/password-hasher';
import type { LoginDto } from './dto/login.dto';
import type { RegisterDto } from './dto/register.dto';
import { toUserResponse, type UserResponse } from './dto/user-response.dto';
import type { TokenPair, TokenService } from './token.service';

export type AuthResult = { user: UserResponse } & TokenPair;

// Hash de una contraseña que no existe. Se verifica contra él cuando el correo
// no está registrado, para gastar el mismo tiempo que en un login real: sin
// esto, la latencia de la respuesta revela qué correos existen.
const HASH_SEÑUELO =
  '$argon2id$v=19$m=19456,t=2,p=1$c2FsdGVkc2FsdGVkc2E$3Nk8Q1sJq0mWl6vYyQ4tVw7oXhKp2ZqB5dRfTgLnCmE';

@Injectable()
export class AuthService {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    private readonly tokens: TokenService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResult> {
    // Se comprueban los dos por separado para poder decir cuál chocó: el
    // formulario necesita marcar el campo correcto.
    if (await this.users.existsByEmail(dto.email)) throw Errors.emailTaken();
    if (await this.users.existsByCedula(dto.cedula)) throw Errors.cedulaTaken();

    const user = await this.users.create({
      email: dto.email,
      cedula: dto.cedula,
      fullName: dto.fullName,
      phone: dto.phone,
      passwordHash: await this.hasher.hash(dto.password),
      state: null,
      city: null,
      currency: 'BOTH',
    });

    return { user: toUserResponse(user), ...(await this.tokens.issuePair(user)) };
  }

  async login(dto: LoginDto): Promise<AuthResult> {
    const user = await this.users.findByEmail(dto.email);

    // Se verifica SIEMPRE, exista o no el usuario. Salir antes por "no existe"
    // haría que esa rama respondiera mucho más rápido.
    const ok = await this.hasher.verify(user?.passwordHash ?? HASH_SEÑUELO, dto.password);
    if (!user || !ok) throw Errors.invalidCredentials();

    return { user: toUserResponse(user), ...(await this.tokens.issuePair(user)) };
  }

  refresh(refreshToken: string): Promise<TokenPair> {
    return this.tokens.rotate(refreshToken).then((r) => r.pair);
  }

  logout(refreshToken: string): Promise<void> {
    return this.tokens.revoke(refreshToken);
  }
}
```

- [ ] **Step 4: Ejecutar el test y verlo pasar**

Run: `pnpm test auth.service`
Expected: PASS — 8 tests.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(auth): registro y login con respuesta uniforme ante credenciales inválidas"
```

---

### Task 9: Estrategia JWT, guard, controlador y módulo

Cierra el backend: aquí la lógica se vuelve una API de verdad.

**Files:**
- Create: `src/modules/auth/strategies/jwt.strategy.ts`
- Create: `src/modules/auth/guards/jwt-auth.guard.ts`
- Create: `src/common/decorators/current-user.decorator.ts`
- Create: `src/modules/auth/auth.controller.ts`, `src/modules/auth/auth.module.ts`
- Modify: `src/app.module.ts`

**Interfaces:**
- Consumes: `AuthService`, `TokenService`, `USER_REPOSITORY`, `PASSWORD_HASHER`, `REFRESH_TOKEN_REPOSITORY`.
- Produces: los 5 endpoints bajo `/api/v1/auth`; `@CurrentUser()` inyecta el `User` de dominio.

- [ ] **Step 1: Implementar la estrategia JWT**

Crear `src/modules/auth/strategies/jwt.strategy.ts`:

```ts
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { USER_REPOSITORY, type UserRepository } from '../../users/domain/user.repository';
import type { User } from '../../users/domain/user';
import type { AccessPayload } from '../token.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }

  // Se relee el usuario en vez de confiar solo en el payload: así una cuenta
  // borrada deja de entrar de inmediato, sin esperar a que expire el token.
  async validate(payload: AccessPayload): Promise<User> {
    const user = await this.users.findById(payload.sub);
    if (!user) throw new UnauthorizedException();
    return user;
  }
}
```

- [ ] **Step 2: Implementar el guard y el decorador**

Crear `src/modules/auth/guards/jwt-auth.guard.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
```

Crear `src/common/decorators/current-user.decorator.ts`:

```ts
import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { User } from '../../modules/users/domain/user';

/** El usuario que puso JwtStrategy.validate en la petición. */
export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): User =>
    ctx.switchToHttp().getRequest<{ user: User }>().user,
);
```

- [ ] **Step 3: Implementar el controlador**

Crear `src/modules/auth/auth.controller.ts`:

```ts
// Solo HTTP: recibe DTO, delega, devuelve DTO. Cero reglas de negocio.
import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { User } from '../users/domain/user';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { RegisterDto } from './dto/register.dto';
import { toUserResponse } from './dto/user-response.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  // 5 por minuto: sin esto, el login es fuerza bruta gratis.
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('logout')
  async logout(@Body() dto: RefreshDto): Promise<void> {
    await this.auth.logout(dto.refreshToken);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: User) {
    return { user: toUserResponse(user) };
  }
}
```

- [ ] **Step 4: Cablear `AuthModule` — el resto de líneas del cambio de motor**

```bash
pnpm add @nestjs/throttler
```

Crear `src/modules/auth/auth.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { PrismaRefreshTokenRepository } from '../../infra/prisma/prisma-refresh-token.repository';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { REFRESH_TOKEN_REPOSITORY } from './domain/refresh-token.repository';
import { PASSWORD_HASHER } from './domain/password-hasher';
import { Argon2Hasher } from './hashing/argon2.hasher';
import { JwtStrategy } from './strategies/jwt.strategy';
import { TokenService } from './token.service';

@Module({
  imports: [UsersModule, PassportModule, JwtModule.register({})],
  controllers: [AuthController],
  providers: [
    AuthService,
    TokenService,
    JwtStrategy,
    // Las otras dos líneas intercambiables: cambiar de algoritmo de hash o de
    // almacén de tokens no toca ningún servicio.
    { provide: PASSWORD_HASHER, useClass: Argon2Hasher },
    { provide: REFRESH_TOKEN_REPOSITORY, useClass: PrismaRefreshTokenRepository },
  ],
})
export class AuthModule {}
```

En `src/app.module.ts`, añadir a `imports`:

```ts
ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
PrismaModule,
AuthModule,
```

y a `providers`:

```ts
{ provide: APP_GUARD, useClass: ThrottlerGuard },
```

(importando `APP_GUARD` de `@nestjs/core` y `ThrottlerGuard`/`ThrottlerModule` de `@nestjs/throttler`).

- [ ] **Step 5: Escribir el test e2e del flujo completo**

Reemplazar `test/app.e2e-spec.ts` por `test/auth.e2e-spec.ts`:

```ts
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';

const nuevo = () => ({
  fullName: 'Luis Guerrero',
  cedula: `V${Math.floor(10_000_000 + Math.random() * 89_999_999)}`,
  email: `luis-${Date.now()}-${Math.floor(Math.random() * 1e6)}@correo.com`,
  phone: '+58 414 528 9012',
  password: 'contrasena1',
});

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let http: () => request.SuperTest<request.Test>;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
    http = () => request(app.getHttpServer());
  });

  afterAll(async () => { await app.close(); });

  it('flujo completo: registrar → /me → refrescar → /me → cerrar sesión', async () => {
    const datos = nuevo();

    const reg = await http().post('/api/v1/auth/register').send(datos).expect(201);
    expect(reg.body.user.email).toBe(datos.email);
    expect(reg.body).not.toHaveProperty('user.passwordHash');

    await http().get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${reg.body.accessToken}`).expect(200);

    const ref = await http().post('/api/v1/auth/refresh')
      .send({ refreshToken: reg.body.refreshToken }).expect(200);
    expect(ref.body.refreshToken).not.toBe(reg.body.refreshToken);

    await http().get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${ref.body.accessToken}`).expect(200);

    await http().post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${ref.body.accessToken}`)
      .send({ refreshToken: ref.body.refreshToken }).expect(204);

    await http().post('/api/v1/auth/refresh')
      .send({ refreshToken: ref.body.refreshToken }).expect(401);
  });

  it('reusar un refresh ya rotado tumba todas las sesiones', async () => {
    const datos = nuevo();
    const reg = await http().post('/api/v1/auth/register').send(datos).expect(201);
    const ref = await http().post('/api/v1/auth/refresh')
      .send({ refreshToken: reg.body.refreshToken }).expect(200);

    // El robado (ya rotado) vuelve a aparecer → se revoca todo.
    await http().post('/api/v1/auth/refresh')
      .send({ refreshToken: reg.body.refreshToken }).expect(401);

    // Y el legítimo también deja de servir.
    await http().post('/api/v1/auth/refresh')
      .send({ refreshToken: ref.body.refreshToken }).expect(401);
  });

  it('login con contraseña errada y con correo inexistente dan el mismo cuerpo', async () => {
    const datos = nuevo();
    await http().post('/api/v1/auth/register').send(datos).expect(201);

    const a = await http().post('/api/v1/auth/login')
      .send({ email: datos.email, password: 'otra1234' }).expect(401);
    const b = await http().post('/api/v1/auth/login')
      .send({ email: 'nadie@correo.com', password: 'otra1234' }).expect(401);

    expect(a.body.error).toBe('INVALID_CREDENTIALS');
    expect(a.body.message).toBe(b.body.message);
  });

  it('rechaza correo duplicado y campos de más', async () => {
    const datos = nuevo();
    await http().post('/api/v1/auth/register').send(datos).expect(201);
    await http().post('/api/v1/auth/register')
      .send({ ...datos, cedula: `V${Math.floor(Math.random() * 1e8)}` })
      .expect(409)
      .expect((r) => expect(r.body.error).toBe('EMAIL_TAKEN'));

    await http().post('/api/v1/auth/register')
      .send({ ...nuevo(), esAdmin: true })
      .expect(400)
      .expect((r) => expect(r.body.error).toBe('VALIDATION_ERROR'));
  });

  it('/me sin token da 401', async () => {
    await http().get('/api/v1/auth/me').expect(401);
  });
});
```

- [ ] **Step 6: Ejecutar los tests e2e**

```bash
docker compose up -d
pnpm test:e2e
```
Expected: PASS — 5 tests. Si el de rate limit interfiere (más de 5 registros por minuto), subir temporalmente el límite vía env o espaciar las corridas.

- [ ] **Step 7: Probar a mano**

```bash
pnpm start:dev
```

En otra terminal:

```bash
curl -s -X POST http://localhost:3000/api/v1/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"fullName":"Luis Guerrero","cedula":"V-25.481.073","email":"luis@correo.com","phone":"+58 414 528 9012","password":"contrasena1"}' | jq
```
Expected: `201` con `user`, `accessToken` y `refreshToken`. Confirmar que **no** aparece `passwordHash` por ningún lado.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(auth): endpoints de registro, login, refresh, logout y /me"
```

---

# Fase 2 — App móvil

> Todo lo que sigue ocurre en `../app-mobile/`. Es **el mismo repositorio git** que el backend (monorepo, sin submódulos): los commits de esta fase van al mismo sitio que los de la Fase 1, y una tarea puede tocar ambas carpetas si hace falta. Lo que sí cambia es el gestor de paquetes — `npm`/`npx expo` en `app-mobile/`, `pnpm` en `backend-oil-app/`.

### Task 10: Almacenamiento seguro de tokens

**Files:**
- Create: `app-mobile/src/api/tokens.ts`, `app-mobile/src/api/tokens.test.ts`
- Modify: `app-mobile/package.json`

**Interfaces:**
- Produces: `type Tokens = { accessToken: string; refreshToken: string }`; `tokenStorage: { get(): Promise<Tokens | null>; save(t: Tokens): Promise<void>; clear(): Promise<void> }`.

- [ ] **Step 1: Instalar `expo-secure-store`**

```bash
cd ../app-mobile
npx expo install expo-secure-store
```

Con `npx expo install`, no `npm install`: la versión la fija `bundledNativeModules.json` del SDK 57 (AGENTS.md).

Es un módulo nativo, así que hace falta rebuild del development build:

```bash
npx expo run:ios
```

- [ ] **Step 2: Escribir el test**

Crear `app-mobile/src/api/tokens.test.ts`:

```ts
import * as SecureStore from 'expo-secure-store';
import { tokenStorage } from './tokens';

jest.mock('expo-secure-store');
const mock = SecureStore as jest.Mocked<typeof SecureStore>;

describe('tokenStorage', () => {
  beforeEach(() => jest.resetAllMocks());

  it('guarda y recupera el par', async () => {
    await tokenStorage.save({ accessToken: 'a', refreshToken: 'r' });
    expect(mock.setItemAsync).toHaveBeenCalledWith(
      expect.any(String),
      JSON.stringify({ accessToken: 'a', refreshToken: 'r' }),
    );

    mock.getItemAsync.mockResolvedValue(JSON.stringify({ accessToken: 'a', refreshToken: 'r' }));
    await expect(tokenStorage.get()).resolves.toEqual({ accessToken: 'a', refreshToken: 'r' });
  });

  it('devuelve null si no hay nada guardado', async () => {
    mock.getItemAsync.mockResolvedValue(null);
    await expect(tokenStorage.get()).resolves.toBeNull();
  });

  // Un JSON corrupto no debe dejar la app inarrancable: se trata como "no hay
  // sesión" y el usuario entra de nuevo.
  it('devuelve null si lo guardado está corrupto', async () => {
    mock.getItemAsync.mockResolvedValue('{esto no es json');
    await expect(tokenStorage.get()).resolves.toBeNull();
  });
});
```

- [ ] **Step 3: Ejecutar el test y verlo fallar**

Run: `npx jest src/api/tokens.test.ts`
Expected: FAIL — módulo `./tokens` no encontrado.

- [ ] **Step 4: Implementar**

Crear `app-mobile/src/api/tokens.ts`:

```ts
// Los tokens van a Keychain (iOS) / Keystore (Android), NO a
// `expo-sqlite/kv-store`: ese es almacenamiento plano, y un token robado de
// ahí es una sesión robada. Es justo lo que advierte el comentario de
// `src/store/session.ts`.
import * as SecureStore from 'expo-secure-store';

const CLAVE = 'ruedalo.tokens';

export type Tokens = { accessToken: string; refreshToken: string };

export const tokenStorage = {
  async get(): Promise<Tokens | null> {
    try {
      const crudo = await SecureStore.getItemAsync(CLAVE);
      if (!crudo) return null;
      const t = JSON.parse(crudo) as Partial<Tokens>;
      return t.accessToken && t.refreshToken
        ? { accessToken: t.accessToken, refreshToken: t.refreshToken }
        : null;
    } catch {
      // Corrupto o ilegible: se trata como "sin sesión".
      return null;
    }
  },

  async save(tokens: Tokens): Promise<void> {
    await SecureStore.setItemAsync(CLAVE, JSON.stringify(tokens));
  },

  async clear(): Promise<void> {
    await SecureStore.deleteItemAsync(CLAVE);
  },
};
```

- [ ] **Step 5: Ejecutar el test y verlo pasar**

Run: `npx jest src/api/tokens.test.ts`
Expected: PASS — 3 tests.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(api): tokens de sesión en almacenamiento seguro del dispositivo"
```

---

### Task 11: Cliente HTTP con refresco en cola

La pieza con más trampa del móvil: sin la cola, varias peticiones caducadas a la vez disparan refrescos en carrera que, con rotación, se invalidan entre sí y cierran la sesión de un usuario legítimo.

**Files:**
- Create: `app-mobile/src/api/client.ts`, `app-mobile/src/api/client.test.ts`
- Modify: `app-mobile/app.json` (campo `extra.apiUrl`)

**Interfaces:**
- Consumes: `tokenStorage`, `Tokens` (Task 10).
- Produces: `class ApiError extends Error { status: number; code: string }`; `apiFetch<T>(path: string, opciones?: { method?, body?, auth?: boolean }): Promise<T>`; `setOnSessionExpired(cb: () => void): void`.

- [ ] **Step 1: Declarar la URL base**

En `app-mobile/app.json`, dentro de `expo`, añadir:

```json
"extra": {
  "apiUrl": "http://localhost:3000/api/v1"
}
```

**En dispositivo físico `localhost` es el propio teléfono.** Para probar en un móvil real hay que poner la IP LAN del Mac, p. ej. `http://192.168.1.50:3000/api/v1`. Obtenerla con:

```bash
ipconfig getifaddr en0
```

- [ ] **Step 2: Escribir el test del cliente**

Crear `app-mobile/src/api/client.test.ts`:

```ts
import { apiFetch, ApiError, setOnSessionExpired, __resetClient } from './client';
import { tokenStorage } from './tokens';

jest.mock('./tokens', () => ({
  tokenStorage: { get: jest.fn(), save: jest.fn(), clear: jest.fn() },
}));
const storage = tokenStorage as jest.Mocked<typeof tokenStorage>;

const respuesta = (status: number, body: unknown) =>
  Promise.resolve({
    status,
    ok: status >= 200 && status < 300,
    json: () => Promise.resolve(body),
  } as Response);

describe('apiFetch', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    __resetClient();
    storage.get.mockResolvedValue({ accessToken: 'viejo', refreshToken: 'ref' });
  });

  it('manda el Bearer y devuelve el cuerpo', async () => {
    global.fetch = jest.fn().mockReturnValue(respuesta(200, { ok: true }));

    await expect(apiFetch('/auth/me', { auth: true })).resolves.toEqual({ ok: true });
    const headers = (global.fetch as jest.Mock).mock.calls[0][1].headers;
    expect(headers.Authorization).toBe('Bearer viejo');
  });

  it('convierte el error del backend en ApiError con su código', async () => {
    global.fetch = jest.fn().mockReturnValue(
      respuesta(409, { error: 'EMAIL_TAKEN', message: 'Ese correo ya tiene una cuenta.' }),
    );

    await expect(apiFetch('/auth/register', { method: 'POST' })).rejects.toMatchObject({
      code: 'EMAIL_TAKEN',
      status: 409,
    });
  });

  it('ante 401 refresca una vez y reintenta', async () => {
    global.fetch = jest.fn()
      .mockReturnValueOnce(respuesta(401, { error: 'INVALID_CREDENTIALS' }))
      .mockReturnValueOnce(respuesta(200, { accessToken: 'nuevo', refreshToken: 'ref2' }))
      .mockReturnValueOnce(respuesta(200, { ok: true }));

    await expect(apiFetch('/auth/me', { auth: true })).resolves.toEqual({ ok: true });
    expect(storage.save).toHaveBeenCalledWith({ accessToken: 'nuevo', refreshToken: 'ref2' });

    const ultimaLlamada = (global.fetch as jest.Mock).mock.calls[2][1].headers;
    expect(ultimaLlamada.Authorization).toBe('Bearer nuevo');
  });

  // EL test que justifica la cola: con rotación, dos refrescos simultáneos se
  // invalidan mutuamente y cierran la sesión de un usuario legítimo.
  it('con tres peticiones caducadas a la vez, refresca UNA sola vez', async () => {
    const llamadas: string[] = [];
    global.fetch = jest.fn().mockImplementation((url: string, init: RequestInit) => {
      llamadas.push(url);
      if (url.endsWith('/auth/refresh')) return respuesta(200, { accessToken: 'nuevo', refreshToken: 'ref2' });
      const auth = (init.headers as Record<string, string>).Authorization;
      return auth === 'Bearer nuevo' ? respuesta(200, { ok: true }) : respuesta(401, { error: 'X' });
    });

    await Promise.all([
      apiFetch('/a', { auth: true }),
      apiFetch('/b', { auth: true }),
      apiFetch('/c', { auth: true }),
    ]);

    expect(llamadas.filter((u) => u.endsWith('/auth/refresh'))).toHaveLength(1);
  });

  it('si el refresco falla, limpia los tokens y avisa que expiró la sesión', async () => {
    const expiro = jest.fn();
    setOnSessionExpired(expiro);
    global.fetch = jest.fn()
      .mockReturnValueOnce(respuesta(401, { error: 'X' }))
      .mockReturnValueOnce(respuesta(401, { error: 'INVALID_REFRESH_TOKEN' }));

    await expect(apiFetch('/auth/me', { auth: true })).rejects.toBeInstanceOf(ApiError);
    expect(storage.clear).toHaveBeenCalled();
    expect(expiro).toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Ejecutar el test y verlo fallar**

Run: `npx jest src/api/client.test.ts`
Expected: FAIL — módulo `./client` no encontrado.

- [ ] **Step 4: Implementar el cliente**

Crear `app-mobile/src/api/client.ts`:

```ts
// Envoltorio de fetch: pone el Bearer, traduce los errores del backend y
// refresca el token cuando caduca.
import Constants from 'expo-constants';
import { tokenStorage, type Tokens } from './tokens';

const BASE = (Constants.expoConfig?.extra?.apiUrl as string) ?? 'http://localhost:3000/api/v1';

export class ApiError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

let alExpirarSesion: (() => void) | null = null;
export function setOnSessionExpired(cb: () => void): void {
  alExpirarSesion = cb;
}

// Un único refresco en vuelo. Si tres peticiones caducan a la vez, las tres
// esperan a ESTA promesa; disparar tres refrescos en paralelo haría que la
// rotación del backend los invalidara entre sí y cerrara la sesión.
let refrescoEnCurso: Promise<Tokens | null> | null = null;

async function refrescar(): Promise<Tokens | null> {
  const actuales = await tokenStorage.get();
  if (!actuales) return null;

  const res = await fetch(`${BASE}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: actuales.refreshToken }),
  });

  if (!res.ok) {
    await tokenStorage.clear();
    alExpirarSesion?.();
    return null;
  }

  const nuevos = (await res.json()) as Tokens;
  await tokenStorage.save(nuevos);
  return nuevos;
}

function refrescarUnaVez(): Promise<Tokens | null> {
  refrescoEnCurso ??= refrescar().finally(() => {
    refrescoEnCurso = null;
  });
  return refrescoEnCurso;
}

type Opciones = { method?: string; body?: unknown; auth?: boolean };

async function pedir(path: string, opciones: Opciones, token: string | null): Promise<Response> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  return fetch(`${BASE}${path}`, {
    method: opciones.method ?? 'GET',
    headers,
    ...(opciones.body !== undefined ? { body: JSON.stringify(opciones.body) } : {}),
  });
}

export async function apiFetch<T>(path: string, opciones: Opciones = {}): Promise<T> {
  const tokens = opciones.auth ? await tokenStorage.get() : null;
  let res = await pedir(path, opciones, tokens?.accessToken ?? null);

  if (res.status === 401 && opciones.auth) {
    const nuevos = await refrescarUnaVez();
    if (nuevos) res = await pedir(path, opciones, nuevos.accessToken);
  }

  if (!res.ok) {
    const cuerpo = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
    throw new ApiError(
      res.status,
      cuerpo.error ?? 'NETWORK_ERROR',
      cuerpo.message ?? 'No pudimos conectar. Revisa tu conexión.',
    );
  }

  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

/** Solo para tests: limpia el refresco en vuelo entre casos. */
export function __resetClient(): void {
  refrescoEnCurso = null;
  alExpirarSesion = null;
}
```

- [ ] **Step 5: Ejecutar el test y verlo pasar**

Run: `npx jest src/api/client.test.ts`
Expected: PASS — 5 tests. El de la cola es el que importa: si falla, hay una condición de carrera que cierra sesiones válidas.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(api): cliente HTTP con refresco de token en cola"
```

---

### Task 12: Endpoints tipados y store de autenticación

**Files:**
- Create: `app-mobile/src/api/auth.ts`
- Create: `app-mobile/src/store/auth.ts`, `app-mobile/src/store/__tests__/auth.test.ts`

**Interfaces:**
- Consumes: `apiFetch`, `ApiError`, `setOnSessionExpired`, `tokenStorage`.
- Produces:
  - `type ApiUser = { id, fullName, cedula, email, phone, state: string | null, city: string | null, currency: 'USD'|'BS'|'BOTH' }`
  - `authApi = { register(input: RegisterInput): Promise<AuthResponse>; login(email, password): Promise<AuthResponse>; me(): Promise<{ user: ApiUser }>; logout(refreshToken): Promise<void> }`
  - `useAuth` — store con `{ user, status, error, bootstrap, signIn, signUp, signOut }`.

- [ ] **Step 1: Implementar los endpoints tipados**

Crear `app-mobile/src/api/auth.ts`:

```ts
import { apiFetch } from './client';
import type { Tokens } from './tokens';

export type ApiUser = {
  id: string;
  fullName: string;
  cedula: string;
  email: string;
  phone: string;
  state: string | null;
  city: string | null;
  currency: 'USD' | 'BS' | 'BOTH';
};

export type AuthResponse = { user: ApiUser } & Tokens;

export type RegisterInput = {
  fullName: string;
  cedula: string;
  email: string;
  phone: string;
  password: string;
};

export const authApi = {
  register: (input: RegisterInput) =>
    apiFetch<AuthResponse>('/auth/register', { method: 'POST', body: input }),

  login: (email: string, password: string) =>
    apiFetch<AuthResponse>('/auth/login', { method: 'POST', body: { email, password } }),

  me: () => apiFetch<{ user: ApiUser }>('/auth/me', { auth: true }),

  logout: (refreshToken: string) =>
    apiFetch<void>('/auth/logout', { method: 'POST', auth: true, body: { refreshToken } }),
};
```

- [ ] **Step 2: Escribir el test del store**

Crear `app-mobile/src/store/__tests__/auth.test.ts`:

```ts
import { useAuth } from '../auth';
import { authApi } from '../../api/auth';
import { tokenStorage } from '../../api/tokens';
import { ApiError } from '../../api/client';

jest.mock('../../api/auth');
jest.mock('../../api/tokens', () => ({
  tokenStorage: { get: jest.fn(), save: jest.fn(), clear: jest.fn() },
}));

const api = authApi as jest.Mocked<typeof authApi>;
const storage = tokenStorage as jest.Mocked<typeof tokenStorage>;

const usuario = {
  id: '1', fullName: 'Luis Guerrero', cedula: 'V25481073',
  email: 'luis@correo.com', phone: '+58 414 528 9012',
  state: null, city: null, currency: 'BOTH' as const,
};

describe('useAuth', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    useAuth.setState({ user: null, status: 'loading', error: null });
  });

  it('arranca en guest cuando no hay tokens guardados', async () => {
    storage.get.mockResolvedValue(null);
    await useAuth.getState().bootstrap();
    expect(useAuth.getState().status).toBe('guest');
  });

  it('arranca en authed y trae el usuario si hay tokens', async () => {
    storage.get.mockResolvedValue({ accessToken: 'a', refreshToken: 'r' });
    api.me.mockResolvedValue({ user: usuario });

    await useAuth.getState().bootstrap();

    expect(useAuth.getState().status).toBe('authed');
    expect(useAuth.getState().user?.email).toBe('luis@correo.com');
  });

  // Un token guardado puede estar revocado: si /me falla, no hay sesión.
  it('cae a guest si el token guardado ya no sirve', async () => {
    storage.get.mockResolvedValue({ accessToken: 'a', refreshToken: 'r' });
    api.me.mockRejectedValue(new ApiError(401, 'INVALID_REFRESH_TOKEN', 'expiró'));

    await useAuth.getState().bootstrap();

    expect(useAuth.getState().status).toBe('guest');
    expect(storage.clear).toHaveBeenCalled();
  });

  it('signIn guarda los tokens y deja la sesión abierta', async () => {
    api.login.mockResolvedValue({ user: usuario, accessToken: 'a', refreshToken: 'r' });

    await useAuth.getState().signIn('luis@correo.com', 'contrasena1');

    expect(storage.save).toHaveBeenCalledWith({ accessToken: 'a', refreshToken: 'r' });
    expect(useAuth.getState().status).toBe('authed');
  });

  it('signIn expone el mensaje del backend y no abre sesión', async () => {
    api.login.mockRejectedValue(new ApiError(401, 'INVALID_CREDENTIALS', 'Correo o contraseña incorrectos.'));

    await expect(useAuth.getState().signIn('luis@correo.com', 'mala')).rejects.toBeInstanceOf(ApiError);

    expect(useAuth.getState().status).toBe('guest');
    expect(useAuth.getState().error).toBe('Correo o contraseña incorrectos.');
  });

  // Si el logout del servidor falla (sin red), la sesión local igual se cierra:
  // dejar al usuario dentro porque no hubo internet sería peor.
  it('signOut limpia la sesión local aunque falle la llamada', async () => {
    storage.get.mockResolvedValue({ accessToken: 'a', refreshToken: 'r' });
    api.logout.mockRejectedValue(new Error('sin red'));
    useAuth.setState({ user: usuario, status: 'authed' });

    await useAuth.getState().signOut();

    expect(useAuth.getState().status).toBe('guest');
    expect(useAuth.getState().user).toBeNull();
    expect(storage.clear).toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Ejecutar el test y verlo fallar**

Run: `npx jest src/store/__tests__/auth.test.ts`
Expected: FAIL — módulo `../auth` no encontrado.

- [ ] **Step 4: Implementar el store**

Crear `app-mobile/src/store/auth.ts`:

```ts
// Sesión real. Distinto de `session.ts`, que solo recuerda el correo del
// "Recordarme" y sigue siendo una comodidad de UI, no una credencial.
import { create } from 'zustand';
import { authApi, type ApiUser, type RegisterInput } from '../api/auth';
import { ApiError, setOnSessionExpired } from '../api/client';
import { tokenStorage } from '../api/tokens';

type Estado = 'loading' | 'authed' | 'guest';

type AuthStore = {
  user: ApiUser | null;
  /** `loading` mientras se lee el almacenamiento seguro: la navegación espera
   *  a que salga de aquí para no parpadear el Login a quien ya tiene sesión. */
  status: Estado;
  error: string | null;
  bootstrap: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (input: RegisterInput) => Promise<void>;
  signOut: () => Promise<void>;
};

export const useAuth = create<AuthStore>((set) => ({
  user: null,
  status: 'loading',
  error: null,

  bootstrap: async () => {
    const tokens = await tokenStorage.get();
    if (!tokens) {
      set({ status: 'guest', user: null });
      return;
    }
    try {
      // Tener el token guardado no basta: puede estar revocado.
      const { user } = await authApi.me();
      set({ user, status: 'authed', error: null });
    } catch {
      await tokenStorage.clear();
      set({ status: 'guest', user: null });
    }
  },

  signIn: async (email, password) => {
    set({ error: null });
    try {
      const { user, accessToken, refreshToken } = await authApi.login(email, password);
      await tokenStorage.save({ accessToken, refreshToken });
      set({ user, status: 'authed' });
    } catch (e) {
      set({ status: 'guest', error: e instanceof ApiError ? e.message : 'No pudimos conectar.' });
      throw e;
    }
  },

  signUp: async (input) => {
    set({ error: null });
    try {
      const { user, accessToken, refreshToken } = await authApi.register(input);
      await tokenStorage.save({ accessToken, refreshToken });
      set({ user, status: 'authed' });
    } catch (e) {
      set({ status: 'guest', error: e instanceof ApiError ? e.message : 'No pudimos conectar.' });
      throw e;
    }
  },

  signOut: async () => {
    const tokens = await tokenStorage.get();
    try {
      if (tokens) await authApi.logout(tokens.refreshToken);
    } catch {
      // Sin red el servidor no se entera, pero la sesión local se cierra igual:
      // dejar al usuario dentro por falta de internet sería peor.
    }
    await tokenStorage.clear();
    set({ user: null, status: 'guest', error: null });
  },
}));

// Si el refresco falla en cualquier petición, la sesión cae sola.
setOnSessionExpired(() => useAuth.setState({ user: null, status: 'guest' }));
```

- [ ] **Step 5: Ejecutar el test y verlo pasar**

Run: `npx jest src/store/__tests__/auth.test.ts`
Expected: PASS — 6 tests.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(auth): store de sesión conectado al backend"
```

---

### Task 13: Conectar `LoginScreen` y `SignupScreen`

**Files:**
- Modify: `app-mobile/src/screens/LoginScreen.tsx`, `app-mobile/src/screens/SignupScreen.tsx`

**Interfaces:**
- Consumes: `useAuth` (Task 12), `ApiError`, `isEmail` de `src/utils/validate.ts`.

- [ ] **Step 1: Conectar el login**

En `LoginScreen.tsx`:

1. Borrar las constantes `DEMO_EMAIL` y `DEMO_PASSWORD` y arrancar los estados vacíos:
   `const [email, setEmail] = useState('')` y `const [password, setPassword] = useState('')`.
   La demo entraba de un toque; con backend real, dejarlas es una credencial de prueba en el binario de producción.
2. Añadir estado local: `const [enviando, setEnviando] = useState(false)` y `const [error, setError] = useState<string | null>(null)`.
3. Reemplazar `submit`:

```tsx
const signIn = useAuth((s) => s.signIn);

const submit = async () => {
  setError(null);

  if (!isEmail(email)) {
    setError('Escribe un correo válido.');
    return;
  }
  if (password.length === 0) {
    setError('Escribe tu contraseña.');
    return;
  }

  setEnviando(true);
  try {
    await signIn(email, password);
    // El "Recordarme" solo guarda el correo, nunca la contraseña.
    if (remember) rememberEmail(email);
    else forget();
    navigation.replace('Tabs');
  } catch (e) {
    setError(e instanceof ApiError ? e.message : 'No pudimos conectar. Revisa tu conexión.');
  } finally {
    setEnviando(false);
  }
};
```

4. Mostrar el error encima del botón, dentro de la `Card`:

```tsx
{error ? (
  <Txt fos={13} tone="danger" mt={2}>
    {error}
  </Txt>
) : null}
```

Si `tone="danger"` no existe en `src/ui/index.tsx`, usar el token de color de peligro que ya use el proyecto; comprobarlo antes en `src/theme/index.ts`.

5. En el `<Btn>`, añadir `disabled={enviando}` y cambiar el texto a `{enviando ? 'Entrando…' : 'Iniciar sesión'}`.

Imports nuevos: `import { useAuth } from '../store/auth'`, `import { ApiError } from '../api/client'`, `import { isEmail } from '../utils/validate'`.

- [ ] **Step 2: Probar el login a mano**

Con el backend corriendo (`pnpm start:dev` en `backend-oil-app`) y un usuario ya registrado por curl en la Task 9:

```bash
cd ../app-mobile && npx expo start
```

Verificar tres cosas:
- Credenciales correctas → entra a `Tabs`.
- Contraseña equivocada → se ve «Correo o contraseña incorrectos.» y **no** entra.
- Backend apagado → se ve «No pudimos conectar. Revisa tu conexión.» y la app no se cae.

- [ ] **Step 3: Conectar el registro**

En `SignupScreen.tsx`:

1. Añadir `const [enviando, setEnviando] = useState(false)` y `const [error, setError] = useState<string | null>(null)`.
2. Cambiar el valor inicial de los términos a `useState(false)`: hoy arranca en `true`, que da por aceptado algo que el usuario no leyó.
3. Añadir el `submit`:

```tsx
const signUp = useAuth((s) => s.signUp);

const submit = async () => {
  setError(null);

  if (fullName.trim().length < 2) return setError('Escribe tu nombre completo.');
  if (!isEmail(email)) return setError('Escribe un correo válido.');
  if (cedula.replace(/\D/g, '').length < 6) return setError('Escribe tu cédula.');
  if (phone.trim().length < 7) return setError('Escribe tu teléfono.');
  if (password.length < 8) return setError('La contraseña debe tener al menos 8 caracteres.');

  setEnviando(true);
  try {
    // El campo lleva el prefijo "V-" visual aparte: se envía junto porque el
    // backend normaliza igual "V-25.481.073" que "25481073".
    await signUp({ fullName, cedula: `V-${cedula}`, email, phone, password });
    navigation.replace('Tabs');
  } catch (e) {
    setError(e instanceof ApiError ? e.message : 'No pudimos conectar. Revisa tu conexión.');
  } finally {
    setEnviando(false);
  }
};
```

4. En el `<Btn>`: `onPress={submit}`, `disabled={enviando || !accepted}` y texto `{enviando ? 'Creando…' : 'Crear cuenta'}`. Hoy el checkbox de términos no bloquea nada — esto lo arregla.
5. Mostrar el error igual que en el login, encima del botón.

- [ ] **Step 4: Probar el registro a mano**

- Registrar una cuenta nueva → entra a `Tabs`.
- Repetir el mismo correo → se ve «Ese correo ya tiene una cuenta.».
- Repetir la misma cédula con otro correo → se ve «Esa cédula ya tiene una cuenta.».
- Contraseña de 7 caracteres → lo ataja la app sin gastar petición.
- Sin marcar los términos → el botón está deshabilitado.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(auth): login y registro conectados al backend"
```

---

### Task 14: Arranque de sesión en la navegación y perfil real

Cierra el círculo: la app abre donde toca y el perfil deja de ser mock.

**Files:**
- Modify: `app-mobile/src/navigation/index.tsx`, `app-mobile/src/store/useStore.ts`, `app-mobile/src/screens/MenuScreen.tsx`
- Modify: `app-mobile/README.md`

**Interfaces:**
- Consumes: `useAuth` (Task 12).

- [ ] **Step 1: Arrancar la sesión al montar la navegación**

En `navigation/index.tsx`, dentro del componente raíz que monta el `NavigationContainer`:

```tsx
const status = useAuth((s) => s.status);
const bootstrap = useAuth((s) => s.bootstrap);

useEffect(() => {
  void bootstrap();
}, [bootstrap]);

// Mientras se lee el almacenamiento seguro no se decide ruta: pintar Login y
// saltar a Tabs medio segundo después es un parpadeo feo y confuso.
if (status === 'loading') return <SplashScreen />;
```

Para el splash, reusar lo que ya haya; si no hay nada, basta con un `<Box f={1} bg="$bg3" ai="center" jc="center"><BrandMark size={48} /></Box>`.

- [ ] **Step 2: Elegir la ruta inicial según la sesión**

En el `<Stack.Navigator>`, cambiar la ruta inicial fija por:

```tsx
initialRouteName={status === 'authed' ? 'Tabs' : 'Onboarding'}
```

Comprobar cómo está declarada hoy: si el navegador no usa `initialRouteName` sino el orden de las `Screen`, hay que añadirlo explícitamente.

- [ ] **Step 3: Alimentar el perfil con el usuario real**

En `useStore.ts`, `profile` arranca con `MOCK_PROFILE`. Añadir una acción para volcar el usuario de la API:

```ts
/** Vuelca el usuario autenticado sobre el perfil. Los campos que el registro
 *  no pide (estado, ciudad) llegan nulos: se conserva lo que ya hubiera. */
setProfileFromUser: (u: {
  fullName: string; cedula: string; email: string; phone: string;
  state: string | null; city: string | null; currency: 'USD' | 'BS' | 'BOTH';
}) =>
  set((s) => ({
    profile: {
      ...s.profile,
      fullName: u.fullName,
      cedula: u.cedula,
      email: u.email,
      phone: u.phone,
      state: u.state ?? s.profile.state,
      city: u.city ?? s.profile.city,
      currency: u.currency,
    },
  })),
```

Y llamarla desde el componente raíz de navegación cuando el usuario cambie:

```tsx
const user = useAuth((s) => s.user);
const setProfileFromUser = useStore((s) => s.setProfileFromUser);

useEffect(() => {
  if (user) setProfileFromUser(user);
}, [user, setProfileFromUser]);
```

- [ ] **Step 4: Cerrar sesión de verdad desde el menú**

En `MenuScreen.tsx`, buscar la opción de cerrar sesión (si no existe, añadirla al final de la lista) y conectarla:

```tsx
const signOut = useAuth((s) => s.signOut);

const cerrarSesion = () => {
  Alert.alert('Cerrar sesión', '¿Seguro que quieres salir?', [
    { text: 'Cancelar', style: 'cancel' },
    {
      text: 'Cerrar sesión',
      style: 'destructive',
      onPress: () => {
        void signOut().then(() => navigation.reset({ index: 0, routes: [{ name: 'Login' }] }));
      },
    },
  ]);
};
```

- [ ] **Step 5: Verificar el ciclo completo a mano**

1. Entrar con una cuenta → cerrar la app del todo → volver a abrirla: **debe entrar directo a `Tabs`**, sin pasar por Login. Es la prueba de que el token sobrevive en almacenamiento seguro.
2. Ir a Perfil: deben verse el nombre, cédula, correo y teléfono **reales**, no los de Luis Guerrero del mock (salvo que sea la cuenta que registraste).
3. Cerrar sesión → la app vuelve a Login → cerrar y reabrir: sigue en Login.

- [ ] **Step 6: Documentar cómo se levanta todo**

Añadir al `README.md` de `app-mobile` una sección:

````markdown
## Backend

La app necesita el backend corriendo (`../backend-oil-app`):

```bash
cd ../backend-oil-app
docker compose up -d
pnpm start:dev
```

La URL sale de `app.json` → `expo.extra.apiUrl`. En **dispositivo físico**
`localhost` es el propio teléfono: hay que poner la IP LAN del equipo
(`ipconfig getifaddr en0`), por ejemplo `http://192.168.1.50:3000/api/v1`.
````

Actualizar también el `README.md` de la raíz del monorepo: la tabla todavía dice `backend/` y «🔜 Pendiente».

- [ ] **Step 7: Ejecutar toda la batería y commitear**

```bash
npx tsc --noEmit && npx jest
```
Expected: todo en verde.

```bash
git add -A
git commit -m "feat(auth): sesión persistente al abrir la app y perfil del usuario real"
```

---

## Verificación final

Correr en los dos repositorios antes de dar por cerrado el trabajo:

```bash
cd backend-oil-app && docker compose up -d && pnpm lint && pnpm test && pnpm test:e2e
cd ../app-mobile && npx tsc --noEmit && npx jest
```

Y la comprobación que ningún test automático cubre: **instalar la app, entrar,
matar la app, reabrirla y comprobar que sigue dentro.** Es el comportamiento
que motivó toda esta entrega.
