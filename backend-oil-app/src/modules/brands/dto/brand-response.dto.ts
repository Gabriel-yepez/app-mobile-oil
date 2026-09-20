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
