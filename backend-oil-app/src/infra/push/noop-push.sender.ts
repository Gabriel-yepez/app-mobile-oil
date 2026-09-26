// El emisor que no emite. Es lo que se inyecta con PUSH_ENABLED=false: en
// desarrollo y en los e2e, arrancar la app no puede mandarle notificaciones de
// verdad a nadie.
//
// Devuelve tickets FALLIDOS a propósito, no exitosos. Un ticket exitoso haría
// que el despachador anotara la firma en la bitácora, y ese aviso quedaría
// "gastado": el día que se encienda el push, el usuario nunca recibiría el
// aviso de un aceite que ya estaba vencido. Fallar no consume nada.
import { Injectable, Logger } from '@nestjs/common';
import type {
  EnvioPush,
  PushReceipt,
  PushSender,
  PushTicket,
} from '../../modules/notifications/domain/push-sender';

export const PUSH_DESACTIVADO = 'PUSH_DISABLED';

@Injectable()
export class NoopPushSender implements PushSender {
  private readonly log = new Logger(NoopPushSender.name);

  enviar(envios: EnvioPush[]): Promise<PushTicket[]> {
    if (envios.length > 0) {
      this.log.debug(
        `PUSH_ENABLED=false: ${envios.length} aviso(s) descartado(s) sin enviar.`,
      );
    }
    return Promise.resolve(
      envios.map(() => ({
        ok: false as const,
        code: PUSH_DESACTIVADO,
        message: 'Las notificaciones push están desactivadas en este entorno.',
      })),
    );
  }

  receipts(): Promise<PushReceipt[]> {
    return Promise.resolve([]);
  }
}
