// El puerto de salida. Lo implementa ExpoPushSender en producción y
// FakePushSender en los tests: ningún test le pega a los servidores de Expo.
import type { PushMessage } from './push-message';

export const PUSH_SENDER = Symbol('PUSH_SENDER');

export type EnvioPush = { token: string; mensaje: PushMessage };

/** Uno por envío y EN EL MISMO ORDEN que la lista que entró. */
export type PushTicket =
  | { ok: true; id: string }
  | { ok: false; code: string; message: string };

export type PushReceipt = { ticketId: string; error: string | null };

export interface PushSender {
  enviar(envios: EnvioPush[]): Promise<PushTicket[]>;
  receipts(ticketIds: string[]): Promise<PushReceipt[]>;
}
