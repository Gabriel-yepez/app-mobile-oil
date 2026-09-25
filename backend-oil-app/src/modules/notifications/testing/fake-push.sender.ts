import type {
  EnvioPush,
  PushReceipt,
  PushSender,
  PushTicket,
} from '../domain/push-sender';

export class FakePushSender implements PushSender {
  readonly enviados: EnvioPush[] = [];
  /** Se consume en orden; agotada, devuelve tickets ok con id correlativo. */
  ticketsPorDevolver: PushTicket[] = [];
  receiptsPorDevolver: PushReceipt[] = [];
  /** Los ids que se pidieron: sirve para afirmar que NO se llamó al emisor. */
  readonly receiptsPedidos: string[] = [];
  private n = 0;

  enviar(envios: EnvioPush[]): Promise<PushTicket[]> {
    this.enviados.push(...envios);
    return Promise.resolve(
      envios.map(
        () =>
          this.ticketsPorDevolver.shift() ?? {
            ok: true as const,
            id: `tk-${++this.n}`,
          },
      ),
    );
  }

  receipts(ticketIds: string[]): Promise<PushReceipt[]> {
    this.receiptsPedidos.push(...ticketIds);
    if (this.receiptsPorDevolver.length > 0) {
      return Promise.resolve(this.receiptsPorDevolver);
    }
    return Promise.resolve(
      ticketIds.map((ticketId) => ({ ticketId, error: null })),
    );
  }
}
