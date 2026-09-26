import { Inject, Injectable, Logger } from '@nestjs/common';
import { Errors } from '../../common/errors';
import {
  TASA_SOURCE,
  type TasaBcv,
  type TasaSource,
} from './domain/tasa-source';

/** El BCV publica una vez por día hábil: consultar más seguido no trae nada
 *  nuevo, y el proveedor es un servicio gratuito que conviene no martillar. */
export const TTL_MS = 30 * 60_000;

/** Tras un fallo, cuánto esperar antes de volver a intentar. Sin esto, con el
 *  proveedor caído cada petición de la app saldría a la red a fallar otra vez. */
export const REINTENTO_MS = 60_000;

export type TasaConsultada = TasaBcv & { consultada: Date };

@Injectable()
export class ExchangeRateService {
  private readonly logger = new Logger(ExchangeRateService.name);

  // En memoria y no en la base: es un solo número que se recupera en un
  // segundo, y perderlo al reiniciar solo cuesta una consulta.
  private ultima: TasaConsultada | null = null;
  private noAntesDe = 0;
  private enCurso: Promise<TasaConsultada> | null = null;

  constructor(@Inject(TASA_SOURCE) private readonly source: TasaSource) {}

  async bcv(ahora = new Date()): Promise<TasaConsultada> {
    const t = ahora.getTime();
    const fresca = this.ultima && t - this.ultima.consultada.getTime() < TTL_MS;
    if (fresca || t < this.noAntesDe) return this.ultimaOFalla();

    // Varias peticiones a la vez con la caché vencida comparten la misma
    // consulta en vez de disparar una cada una.
    this.enCurso ??= this.consultar(ahora).finally(() => {
      this.enCurso = null;
    });
    return this.enCurso;
  }

  private async consultar(ahora: Date): Promise<TasaConsultada> {
    try {
      const tasa = await this.source.tasaBcv();
      this.ultima = { ...tasa, consultada: ahora };
      return this.ultima;
    } catch (e) {
      this.noAntesDe = ahora.getTime() + REINTENTO_MS;
      this.logger.warn(`No se pudo consultar la tasa BCV: ${String(e)}`);
      // Una tasa de ayer sirve para un "≈ Bs.S": es mejor que no mostrar nada.
      return this.ultimaOFalla();
    }
  }

  private ultimaOFalla(): TasaConsultada {
    if (!this.ultima) throw Errors.exchangeRateUnavailable();
    return this.ultima;
  }
}
