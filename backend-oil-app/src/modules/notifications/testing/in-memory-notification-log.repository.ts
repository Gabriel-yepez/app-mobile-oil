import type {
  LogEntry,
  NotificationLogRepository,
  NuevoLogEntry,
} from '../domain/notification-log.repository';

export class InMemoryNotificationLogRepository implements NotificationLogRepository {
  readonly filas: (LogEntry & { receiptAt: Date | null })[] = [];
  private n = 0;

  async firmasDe(userId: string): Promise<Set<string>> {
    return new Set(
      this.filas.filter((f) => f.userId === userId).map((f) => f.sig),
    );
  }

  async registrar(entrada: NuevoLogEntry): Promise<void> {
    this.filas.push({
      ...entrada,
      id: `log-${++this.n}`,
      sentAt: new Date(),
      receiptAt: null,
    });
  }

  async pendientesDeReceipt(limite: number): Promise<LogEntry[]> {
    return this.filas
      .filter((f) => f.ticketId !== null && f.receiptAt === null)
      .slice(0, limite);
  }

  // El error del receipt no se guarda acá: ningún test afirma sobre él y el
  // doble solo tiene que saber qué deja de estar pendiente.
  async marcarReceipt(ticketId: string): Promise<void> {
    for (const f of this.filas) {
      if (f.ticketId === ticketId) f.receiptAt = new Date();
    }
  }
}
