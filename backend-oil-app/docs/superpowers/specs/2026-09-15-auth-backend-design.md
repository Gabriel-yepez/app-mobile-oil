# Autenticación: registro e inicio de sesión

**Fecha:** 2026-09-15
**Estado:** aprobado, pendiente de implementar
**Alcance:** `backend-oil-app/` (nuevo) + `app-mobile/` (conexión)

## 1. Contexto

La app móvil ya tiene `LoginScreen`, `SignupScreen` y `ForgotPasswordScreen`
terminadas visualmente, pero ninguna llama a nada: ambas hacen
`navigation.replace('Tabs')` y entran. El perfil sale de `MOCK_PROFILE`.

El backend es un starter de NestJS 11 sin tocar: solo
`AppModule`/`AppController`/`AppService`, sin persistencia, sin configuración y
sin validación.

El objetivo de esta entrega es que un usuario pueda crear una cuenta real,
iniciar sesión, mantenerla abierta entre aperturas de la app y cerrarla.

`src/store/session.ts` de la app ya anticipa este trabajo en su comentario de
cabecera: guarda solo el correo del «Recordarme» y advierte que el token debe
vivir en almacenamiento seguro, aparte. Este diseño respeta esa decisión.

## 2. Decisiones

| Decisión | Elegido | Razón |
|---|---|---|
| Persistencia | PostgreSQL + Prisma | Migraciones versionadas y tipos generados; el motor queda detrás de una interfaz |
| Acoplamiento a la base | Repositorio con token de inyección | Cambiar de motor = cambiar una línea en el módulo |
| Tokens | Access + refresh **rotativo** | Estándar en móvil; permite revocar y detectar robo |
| Hash de contraseña | Argon2id | Recomendación actual de OWASP; resiste GPU mejor que bcrypt |
| Identificador de login | Correo | Es lo que la `LoginScreen` ya pide |
| Cédula | Única, normalizada, **no** sirve para entrar | Evita cuentas duplicadas de la misma persona |
| Versionado | `/api/v1` desde el día uno | En móvil no se puede forzar a actualizar |

### Fuera de alcance

- Recuperar contraseña (exige proveedor de correo: es un subproyecto aparte).
  `ForgotPasswordScreen` se queda sin conectar.
- Verificación de correo.
- Endpoints de vehículos, cambios de aceite y suscripción: siguen con mock.

## 3. Arquitectura

```
src/
├── main.ts                      ValidationPipe global, helmet, CORS, prefijo /api/v1
├── app.module.ts                ConfigModule (global) + Throttler + Prisma + Auth
├── config/
│   ├── configuration.ts         env tipado
│   └── env.validation.ts        valida el env al arrancar
├── common/
│   ├── filters/all-exceptions.filter.ts
│   └── decorators/{current-user,public}.decorator.ts
├── infra/prisma/
│   ├── prisma.module.ts
│   ├── prisma.service.ts
│   ├── prisma-user.repository.ts
│   └── prisma-refresh-token.repository.ts
└── modules/
    ├── users/
    │   ├── domain/user.ts                   tipo de dominio, sin tipos de Prisma
    │   ├── domain/user.repository.ts        interfaz + token USER_REPOSITORY
    │   ├── users.service.ts
    │   └── users.module.ts
    └── auth/
        ├── auth.controller.ts               solo HTTP
        ├── auth.service.ts                  reglas de negocio
        ├── token.service.ts                 firma, verifica y rota tokens
        ├── domain/password-hasher.ts        interfaz + token PASSWORD_HASHER
        ├── domain/refresh-token.repository.ts
        ├── hashing/argon2.hasher.ts
        ├── dto/
        ├── strategies/jwt.strategy.ts
        ├── guards/jwt-auth.guard.ts
        └── auth.module.ts
```

Tres capas con fronteras reales: el controlador no conoce el negocio, el
servicio no conoce Prisma, Prisma no conoce HTTP.

