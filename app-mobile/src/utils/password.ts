// La regla de contraseña, copiada del backend para marcar la leyenda en vivo.
//
// La autoridad es backend-oil-app/src/modules/auth/password-policy.ts: el
// servidor valida siempre, esto solo le ahorra al usuario una ida y vuelta.
// Los tests de los dos lados usan los mismos casos; si cambias una regla acá,
// cámbiala allá.

export type IdRegla = 'longitud' | 'mayuscula' | 'numero' | 'especial';

export type ReglaContrasena = {
  id: IdRegla;
  /** Texto de la leyenda. */
  etiqueta: string;
  cumple: (password: string) => boolean;
};

export const REGLAS_CONTRASENA: readonly ReglaContrasena[] = [
  {
    id: 'longitud',
    etiqueta: 'Entre 8 y 72 caracteres',
    cumple: (p) => p.length >= 8 && p.length <= 72,
  },
  {
    id: 'mayuscula',
    etiqueta: 'Una letra mayúscula',
    // \p{Lu} y no [A-Z]: la Ñ y la Á son mayúsculas.
    cumple: (p) => /\p{Lu}/u.test(p),
  },
  {
    id: 'numero',
    etiqueta: 'Un número',
    cumple: (p) => /\d/.test(p),
  },
  {
    id: 'especial',
    etiqueta: 'Un carácter especial (!@#$…)',
    // Cualquier cosa que no sea letra, número ni espacio.
    cumple: (p) => /[^\p{L}\p{N}\s]/u.test(p),
  },
];

export function evaluarContrasena(
  password: string,
): { id: IdRegla; etiqueta: string; cumple: boolean }[] {
  return REGLAS_CONTRASENA.map((r) => ({
    id: r.id,
    etiqueta: r.etiqueta,
    cumple: r.cumple(password),
  }));
}

export function contrasenaValida(password: string): boolean {
  return REGLAS_CONTRASENA.every((r) => r.cumple(password));
}
