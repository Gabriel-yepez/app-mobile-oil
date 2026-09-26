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

/**
 * `PATCH /auth/me`: el usuario ya actualizado, más un acuse legible.
 *
 * El `message` viaja en el ÉXITO y no solo en los errores porque es lo que la
 * app enseña en el toast. Sin él, cada cliente redactaría su propio "Guardado"
 * y el mismo backend hablaría distinto en Android, en iOS y en la web; y el
 * caso de "guardé sin tocar nada" —que no es un error, pero tampoco un
 * cambio— no tendría cómo contarse.
 */
export class UpdateMeResponseDto extends MeResponseDto {
  @ApiProperty({
    example: 'Listo, tus datos quedaron actualizados.',
    description:
      'Texto para mostrarle al usuario tal cual. Puede cambiar de redacción ' +
      'sin previo aviso: para decidir en código, mira `changed`.',
  })
  message!: string;

  @ApiProperty({
    type: [String],
    example: ['phone', 'city'],
    description:
      'Los campos que cambiaron de verdad, ya normalizados. Viene **vacío** ' +
      'si el cuerpo no traía ninguna diferencia: la app puede mandar el ' +
      'formulario entero sin saber qué tocó el usuario, y el servidor no ' +
      'escribe nada en ese caso.',
  })
  changed!: string[];
}
