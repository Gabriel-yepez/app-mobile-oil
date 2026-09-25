# Recuperar contraseña y regla de contraseña

**Fecha:** 2026-09-24
**Estado:** aprobado
**Alcance:** `backend-oil-app/` + `app-mobile/`

## 1. Qué se construye

1. Un flujo de tres pasos para restablecer la contraseña: correo → código de 6
   dígitos recibido por correo → contraseña nueva y su confirmación.
2. Una regla de contraseña nueva, aplicada en el registro y en el
   restablecimiento, validada en el backend y mostrada como leyenda en la app.

## 2. Decisiones

| Decisión | Elegido | Razón |
|---|---|---|
| Envío de correo | Puerto `MAIL_SENDER` + adaptador SMTP (nodemailer) | Igual que `PUSH_SENDER`. SendGrid, Brevo y Resend aceptan SMTP: cambiar de proveedor son variables de entorno |
| Correo en desarrollo | Mailpit en el docker-compose | Los correos no salen a internet y se leen en `localhost:8025` |
| Proveedor en producción | Pendiente del usuario | SendGrid retiró su plan gratis en mayo de 2025 (solo 60 días de prueba); Brevo y Resend tienen plan gratis permanente |
| Longitud mínima | 8 caracteres | La regla ya existente; «más de 6» se resolvió a 8 |
| Guardar el código | HMAC-SHA256 con secreto del servidor | 6 dígitos son un millón de combinaciones: un SHA-256 simple se rompe desde un volcado en segundos |
| Tras restablecer | Se revocan todas las sesiones y no se inicia sesión | Si robaron la cuenta, cambiar la contraseña debe echar al intruso |

## 3. La regla de contraseña

| Regla | Mensaje |
|---|---|
| 8 a 72 caracteres | `Debe tener entre 8 y 72 caracteres` |
| Una mayúscula | `Debe incluir al menos una letra mayúscula` |
| Un número | `Debe incluir al menos un número` |
| Un carácter especial | `Debe incluir al menos un carácter especial` |

«Carácter especial» es cualquier cosa que no sea letra, número ni espacio
(`/[^\p{L}\p{N}\s]/u`). La `ñ` y las vocales acentuadas cuentan como letras.

Cada regla es **un validador aparte**, de modo que la respuesta 400 lista en
`details` **todas** las reglas incumplidas a la vez, no solo la primera.

Solo se aplica **al fijar** una contraseña (registro y restablecimiento). El
login no la valida: las cuentas con contraseñas anteriores siguen entrando.

La regla vive en dos sitios —el backend y la app— porque no hay paquete
compartido entre los proyectos. El backend es la autoridad; la app la replica
para marcar la leyenda en vivo. Ambos lados tienen tests con los mismos casos.

## 4. API

Prefijo `/api/v1/auth/password`. Las tres rutas usan el limitador estricto.

### `POST /forgot` — `{ email }` → `202`

Responde **siempre lo mismo**, exista o no la cuenta, y el correo se envía en
segundo plano para que el tiempo de respuesta tampoco lo delate.

Si la cuenta existe: se invalidan los códigos anteriores del usuario, se genera
uno nuevo de 6 dígitos (vida: 15 min) y se envía.

### `POST /verify` — `{ email, code }` → `200 { resetToken, expiresIn }`

- Código correcto y vigente → `resetToken` aleatorio de un solo uso, vida de
  10 min, guardado como SHA-256 (alta entropía, a diferencia del código).
- Código errado, vencido, agotado o correo sin cuenta → el mismo
  `400 INVALID_RESET_CODE`. No se distingue: distinguirlo convertiría el
  endpoint en un oráculo.
- 5 intentos fallidos agotan el código; hay que pedir otro.

### `POST /reset` — `{ resetToken, password, confirmPassword }` → `204`

- Valida la regla de contraseña y que la confirmación coincida.
- Token inválido, vencido o ya usado → `400 INVALID_RESET_TOKEN`.
- Guarda el hash nuevo, consume el token y **revoca todos los refresh tokens**.

## 5. Modelo

```prisma
model PasswordResetCode {
  id             String    @id @default(uuid()) @db.Uuid
  userId         String    @db.Uuid
  user           User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  codeHash       String                // HMAC-SHA256
  expiresAt      DateTime
  attempts       Int       @default(0)
  resetTokenHash String?   @unique     // SHA-256, tras verificar
  resetExpiresAt DateTime?
  usedAt         DateTime?
  createdAt      DateTime  @default(now())

  @@index([userId])
}
```

Variable de entorno nueva y obligatoria: `RESET_CODE_SECRET` (≥ 32 caracteres,
distinta de los secretos JWT). Más las del SMTP: `SMTP_HOST`, `SMTP_PORT`,
`SMTP_USER`, `SMTP_PASS`, `SMTP_SECURE`, `MAIL_FROM`.

## 6. App

- `PasswordRules`: leyenda con las cuatro reglas que se marcan en verde al
  escribir. En el paso 3 del registro y en el paso 3 de recuperar.
- `ForgotPasswordScreen` pasa a tres pasos con el contador sobre el navy, como
  el registro. Al terminar vuelve al login con el correo puesto.
- El «Cambiar contraseña» de Seguridad abre este flujo con el correo del
  usuario precargado.

## 7. Fuera de alcance

- Cambiar la contraseña sabiendo la actual (sin correo). El flujo por código
  cubre también al usuario con sesión.
- Plantillas de correo con marca. Va texto plano más un HTML mínimo.
