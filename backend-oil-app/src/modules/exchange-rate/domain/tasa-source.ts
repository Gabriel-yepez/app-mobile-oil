// El puerto de salida. Lo implementa DolarApiTasaSource en producción; los
// tests inyectan un doble y ninguno sale a la red.
export const TASA_SOURCE = Symbol('TASA_SOURCE');

/** La tasa oficial que publica el BCV: cuántos bolívares vale un dólar. */
export type TasaBcv = {
  bsPorUsd: number;
  /** Día desde el que rige. El BCV la publica la tarde anterior. */
  vigente: Date;
};

export interface TasaSource {
  tasaBcv(): Promise<TasaBcv>;
}
