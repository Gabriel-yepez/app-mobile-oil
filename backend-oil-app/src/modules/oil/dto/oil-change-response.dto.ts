import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class ListOilChangesQueryDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Id del último elemento de la página anterior. Se omite en la primera.',
  })
  @IsOptional()
  @IsUUID('4')
  cursor?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class OilChangeResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() vehicleId!: string;
  @ApiProperty() changedAt!: Date;
  @ApiProperty() km!: number;
  @ApiProperty() intervalKm!: number;
  @ApiProperty() intervalMonths!: number;
  @ApiProperty() oilBrand!: string;
  @ApiProperty() oilTag!: string;
  @ApiProperty() oilViscosity!: string;
  @ApiProperty() oilSynthetic!: boolean;
  @ApiProperty({ nullable: true }) shop!: string | null;
  @ApiProperty({ nullable: true }) costUsd!: number | null;
}

export class OilChangePageDto {
  @ApiProperty({ type: [OilChangeResponseDto] })
  items!: OilChangeResponseDto[];

  @ApiProperty({
    nullable: true,
    description:
      'Se pasa como `cursor` para pedir la página siguiente. `null` significa que no hay más: sin esto la app pagina para siempre.',
  })
  nextCursor!: string | null;
}
