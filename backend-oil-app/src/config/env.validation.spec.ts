import { validateEnv } from './env.validation';

describe('validateEnv', () => {
  const valid = {
    DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
    JWT_ACCESS_SECRET: 'a'.repeat(32),
    JWT_REFRESH_SECRET: 'b'.repeat(32),
    RESET_CODE_SECRET: 'c'.repeat(32),
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
      RESET_CODE_SECRET: valid.RESET_CODE_SECRET,
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

  describe('recuperar contraseña y correo', () => {
    it('falla si falta RESET_CODE_SECRET', () => {
      const { RESET_CODE_SECRET: _omitido, ...sin } = valid;
      void _omitido;
      expect(() => validateEnv(sin)).toThrow(/RESET_CODE_SECRET/);
    });

    // Con el mismo secreto que un JWT, quien consiga uno de los dos tiene
    // también el otro: la separación es la que acota el daño.
    it('falla si RESET_CODE_SECRET repite un secreto JWT', () => {
      expect(() =>
        validateEnv({ ...valid, RESET_CODE_SECRET: valid.JWT_ACCESS_SECRET }),
      ).toThrow(/RESET_CODE_SECRET/);
    });

    // Los valores por defecto apuntan a Mailpit: en desarrollo no hace falta
    // configurar nada para ver los correos.
    it('el SMTP apunta a Mailpit si no se configura', () => {
      const env = validateEnv(valid);
      expect(env.SMTP_HOST).toBe('localhost');
      expect(env.SMTP_PORT).toBe(1025);
      expect(env.SMTP_USER).toBeUndefined();
      expect(env.MAIL_FROM).toContain('@');
    });

    it('lee el puerto SMTP como número', () => {
      expect(validateEnv({ ...valid, SMTP_PORT: '587' }).SMTP_PORT).toBe(587);
    });
  });

  describe('tasa BCV', () => {
    it('BCV_RATE_URL apunta a dolarapi si no se declara', () => {
      expect(validateEnv(valid).BCV_RATE_URL).toBe(
        'https://ve.dolarapi.com/v1/dolares/oficial',
      );
    });

    it('BCV_RATE_URL toma la del entorno', () => {
      const url = 'https://otro-proveedor.com/api/bcv';
      expect(validateEnv({ ...valid, BCV_RATE_URL: url }).BCV_RATE_URL).toBe(
        url,
      );
    });

    // Un error de tipeo en la URL tiene que tumbar el arranque, no aparecer
    // semanas después como "la tasa no carga".
    it('falla si BCV_RATE_URL no es una URL', () => {
      expect(() =>
        validateEnv({ ...valid, BCV_RATE_URL: 've.dolarapi.com oficial' }),
      ).toThrow(/BCV_RATE_URL/);
    });
  });
});
