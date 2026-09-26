import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Max, Min } from 'class-validator';

export class SnoozeAlertDto {
  @ApiProperty({
    example: 3,
    minimum: 1,
    maximum: 30,
    description:
      'Por cuántos días se calla la alerta. El tope evita que "posponer" se vuelva una forma de apagarla para siempre sin pasar por los ajustes.',
  })
  @IsInt()
  @Min(1)
  @Max(30)
  days!: number;
}
