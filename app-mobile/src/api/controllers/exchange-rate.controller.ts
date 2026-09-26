// Endpoints de /exchange-rate. Un archivo por recurso.
//
// La tasa se pide a NUESTRO backend y no directo al proveedor: así el
// proveedor se cambia en el servidor sin publicar una versión de la app.
import { ApiClient } from '../base';

export type ApiExchangeRate = {
  /** Bolívares por dólar, tasa oficial del BCV. */
  bsPerUsd: number;
  /** ISO. Día desde el que rige la tasa. */
  effectiveDate: string;
  /** ISO. Cuándo la consultó el servidor. */
  fetchedAt: string;
};

class ExchangeRateController extends ApiClient {
  constructor() {
    super('/exchange-rate');
  }

  async bcv(): Promise<ApiExchangeRate> {
    return this.get<ApiExchangeRate>('/bcv', { auth: true });
  }
}

export const exchangeRateController = new ExchangeRateController();
