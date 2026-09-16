// La normalización vive acá, en la frontera de entrada, y no en el servicio:
// así el servicio y el repositorio ven SIEMPRE el valor canónico y el índice
// único de la base puede hacer su trabajo.
import { Transform } from 'class-transformer';
import { IsEmail, IsString, Length, Matches } from 'class-validator';

const texto = (v: unknown): string => (typeof v === 'string' ? v : '');

/** "V-25.481.073" → "V25481073". Sin letra se asume V (venezolano). */
export function normalizarCedula(valor: string): string {
  const limpio = valor.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return /^[VEJG]/.test(limpio) ? limpio : `V${limpio}`;
}

export class RegisterDto {
  @Transform(({ value }) => texto(value).trim())
  @IsString()
  @Length(2, 80, { message: 'El nombre debe tener entre 2 y 80 caracteres' })
  fullName!: string;

  @Transform(({ value }) => normalizarCedula(texto(value)))
  @IsString()
  @Matches(/^[VEJG]\d{6,9}$/, {
    message: 'La cédula no tiene un formato válido',
  })
  cedula!: string;

  @Transform(({ value }) => texto(value).trim().toLowerCase())
  @IsEmail({}, { message: 'El correo no es válido' })
  @Length(5, 160)
  email!: string;

  @Transform(({ value }) => texto(value).trim())
  @IsString()
  @Matches(/^[\d+\-() ]{7,20}$/, {
    message: 'El teléfono no tiene un formato válido',
  })
  phone!: string;

  // 72 es el límite práctico de las funciones de hash: cortar en silencio una
  // contraseña más larga sería peor que rechazarla.
  @IsString()
  @Length(8, 72, {
    message: 'La contraseña debe tener entre 8 y 72 caracteres',
  })
  @Matches(/(?=.*[A-Za-zÀ-ÿ])(?=.*\d)/, {
    message: 'La contraseña debe incluir al menos una letra y un número',
  })
  password!: string;
}
