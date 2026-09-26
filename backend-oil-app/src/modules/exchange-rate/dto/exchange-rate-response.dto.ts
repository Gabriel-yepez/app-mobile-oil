import { ApiProperty } from '@nestjs/swagger';

export class ExchangeRateResponseDto {
  @ApiProperty({ example: 855.6625, description: 'Bolívares por dólar.' })
  bsPerUsd!: number;

  @ApiProperty({
    example: '2026-09-25T04:00:00.000Z',
    description: 'Día desde el que rige la tasa, según el BCV.',
  })
  effectiveDate!: string;

  @ApiProperty({
    example: '2026-09-26T12:00:00.000Z',
    description:
      'Cuándo la consultó el servidor. Si el proveedor está caído se sirve la última conocida, y esta hora deja ver qué tan vieja es.',
  })
  fetchedAt!: string;
}
