// El nombre de un taller. Reusa la normalización y la clave de las marcas —
// "El Marqués" y "el marques" son el mismo taller por la misma razón que
// "Toyotá" y "TOYOTA" son la misma marca— y solo cambia lo que admite.
//
// OJO: `app-mobile/src/data/talleres/nombre.ts` tiene su propia copia de
// `nombreValido`, por lo mismo que la de marcas. Si cambias el patrón o el
// largo acá, cámbialos allá.
import { claveDeMarca, normalizarNombre } from '../../brands/domain/brand-name';

export { normalizarNombre };

export const LARGO_MAX = 60;

// Más permisivo que el de marcas: un taller se llama "Auto Express C.A.",
// "Taller Hnos. Pérez (Los Ruices)" o "Lubricentro #1". Sigue sin admitir `/`
// ni `:`, que es lo que corta las URLs, ni `<` `>`.
const PATRON = /^[\p{L}\p{N}][\p{L}\p{N} .,'&#()-]*$/u;

/** La clave canónica: lo que decide si dos textos son el mismo taller. */
export const claveDeTaller = claveDeMarca;

export function nombreValido(nombre: string): boolean {
  const limpio = normalizarNombre(nombre);
  if (limpio.length === 0 || limpio.length > LARGO_MAX) return false;
  if (!PATRON.test(limpio)) return false;
  return claveDeTaller(limpio).length > 0;
}
