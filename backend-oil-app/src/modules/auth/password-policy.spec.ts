import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import {
  Coincide,
  IsStrongPassword,
  REGLAS_CONTRASENA,
} from './password-policy';

class ConContrasena {
  @IsStrongPassword()
  password!: string;

  @Coincide('password')
  confirmPassword!: string;
}

/** Los mensajes que devolvería la API, en el orden de la validación. */
function fallos(
  password: unknown,
  confirmPassword: unknown = password,
): string[] {
  const dto = plainToInstance(ConContrasena, { password, confirmPassword });
  return validateSync(dto).flatMap((e) => Object.values(e.constraints ?? {}));
}

const MSG = Object.fromEntries(REGLAS_CONTRASENA.map((r) => [r.id, r.mensaje]));

describe('regla de contraseña', () => {
  it('acepta una contraseña que cumple las cuatro reglas', () => {
    expect(fallos('Clave#2026')).toEqual([]);
  });

  // EL test que importa. Varios @Matches sobre la misma propiedad se guardan
  // bajo la misma clave ("matches") y cada uno pisa el mensaje del anterior:
  // la API diría una sola regla incumplida cuando fallan tres, y el usuario
  // arreglaría esa para toparse con la siguiente. Cada regla lleva nombre
  // propio justamente para que esto no pase.
  it('reporta TODAS las reglas incumplidas a la vez, no solo la primera', () => {
    const f = fallos('abcdefgh');

    expect(f).toContain(MSG.mayuscula);
    expect(f).toContain(MSG.numero);
    expect(f).toContain(MSG.especial);
    expect(f).not.toContain(MSG.longitud);
  });

  it.each([
    ['sin mayúscula', 'clave#2026', 'mayuscula'],
    ['sin número', 'Clave#Nueva', 'numero'],
    ['sin carácter especial', 'Clave2026', 'especial'],
    ['de 7 caracteres', 'Cl#2026', 'longitud'],
  ])('rechaza una contraseña %s', (_, password, regla) => {
    expect(fallos(password)).toEqual([MSG[regla]]);
  });

  // 72 es el límite real de las funciones de hash: cortar en silencio una
  // contraseña más larga sería peor que rechazarla.
  it('rechaza más de 72 caracteres', () => {
    expect(fallos(`Clave#2026${'x'.repeat(63)}`)).toEqual([MSG.longitud]);
  });

  // Los usuarios escriben en español: la Ñ es una mayúscula y la ñ una letra,
  // no un carácter especial. Una regex de solo [A-Z] rechazaría "Ñandú#2026".
  it('cuenta la Ñ y las vocales acentuadas como letras', () => {
    expect(fallos('Ñandú#2026')).toEqual([]);
    expect(fallos('ñandú#2026')).toEqual([MSG.mayuscula]);
    expect(fallos('Ñandúñandú2026')).toEqual([MSG.especial]);
  });

  // Un espacio no es un carácter especial: "Clave 2026" tiene aspecto de
  // cumplir y no cumple.
  it('no cuenta el espacio como carácter especial', () => {
    expect(fallos('Clave 2026')).toEqual([MSG.especial]);
  });

  it('acepta cualquier símbolo como especial', () => {
    for (const s of [
      '!',
      '@',
      '#',
      '$',
      '%',
      '&',
      '*',
      '.',
      '-',
      '_',
      '?',
      '¿',
      '¡',
    ]) {
      expect(fallos(`Clave2026${s}`)).toEqual([]);
    }
  });

  it('rechaza un valor que no es texto', () => {
    expect(fallos(12345678).length).toBeGreaterThan(0);
  });

  describe('confirmación', () => {
    it('acepta cuando coincide', () => {
      expect(fallos('Clave#2026', 'Clave#2026')).toEqual([]);
    });

    it('rechaza cuando no coincide', () => {
      expect(fallos('Clave#2026', 'Clave#2027')).toEqual([
        'Las contraseñas no coinciden',
      ]);
    });
  });
});
