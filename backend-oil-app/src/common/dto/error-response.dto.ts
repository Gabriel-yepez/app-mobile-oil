// La forma ÚNICA de error de la API, tal como la arma AllExceptionsFilter.
// Existe para que Swagger pueda mostrarla: el filtro construye el cuerpo a
// mano, así que sin esta clase la documentación no tendría de dónde sacar el
// esquema y cada 4xx aparecería vacío.
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ErrorResponseDto {
  @ApiProperty({
    example: 401,
    description: 'El mismo código HTTP de la respuesta, repetido en el cuerpo.',
  })
  statusCode!: number;

  @ApiProperty({
    example: 'INVALID_CREDENTIALS',
    description:
      'Código estable de la falla. **Es el contrato con la app: ramifica ' +
      'por este campo, nunca por `message`.** Nunca cambia sin versionar la API.',
  })
  error!: string;

  @ApiProperty({
    example: 'Correo o contraseña incorrectos.',
    description:
      'Texto en español listo para mostrarle al usuario. Puede cambiar en ' +
      'cualquier momento (redacción, traducción): no lo uses para decidir.',
  })
  message!: string;

  @ApiPropertyOptional({
    type: [String],
    description:
      'Solo en `VALIDATION_ERROR`: un renglón por regla incumplida, tal cual ' +
      'los devuelve class-validator. Sirve para marcar campos en el formulario.',
    example: [
      'El correo no es válido',
      'La contraseña debe tener entre 8 y 72 caracteres',
    ],
  })
  details?: string[];

  @ApiProperty({
    format: 'date-time',
    example: '2026-09-18T14:03:11.482Z',
    description: 'Momento en que el servidor generó el error (ISO 8601, UTC).',
  })
  timestamp!: string;
}
