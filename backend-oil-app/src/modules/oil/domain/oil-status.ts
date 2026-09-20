// El estado del aceite como lo entiende el negocio. Igual que users/domain,
// deliberadamente SIN tipos de Prisma: el calculador tiene que poder correr en
// un test sin base, y el día que cambie el motor esto no se toca.

/** Cortes del medidor. `danger` es vencido, no "poco": ver oil-status.calculator. */
export type OilStatusLevel = 'ok' | 'warn' | 'danger';

/** Cuál de los dos ejes es el que está por vencerse. */
export type LimitedBy = 'km' | 'time';

/** Si el odómetro es una lectura real o una proyección. */
export type OdometerSource = 'reported' | 'estimated';

/**
 * Rango admisible del ritmo de uso, en km/día.
 *
 * El piso de 1 descarta el vehículo que estuvo meses parado; el techo de 500
 * descarta el dedazo en el odómetro (un dígito de más da miles de km/día). Sin
 * estos topes, cualquiera de los dos envenena la estimación por los tres ciclos
 * siguientes.
 */
export const KM_PER_DAY_MIN = 1;
export const KM_PER_DAY_MAX = 500;

export type OilCycle = {
  km: number;
  changedAt: Date;
  intervalKm: number;
  intervalMonths: number;
};

export type OdometerBase = { km: number; readAt: Date };

export type OilStatusInput = {
  now: Date;
  kmPerDay: number;
  lastReading: OdometerBase | null;
  cycle: OilCycle | null;
};

export type Gauge = {
  /** Recortado a [0, 100]: la barra no puede dibujar menos que vacío. */
  pct: number;
  status: OilStatusLevel;
  limitedBy: LimitedBy;
  /** SIN recortar: el negativo ("te pasaste 800 km") es la información útil. */
  kmLeft: number;
  /**
   * SIN recortar, y mide su propio eje. Un vehículo limitado por tiempo puede
   * tener 8.000 en kmLeft y 12 en daysLeft a la vez: no es una contradicción,
   * es el retrato de un carro parado.
   */
  daysLeft: number;
};

export type Odometer = { km: number; source: OdometerSource; asOf: Date };

export type OilStatus = {
  computedAt: Date;
  /** null cuando el vehículo no tiene ningún cambio registrado. */
  gauge: Gauge | null;
  /** null cuando no hay ninguna lectura de odómetro. */
  odometer: Odometer | null;
};
