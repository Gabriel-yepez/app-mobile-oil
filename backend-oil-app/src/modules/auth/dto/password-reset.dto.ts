import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, Length, Matches } from 'class-validator';
import {
  Coincide,
  DESCRIPCION_REGLAS,
  IsStrongPassword,
} from '../password-policy';

const correo = (v: unknown): string =>
  typeof v === 'string' ? v.trim().toLowerCase() : '';

export class ForgotPasswordDto {
  @ApiProperty({
    format: 'email',
    example: 'luis@correo.com',
    description:
      'Correo de la cuenta. Se normaliza igual que en el registro y el login.',
  })
  @Transform(({ value }) => correo(value))
  @IsEmail({}, { message: 'El correo no es válido' })
  email!: string;
}

export class VerifyResetCodeDto {
  @ApiProperty({ format: 'email', example: 'luis@correo.com' })
  @Transform(({ value }) => correo(value))
  @IsEmail({}, { message: 'El correo no es válido' })
  email!: string;

  @ApiProperty({
    pattern: '^\\d{6}$',
    example: '482913',
    description: 'Los 6 dígitos que llegaron por correo.',
  })
  // Se recortan espacios: al pegar el código desde el correo suele venir uno.
  // Lo que no sea texto se deja pasar tal cual para que @IsString lo rechace
  // con su propio mensaje.
  @Transform(({ value }): unknown =>
    typeof value === 'string' ? value.trim() : (value as unknown),
  )
  @IsString()
  @Matches(/^\d{6}$/, { message: 'El código son 6 dígitos' })
  code!: string;
}

export class ResetPasswordDto {
  @ApiProperty({
    example: 'q5Zr8Yy2c1M0jVx3Hk7pTnLwBaEuFsDgIoRtAeNvXm4',
    description:
      'El `resetToken` que devolvió `/auth/password/verify`. Un solo uso y ' +
      '10 minutos de vida.',
  })
  @IsString()
  @Length(20, 200)
  resetToken!: string;

  @ApiProperty({
    format: 'password',
    minLength: 8,
    maxLength: 72,
    example: 'Nueva#2026',
    description:
      `Contraseña nueva: ${DESCRIPCION_REGLAS}. Cada regla se valida por ` +
      'separado: un 400 trae en `details` TODAS las que no se cumplen.',
  })
  @IsStrongPassword()
  password!: string;

  @ApiProperty({
    format: 'password',
    example: 'Nueva#2026',
    description: 'La misma contraseña otra vez. Se comprueba en el servidor.',
  })
  @Coincide('password')
  confirmPassword!: string;
}

export class ForgotPasswordResponseDto {
  @ApiProperty({
    example: 'Si hay una cuenta con ese correo, te enviamos un código.',
    description:
      'Siempre el mismo texto, exista o no la cuenta. Es a propósito: no ' +
      'ramifiques por él.',
  })
  message!: string;
}

export class VerifyResetCodeResponseDto {
  @ApiProperty({
    example: 'q5Zr8Yy2c1M0jVx3Hk7pTnLwBaEuFsDgIoRtAeNvXm4',
    description: 'Para el último paso. Un solo uso.',
  })
  resetToken!: string;

  @ApiProperty({ example: 600, description: 'Segundos de vida del token.' })
  expiresIn!: number;
}
