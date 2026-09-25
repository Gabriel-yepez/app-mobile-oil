// Filtro de lenguaje para el catálogo común de marcas.
//
// Existe porque una marca nueva la ve TODO el mundo de inmediato, así que el
// nombre que escribe un usuario aparece en el selector de los demás. Esto es
// una capa, no una solución: ninguna lista atrapa todo, y lo ofensivo que
// depende del contexto —una frase sin ninguna palabra sucia pero dirigida a
// alguien— pasa entero. El borrado manual por `pnpm db:studio` sigue siendo
// necesario.
//
// PARA EXTENDER LA LISTA: agregá el término ya normalizado (mayúsculas, sin
// acentos, sin eñe: "coño" se escribe CONO). Después corré el spec — tiene un
// bloque con marcas reales que falla si el término nuevo pisa alguna.

/**
 * Términos vetados, en forma canónica.
 *
 * Los de 5 caracteres o más se buscan como subcadena, así que atrapan
 * `supermierda`. Los de 4 o menos se exigen como palabra completa: son
 * demasiado cortos y chocarían con marcas legítimas — `PUTA` vive dentro de
 * "disputa" y `ASS` dentro de "Passat".
 */
const VETADAS: readonly string[] = [
  // Español general y venezolano
  'MIERDA',
  'PENDEJO',
  'PENDEJA',
  'CARAJO',
  'CABRON',
  'CABRONA',
  'GILIPOLLAS',
  'CAPULLO',
  'CHINGAR',
  'CHINGADA',
  'JODER',
  'JODIDO',
  'PUTA',
  'PUTO',
  'PUTOS',
  'PUTAS',
  'PERRA',
  'ZORRA',
  'MALPARIDO',
  'HIJUEPUTA',
  'HIJUEPUTAS',
  'HDP',
  'CONO',
  'VERGA',
  'VERGAZO',
  'GUEVON',
  'HUEVON',
  'GUEBON',
  'MARICO',
  'MARICA',
  'MARICON',
  'CULO',
  'CULERO',
  'PINGA',
  'POLLA',
  'PICHA',
  'CHIMBO',
  'CHIMBA',
  'COGER',
  'COGIDA',
  'TETAS',
  'CONCHUDO',
  'CONCHASUMADRE',
  'GONORREA',
  'MALDITO',
  'ESTUPIDO',
  'IMBECIL',
  'IDIOTA',
  // Inglés
  'FUCK',
  'FUCKING',
  'SHIT',
  'BITCH',
  'ASSHOLE',
  'BASTARD',
  'CUNT',
  'DICK',
  'PUSSY',
  'WHORE',
  'SLUT',
  'NIGGA',
  'NIGGER',
  'FAGGOT',
  'RETARD',
  'RAPE',
];

const CORTAS = new Set(VETADAS.filter((t) => t.length <= 4));
const LARGAS = VETADAS.filter((t) => t.length >= 5);

// Sustituciones de "leet": lo mínimo para que p3nd3j0 no entre por la puerta
// de al lado. No pretende ser exhaustivo.
const LEET: Record<string, string> = {
  '0': 'O',
  '1': 'I',
  '3': 'E',
  '4': 'A',
  '5': 'S',
  '7': 'T',
  '8': 'B',
  '@': 'A',
  $: 'S',
};

/**
 * Deja una palabra en la forma con la que se compara.
 *
 * El colapso de repetidas corta en TRES y no en dos a propósito: las dobles
 * legítimas son comunes —"Keeway", "Nissan"— y colapsarlas cambiaría marcas
 * reales.
 */
function normalizarPalabra(palabra: string): string {
  return palabra
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .split('')
    .map((c) => LEET[c] ?? c)
    .join('')
    .replace(/[^A-Z]/g, '')
    .replace(/(.)\1{2,}/g, '$1');
}

const tieneLarga = (texto: string): boolean =>
  LARGAS.some((t) => texto.includes(t));

export function contieneGroseria(nombre: string): boolean {
  const palabras = nombre.split(/\s+/).map(normalizarPalabra).filter(Boolean);

  // Palabra por palabra: las cortas solo cuentan si ocupan la palabra entera.
  for (const p of palabras) {
    if (CORTAS.has(p)) return true;
    if (tieneLarga(p)) return true;
  }

  // Y sobre todo junto, porque separar con espacios es la evasión más obvia:
  // "p e n d e j o" son siete palabras que por separado no dicen nada.
  // Acá solo cuentan las largas: buscar las cortas sobre el texto pegado
  // rompería marcas reales de dos palabras.
  return tieneLarga(palabras.join(''));
}
