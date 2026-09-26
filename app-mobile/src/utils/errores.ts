import { ApiError } from '../api/base';

/**
 * El texto a mostrar para un error de la API.
 *
 * Si el servidor mandó `details` —p. ej. las reglas de contraseña que no se
 * cumplen—, van esos: dicen QUÉ corregir, mientras que el `message` de un
 * VALIDATION_ERROR es un genérico "Revisa los datos enviados.".
 */
export function textoDeError(e: unknown): string {
  if (e instanceof ApiError) {
    return e.details.length > 0 ? e.details.join('\n') : e.message;
  }
  return 'No pudimos conectar. Revisa tu conexión.';
}
