import { ApiProperty } from '@nestjs/swagger';

export class ColorResponseDto {
  @ApiProperty({ example: 'Negro' }) name!: string;

  @ApiProperty({
    example: '#1F2937',
    description:
      'Hex de seis dígitos. Es lo que el vehículo guarda en `color`.',
  })
  hex!: string;
}
