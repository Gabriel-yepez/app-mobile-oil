// Orquesta el dominio del aceite: carga lo que hace falta, se lo pasa al
// calculador y arma el bloque. Las reglas viven acá; el controlador solo habla
// HTTP y el calculador solo hace aritmética.
import { Inject, Injectable } from '@nestjs/common';
import { Errors } from '../../common/errors';
import { OilCycleService } from './oil-cycle.service';
import {
  OIL_CHANGE_REPOSITORY,
  type NewOilChange,
  type OilChangeRecord,
  type OilChangeRepository,
} from './domain/oil-change.repository';
import {
  ODOMETER_REPOSITORY,
  type OdometerRepository,
} from './domain/odometer.repository';
import {
  VEHICLE_REPOSITORY,
  type NewVehicle,
  type Vehicle,
  type VehicleRepository,
} from './domain/vehicle.repository';

@Injectable()
export class OilService {
  constructor(
    @Inject(VEHICLE_REPOSITORY) private readonly vehicles: VehicleRepository,
    @Inject(OIL_CHANGE_REPOSITORY)
    private readonly changes: OilChangeRepository,
    @Inject(ODOMETER_REPOSITORY)
    private readonly odometer: OdometerRepository,
    private readonly cycle: OilCycleService,
  ) {}

  /**
   * Toda ruta que reciba un :id de vehículo pasa por acá primero. Es el único
   * lugar donde se decide si el vehículo es tuyo, así que no puede olvidarse
   * en una ruta nueva sin que salte a la vista.
   */
  async getOwnedVehicle(userId: string, vehicleId: string): Promise<Vehicle> {
    const v = await this.vehicles.findById(vehicleId);
    if (!v || v.userId !== userId) throw Errors.vehicleNotFound();
    return v;
  }

  async createVehicle(
    userId: string,
    data: Omit<NewVehicle, 'userId'>,
  ): Promise<Vehicle> {
    return this.vehicles.create({ ...data, userId });
  }

  async listVehicles(userId: string): Promise<Vehicle[]> {
    return this.vehicles.findByUser(userId);
  }

  /**
   * Registra un cambio y deja el mundo coherente: escribe la lectura de
   * odómetro que el cambio implica y resincroniza el espejo del ciclo.
   *
   * Las tres escrituras van juntas a propósito. Un cambio sin su lectura deja
   * la proyección anclada a un odómetro viejo —la barra arrancaría el ciclo
   * nuevo ya gastada—, y un cambio sin sync deja la ficha del vehículo
   * mintiendo.
   */
  async registerOilChange(
    userId: string,
    vehicleId: string,
    data: Omit<NewOilChange, 'vehicleId'>,
  ): Promise<OilChangeRecord> {
    await this.getOwnedVehicle(userId, vehicleId);

    const anterior = await this.changes.findLatest(vehicleId);
    if (anterior && data.km < anterior.km) throw Errors.oilChangeBackwards();

    const creado = await this.changes.create({ ...data, vehicleId });
    await this.odometer.create({
      vehicleId,
      km: data.km,
      readAt: data.changedAt,
      source: 'OIL_CHANGE',
    });
    await this.cycle.syncVehicleCycle(vehicleId);
    return creado;
  }

  /** El caso real: puso 48.000 y eran 45.000. */
  async updateOilChange(
    userId: string,
    changeId: string,
    patch: Partial<Omit<NewOilChange, 'vehicleId'>>,
  ): Promise<OilChangeRecord> {
    const existente = await this.changes.findById(changeId);
    // Mismo 404 que el vehículo ajeno, y por la misma razón: no confirmar que
    // ese id existe.
    if (!existente) throw Errors.vehicleNotFound();
    await this.getOwnedVehicle(userId, existente.vehicleId);

    const actualizado = await this.changes.update(changeId, patch);
    await this.cycle.syncVehicleCycle(existente.vehicleId);
    return actualizado;
  }

  async removeOilChange(userId: string, changeId: string): Promise<void> {
    const existente = await this.changes.findById(changeId);
    if (!existente) throw Errors.vehicleNotFound();
    await this.getOwnedVehicle(userId, existente.vehicleId);

    await this.changes.remove(changeId);
    await this.cycle.syncVehicleCycle(existente.vehicleId);
  }
}
