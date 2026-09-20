// Qué avisarle al usuario después de intentar agregar una marca.
//
// PURO a propósito: la decisión de qué mensaje sale y de qué tipo es lo único
// que vale la pena probar acá, y así se prueba con una tabla de casos en vez
// de mockeando el store de toast.
import { ApiError } from '../../api/base';
import { clasificarFallo } from '../sync/runner';
import type { ApiBrandCreada } from '../../api/controllers/brands.controller';
import type { ToastKind } from '../../store/toast';

/** `null` significa que no hay nada que avisar. */
export type Aviso = { kind: ToastKind; text: string } | null;

/**
 * Usa el nombre que devolvió el SERVIDOR, no el que escribió el usuario: si
 * escribió "toyota" y el catálogo ya tenía "Toyota", tiene que leer el del
 * catálogo — es el que va a ver de ahora en adelante.
 */
export function avisoDeAlta(r: ApiBrandCreada): Aviso {
  return r.created
    ? { kind: 'ok', text: `${r.name} agregada al catálogo` }
    : { kind: 'info', text: `${r.name} ya estaba en el catálogo` };
}

/**
 * Solo se avisan los rechazos PERMANENTES.
 *
 * Un fallo de red o un servidor caído los reintenta la cola sola; avisarle al
 * usuario de algo que no hizo mal y que se va a resolver solo es ruido. Y la
 * sesión caída tiene su propio flujo, que va a sacarlo al login: un toast ahí
 * compite con eso.
 */
export function avisoDeFallo(e: unknown): Aviso {
  if (clasificarFallo(e) !== 'permanente') return null;
  // Acá el texto SÍ sale de la API: es el único que sabe por qué rechazó.
  const text =
    e instanceof ApiError ? e.message : 'No se pudo agregar la marca.';
  return { kind: 'error', text };
}
