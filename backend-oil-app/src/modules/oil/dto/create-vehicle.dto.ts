import { ApiProperty } from '@nestjs/swagger';
import {
  IsHexColor,
  IsIn,
  IsInt,
  IsNumber,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';
import { KM_PER_DAY_MAX, KM_PER_DAY_MIN } from '../domain/oil-status';

export class CreateVehicleDto {
  @ApiProperty({ enum: ['CAR', 'MOTO'] })
  @IsIn(['CAR', 'MOTO'])
  kind!: 'CAR' | 'MOTO';

  @ApiProperty({ example: 'Toyota' })
  @IsString()
  @Length(1, 40)
  brand!: string;

  @ApiProperty({ example: 'Corolla' })
  @IsString()
  @Length(1, 40)
  model!: string;

  @ApiProperty({ example: 2019 })
  @IsInt()
  @Min(1950)
  @Max(2100)
  year!: number;

  @ApiProperty({ example: 'AB123CD' })
  @IsString()
  @Length(4, 10)
  plate!: string;

  @ApiProperty({ example: '#1E88E5' })
  @IsHexColor()
  color!: string;

  @ApiProperty({
    minimum: KM_PER_DAY_MIN,
    maximum: KM_PER_DAY_MAX,
    example: 40,
    description: [
      'Ritmo de uso declarado, en km/día. Arranca la estimación del odómetro',
      'y se recalibra solo con cada ciclo medido: desde el segundo cambio de',
      'aceite el número pasa a ser el real de este vehículo.',
    ].join(' '),
  })
  @IsNumber()
  @Min(KM_PER_DAY_MIN)
  @Max(KM_PER_DAY_MAX)
  kmPerDay!: number;
}
