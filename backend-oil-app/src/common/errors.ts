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
};
