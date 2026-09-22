// Expo confirma la entrega REAL unos 15 minutos después del envío. Un ticket
// correcto no garantiza nada: el DeviceNotRegistered de una app desinstalada
// suele llegar acá, no en el ticket.
import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  DEVICE_TOKEN_REPOSITORY,
  type DeviceTokenRepository,
} from './domain/device-token.repository';
import {
  NOTIFICATION_LOG_REPOSITORY,
  type NotificationLogRepository,
} from './domain/notification-log.repository';
import { PUSH_SENDER, type PushSender } from './domain/push-sender';

const POR_TANDA = 300;

@Injectable()
export class ReceiptsService {
  private readonly log = new Logger(ReceiptsService.name);

  constructor(
    @Inject(NOTIFICATION_LOG_REPOSITORY)
    private readonly bitacora: NotificationLogRepository,
    @Inject(DEVICE_TOKEN_REPOSITORY)
    private readonly devices: DeviceTokenRepository,
    @Inject(PUSH_SENDER) private readonly sender: PushSender,
  ) {}

  async procesarPendientes(): Promise<{
    revisados: number;
    tokensApagados: number;
  }> {
    const pendientes = await this.bitacora.pendientesDeReceipt(POR_TANDA);
    if (pendientes.length === 0) return { revisados: 0, tokensApagados: 0 };

    const porTicket = new Map(
      pendientes
        .filter((p) => p.ticketId !== null)
        .map((p) => [p.ticketId as string, p]),
    );

    const receipts = await this.sender.receipts([...porTicket.keys()]);

    let revisados = 0;
    let tokensApagados = 0;

    for (const r of receipts) {
      await this.bitacora.marcarReceipt(r.ticketId, r.error);
      revisados++;

      if (r.error === 'DeviceNotRegistered') {
        const entrada = porTicket.get(r.ticketId);
        if (entrada?.token) {
          await this.devices.apagar(entrada.token);
          tokensApagados++;
        }
      } else if (r.error !== null) {
        // Se anota pero no se apaga nada: un MessageRateExceeded no significa
        // que el teléfono haya desaparecido.
        this.log.warn(
          `Receipt con error ${r.error} para el ticket ${r.ticketId}`,
        );
      }
    }

    return { revisados, tokensApagados };
  }
}
