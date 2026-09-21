import { Injectable } from '@nestjs/common';
import type { NotificationLog as Row } from '@prisma/client';
import type {
  LogEntry,
  NotificationLogRepository,
  NuevoLogEntry,
} from '../../modules/notifications/domain/notification-log.repository';
import type { PushKind } from '../../modules/notifications/domain/push-message';
import { PrismaService } from './prisma.service';

const DIAS_VIGENCIA = 90;

@Injectable()
export class PrismaNotificationLogRepository
  implements NotificationLogRepository
{
  constructor(private readonly prisma: PrismaService) {}

  private toDomain(r: Row): LogEntry {
    return {
      id: r.id,
      userId: r.userId,
      vehicleId: r.vehicleId,
      kind: r.kind as PushKind,
      sig: r.sig,
      ticketId: r.ticketId,
      sentAt: r.sentAt,
    };
  }

  async firmasDe(userId: string): Promise<Set<string>> {
    const desde = new Date(Date.now() - DIAS_VIGENCIA * 86_400_000);
    const rows = await this.prisma.notificationLog.findMany({
      where: { userId, sentAt: { gte: desde } },
      select: { sig: true },
    });
    return new Set(rows.map((r) => r.sig));
  }

  async registrar(entrada: NuevoLogEntry): Promise<void> {
    await this.prisma.notificationLog.create({ data: entrada });
  }

  async pendientesDeReceipt(limite: number): Promise<LogEntry[]> {
    const rows = await this.prisma.notificationLog.findMany({
      where: { ticketId: { not: null }, receiptAt: null },
      orderBy: { sentAt: 'asc' },
      take: limite,
    });
    return rows.map((r) => this.toDomain(r));
  }

  async marcarReceipt(ticketId: string, error: string | null): Promise<void> {
    await this.prisma.notificationLog.updateMany({
      where: { ticketId },
      data: { receiptAt: new Date(), receiptError: error },
    });
  }
}
