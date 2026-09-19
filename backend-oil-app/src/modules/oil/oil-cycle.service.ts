// EL ÚNICO ESCRITOR del espejo del ciclo en Vehicle.
//
// Las cuatro columnas (lastChangeKm, lastChangeAt, nextChangeKm,
// nextChangeDueAt) son derivables de la última fila de OilChange. Se persisten
// por decisión de producto —para tener el ciclo actual registrado en la ficha—
// y el precio de esa duplicación es esta regla: si alguna otra ruta las
// escribe, el espejo puede quedar mintiendo sin que nada en la base lo delate,
// porque dos números desincronizados se ven perfectamente válidos.
//
// Por eso hay un solo método que las toca, y un test de invariante que lo
// vigila (oil-cycle.service.spec.ts).
import { Inject, Injectable } from '@nestjs/common';
import { addMonths } from './domain/dates';
import { computeKmPerDay } from './domain/km-rate';
import {
  OIL_CHANGE_REPOSITORY,
  type OilChangeRepository,
} from './domain/oil-change.repository';
import {
  VEHICLE_REPOSITORY,
  type VehicleRepository,
} from './domain/vehicle.repository';

/**
 * Cuántos cambios bajan de la base para recalibrar: los 3 ciclos que promedia
 * computeKmPerDay necesitan 4 filas.
 */
const CAMBIOS_PARA_RECALIBRAR = 4;

@Injectable()
export class OilCycleService {
  constructor(
    @Inject(VEHICLE_REPOSITORY) private readonly vehicles: VehicleRepository,
    @Inject(OIL_CHANGE_REPOSITORY)
    private readonly changes: OilChangeRepository,
  ) {}

  /**
   * Recalcula el espejo desde la fuente de verdad y lo escribe. Lo llaman las
   * tres rutas que tocan el historial: crear, editar y borrar un cambio.
   */
  async syncVehicleCycle(vehicleId: string): Promise<void> {
    const recientes = await this.changes.findByVehicle(
      vehicleId,
      CAMBIOS_PARA_RECALIBRAR,
    );
    const ultimo = recientes[0] ?? null;

    if (!ultimo) {
      // Se borró el único cambio: el espejo vuelve a null. Dejarlo apuntando a
      // un ciclo que ya no existe es justo la mentira que esto evita.
      await this.vehicles.updateCycleMirror(vehicleId, {
        lastChangeKm: null,
        lastChangeAt: null,
        nextChangeKm: null,
        nextChangeDueAt: null,
      });
      return;
    }

    await this.vehicles.updateCycleMirror(vehicleId, {
      lastChangeKm: ultimo.km,
      lastChangeAt: ultimo.changedAt,
      nextChangeKm: ultimo.km + ultimo.intervalKm,
      nextChangeDueAt: addMonths(ultimo.changedAt, ultimo.intervalMonths),
    });

    const vehicle = await this.vehicles.findById(vehicleId);
    if (!vehicle) return;

    const ritmo = computeKmPerDay(recientes, vehicle.kmPerDay);
    if (ritmo !== vehicle.kmPerDay) {
      await this.vehicles.updateKmRate(vehicleId, ritmo, 'MEASURED');
    }
  }

  /**
   * Comando de mantenimiento. Si el espejo se desincroniza alguna vez (una
   * migración, un arreglo a mano en producción), se repara con esto y no con
   * un UPDATE manual. Devuelve cuántos vehículos recorrió.
   */
  async recomputeAllCycles(): Promise<number> {
    const ids = await this.vehicles.listAllIds();
    for (const id of ids) await this.syncVehicleCycle(id);
    return ids.length;
  }
}
