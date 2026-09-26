import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Length } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    format: 'email',
    example: 'luis@correo.com',
    description:
      'Correo de la cuenta. Se recorta y se pasa a minúsculas, igual que en ' +
      'el registro, para que las mayúsculas no impidan entrar.',
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : '',
  )
  @IsEmail({}, { message: 'El correo no es válido' })
  email!: string;

  // A propósito sin reglas de fuerza: en el login la clave o coincide o no.
  // Validar aquí el formato solo le diría al atacante cómo son las válidas.
  @ApiProperty({
    minLength: 1,
    maxLength: 72,
    format: 'password',
    example: 'contrasena1',
    description:
      'Contraseña. Aquí **no** se validan reglas de fuerza a propósito: en ' +
      'el login la clave o coincide o no, y exigir el formato solo le diría ' +
      'a un atacante cómo son las contraseñas válidas del sistema.',
  })
  @IsString()
  @Length(1, 72)
  password!: string;
}
