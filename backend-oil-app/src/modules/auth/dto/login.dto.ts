import { Transform } from 'class-transformer';
import { IsEmail, IsString, Length } from 'class-validator';

export class LoginDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : '',
  )
  @IsEmail({}, { message: 'El correo no es válido' })
  email!: string;

  // A propósito sin reglas de fuerza: en el login la clave o coincide o no.
  // Validar aquí el formato solo le diría al atacante cómo son las válidas.
  @IsString()
  @Length(1, 72)
  password!: string;
}
