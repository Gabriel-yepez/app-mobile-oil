// El enlace de "Contactar soporte". Correo y no un formulario propio: llega a
// una bandeja que ya existe, y el usuario conserva copia de lo que mandó.

export type DatosSoporte = {
  /** A dónde escribir; sale de SUPPORT_EMAIL en el backend. */
  email: string;
  /** El plan incluye soporte prioritario. */
  priority: boolean;
  /** El correo de la cuenta, para no tener que preguntarlo. */
  cuenta: string;
  plan: string;
  version: string;
};

/**
 * `mailto:` con asunto y cuerpo ya escritos. El [PRO] al inicio del asunto
 * es lo que hace prioritario al soporte: se ve en la bandeja sin abrir nada,
 * y se puede filtrar.
 */
export function mailtoSoporte(d: DatosSoporte): string {
  const asunto = `${d.priority ? '[PRO] ' : ''}Soporte Ruédalo`;
  const cuerpo = [
    'Cuéntanos qué pasó:',
    '',
    '',
    '— No borres lo de abajo: nos ayuda a encontrar tu cuenta —',
    `Cuenta: ${d.cuenta}`,
    `Plan: ${d.plan}`,
    `App: ${d.version}`,
  ].join('\n');

  // encodeURIComponent y no URLSearchParams: este último codifica el espacio
  // como "+", y varias apps de correo lo muestran tal cual en el asunto.
  return `mailto:${d.email}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`;
}