### El punto de cambio de motor

`UsersModule` es el único lugar donde se declara quién cumple el contrato:

```ts
@Module({
  imports: [PrismaModule],
  providers: [
    UsersService,
    { provide: USER_REPOSITORY, useClass: PrismaUserRepository }, // ← la línea
  ],
  exports: [UsersService, USER_REPOSITORY],
})
export class UsersModule {}
```

Migrar a otro motor es escribir una clase que cumpla `UserRepository` y cambiar
`useClass`. Servicios, controladores y tests no se tocan.

**Condición para que eso sea cierto:** el repositorio devuelve el tipo de
dominio `User` (`modules/users/domain/user.ts`), **nunca** el modelo generado
por Prisma. Si los servicios consumieran el tipo de Prisma, el acoplamiento se
filtraría por los tipos a toda la aplicación y el cambio de una línea sería
falso. `PrismaUserRepository` hace el mapeo en su frontera.

El mismo patrón aplica a `PASSWORD_HASHER` y a `RefreshTokenRepository`.

### Dependencias nuevas

`@nestjs/config`, `@nestjs/jwt`, `@nestjs/passport`, `passport`, `passport-jwt`,
`@nestjs/throttler`, `class-validator`, `class-transformer`, `argon2`, `helmet`,
`prisma`, `@prisma/client`.

## 4. Modelo de datos

```prisma
enum Currency { USD BS BOTH }

model User {
  id            String   @id @default(uuid()) @db.Uuid
  email         String   @unique          // normalizado a minúsculas
  cedula        String   @unique          // normalizada: "V25481073"
  passwordHash  String
  fullName      String
  phone         String
  state         String?                   // se completan luego en EditProfile
  city          String?
  currency      Currency @default(BOTH)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  refreshTokens RefreshToken[]
}

model RefreshToken {
  id         String    @id @default(uuid()) @db.Uuid
  tokenHash  String    @unique             // SHA-256 del token, nunca el token
  userId     String    @db.Uuid
  user       User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  expiresAt  DateTime
  revokedAt  DateTime?
  replacedBy String?                       // id del sucesor: rastro de rotación
  createdAt  DateTime  @default(now())

  @@index([userId])
}
```

**Normalización.** El correo se guarda en minúsculas y sin espacios. La cédula
se guarda como letra de nacionalidad + dígitos (`V25481073`), de modo que
`V-25.481.073` y `25481073` no produzcan dos cuentas. El formato de
presentación es responsabilidad de la app.

**Por qué el refresh token se guarda hasheado.** Un volcado de la base no debe
entregar sesiones vivas.

**Por qué SHA-256 y no Argon2 para ese hash.** El token son 256 bits
aleatorios, no una contraseña adivinable: no hay diccionario que probar. Argon2
en cada refresco solo gastaría CPU sin añadir seguridad.

**Rotación y detección de robo.** Al refrescar, el token usado queda con
`revokedAt` y `replacedBy`. Presentar un token **ya revocado** solo ocurre si
hay dos copias circulando: ante ese caso se revocan **todas** las sesiones del
usuario. Ésa es la razón de existir de la rotación.

## 5. API

Prefijo `/api/v1`.

| Método | Ruta | Auth | Cuerpo | Respuesta |
|---|---|---|---|---|
| POST | `/auth/register` | — | `fullName`, `cedula`, `email`, `phone`, `password` | `201 { user, accessToken, refreshToken }` |
| POST | `/auth/login` | — | `email`, `password` | `200 { user, accessToken, refreshToken }` |
| POST | `/auth/refresh` | — | `refreshToken` | `200 { accessToken, refreshToken }` |
| POST | `/auth/logout` | Bearer | `refreshToken` | `204` |
| GET | `/auth/me` | Bearer | — | `200 { user }` |

`user` nunca incluye `passwordHash`. Se arma con un DTO explícito de lista
blanca: olvidar **incluir** un campo es visible en la respuesta; olvidar
**excluirlo** es silencioso y peligroso.

