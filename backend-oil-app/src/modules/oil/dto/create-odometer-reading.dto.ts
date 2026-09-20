import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Max, Min } from 'class-validator';

export class CreateOdometerReadingDto {
  @ApiProperty({
    example: 47250,
    description: 'Lectura del tablero, en km.',
  })
  @IsInt()
  @Min(0)
  @Max(2_000_000)
  km!: number;
}
