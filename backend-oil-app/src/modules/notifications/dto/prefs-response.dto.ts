import { ApiProperty } from '@nestjs/swagger';
import type { NotificationPrefs } from '../domain/push-message';

export class PrefsResponseDto {
  @ApiProperty() enabled!: boolean;
  @ApiProperty() warnEnabled!: boolean;
  @ApiProperty() overdueEnabled!: boolean;
  @ApiProperty() checkinEnabled!: boolean;
  @ApiProperty({ example: 500 }) warnThresholdKm!: number;
  @ApiProperty({ example: 1, description: 'Domingo = 1.' })
  checkinWeekday!: number;
}

export const toPrefsResponse = (p: NotificationPrefs): PrefsResponseDto => ({
  enabled: p.enabled,
  warnEnabled: p.warnEnabled,
  overdueEnabled: p.overdueEnabled,
  checkinEnabled: p.checkinEnabled,
  warnThresholdKm: p.warnThresholdKm,
  checkinWeekday: p.checkinWeekday,
});
