// El nombre de un taller del lado del cliente. Reusa la normalización, la
// clave y el "¿quisiste decir?" de las marcas; solo cambia qué admite.
//
// OJO: `backend-oil-app/src/modules/shops/domain/shop-name.ts` tiene la
// restricción de verdad. Si cambias el patrón o el largo acá, cámbialos allá.
import { claveDeMarca, normalizarNombre, sugerirParecida } from '../marcas/nombre';

export { normalizarNombre, sugerirParecida };

export const LARGO_MAX = 60;

const PATRON = /^[\p{L}\p{N}][\p{L}\p{N} .,'&#()-]*$/u;

export const claveDeTaller = claveDeMarca;

export function nombreValido(nombre: string): boolean {
  const limpio = normalizarNombre(nombre);
  if (limpio.length === 0 || limpio.length > LARGO_MAX) return false;
  if (!PATRON.test(limpio)) return false;
  return claveDeTaller(limpio).length > 0;
}
