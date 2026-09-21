// Los relojes, y nada más. Toda la lógica está en los servicios, para que un
// test pueda llamarla sin esperar a las 9 de la mañana.
import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PushSweepService } from './push-sweep.service';
import { ReceiptsService } from './receipts.service';

@Injectable()
export class NotificationsCron {
  constructor(
    private readonly sweep: PushSweepService,
    private readonly receipts: ReceiptsService,
  ) {}

  // Venezuela no mueve el reloj en todo el año, así que el offset es fijo y no
  // existe la sorpresa clásica del horario de verano.
  @Cron('0 9 * * *', { timeZone: 'America/Caracas' })
  async barridoDiario(): Promise<void> {
    await this.sweep.run();
  }

  // Expo confirma la entrega real unos 15 minutos después del envío.
  @Cron('*/30 * * * *')
  async revisarReceipts(): Promise<void> {
    await this.receipts.procesarPendientes();
  }
}
