import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, Length } from 'class-validator';
import { LARGO_MAX } from '../domain/shop-name';
import type { Shop } from '../domain/shop.repository';

export class CreateShopDto {
  @ApiProperty({
    format: 'uuid',
    required: false,
    description:
      'Lo genera la app para poder agregar sin señal. Si ya existe, la respuesta es 200 con el taller guardado: es un reintento de la cola, no un error.',
  })
  @IsOptional()
  @IsUUID('4')
  id?: string;

  @ApiProperty({
    minLength: 1,
    maxLength: LARGO_MAX,
    example: 'Lubricentro El Rápido',
    description:
      'El charset real lo valida el servicio y devuelve SHOP_NAME_INVALID. Acá solo se acota el largo.',
  })
  @IsString()
  @Length(1, LARGO_MAX)
  name!: string;
}

export class ShopResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty({ example: 'Lubricentro El Rápido' }) name!: string;

  @ApiProperty({
    example: 'LUBRICENTROELRAPIDO',
    description:
      'Nombre normalizado. Viaja para que la app deduplique con la clave del servidor en vez de recalcularla.',
  })
  nameKey!: string;
}

/** El POST: el taller más si esta petición lo creó. Ver CreateBrandResponseDto. */
export class CreateShopResponseDto extends ShopResponseDto {
  @ApiProperty({
    example: true,
    description:
      'true si esta petición lo creó; false si ya estaba en el catálogo, por nombre o por id.',
  })
  created!: boolean;
}

export const toShopResponse = (s: Shop): ShopResponseDto => ({
  id: s.id,
  name: s.name,
  nameKey: s.nameKey,
});

export const toCreateShopResponse = (
  s: Shop,
  created: boolean,
): CreateShopResponseDto => ({ ...toShopResponse(s), created });