### Reglas de validación del registro

| Campo | Regla |
|---|---|
| `fullName` | 2–80 caracteres, no vacío tras recortar espacios |
| `cedula` | 6–9 dígitos, con letra de nacionalidad opcional (`V`, `E`, `J`, `G`) |
| `email` | correo válido, máximo 160 caracteres |
| `phone` | 7–20 caracteres; dígitos, espacios, `+`, `-`, `(`, `)` |
| `password` | **mínimo 8 caracteres**, máximo 72; al menos una letra y un dígito |

El mínimo de 8 no es arbitrario: es lo que la `SignupScreen` ya le promete al
usuario («Al menos 8 caracteres»). El máximo de 72 es el límite práctico que
heredan las funciones de hash; cortar en silencio una contraseña más larga sería
peor que rechazarla.

**Normalización antes de guardar**, hecha en el DTO con `@Transform`, no en el
servicio: el correo pasa a minúsculas y sin espacios; la cédula pierde puntos,
guiones y espacios y adopta la letra en mayúscula, con `V` por defecto si no
viene ninguna. Así `V-25.481.073`, `v25481073` y `25.481.073` llegan todas al
repositorio como `V25481073` y el índice único puede hacer su trabajo.

### Forma de los errores

Producida por el filtro global, igual para todos:

```json
{
  "statusCode": 409,
  "error": "EMAIL_TAKEN",
  "message": "Ese correo ya tiene una cuenta.",
  "timestamp": "2026-09-15T12:00:00.000Z"
}
```

| `error` | HTTP | Cuándo |
|---|---|---|
| `VALIDATION_ERROR` | 400 | DTO inválido; incluye detalle por campo |
| `INVALID_CREDENTIALS` | 401 | Correo o contraseña incorrectos |
| `INVALID_REFRESH_TOKEN` | 401 | Refresh ausente, vencido, revocado o desconocido |
| `EMAIL_TAKEN` | 409 | Correo ya registrado |
| `CEDULA_TAKEN` | 409 | Cédula ya registrada |
| `TOO_MANY_REQUESTS` | 429 | Límite de tasa superado |

La app ramifica por `error` (código estable) y muestra `message` (texto que
puede cambiar). Nunca ramificar por el texto.

**Correo inexistente y contraseña equivocada devuelven exactamente el mismo
`401 INVALID_CREDENTIALS`.** Distinguirlos convierte al login en un oráculo
para enumerar qué correos están registrados.

El registro sí revela que un correo está tomado (`409`). Es una concesión
deliberada: el formulario tiene que poder decírselo al usuario. Se mitiga con
el límite de tasa.

## 6. Seguridad

- **`ValidationPipe` global** con `whitelist`, `forbidNonWhitelisted` y
  `transform`: un campo de más en el JSON se rechaza, no se ignora en silencio.
- **Límite de tasa.** `register` y `login`: 5 por minuto por IP. Resto: 100 por
  minuto. Sin esto el login es fuerza bruta gratis.
- **Vidas de token.** Access 15 min, refresh 30 días, con secretos distintos.
- **Timing del login.** Cuando el correo no existe se compara contra un hash
  señuelo, para que el tiempo de respuesta sea el mismo con correo válido e
  inválido. Sin esto, la latencia delata qué correos existen.
- **`helmet`** y CORS restringido por configuración.
- **Env validado al arrancar.** Sin `JWT_SECRET` el proceso no levanta, en vez
  de arrancar con un valor por defecto inseguro.

### Variables de entorno

| Variable | Ejemplo | Obligatoria |
|---|---|---|
| `DATABASE_URL` | `postgresql://user:pass@localhost:5432/ruedalo` | sí |
| `JWT_ACCESS_SECRET` | cadena aleatoria larga | sí |
| `JWT_REFRESH_SECRET` | distinta de la anterior | sí |
| `JWT_ACCESS_TTL` | `15m` | no (por defecto `15m`) |
| `JWT_REFRESH_TTL` | `30d` | no (por defecto `30d`) |
| `PORT` | `3000` | no (por defecto `3000`) |
| `CORS_ORIGINS` | lista separada por comas | no |

