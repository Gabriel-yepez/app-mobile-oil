// Mismos casos que backend-oil-app/src/modules/auth/password-policy.spec.ts.
// El backend es la autoridad; esta copia existe para marcar la leyenda en vivo
// mientras el usuario escribe. Si una de las dos cambia y la otra no, estos
// casos son los que deberían saltar.
import { REGLAS_CONTRASENA, contrasenaValida, evaluarContrasena } from '../password';

const incumplidas = (p: string) =>
  evaluarContrasena(p)
    .filter((r) => !r.cumple)
    .map((r) => r.id);

describe('regla de contraseña (app)', () => {
  it('son las cuatro reglas del backend, en el mismo orden', () => {
    expect(REGLAS_CONTRASENA.map((r) => r.id)).toEqual([
      'longitud',
      'mayuscula',
      'numero',
      'especial',
    ]);
  });

  it('acepta una contraseña que cumple todo', () => {
    expect(incumplidas('Clave#2026')).toEqual([]);
    expect(contrasenaValida('Clave#2026')).toBe(true);
  });

  it('marca todas las que fallan a la vez', () => {
    expect(incumplidas('abcdefgh')).toEqual(['mayuscula', 'numero', 'especial']);
  });

  it.each([
    ['clave#2026', 'mayuscula'],
    ['Clave#Nueva', 'numero'],
    ['Clave2026', 'especial'],
    ['Cl#2026', 'longitud'],
  ])('%s incumple %s', (password, regla) => {
    expect(incumplidas(password)).toEqual([regla]);
  });

  it('rechaza más de 72 caracteres', () => {
    expect(incumplidas(`Clave#2026${'x'.repeat(63)}`)).toEqual(['longitud']);
  });

  it('cuenta la Ñ y las vocales acentuadas como letras', () => {
    expect(incumplidas('Ñandú#2026')).toEqual([]);
    expect(incumplidas('ñandú#2026')).toEqual(['mayuscula']);
    expect(incumplidas('Ñandúñandú2026')).toEqual(['especial']);
  });

  it('no cuenta el espacio como carácter especial', () => {
    expect(incumplidas('Clave 2026')).toEqual(['especial']);
  });

  it('con el campo vacío no cumple ninguna', () => {
    expect(incumplidas('')).toEqual(['longitud', 'mayuscula', 'numero', 'especial']);
    expect(contrasenaValida('')).toBe(false);
  });
});
