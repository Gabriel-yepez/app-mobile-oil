// Las dos formas de respuesta exitosa de /auth. Solo existen para que Swagger
// tenga un esquema que mostrar: los tipos `TokenPair` y `AuthResult` que usan
// el servicio y el controlador siguen siendo los de siempre, y estas clases
// son estructuralmente idénticas a ellos.
import { ApiProperty } from '@nestjs/swagger';
import { UserResponseDto } from './user-response.dto';

const DESC_ACCESS =
  'JWT firmado con `JWT_ACCESS_SECRET`. Va en cada petición protegida como ' +
  '`Authorization: Bearer <accessToken>`. Vive lo que diga `JWT_ACCESS_TTL` ' +
  '(15 minutos por defecto); cuando vence, se cambia por uno nuevo en ' +
  '`POST /auth/refresh` sin volver a pedir la contraseña.';

const DESC_REFRESH =
  '384 bits aleatorios (no es un JWT: no lleva datos dentro y no se puede ' +
  'decodificar). Dura `JWT_REFRESH_TTL`, 30 días por defecto. **Guárdalo en ' +
  'almacenamiento seguro del dispositivo, nunca en texto plano.** Es de un ' +
  'solo uso: al refrescar se invalida y recibes otro.';

export class TokenPairDto {
  @ApiProperty({
    description: DESC_ACCESS,
    example:
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI5ZjFjMmI3ZS0zYTQ0...',
  })
  accessToken!: string;

  @ApiProperty({
    description: DESC_REFRESH,
    example: 'Rkx1ZGVsUGFzb0RlVG9rZW5BbGVhdG9yaW9EZTQ4Qnl0ZXNFbkJhc2U2NHVybA',
  })
  refreshToken!: string;
}

export class AuthResponseDto extends TokenPairDto {
  @ApiProperty({
    type: UserResponseDto,
    description:
      'El usuario recién autenticado, ya filtrado por lista blanca: el ' +
      '`passwordHash` no sale nunca de la capa de datos.',
  })
  user!: UserResponseDto;
}

/**
 * `GET /auth/me` devuelve el usuario ENVUELTO en un objeto en vez de suelto.
 * Es a propósito: deja sitio para añadir datos al lado (permisos, ajustes) sin
 * romper a los clientes que ya leen `user`.
 */
export class MeResponseDto {
  @ApiProperty({ type: UserResponseDto })
  user!: UserResponseDto;
}
