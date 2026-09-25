// La regla de contraseña. Se aplica AL FIJAR una contraseña —registro y
// restablecimiento—, nunca en el login: las cuentas creadas con la regla
// anterior siguen entrando sin problema.
//
// La app replica esta lista en src/utils/password.ts para marcar la leyenda
// mientras el usuario escribe. Este archivo es la autoridad: si cambian, el
// backend manda y los tests de ambos lados usan los mismos casos.
import { applyDecorators } from '@nestjs/common';
import {
  IsString,
  ValidateBy,
  type ValidationArguments,
} from 'class-validator';

export type IdRegla = 'longitud' | 'mayuscula' | 'numero' | 'especial';

export type ReglaContrasena = {
  id: IdRegla;
  /** Lo que ve el usuario en `details` cuando la regla no se cumple. */
  mensaje: string;
  cumple: (password: string) => boolean;
};

export const REGLAS_CONTRASENA: readonly ReglaContrasena[] = [
  {
    id: 'longitud',
    mensaje: 'Debe tener entre 8 y 72 caracteres',
    // 72 es el límite real de las funciones de hash: recortar en silencio una
    // contraseña más larga sería peor que rechazarla.
    cumple: (p) => p.length >= 8 && p.length <= 72,
  },
  {
    id: 'mayuscula',
    mensaje: 'Debe incluir al menos una letra mayúscula',
    // \p{Lu} y no [A-Z]: la Ñ y la Á son mayúsculas, y los usuarios escriben
    // en español.
    cumple: (p) => /\p{Lu}/u.test(p),
  },
  {
    id: 'numero',
    mensaje: 'Debe incluir al menos un número',
    cumple: (p) => /\d/.test(p),
  },
  {
    id: 'especial',
    mensaje: 'Debe incluir al menos un carácter especial',
    // Cualquier cosa que no sea letra, número ni espacio. Definirlo por
    // exclusión evita mantener una lista de símbolos que siempre se queda
    // corta ("¿" y "¡" también cuentan). El espacio queda fuera a propósito:
    // "Clave 2026" parece cumplir y no cumple.
    cumple: (p) => /[^\p{L}\p{N}\s]/u.test(p),
  },
];

/** Las reglas en una línea, para descripciones de Swagger. */
export const DESCRIPCION_REGLAS =
  'entre 8 y 72 caracteres, con al menos una mayúscula, un número y un ' +
  'carácter especial (cualquier símbolo que no sea letra, número ni espacio)';

/**
 * Valida la regla de contraseña con UN validador por regla.
 *
 * No son varios @Matches porque class-validator guarda los fallos por nombre de
 * validador, y todos los @Matches se llaman "matches": cada uno pisaría el
 * mensaje del anterior y la API reportaría una sola regla incumplida cuando
 * fallan tres. El usuario arreglaría esa para toparse con la siguiente. Con
 * nombres propios, `details` las trae todas de una vez.
 */
export function IsStrongPassword(): PropertyDecorator {
  return applyDecorators(
    IsString({ message: 'La contraseña debe ser texto' }),
    ...REGLAS_CONTRASENA.map((regla) =>
      ValidateBy({
        name: `password_${regla.id}`,
        validator: {
          validate: (valor: unknown) =>
            typeof valor === 'string' && regla.cumple(valor),
          defaultMessage: () => regla.mensaje,
        },
      }),
    ),
  );
}

/** La confirmación debe ser idéntica al campo indicado. */
export function Coincide(campo: string): PropertyDecorator {
  return ValidateBy({
    name: 'passwordsMatch',
    constraints: [campo],
    validator: {
      validate: (valor: unknown, args?: ValidationArguments) =>
        typeof valor === 'string' &&
        valor ===
          (args?.object as Record<string, unknown> | undefined)?.[campo],
      defaultMessage: () => 'Las contraseñas no coinciden',
    },
  });
}
