// Valida el entorno AL ARRANCAR. Si algo falta, el proceso no levanta.
// Arrancar con un secreto por defecto es peor que no arrancar: el fallo sería
// silencioso y en producción.
import { plainToInstance, Transform } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
  validateSync,
} from 'class-validator';

/**
 * Lee una bandera booleana del entorno SIN pasar por la conversión implícita.
 *
 * `plainToInstance` corre con `enableImplicitConversion`, que convierte el
 * valor al tipo declarado ANTES de que corra el @Transform. Para un booleano
 * eso es `Boolean('false')`, que es `true`: leyendo `value`, la cadena "false"
 * ENCENDÍA la bandera en vez de apagarla, y la única forma de apagarla era
 * pasar un booleano de verdad — cosa que el entorno no puede hacer, porque
 * todo lo que viene de ahí es texto.
 *
 * `obj` es el objeto crudo, sin convertir, así que ahí la cadena sigue siendo
 * la cadena.
 */
const banderaDelEntorno =
  (clave: string) =>
  ({ obj }: { obj: unknown }): boolean => {
    const crudo = (obj as Record<string, unknown>)[clave];
    return crudo !== 'false' && crudo !== false;
  };

export class EnvVars {
  @IsString()
  @IsNotEmpty()
  DATABASE_URL!: string;

  @IsString()
  @MinLength(32, {
    message: 'JWT_ACCESS_SECRET debe tener al menos 32 caracteres',
  })
  JWT_ACCESS_SECRET!: string;

  @IsString()
  @MinLength(32, {
    message: 'JWT_REFRESH_SECRET debe tener al menos 32 caracteres',
  })
  JWT_REFRESH_SECRET!: string;

  @IsOptional()
  @IsString()
  JWT_ACCESS_TTL: string = '15m';

  @IsOptional()
  @IsString()
  JWT_REFRESH_TTL: string = '30d';

  @IsOptional()
  @IsInt()
  @Transform(({ value }) => Number(value ?? 3000))
  PORT: number = 3000;

  @IsOptional()
  @IsString()
  CORS_ORIGINS: string = '';

  // Publica la documentación interactiva en /docs. Encendida por defecto,
  // porque en desarrollo es justo lo que se quiere; en producción se apaga
  // poniendo "false", sin tocar código.
  @IsOptional()
  @IsBoolean()
  @Transform(banderaDelEntorno('SWAGGER_ENABLED'))
  SWAGGER_ENABLED: boolean = true;

  // Intentos de registro/login por minuto y por IP. Configurable porque los
  // tests e2e crean más cuentas que eso en segundos: sin esta palanca, la
  // única salida sería relajar el límite real o espaciar los tests.
  @IsOptional()
  @IsInt()
  @Transform(({ value }) => Number(value ?? 5))
  THROTTLE_AUTH_LIMIT: number = 5;

  // Activa la seguridad reforzada de Expo para push. Opcional porque en
  // desarrollo se envía sin ella, pero en producción debe estar: sin el token,
  // cualquiera que consiga un ExpoPushToken de la app puede mandarle
  // notificaciones a los usuarios haciéndose pasar por nosotros.
  @IsOptional()
  @IsString()
  EXPO_ACCESS_TOKEN?: string;

  // En `false` los cron de push no se registran. Es lo que permite correr los
  // e2e y levantar la app en local sin disparar envíos de verdad.
  @IsOptional()
  @IsBoolean()
  @Transform(banderaDelEntorno('PUSH_ENABLED'))
  PUSH_ENABLED: boolean = true;

  // Firma (HMAC) de los códigos de 6 dígitos de recuperar contraseña. Un código
  // así son un millón de combinaciones: con un hash simple, un volcado de la
  // base bastaría para sacarlos todos en segundos. Con este secreto, que no
  // vive en la base, el volcado por sí solo no alcanza.
  @IsString()
  @MinLength(32, {
    message: 'RESET_CODE_SECRET debe tener al menos 32 caracteres',
  })
  RESET_CODE_SECRET!: string;

  // ── Correo saliente ────────────────────────────────────────────────────
  // Los valores por defecto apuntan a Mailpit (docker-compose): en desarrollo
  // no hay que configurar nada y los correos se leen en localhost:8025. En
  // producción se apuntan al proveedor (Brevo, Resend, SendGrid…): todos
  // hablan SMTP, así que cambiar de proveedor es cambiar estas variables.
  //
  // No hay SMTP_SECURE a propósito: se deduce del puerto (465 → TLS directo;
  // cualquier otro → STARTTLS si el servidor lo ofrece). Una bandera booleana
  // más del entorno sería una más que configurar mal.

  @IsOptional()
  @IsString()
  SMTP_HOST: string = 'localhost';

  @IsOptional()
  @IsInt()
  @Transform(({ value }) => Number(value ?? 1025))
  SMTP_PORT: number = 1025;

  // Opcionales: Mailpit no pide credenciales. Los proveedores reales sí.
  @IsOptional()
  @IsString()
  SMTP_USER?: string;

  @IsOptional()
  @IsString()
  SMTP_PASS?: string;

  @IsOptional()
  @IsString()
  MAIL_FROM: string = 'Ruédalo <no-responder@ruedalo.local>';
}

export function validateEnv(raw: Record<string, unknown>): EnvVars {
  const env = plainToInstance(EnvVars, raw, { enableImplicitConversion: true });
  const errores = validateSync(env, { skipMissingProperties: false });

  if (errores.length > 0) {
    const detalle = errores
      .map((e) => Object.values(e.constraints ?? {}).join(', '))
      .join('\n  - ');
    throw new Error(`Configuración inválida:\n  - ${detalle}`);
  }

  if (
    env.RESET_CODE_SECRET === env.JWT_ACCESS_SECRET ||
    env.RESET_CODE_SECRET === env.JWT_REFRESH_SECRET
  ) {
    throw new Error(
      'RESET_CODE_SECRET debe ser distinto de los secretos JWT: con uno ' +
        'repetido, quien consiga uno de los dos tiene también el otro.',
    );
  }

  if (env.JWT_ACCESS_SECRET === env.JWT_REFRESH_SECRET) {
    throw new Error(
      'JWT_REFRESH_SECRET debe ser distinto de JWT_ACCESS_SECRET: ' +
        'con el mismo secreto, un access token vale como refresh token.',
    );
  }

  return env;
}
