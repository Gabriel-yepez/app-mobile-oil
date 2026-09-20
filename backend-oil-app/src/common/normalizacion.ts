// Normalización de texto de entrada, compartida por los DTO que reciben datos
// de perfil.
//
// Vive en common/ y no dentro de un DTO porque la usan dos fronteras distintas
// —el registro y la edición de perfil— y tienen que coincidir exactamente: si
// el registro guardara "Distrito Capital" y la edición "distrito capital", el
// mismo usuario acabaría en dos zonas distintas según por dónde entró el dato.

export const texto = (v: unknown): string => (typeof v === 'string' ? v : '');

/** "V-25.481.073" → "V25481073". Sin letra se asume V (venezolano). */
export function normalizarCedula(valor: string): string {
  const limpio = valor.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return /^[VEJG]/.test(limpio) ? limpio : `V${limpio}`;
}

// Conectores que en español van en minúscula dentro de un topónimo:
// "San Juan de los Morros", no "San Juan De Los Morros".
const CONECTORES = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'e']);

/**
 * "  distrito   CAPITAL " → "Distrito Capital".
 *
 * Estado y ciudad se piden como texto libre, así que sin esto la base
 * acabaría con "Caracas", "caracas" y "CARACAS" como valores distintos y
 * cualquier agrupación por zona saldría partida en tres. No sustituye a un
 * catálogo cerrado —"Ccs" seguirá siendo otra cosa— pero recoge el caso
 * frecuente, que es el de las mayúsculas y los espacios de más.
 */
export function normalizarLugar(valor: string): string {
  return valor
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('es')
    .split(' ')
    .map((palabra, i) =>
      i > 0 && CONECTORES.has(palabra)
        ? palabra
        : palabra.charAt(0).toLocaleUpperCase('es') + palabra.slice(1),
    )
    .join(' ');
}
