// La normalización vive acá, en la frontera de entrada, y no en el servicio:
// así el servicio y el repositorio ven SIEMPRE el valor canónico y el índice
// único de la base puede hacer su trabajo.
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';
import type { Currency } from '../../users/domain/user';

const texto = (v: unknown): string => (typeof v === 'string' ? v : '');

/** "V-25.481.073" → "V25481073". Sin letra se asume V (venezolano). */
export function normalizarCedula(valor: string): string {
  const limpio = valor.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return /^[VEJG]/.test(limpio) ? limpio : `V${limpio}`;
}

// Conectores que en español van en minúscula dentro de un topónimo:
// "San Juan de los Morros", no "San Juan De Los Morros".
const CONECTORES = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'e']);

/**
 * "  distrito   CAPITAL " → "Distrito Capital".
 *
 * Estado y ciudad se piden como texto libre, así que sin esto la base
 * acabaría con "Caracas", "caracas" y "CARACAS" como valores distintos y
 * cualquier agrupación por zona saldría partida en tres. No sustituye a un
 * catálogo cerrado —"Ccs" seguirá siendo otra cosa— pero recoge el caso
 * frecuente, que es el de las mayúsculas y los espacios de más.
 */
export function normalizarLugar(valor: string): string {
  return valor
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('es')
    .split(' ')
    .map((palabra, i) =>
      i > 0 && CONECTORES.has(palabra)
        ? palabra
        : palabra.charAt(0).toLocaleUpperCase('es') + palabra.slice(1),
    )
    .join(' ');
}

export class RegisterDto {
  @ApiProperty({
    minLength: 2,
    maxLength: 80,
    example: 'Luis Guerrero',
    description:
      'Nombre completo. Se le recortan los espacios de los extremos antes ' +
      'de validar, así que " Luis " entra sin problema.',
  })
  @Transform(({ value }) => texto(value).trim())
  @IsString()
  @Length(2, 80, { message: 'El nombre debe tener entre 2 y 80 caracteres' })
  fullName!: string;

  @ApiProperty({
    pattern: '^[VEJG]\\d{6,9}$',
    example: 'V-25.481.073',
    description:
      'Cédula venezolana. **Se normaliza antes de validar**: se eliminan ' +
      'puntos, guiones y espacios, y se pasa a mayúscula. Si no trae letra ' +
      'inicial se le antepone `V`. Por eso `V-25.481.073`, `25481073` y ' +
      '`v25481073` terminan siendo el mismo valor (`V25481073`) y el segundo ' +
      'registro choca con `CEDULA_TAKEN`. Letras admitidas: V, E, J, G.',
  })
  @Transform(({ value }) => normalizarCedula(texto(value)))
  @IsString()
  @Matches(/^[VEJG]\d{6,9}$/, {
    message: 'La cédula no tiene un formato válido',
  })
  cedula!: string;

  @ApiProperty({
    format: 'email',
    minLength: 5,
    maxLength: 160,
    example: 'luis@correo.com',
    description:
      'Correo electrónico. Se recorta y se pasa a minúsculas antes de ' +
      'validar, de modo que `Luis@Correo.com` y `luis@correo.com` son la ' +
      'misma cuenta.',
  })
  @Transform(({ value }) => texto(value).trim().toLowerCase())
  @IsEmail({}, { message: 'El correo no es válido' })
  @Length(5, 160)
  email!: string;

  @ApiProperty({
    pattern: '^[\\d+\\-() ]{7,20}$',
    example: '+58 414 528 9012',
    description:
      'Teléfono. Admite dígitos, `+`, `-`, paréntesis y espacios, entre 7 y ' +
      '20 caracteres. No se normaliza: se guarda como lo escribió el usuario.',
  })
  @Transform(({ value }) => texto(value).trim())
  @IsString()
  @Matches(/^[\d+\-() ]{7,20}$/, {
    message: 'El teléfono no tiene un formato válido',
  })
  phone!: string;

  @ApiProperty({
    minLength: 2,
    maxLength: 60,
    example: 'Distrito Capital',
    description:
      'Estado de residencia, en texto libre. **Se normaliza**: se recortan ' +
      'los espacios sobrantes y se pasa a mayúscula inicial por palabra, ' +
      'dejando en minúscula los conectores ("San Juan de los Morros"). Así ' +
      '`distrito capital` y `DISTRITO CAPITAL` se guardan igual.',
  })
  @Transform(({ value }) => normalizarLugar(texto(value)))
  @IsString()
  @Length(2, 60, { message: 'El estado debe tener entre 2 y 60 caracteres' })
  state!: string;

  @ApiProperty({
    minLength: 2,
    maxLength: 60,
    example: 'Caracas',
    description: 'Ciudad de residencia. Se normaliza igual que el estado.',
  })
  @Transform(({ value }) => normalizarLugar(texto(value)))
  @IsString()
  @Length(2, 60, { message: 'La ciudad debe tener entre 2 y 60 caracteres' })
  city!: string;

  @ApiProperty({
    enum: ['USD', 'BS', 'BOTH'],
    default: 'BOTH',
    required: false,
    example: 'BOTH',
    description:
      'Moneda en la que el usuario quiere ver los precios. Es el único dato ' +
      'del perfil con un valor por defecto sensato, así que se admite ' +
      'omitirlo: si no viene, queda en `BOTH` (dólar y bolívar a la vez).',
  })
  @IsOptional()
  @IsIn(['USD', 'BS', 'BOTH'], { message: 'La moneda no es válida' })
  currency: Currency = 'BOTH';

  // 72 es el límite práctico de las funciones de hash: cortar en silencio una
  // contraseña más larga sería peor que rechazarla.
  @ApiProperty({
    minLength: 8,
    maxLength: 72,
    format: 'password',
    example: 'contrasena1',
    description:
      'Contraseña: entre 8 y 72 caracteres, con al menos una letra y al ' +
      'menos un número. El tope de 72 no es capricho — es el límite real de ' +
      'la función de hash, y recortar en silencio sería peor que rechazar. ' +
      'Se guarda con Argon2id; el texto plano no se persiste en ningún lado.',
  })
  @IsString()
  @Length(8, 72, {
    message: 'La contraseña debe tener entre 8 y 72 caracteres',
  })
  @Matches(/(?=.*[A-Za-zÀ-ÿ])(?=.*\d)/, {
    message: 'La contraseña debe incluir al menos una letra y un número',
  })
  password!: string;
}
