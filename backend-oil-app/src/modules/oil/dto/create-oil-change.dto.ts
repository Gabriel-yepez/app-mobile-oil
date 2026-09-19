import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDate,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
} from 'class-validator';

export class CreateOilChangeDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: [
      'Id generado por la app. Hace la creación **idempotente**: reenviar el',
      'mismo id devuelve el cambio ya registrado en vez de abrir un ciclo',
      'nuevo y reiniciar la barra sin motivo.',
    ].join(' '),
  })
  @IsOptional()
  @IsUUID('4')
  id?: string;

  @ApiProperty({
    example: '2026-06-04T00:00:00.000Z',
    description:
      'Fecha real del cambio, que no es la de registro: se puede anotar hoy un cambio hecho la semana pasada.',
  })
  @Type(() => Date)
  @IsDate()
  changedAt!: Date;

  @ApiProperty({ example: 45000, description: 'Odómetro al hacer el cambio.' })
  @IsInt()
  @Min(0)
  @Max(2_000_000)
  km!: number;

  @ApiProperty({
    example: 5000,
    description: 'Eje de kilometraje del ciclo. Lo escribe el usuario.',
  })
  @IsInt()
  @Min(500)
  @Max(50_000)
  intervalKm!: number;

  @ApiProperty({
    example: 6,
    description:
      'Eje de tiempo del ciclo, en meses. Junto con intervalKm arma el "lo que ocurra primero".',
  })
  @IsInt()
  @Min(1)
  @Max(36)
  intervalMonths!: number;

  @ApiProperty({ example: 'Pennzoil' })
  @IsString()
  @Length(1, 40)
  oilBrand!: string;

  @ApiProperty({ example: 'Platinum' })
  @IsString()
  @Length(1, 40)
  oilTag!: string;

  @ApiProperty({ example: '5W-30' })
  @IsString()
  @Length(1, 20)
  oilViscosity!: string;

  @ApiProperty({ example: true })
  @IsBoolean()
  oilSynthetic!: boolean;

  @ApiPropertyOptional({ example: 'Lubricentro El Rápido' })
  @IsOptional()
  @IsString()
  @Length(1, 80)
  shop?: string;

  @ApiPropertyOptional({ example: 32 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  costUsd?: number;
}

/** Para corregir: la pantalla manda solo lo que el usuario tocó. */
export class UpdateOilChangeDto extends PartialType(CreateOilChangeDto) {}
