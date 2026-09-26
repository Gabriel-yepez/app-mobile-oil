// Azúcar para documentar errores. Un mismo código HTTP puede salir por varios
// motivos —409 es correo repetido O cédula repetida— y lo que le importa a
// quien consume la API es el `error`, no el número. Este decorador pinta todos
// los motivos de un status como ejemplos seleccionables en el desplegable de
// Swagger, en vez de dejar un solo cuerpo genérico por código.
import { applyDecorators, type HttpStatus } from '@nestjs/common';
import { ApiExtraModels, ApiResponse, getSchemaPath } from '@nestjs/swagger';
import { ErrorResponseDto } from '../dto/error-response.dto';

export type EjemploError = {
  /** Título del ejemplo en el desplegable. */
  resumen: string;
  /** Valor del campo `error`: el código estable. */
  error: string;
  /** Valor del campo `message`: el texto para el usuario. */
  message: string;
  details?: string[];
};

export function ApiErrorResponse(
  status: HttpStatus,
  description: string,
  ejemplos: Record<string, EjemploError>,
): MethodDecorator & ClassDecorator {
  const examples = Object.fromEntries(
    Object.entries(ejemplos).map(([clave, e]) => [
      clave,
      {
        summary: `${e.error} — ${e.resumen}`,
        value: {
          statusCode: status,
          error: e.error,
          message: e.message,
          ...(e.details ? { details: e.details } : {}),
          timestamp: '2026-09-18T14:03:11.482Z',
        },
      },
    ]),
  );

  return applyDecorators(
    ApiExtraModels(ErrorResponseDto),
    ApiResponse({
      status,
      description,
      content: {
        'application/json': {
          schema: { $ref: getSchemaPath(ErrorResponseDto) },
          examples,
        },
      },
    }),
  );
}

/** Los tres errores que puede devolver CUALQUIER ruta de la API. */
export const ERRORES_COMUNES = {
  validacion: {
    resumen: 'el cuerpo no pasó las validaciones',
    error: 'VALIDATION_ERROR',
    message: 'Revisa los datos enviados.',
    details: ['El correo no es válido'],
  },
  camposDeMas: {
    resumen: 'llegó un campo que no existe en el DTO',
    error: 'VALIDATION_ERROR',
    message: 'Revisa los datos enviados.',
    details: ['property esAdmin should not exist'],
  },
  limite: {
    resumen: 'se agotaron los intentos por minuto',
    error: 'TOO_MANY_REQUESTS',
    message: 'Demasiados intentos. Espera un momento.',
  },
  interno: {
    resumen: 'falla no prevista del servidor',
    error: 'INTERNAL_ERROR',
    message: 'Ocurrió un error inesperado.',
  },
  sinToken: {
    resumen: 'no vino el header Authorization',
    error: 'UNAUTHORIZED',
    message: 'Acceso no autorizado, falta token',
  },
  vencido: {
    resumen: 'el access token venció — la app debe refrescar y reintentar',
    error: 'TOKEN_EXPIRED',
    message: 'Tu sesión expiró.',
  },
  malFirmado: {
    resumen: 'el token está mal formado o mal firmado',
    error: 'INVALID_TOKEN',
    message: 'Tu sesión no es válida. Inicia sesión de nuevo.',
  },
  cuentaBorrada: {
    resumen: 'el token es válido pero la cuenta que nombra ya no existe',
    error: 'ACCOUNT_NOT_FOUND',
    message: 'Tu cuenta ya no está registrada.',
  },
} as const satisfies Record<string, EjemploError>;
