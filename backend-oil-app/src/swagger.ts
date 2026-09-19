// Toda la configuración de la documentación vive acá para que main.ts siga
// leyéndose de un vistazo.
import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

/** Ruta donde queda la UI. El JSON crudo sale en `${DOCS_PATH}-json`. */
export const DOCS_PATH = 'docs';

// El texto de portada. Es lo primero que lee quien va a consumir la API, así
// que dice las cosas que no se deducen mirando los endpoints uno por uno.
const DESCRIPCION = `
API del backend. Todas las rutas cuelgan de **\`/api/v1\`**.

---

## Cómo probar desde acá

1. Abre \`POST /auth/register\` (o \`/auth/login\` si ya tienes cuenta), pulsa
   **Try it out** y envía el cuerpo de ejemplo.
2. Copia el \`accessToken\` de la respuesta.
3. Pulsa **Authorize** 🔒 arriba a la derecha y pégalo. Escribe **solo el
   token**: el prefijo \`Bearer \` lo pone Swagger.
4. Ya puedes llamar a las rutas con candado (\`/auth/me\`, \`/auth/logout\`).

La autorización queda guardada aunque recargues la página.

---

## Cómo se autentica

Son **dos tokens con trabajos distintos**:

| | \`accessToken\` | \`refreshToken\` |
|---|---|---|
| Qué es | JWT firmado | 384 bits aleatorios, opacos |
| Dura | 15 min (\`JWT_ACCESS_TTL\`) | 30 días (\`JWT_REFRESH_TTL\`) |
| Va en | header \`Authorization: Bearer …\` | cuerpo de \`/auth/refresh\` y \`/auth/logout\` |
| Usos | los que quepan en su vida | **uno solo** |

El ciclo normal de la app: registrarse o entrar → guardar ambos tokens → usar
el access en cada petición → cuando responda 401, llamar a \`/auth/refresh\` y
reintentar → si el refresh también falla, mandar al login.

> ⚠️ **Los refresh son de un solo uso, y reusar uno gastado revoca todas las
> sesiones del usuario.** Si dos peticiones refrescan en paralelo con el mismo
> token, la segunda cierra la sesión. Serializa la renovación en el cliente.

---

## Cómo son los errores

**Todos** los errores de la API, sin excepción, tienen la misma forma:

\`\`\`json
{
  "statusCode": 409,
  "error": "EMAIL_TAKEN",
  "message": "Ese correo ya tiene una cuenta.",
  "timestamp": "2026-09-18T14:03:11.482Z"
}
\`\`\`

- **\`error\`** es el contrato estable: **ramifica por este campo.**
- **\`message\`** es texto en español para mostrarle al usuario. Puede cambiar
  de redacción sin aviso, así que no lo compares.
- **\`details\`** aparece solo en \`VALIDATION_ERROR\`, con un renglón por regla
  incumplida, para marcar campos en el formulario.

Códigos que puede devolver cualquier ruta:

| \`error\` | HTTP | Cuándo |
|---|---|---|
| \`VALIDATION_ERROR\` | 400 | El cuerpo no pasó el DTO. También si mandas un campo **de más**: se rechaza, no se ignora. |
| \`TOKEN_EXPIRED\` | 401 | El access venció (cada 15 min). **Reacción: refrescar y reintentar** — es el único de los cuatro que se arregla solo. |
| \`UNAUTHORIZED\` | 401 | No vino el header \`Authorization\`. Reacción: al login. |
| \`INVALID_TOKEN\` | 401 | Token mal formado o mal firmado. Reacción: limpiar el dispositivo y al login. |
| \`ACCOUNT_NOT_FOUND\` | 401 | El token es válido pero la cuenta ya no existe. Reacción: limpiar y al registro — refrescar no va a funcionar. |
| \`TOO_MANY_REQUESTS\` | 429 | Se agotó el límite por IP. |
| \`INTERNAL_ERROR\` | 500 | Falla no prevista. El detalle va al log, nunca a la respuesta. |

Los códigos propios de cada ruta (\`INVALID_CREDENTIALS\`, \`EMAIL_TAKEN\`,
\`CEDULA_TAKEN\`, \`INVALID_REFRESH_TOKEN\`) están documentados endpoint por
endpoint, con un ejemplo por motivo en el desplegable de cada respuesta.

---

## Límites por IP

Hay dos limitadores encima de cada petición:

- **general** — 100 por minuto, para todo.
- **estricto** — \`THROTTLE_AUTH_LIMIT\` por minuto (5 por defecto), solo para
  \`register\` y \`login\`.

\`refresh\`, \`logout\` y \`me\` se saltan el estricto a propósito: usarlas seguido
es comportamiento normal de la app; reintentar el login no lo es.
`.trim();

export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('backend-oil-app — API')
    .setDescription(DESCRIPCION)
    .setVersion('1.0')
    // SIN addServer a propósito: createDocument ya incorpora el prefijo global
    // (/api/v1) en cada ruta, así que declarar un server con ese mismo prefijo
    // haría que "Try it out" pegara contra /api/v1/api/v1/... y diera 404.
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description:
          'Pega el `accessToken` que devolvió /auth/register, /auth/login o ' +
          '/auth/refresh. Sin el prefijo "Bearer": lo agrega Swagger.',
      },
      // El nombre con el que lo referencian los @ApiBearerAuth del controlador.
      'access-token',
    )
    .addTag(
      'Autenticación',
      'Crear cuenta, entrar, renovar tokens, cerrar sesión y leer la sesión ' +
        'actual.',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup(DOCS_PATH, app, document, {
    customSiteTitle: 'backend-oil-app — API',
    jsonDocumentUrl: `${DOCS_PATH}-json`,
    swaggerOptions: {
      // Que el token sobreviva a recargar la página: sin esto hay que volver
      // a pulsar Authorize en cada F5, y probar el flujo se hace tedioso.
      persistAuthorization: true,
      // Los endpoints arrancan plegados: la portada es lo primero que debería
      // leerse, no una lista de cinco rutas abiertas.
      docExpansion: 'list',
      displayRequestDuration: true,
      tryItOutEnabled: true,
    },
  });
}
