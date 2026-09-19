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
  @Transform(({ value }) => value !== 'false' && value !== false)
  SWAGGER_ENABLED: boolean = true;

  // Intentos de registro/login por minuto y por IP. Configurable porque los
  // tests e2e crean más cuentas que eso en segundos: sin esta palanca, la
  // única salida sería relajar el límite real o espaciar los tests.
  @IsOptional()
  @IsInt()
  @Transform(({ value }) => Number(value ?? 5))
  THROTTLE_AUTH_LIMIT: number = 5;
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

  if (env.JWT_ACCESS_SECRET === env.JWT_REFRESH_SECRET) {
    throw new Error(
      'JWT_REFRESH_SECRET debe ser distinto de JWT_ACCESS_SECRET: ' +
        'con el mismo secreto, un access token vale como refresh token.',
    );
  }

  return env;
}
