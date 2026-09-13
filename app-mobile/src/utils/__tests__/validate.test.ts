import { isEmail } from '../validate';

describe('isEmail', () => {
  it('acepta correos normales', () => {
    expect(isEmail('luis.guerrero@gmail.com')).toBe(true);
    expect(isEmail('  gabriel@ruedalo.com  ')).toBe(true);
    expect(isEmail('a+etiqueta@sub.dominio.com.ve')).toBe(true);
  });

  it('rechaza lo que no tiene forma de correo', () => {
    expect(isEmail('')).toBe(false);
    expect(isEmail('luis.guerrero')).toBe(false);
    expect(isEmail('luis@gmail')).toBe(false);
    expect(isEmail('luis @gmail.com')).toBe(false);
    expect(isEmail('@gmail.com')).toBe(false);
  });
});
