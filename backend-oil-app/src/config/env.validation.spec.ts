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

  // Sin este test el fallo pasa inadvertido: la conversión implícita de
  // class-transformer convierte "false" en `true` antes de que corra el
  // @Transform, así que la bandera quedaba encendida en producción.
  describe('banderas booleanas del entorno', () => {
    it('SWAGGER_ENABLED se apaga con la cadena "false"', () => {
      expect(
        validateEnv({ ...valid, SWAGGER_ENABLED: 'false' }).SWAGGER_ENABLED,
      ).toBe(false);
    });

    it('SWAGGER_ENABLED está encendida si no se declara', () => {
      expect(validateEnv(valid).SWAGGER_ENABLED).toBe(true);
    });
  });

  describe('notificaciones push', () => {
    it('PUSH_ENABLED es true si no se declara', () => {
      expect(validateEnv(valid).PUSH_ENABLED).toBe(true);
    });

    it('la cadena "false" lo apaga', () => {
      expect(
        validateEnv({ ...valid, PUSH_ENABLED: 'false' }).PUSH_ENABLED,
      ).toBe(false);
    });

    it('EXPO_ACCESS_TOKEN es opcional', () => {
      expect(validateEnv(valid).EXPO_ACCESS_TOKEN).toBeUndefined();
    });
  });
});
