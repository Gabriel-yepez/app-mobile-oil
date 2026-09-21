// Cuerpo de PATCH /me/notification-prefs: todo opcional.
//
// Deliberadamente SIN ningún @Transform. Los @Transform corren también sobre
// las claves ausentes, y ese par —@Transform junto a @IsOptional— es el que
// convierte un `undefined` en `''` y hace rebotar un campo que el cliente
// nunca mandó. Acá no hay nada que normalizar, así que la tentación no existe;
// si algún día hace falta, se envuelve con el helper `siViene` de
// users/dto/update-profile.dto.ts.
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';

export class UpdatePrefsDto {
  @ApiPropertyOptional({
    description: 'Interruptor maestro. En false no sale ningún aviso.',
  })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({
    description: 'Avisar cuando falte poco para el cambio.',
  })
  @IsOptional()
  @IsBoolean()
  warnEnabled?: boolean;

  @ApiPropertyOptional({
    description: 'Avisar cuando el cambio ya esté vencido.',
  })
  @IsOptional()
  @IsBoolean()
  overdueEnabled?: boolean;

  @ApiPropertyOptional({
    description: 'Recordatorio semanal para confirmar el kilometraje.',
  })
  @IsOptional()
  @IsBoolean()
  checkinEnabled?: boolean;

  @ApiPropertyOptional({ minimum: 100, maximum: 5_000, example: 500 })
  @IsOptional()
  @IsInt()
  @Min(100)
  @Max(5_000)
  warnThresholdKm?: number;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: 7,
    example: 1,
    description:
      'Día del recordatorio semanal. Domingo = 1, como el trigger WEEKLY de Expo.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(7)
  checkinWeekday?: number;
}
