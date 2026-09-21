import type { PushKind } from './push-message';

export const NOTIFICATION_LOG_REPOSITORY = Symbol(
  'NOTIFICATION_LOG_REPOSITORY',
);

export type LogEntry = {
  id: string;
  userId: string;
  vehicleId: string | null;
  kind: PushKind;
  sig: string;
  ticketId: string | null;
  sentAt: Date;
};

export type NuevoLogEntry = Omit<LogEntry, 'id' | 'sentAt'>;

export interface NotificationLogRepository {
  /**
   * Las firmas vigentes del usuario: exactamente lo que `planPushes` recibe
   * como `yaEnviado`. Se limita a los últimos 90 días porque una firma de hace
   * un año no puede repetirse (el ciclo cambió) y la consulta no tiene por qué
   * crecer para siempre.
   */
  firmasDe(userId: string): Promise<Set<string>>;
  registrar(entrada: NuevoLogEntry): Promise<void>;
  /** Enviados con ticket y sin receipt todavía, del más viejo al más nuevo. */
  pendientesDeReceipt(limite: number): Promise<LogEntry[]>;
  marcarReceipt(ticketId: string, error: string | null): Promise<void>;
}
