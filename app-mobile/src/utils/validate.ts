// Validaciones de formulario. Deliberadamente laxas: el objetivo es atajar el
// error de tipeo obvio antes de gastar una petición, no decidir si una cuenta
// existe — eso solo lo sabe el servidor.

/**
 * ¿Parece un correo? Exige `algo@algo.tld` sin espacios. No intenta cumplir
 * el RFC 5322: esa expresión es enorme y termina rechazando correos válidos.
 */
export function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
}
