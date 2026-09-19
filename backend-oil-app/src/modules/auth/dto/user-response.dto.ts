// Lista BLANCA a propósito. Excluir campos es frágil: olvidar excluir uno es
// silencioso y filtra el dato; olvidar incluirlo se ve de inmediato en la
// respuesta. El passwordHash no puede salir por accidente si nunca se copia.
//
// Es una CLASE y no un `type` porque Swagger lee los decoradores en tiempo de
// ejecución, y un alias de tipo no deja rastro al compilar. `UserResponse`
// sigue existiendo como alias para que nada más tenga que cambiar.
import { ApiProperty } from '@nestjs/swagger';
import type { Currency, User } from '../../users/domain/user';

export class UserResponseDto {
  @ApiProperty({
    format: 'uuid',
    example: '9f1c2b7e-3a44-4d51-9d1f-2c8b0a7e5d13',
    description: 'Identificador del usuario. Lo genera la base al registrarse.',
  })
  id!: string;

  @ApiProperty({
    example: 'Luis Guerrero',
    description: 'Nombre y apellido, ya recortado de espacios sobrantes.',
  })
  fullName!: string;

  @ApiProperty({
    example: 'V25481073',
    description:
      'Cédula **normalizada**: sin puntos ni guiones y con la letra en ' +
      'mayúscula. "V-25.481.073", "25481073" y "v25481073" se guardan las ' +
      'tres así, de modo que son la misma persona para el índice único.',
  })
  cedula!: string;

  @ApiProperty({
    format: 'email',
    example: 'luis@correo.com',
    description: 'Correo normalizado a minúsculas. Único en el sistema.',
  })
  email!: string;

  @ApiProperty({
    example: '+58 414 528 9012',
    description: 'Teléfono tal como lo escribió el usuario, solo recortado.',
  })
  phone!: string;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'Distrito Capital',
    description:
      'Estado de residencia, ya normalizado ("Distrito Capital"). El ' +
      'registro lo exige, así que en cuentas nuevas nunca es `null`; sigue ' +
      'siendo anulable por las cuentas creadas antes de que el registro ' +
      'pidiera el perfil completo.',
  })
  state!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'Caracas',
    description: 'Ciudad de residencia. Mismas reglas que el estado.',
  })
  city!: string | null;

  @ApiProperty({
    enum: ['USD', 'BS', 'BOTH'],
    example: 'BOTH',
    description:
      'Moneda en la que el usuario quiere ver los precios. El registro la ' +
      'admite opcional; si no viene, queda en `BOTH` (dólar y bolívar).',
  })
  currency!: Currency;
}

export type UserResponse = UserResponseDto;

export function toUserResponse(user: User): UserResponse {
  return {
    id: user.id,
    fullName: user.fullName,
    cedula: user.cedula,
    email: user.email,
    phone: user.phone,
    state: user.state,
    city: user.city,
    currency: user.currency,
  };
}
