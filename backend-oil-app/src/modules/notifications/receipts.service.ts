import { Injectable } from '@nestjs/common';

@Injectable()
export class ReceiptsService {
  /** El cuerpo llega en la tarea de receipts. Por ahora no hay nada que revisar. */
  async procesarPendientes(): Promise<{
    revisados: number;
    tokensApagados: number;
  }> {
    return { revisados: 0, tokensApagados: 0 };
  }
}
