// El nombre de una marca, sin Prisma y sin Nest. Tres funciones puras que
// deciden qué es la misma marca escrita distinto y qué es texto que no puede
// entrar al catálogo.
//
// OJO: `app-mobile/src/data/marcas/nombre.ts` tiene su propia copia de
// `claveDeMarca`. Es deliberado — no hay paquete compartido entre las dos
// carpetas y montarlo por esto es desproporcionado. La asimetría es explícita:
// la del cliente es una heurística de interfaz, ESTA es la restricción. Si
// divergen, lo peor que pasa es un duplicado visual pasajero en la app; nunca
// una fila duplicada, porque el índice único no lo permite.

export const LARGO_MAX = 40;

// Empieza con letra o número y sigue con letras, números, espacio, punto,
// guion o &. Deja pasar `Mercedes-Benz` y `B.M.W.`; corta URLs (no admite
// `/` ni `:`), saltos de línea y etiquetas.
const PATRON = /^[\p{L}\p{N}][\p{L}\p{N} .\-&]*$/u;

/** Recorta los extremos y colapsa los espacios internos. Nada más: la
 *  capitalización se respeta tal cual, porque `MD` y `AVA` son reales. */
export function normalizarNombre(nombre: string): string {
  return nombre.trim().replace(/\s+/g, ' ');
}

/** La clave canónica: lo que decide si dos textos son la misma marca. */
export function claveDeMarca(nombre: string): string {
  return nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

export function nombreValido(nombre: string): boolean {
  const limpio = normalizarNombre(nombre);
  if (limpio.length === 0 || limpio.length > LARGO_MAX) return false;
  if (!PATRON.test(limpio)) return false;
  // Un nombre cuya clave queda vacía no puede entrar: no habría con qué
  // deduplicarlo y el índice único lo trataría como colisión con cualquier
  // otro igual de vacío.
  return claveDeMarca(limpio).length > 0;
}
