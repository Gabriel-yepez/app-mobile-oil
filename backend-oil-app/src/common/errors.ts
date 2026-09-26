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
    new AppError(
      HttpStatus.UNAUTHORIZED,
      'INVALID_CREDENTIALS',
      'Correo o contraseña incorrectos.',
    ),

  invalidRefreshToken: () =>
    new AppError(
      HttpStatus.UNAUTHORIZED,
      'INVALID_REFRESH_TOKEN',
      'Tu sesión expiró. Inicia sesión de nuevo.',
    ),

  // Los tres de abajo los lanza JwtAuthGuard, mirando el `info` que deja
  // passport-jwt. Antes eran un solo 401 indistinguible, y el más común de los
  // tres —el token vencido— es justo el que la app puede resolver sola.
  missingToken: () =>
    new AppError(
      HttpStatus.UNAUTHORIZED,
      'UNAUTHORIZED',
      'Acceso no autorizado, falta token',
    ),

  tokenExpired: () =>
    new AppError(HttpStatus.UNAUTHORIZED, 'TOKEN_EXPIRED', 'Tu sesión expiró.'),

  invalidToken: () =>
    new AppError(
      HttpStatus.UNAUTHORIZED,
      'INVALID_TOKEN',
      'Tu sesión no es válida. Inicia sesión de nuevo.',
    ),

  // El token está bien firmado y sin vencer, pero la cuenta que nombra ya no
  // está en la base (la borraron con la sesión abierta).
  //
  // Es 401 y no 403: un 403 significa "sé quién eres, pero esto no te toca",
  // y acá no hay a quién identificar — el `sub` del token no corresponde a
  // nadie. Lleva código propio y no el `UNAUTHORIZED` genérico porque la app
  // tiene que reaccionar distinto: ante un token vencido conviene intentar
  // /auth/refresh, mientras que acá refrescar es un viaje perdido (al borrar
  // el usuario cayeron sus refresh en cascada). Con este código la app limpia
  // lo que tenga guardado y va directo al registro.
  accountNotFound: () =>
    new AppError(
      HttpStatus.UNAUTHORIZED,
      'ACCOUNT_NOT_FOUND',
      'Tu cuenta ya no está registrada.',
    ),

  // Un solo error para código errado, vencido, agotado o de un correo sin
  // cuenta. Distinguirlos convertiría el endpoint en un oráculo: bastaría con
  // probar correos para saber cuáles están registrados.
  invalidResetCode: () =>
    new AppError(
      HttpStatus.BAD_REQUEST,
      'INVALID_RESET_CODE',
      'El código no es válido o ya venció. Pide uno nuevo.',
    ),

  invalidResetToken: () =>
    new AppError(
      HttpStatus.BAD_REQUEST,
      'INVALID_RESET_TOKEN',
      'El tiempo para cambiar la contraseña terminó. Empieza de nuevo.',
    ),

  emailTaken: () =>
    new AppError(
      HttpStatus.CONFLICT,
      'EMAIL_TAKEN',
      'Ese correo ya tiene una cuenta.',
    ),

  cedulaTaken: () =>
    new AppError(
      HttpStatus.CONFLICT,
      'CEDULA_TAKEN',
      'Esa cédula ya tiene una cuenta.',
    ),

  // 404 y no 403 a propósito: un 403 confirmaría que ese id existe y es de
  // otro. Para quien pregunta por un vehículo ajeno, no existe y punto.
  vehicleNotFound: () =>
    new AppError(
      HttpStatus.NOT_FOUND,
      'VEHICLE_NOT_FOUND',
      'Ese vehículo no está en tu garaje.',
    ),

  odometerBackwards: () =>
    new AppError(
      HttpStatus.UNPROCESSABLE_ENTITY,
      'ODOMETER_BACKWARDS',
      'El odómetro no puede ser menor que la última lectura registrada.',
    ),

  // El salto imposible casi siempre es un dígito de más. Rechazarlo acá evita
  // que entre a la base y envenene la estimación de los ciclos siguientes.
  odometerImplausible: () =>
    new AppError(
      HttpStatus.UNPROCESSABLE_ENTITY,
      'ODOMETER_IMPLAUSIBLE',
      'Ese kilometraje es demasiado alto para el tiempo transcurrido. Revísalo.',
    ),

  oilChangeBackwards: () =>
    new AppError(
      HttpStatus.UNPROCESSABLE_ENTITY,
      'OIL_CHANGE_BACKWARDS',
      'El kilometraje del cambio no puede ser menor que el del cambio anterior.',
    ),

  // Por usuario, no global: dos personas distintas pueden tener la misma placa
  // mal escrita, y no es asunto de una que la otra exista.
  plateTaken: () =>
    new AppError(
      HttpStatus.CONFLICT,
      'PLATE_TAKEN',
      'Ya tienes un vehículo con esa placa.',
    ),

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

  // El proveedor de la tasa no contestó y el servidor todavía no tenía ninguna
  // guardada (recién arrancado). Si ya tenía una, se devuelve esa y no esto.
  exchangeRateUnavailable: () =>
    new AppError(
      HttpStatus.SERVICE_UNAVAILABLE,
      'EXCHANGE_RATE_UNAVAILABLE',
      'La tasa del BCV no está disponible en este momento.',
    ),

  // Los topes del plan. 403 y no 402: 402 no tiene un uso estándar y hay
  // clientes HTTP que lo tratan raro. Lo que la app mira es el `code`, que la
  // lleva a ofrecer el plan Pro.
  vehicleLimitReached: (plan: string, tope: number) =>
    new AppError(
      HttpStatus.FORBIDDEN,
      'VEHICLE_LIMIT_REACHED',
      `Tu plan ${plan} permite hasta ${tope} vehículos. Pásate a Pro para agregar más.`,
    ),

  oilChangeLimitReached: (plan: string, tope: number) =>
    new AppError(
      HttpStatus.FORBIDDEN,
      'OIL_CHANGE_LIMIT_REACHED',
      `Tu plan ${plan} permite ${tope} cambios de aceite por mes. Pásate a Pro para registrar más.`,
    ),
};
