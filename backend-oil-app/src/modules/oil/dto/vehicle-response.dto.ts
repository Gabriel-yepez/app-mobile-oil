import { ApiProperty } from '@nestjs/swagger';
import type { Vehicle } from '../domain/vehicle.repository';

export class VehicleResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: ['CAR', 'MOTO'] }) kind!: 'CAR' | 'MOTO';
  @ApiProperty() brand!: string;
  @ApiProperty() model!: string;
  @ApiProperty() year!: number;
  @ApiProperty() plate!: string;
  @ApiProperty() color!: string;

  @ApiProperty({ description: 'Ritmo de uso vigente, en km/día.' })
  kmPerDay!: number;

  @ApiProperty({
    enum: ['DECLARED', 'MEASURED'],
    description:
      'DECLARED mientras no haya dos cambios que medir; MEASURED cuando el ritmo ya salió del historial real.',
  })
  kmPerDaySource!: 'DECLARED' | 'MEASURED';

  @ApiProperty({ nullable: true }) lastChangeKm!: number | null;
  @ApiProperty({ nullable: true }) nextChangeKm!: number | null;
}

/** El userId no sale: el cliente ya sabe de quién es, y exponerlo solo da
 *  material para adivinar ids ajenos. */
export function toVehicleResponse(v: Vehicle): VehicleResponseDto {
  return {
    id: v.id,
    kind: v.kind,
    brand: v.brand,
    model: v.model,
    year: v.year,
    plate: v.plate,
    color: v.color,
    kmPerDay: v.kmPerDay,
    kmPerDaySource: v.kmPerDaySource,
    lastChangeKm: v.lastChangeKm,
    nextChangeKm: v.nextChangeKm,
  };
}
