import { ApiProperty } from '@nestjs/swagger';
import type { Brand } from '../domain/brand.repository';

export class BrandResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: ['CAR', 'MOTO'] }) kind!: 'CAR' | 'MOTO';
  @ApiProperty({ example: 'Chery' }) name!: string;

  @ApiProperty({
    example: 'CHERY',
    description:
      'Nombre normalizado. Viaja para que la app deduplique con la clave del servidor en vez de recalcularla.',
  })
  nameKey!: string;
}

export const toBrandResponse = (b: Brand): BrandResponseDto => ({
  id: b.id,
  kind: b.kind,
  name: b.name,
  nameKey: b.nameKey,
});

/**
 * Lo que devuelve el POST. Lleva `created` además de la marca.
 *
 * Es un DTO aparte y no un campo más en `BrandResponseDto` porque `created`
 * describe LO QUE PASÓ EN ESTA PETICIÓN, no la marca: en el listado sería un
 * campo sin significado.
 */
export class CreateBrandResponseDto extends BrandResponseDto {
  @ApiProperty({
    example: true,
    description:
      'true si esta petición la creó; false si ya estaba en el catálogo, por nombre o por id. La app lo usa para decidir qué avisarle al usuario.',
  })
  created!: boolean;
}

export const toCreateBrandResponse = (
  b: Brand,
  created: boolean,
): CreateBrandResponseDto => ({ ...toBrandResponse(b), created });
