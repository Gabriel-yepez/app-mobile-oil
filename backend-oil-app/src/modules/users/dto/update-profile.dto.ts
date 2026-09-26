// Cuerpo de PATCH /auth/me: el perfil editable, todo opcional.
//
// No se construye con PartialType(RegisterDto) aunque los campos se parezcan.
// RegisterDto lleva `cedula` y `password`, y un `PartialType` de él los dejaría
// entrar: quien editara su perfil podría cambiar la cédula —que es la identidad
// de la cuenta— o la contraseña sin presentar la anterior. Los campos se
// enumeran a mano justamente para que sumar uno a RegisterDto no lo vuelva
// editable sin que nadie lo decida.
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';
import { normalizarLugar, texto } from '../../../common/normalizacion';
import type { Currency } from '../domain/user';

/**
 * Envuelve una normalización para que **respete la ausencia**.
 *
 * Los `@Transform` de class-transformer corren también sobre las claves que no
 * vinieron en el cuerpo. Sin esta guarda, `normalizarLugar(texto(undefined))`
 * devuelve `''`, y una cadena vacía ya no es `undefined`: `@IsOptional()` deja
 * de saltarse el campo y el PATCH más inocente —mandar solo el teléfono—
 * rebotaría con "La ciudad debe tener entre 2 y 60 caracteres". Es el tipo de
 * fallo que solo aparece con el formulario en la mano.
 */
const siViene = (fn: (s: string) => string) => (value: unknown) =>
  value === undefined ? undefined : fn(texto(value));

export class UpdateProfileDto {
  @ApiPropertyOptional({
    minLength: 2,
    maxLength: 80,
    example: 'Luis Guerrero',
    description: 'Nombre completo. Se recorta antes de validar.',
  })
  @IsOptional()
  @Transform(({ value }) => siViene((s) => s.trim())(value))
  @IsString()
  @Length(2, 80, { message: 'El nombre debe tener entre 2 y 80 caracteres' })
  fullName?: string;

  @ApiPropertyOptional({
    format: 'email',
    minLength: 5,
    maxLength: 160,
    example: 'luis@correo.com',
    description:
      'Correo electrónico. Se recorta y se pasa a minúsculas antes de ' +
      'validar. Si ya lo tiene otra cuenta, responde 409 `EMAIL_TAKEN`; ' +
      'mandar el correo que ya tienes no es conflicto, es un cambio vacío.',
  })
  @IsOptional()
  @Transform(({ value }) => siViene((s) => s.trim().toLowerCase())(value))
  @IsEmail({}, { message: 'El correo no es válido' })
  @Length(5, 160)
  email?: string;

  @ApiPropertyOptional({
    pattern: '^[\\d+\\-() ]{7,20}$',
    example: '+58 414 528 9012',
    description: 'Teléfono. No se normaliza: se guarda como lo escribió.',
  })
  @IsOptional()
  @Transform(({ value }) => siViene((s) => s.trim())(value))
  @IsString()
  @Matches(/^[\d+\-() ]{7,20}$/, {
    message: 'El teléfono no tiene un formato válido',
  })
  phone?: string;

  @ApiPropertyOptional({
    minLength: 2,
    maxLength: 60,
    example: 'Distrito Capital',
    description:
      'Estado de residencia. Se normaliza igual que en el registro, para ' +
      'que el mismo dato no quede escrito de dos formas según por dónde entró.',
  })
  @IsOptional()
  @Transform(({ value }) => siViene(normalizarLugar)(value))
  @IsString()
  @Length(2, 60, { message: 'El estado debe tener entre 2 y 60 caracteres' })
  state?: string;

  @ApiPropertyOptional({
    minLength: 2,
    maxLength: 60,
    example: 'Caracas',
    description: 'Ciudad de residencia. Mismas reglas que el estado.',
  })
  @IsOptional()
  @Transform(({ value }) => siViene(normalizarLugar)(value))
  @IsString()
  @Length(2, 60, { message: 'La ciudad debe tener entre 2 y 60 caracteres' })
  city?: string;

  @ApiPropertyOptional({
    enum: ['USD', 'BS', 'BOTH'],
    example: 'BOTH',
    description:
      'Moneda en la que el usuario quiere ver los precios. **Sin valor por ' +
      'defecto acá**, al revés que en el registro: en un PATCH, omitir un ' +
      'campo significa "no lo toques", y un `BOTH` por defecto le pisaría en ' +
      'silencio la preferencia a quien solo vino a cambiar el teléfono.',
  })
  @IsOptional()
  @IsIn(['USD', 'BS', 'BOTH'], { message: 'La moneda no es válida' })
  currency?: Currency;
}