Se entrega un `.env.example`. El `.env` real está en `.gitignore`.

## 7. Capa móvil

**Dependencia nueva: `expo-secure-store`** (Keychain en iOS, Keystore en
Android). Los tokens **no** van en `expo-sqlite/kv-store`, que es almacenamiento
plano.

| Archivo | Cambio |
|---|---|
| `src/api/client.ts` | **nuevo** — envoltorio de `fetch`: base URL, `Bearer`, refresco automático |
| `src/api/auth.ts` | **nuevo** — los cinco endpoints, tipados |
| `src/store/auth.ts` | **nuevo** — `user`, `status`, `signIn`/`signUp`/`signOut` |
| `src/screens/LoginScreen.tsx` | envío real, carga, errores; se quitan las credenciales de demo |
| `src/screens/SignupScreen.tsx` | envío real, validación; el checkbox de términos bloquea el botón |
| `src/navigation/index.tsx` | ruta inicial según `status`, con splash |
| `src/store/useStore.ts` | `profile` se alimenta del usuario real |
| `src/store/session.ts` | **sin cambios** |

**Refresco automático con cola.** Ante un `401`, el cliente intenta refrescar
**una sola vez** y reintenta la petición. Si varias peticiones caducan a la vez,
todas esperan al mismo refresco en curso en lugar de disparar refrescos en
carrera — que con rotación se invalidarían entre sí y cerrarían la sesión de un
usuario legítimo. Si el refresco falla, se cierra sesión y se navega a `Login`.

**Estados de `status`:** `loading` mientras se lee el token del almacenamiento
seguro, `authed` con sesión válida, `guest` sin ella. La navegación espera a que
salga de `loading` para no mostrar un parpadeo de `Login` a un usuario que ya
tiene sesión.

**Base URL en desarrollo.** En dispositivo físico `localhost:3000` apunta al
propio teléfono: hay que usar la IP LAN del equipo. Queda configurable y
documentado en el README de la app.

## 8. Testing

**Unitarios (sin base de datos).** `AuthService` contra un
`InMemoryUserRepository` y un hasher falso. Casos: registro correcto, correo
duplicado, cédula duplicada, contraseña incorrecta, correo inexistente,
refresco correcto, refresco con token revocado (debe revocar todas las
sesiones). Es lo que la abstracción de repositorio hace posible.

**E2E (supertest, Postgres de prueba).** Flujo completo: registrar → entrar →
usar `/me` → refrescar → usar `/me` con el token nuevo → cerrar sesión →
comprobar que el refresh ya no sirve. Más el caso de reuso de token rotado.

**Móvil.** Test del cliente HTTP: que el refresco se dispare una sola vez con
peticiones concurrentes, y que un refresco fallido cierre la sesión.

## 9. Riesgos y notas

- **`backend-oil-app/` es un repo git independiente**, sin commits ni remoto,
  anidado en el repo raíz (que lo ve como carpeta sin seguimiento; no es
  submódulo). El histórico del backend no viaja con el del monorepo. Conviene
  decidir aparte si se convierte en submódulo, se absorbe en el repo raíz o se
  le pone remoto propio. No bloquea esta entrega.
- El README raíz aún anuncia la carpeta como `backend/` y en estado
  «🔜 Pendiente»: hay que actualizarlo.
- Los `state`, `city` y `currency` del `Profile` no se piden en el registro:
  quedan nulos o por defecto hasta que el usuario los llene en `EditProfile`.
  Las pantallas que los muestren deben tolerar el valor vacío.
- Falta decidir dónde se hospedará Postgres en producción (Neon, Railway, RDS).
  No bloquea: en desarrollo se levanta con Docker.
