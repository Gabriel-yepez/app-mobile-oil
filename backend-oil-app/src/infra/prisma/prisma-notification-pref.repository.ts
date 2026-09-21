import { Injectable } from '@nestjs/common';
import type { NotificationPref as Row } from '@prisma/client';
import type { NotificationPrefRepository } from '../../modules/notifications/domain/notification-pref.repository';
import {
  DEFAULT_PREFS,
  type NotificationPrefs,
} from '../../modules/notifications/domain/push-message';
import { PrismaService } from './prisma.service';

@Injectable()
export class PrismaNotificationPrefRepository
  implements NotificationPrefRepository
{
  constructor(private readonly prisma: PrismaService) {}

  private toDomain(r: Row): NotificationPrefs {
    return {
      enabled: r.enabled,
      warnEnabled: r.warnEnabled,
      overdueEnabled: r.overdueEnabled,
      checkinEnabled: r.checkinEnabled,
      warnThresholdKm: r.warnThresholdKm,
      checkinWeekday: r.checkinWeekday,
    };
  }

  async obtener(userId: string): Promise<NotificationPrefs> {
    const row = await this.prisma.notificationPref.findUnique({
      where: { userId },
    });
    // Sin fila se devuelven los valores por defecto SIN escribir: un GET no
    // debe crear filas para los usuarios que nunca tocaron la pantalla.
    return row ? this.toDomain(row) : DEFAULT_PREFS;
  }

  async guardar(
    userId: string,
    patch: Partial<NotificationPrefs>,
  ): Promise<NotificationPrefs> {
    const row = await this.prisma.notificationPref.upsert({
      where: { userId },
      create: { userId, ...patch },
      update: patch,
    });
    return this.toDomain(row);
  }
}
