import { ApiProperty } from '@nestjs/swagger';
import type { Vehicle } from '../domain/vehicle.repository';
import { GaugeDto, OdometerDto } from './oil-status-response.dto';

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
  @ApiProperty({
    nullable: true,
    description:
      'Fecha del último cambio. La app deriva de acá los "días desde el último cambio" en vez de mantener un contador propio.',
  })
  lastChangeAt!: Date | null;
  @ApiProperty({ nullable: true }) nextChangeKm!: number | null;

  @ApiProperty({
    nullable: true,
    description:
      'Hasta cuándo el usuario pospuso la alerta del aceite. Mientras sea futura la alerta no se cuenta como abierta y no se mandan push. Registrar un cambio la vuelve a null.',
  })
  alertSnoozedUntil!: Date | null;

  // El estado viaja con la lista para que la pantalla de la flota sea UNA
  // llamada y no una por vehículo. `null` mientras no haya ningún cambio.
  @ApiProperty({ type: GaugeDto, nullable: true })
  gauge!: GaugeDto | null;

  @ApiProperty({ type: OdometerDto, nullable: true })
  odometer!: OdometerDto | null;
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
    lastChangeAt: v.lastChangeAt,
    nextChangeKm: v.nextChangeKm,
    alertSnoozedUntil: v.alertSnoozedUntil,
    // Los rellena listVehiclesWithStatus; la ficha sola no los conoce.
    gauge: null,
    odometer: null,
  };
}
