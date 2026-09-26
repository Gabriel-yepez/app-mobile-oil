// Lo que el usuario lleva consumido de los topes. Puerto propio y no los
// repositorios de OilModule: OilModule depende de este módulo para aplicar
// los topes, y depender de vuelta cerraría un ciclo entre los dos.
export const PLAN_USAGE_REPOSITORY = Symbol('PLAN_USAGE_REPOSITORY');

export interface PlanUsageRepository {
  countVehicles(userId: string): Promise<number>;
  /** Cambios de los vehículos del usuario con fecha en [desde, hasta). */
  countOilChanges(userId: string, desde: Date, hasta: Date): Promise<number>;
}
