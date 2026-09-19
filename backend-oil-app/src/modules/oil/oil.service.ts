// Orquesta el dominio del aceite: carga lo que hace falta, se lo pasa al
// calculador y arma el bloque. Las reglas viven acá; el controlador solo habla
// HTTP y el calculador solo hace aritmética.
import { Inject, Injectable } from '@nestjs/common';
import { Errors } from '../../common/errors';
import { OilCycleService } from './oil-cycle.service';
import {
  OIL_CHANGE_REPOSITORY,
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
}
