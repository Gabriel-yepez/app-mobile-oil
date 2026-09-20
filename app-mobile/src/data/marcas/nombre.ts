// El nombre de una marca del lado del cliente. PURO a propósito: se prueba con
// una tabla de casos en vez de montar pantallas.
//
// OJO: `backend-oil-app/src/modules/brands/domain/brand-name.ts` tiene su
// propia copia de `claveDeMarca` y `nombreValido`. Es deliberado — no hay
// paquete compartido entre las dos carpetas. La asimetría es explícita: ESTA
// es una heurística de interfaz, la del servidor es la restricción. Si
// divergen, lo peor que pasa es un duplicado visual hasta el próximo refresco;
// nunca una fila duplicada, porque el índice único del servidor no lo permite.

export const LARGO_MAX = 40;

const PATRON = /^[\p{L}\p{N}][\p{L}\p{N} .\-&]*$/u;

export function normalizarNombre(nombre: string): string {
  return nombre.trim().replace(/\s+/g, ' ');
}

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
  return claveDeMarca(limpio).length > 0;
}

/** Levenshtein con una sola fila: alcanza para textos de 40 caracteres. */
export function distancia(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let fila = Array.from({ length: b.length + 1 }, (_, i) => i);

  for (let i = 1; i <= a.length; i++) {
    const siguiente = [i];
    for (let j = 1; j <= b.length; j++) {
      const costo = a[i - 1] === b[j - 1] ? 0 : 1;
      siguiente[j] = Math.min(
        fila[j] + 1, // borrar
        siguiente[j - 1] + 1, // insertar
        fila[j - 1] + costo, // sustituir
      );
    }
    fila = siguiente;
  }

  return fila[b.length];
}

/**
 * La marca existente más parecida a lo que escribió, o null.
 *
 * Devuelve null cuando la marca YA existe exacta: ahí no hay nada que
 * sugerir, es la misma, y la pantalla ni siquiera ofrece agregarla.
 *
 * El umbral depende del largo por un caso real: `MD` y `AVA` están a
 * distancia 2 y son dos marcas distintas del catálogo de motos. Con un umbral
 * fijo la app ofrecería cambiar una por la otra.
 */
export function sugerirParecida(
  texto: string,
  existentes: string[],
): string | null {
  const clave = claveDeMarca(texto);
  if (clave.length === 0) return null;

  const umbral = clave.length >= 4 ? 2 : 1;
  let mejor: { nombre: string; d: number } | null = null;

  for (const candidata of existentes) {
    const d = distancia(clave, claveDeMarca(candidata));
    if (d === 0) return null;
    if (d <= umbral && (mejor === null || d < mejor.d)) {
      mejor = { nombre: candidata, d };
    }
  }

  return mejor === null ? null : mejor.nombre;
}
