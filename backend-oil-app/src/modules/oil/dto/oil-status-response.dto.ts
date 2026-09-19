// El bloque que pinta la tarjeta del inicio: medidor, odómetro, ciclo y aceite
// en una sola respuesta. Antes eran dos widgets con dos fuentes distintas, y
// esa era justamente la forma de que dijeran cosas diferentes.
import { ApiProperty } from '@nestjs/swagger';
import type { Gauge, Odometer } from '../domain/oil-status';

export class GaugeDto {
  @ApiProperty({ description: 'Vida restante, recortada a [0, 100].' })
  pct!: number;

  @ApiProperty({
    enum: ['ok', 'warn', 'danger'],
    description:
      'Única definición del estado. `danger` es VENCIDO, no "queda poco".',
  })
  status!: Gauge['status'];

  @ApiProperty({
    enum: ['km', 'time'],
    description: [
      'Qué eje está por vencerse. La app lo usa para decidir si el centro del',
      'medidor muestra km restantes o días restantes: a un carro parado que se',
      'le vence por tiempo, mostrarle "8.000 km restantes" es cierto y a la vez',
      'engañoso.',
    ].join(' '),
  })
  limitedBy!: Gauge['limitedBy'];

  @ApiProperty({
    description: 'Sin recortar: el negativo significa que ya se pasó.',
  })
  kmLeft!: number;

  @ApiProperty({ description: 'Sin recortar, y mide su propio eje.' })
  daysLeft!: number;
}

export class OdometerDto {
  @ApiProperty() km!: number;

  @ApiProperty({
    enum: ['reported', 'estimated'],
    description:
      'estimated significa proyectado desde la última lectura real; la app lo muestra con tilde y deja corregirlo.',
  })
  source!: Odometer['source'];

  @ApiProperty({ description: 'Fecha de la lectura real que sirve de base.' })
  asOf!: Date;
}

export class CycleDto {
  @ApiProperty({ nullable: true }) lastChangeKm!: number | null;
  @ApiProperty({ nullable: true }) lastChangeAt!: Date | null;
  @ApiProperty({ nullable: true }) nextChangeKm!: number | null;
  @ApiProperty({ nullable: true }) nextChangeDueAt!: Date | null;
  @ApiProperty() intervalKm!: number;
  @ApiProperty() intervalMonths!: number;
}

export class OilDto {
  @ApiProperty() brand!: string;
  @ApiProperty() tag!: string;
  @ApiProperty() viscosity!: string;
  @ApiProperty() synthetic!: boolean;
}

export class OilStatusResponseDto {
  @ApiProperty() vehicleId!: string;

  @ApiProperty({
    description:
      'Cuándo se calculó. La app lo usa para marcar el bloque como viejo cuando está sin conexión, en vez de fingir que el número es de ahora.',
  })
  computedAt!: Date;

  @ApiProperty({ type: GaugeDto, nullable: true })
  gauge!: GaugeDto | null;

  @ApiProperty({ type: OdometerDto, nullable: true })
  odometer!: OdometerDto | null;

  @ApiProperty({ type: CycleDto, nullable: true })
  cycle!: CycleDto | null;

  @ApiProperty({ type: OilDto, nullable: true })
  oil!: OilDto | null;
}
