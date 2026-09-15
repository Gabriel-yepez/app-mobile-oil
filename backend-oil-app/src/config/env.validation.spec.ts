import { validateEnv } from './env.validation';

describe('validateEnv', () => {
  const valid = {
    DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
    JWT_ACCESS_SECRET: 'a'.repeat(32),
    JWT_REFRESH_SECRET: 'b'.repeat(32),
  };

  it('acepta un entorno válido y aplica los valores por defecto', () => {
    const env = validateEnv(valid);
    expect(env.PORT).toBe(3000);
    expect(env.JWT_ACCESS_TTL).toBe('15m');
  });

  it('falla si falta JWT_ACCESS_SECRET', () => {
    const sinSecreto = {
      DATABASE_URL: valid.DATABASE_URL,
      JWT_REFRESH_SECRET: valid.JWT_REFRESH_SECRET,
    };
    expect(() => validateEnv(sinSecreto)).toThrow(/JWT_ACCESS_SECRET/);
  });

  // Un secreto corto es adivinable: arrancar con él es peor que no arrancar.
  it('falla si un secreto es demasiado corto', () => {
    expect(() =>
      validateEnv({ ...valid, JWT_ACCESS_SECRET: 'corto' }),
    ).toThrow();
  });

  // Reusar el mismo secreto para ambos tokens permite presentar un access
  // token como si fuera refresh: la separación tiene que ser obligatoria.
  it('falla si los dos secretos son iguales', () => {
    expect(() =>
      validateEnv({ ...valid, JWT_REFRESH_SECRET: valid.JWT_ACCESS_SECRET }),
    ).toThrow(/distinto/i);
  });
});
