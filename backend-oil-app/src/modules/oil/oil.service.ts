// Orquesta el dominio del aceite: carga lo que hace falta, se lo pasa al
// calculador y arma el bloque. Las reglas viven acá; el controlador solo habla
// HTTP y el calculador solo hace aritmética.
import { Inject, Injectable } from '@nestjs/common';
import { Errors } from '../../common/errors';
import { daysBetween } from './domain/dates';
import { computeOilStatus } from './domain/oil-status.calculator';
import { KM_PER_DAY_MAX } from './domain/oil-status';
import type { OilStatusResponseDto } from './dto/oil-status-response.dto';
import { OilCycleService } from './oil-cycle.service';
import {
  OIL_CHANGE_REPOSITORY,
  type NewOilChange,
  type OilChangePage,
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

  /**
   * Crea el vehículo, de forma IDEMPOTENTE cuando la app manda el id.
   *
   * Eso es lo que hace segura la cola de escrituras: si el envío se cortó
   * DESPUÉS de que el servidor guardó, el reintento tiene que ser inofensivo
   * y no un duplicado.
   */
  async createVehicle(
    userId: string,
    data: Omit<NewVehicle, 'userId'> & { id?: string },
  ): Promise<Vehicle> {
    return (await this.createVehicleIdempotent(userId, data)).vehicle;
  }

  /**
   * Igual que createVehicle, pero además dice si CREÓ o reusó.
   *
   * El controlador lo necesita para responder 201 o 200: el 200 es la señal
   * de "esto ya estaba, tu reintento llegó tarde y no pasó nada malo", y la
   * app lo trata como éxito en vez de como conflicto.
   */
  async createVehicleIdempotent(
    userId: string,
    data: Omit<NewVehicle, 'userId'> & { id?: string },
  ): Promise<{ vehicle: Vehicle; created: boolean }> {
    if (data.id) {
      const existente = await this.vehicles.findById(data.id);
      if (existente) {
        // De otro usuario: 404 y no 409, para no confirmar que ese id existe.
        if (existente.userId !== userId) throw Errors.vehicleNotFound();
        // Se devuelve tal cual está, sin aplicar el cuerpo nuevo: el reintento
        // no es una edición. Para eso está PATCH.
        return { vehicle: existente, created: false };
      }
    }

    if (await this.vehicles.findByPlate(userId, data.plate)) {
      throw Errors.plateTaken();
    }

    return {
      vehicle: await this.vehicles.create({ ...data, userId }),
      created: true,
    };
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
    data: Omit<NewOilChange, 'vehicleId'> & { id?: string },
  ): Promise<OilChangeRecord> {
    return (await this.registerOilChangeIdempotent(userId, vehicleId, data))
      .change;
  }

  /** Igual, pero dice si registró o reusó, para que el controlador elija
   *  entre 201 y 200. Ver createVehicleIdempotent. */
  async registerOilChangeIdempotent(
    userId: string,
    vehicleId: string,
    data: Omit<NewOilChange, 'vehicleId'> & { id?: string },
  ): Promise<{ change: OilChangeRecord; created: boolean }> {
    await this.getOwnedVehicle(userId, vehicleId);

    // Mismo motivo que en createVehicle, pero acá el duplicado es peor: serían
    // dos ciclos abiertos y la barra reiniciada sin que el usuario tocara nada.
    if (data.id) {
      const existente = await this.changes.findById(data.id);
      if (existente) {
        await this.getOwnedVehicle(userId, existente.vehicleId);
        return { change: existente, created: false };
      }
    }

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
    return { change: creado, created: true };
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

  /** Historial del vehículo, del más nuevo al más viejo. */
  async listOilChanges(
    userId: string,
    vehicleId: string,
    opts: { cursor?: string; limit?: number } = {},
  ): Promise<OilChangePage> {
    await this.getOwnedVehicle(userId, vehicleId);
    // Tope duro: sin esto, un `limit=100000` es una descarga de toda la tabla
    // disfrazada de consulta normal.
    const limit = Math.min(Math.max(opts.limit ?? 20, 1), 100);
    return this.changes.findPage(vehicleId, { cursor: opts.cursor, limit });
  }

  /**
   * El bloque entero del inicio en una sola llamada.
   *
   * @param now solo para tests. En producción no se pasa: probar "el 2 de
   *            diciembre esto está en rojo" no puede depender del reloj del
   *            proceso.
   */
  async getOilStatus(
    userId: string,
    vehicleId: string,
    now: Date = new Date(),
  ): Promise<OilStatusResponseDto> {
    const vehicle = await this.getOwnedVehicle(userId, vehicleId);
    const ultimo = await this.changes.findLatest(vehicleId);
    const lectura = await this.odometer.findLatest(vehicleId);

    const status = computeOilStatus({
      now,
      kmPerDay: vehicle.kmPerDay,
      lastReading: lectura ? { km: lectura.km, readAt: lectura.readAt } : null,
      cycle: ultimo
        ? {
            km: ultimo.km,
            changedAt: ultimo.changedAt,
            intervalKm: ultimo.intervalKm,
            intervalMonths: ultimo.intervalMonths,
          }
        : null,
    });

    return {
      vehicleId,
      computedAt: status.computedAt,
      gauge: status.gauge,
      odometer: status.odometer,
      // Los límites del ciclo salen del espejo del vehículo: es exactamente
      // para esto que se persisten en vez de derivarse acá.
      cycle: ultimo
        ? {
            lastChangeKm: vehicle.lastChangeKm,
            lastChangeAt: vehicle.lastChangeAt,
            nextChangeKm: vehicle.nextChangeKm,
            nextChangeDueAt: vehicle.nextChangeDueAt,
            intervalKm: ultimo.intervalKm,
            intervalMonths: ultimo.intervalMonths,
          }
        : null,
      oil: ultimo
        ? {
            brand: ultimo.oilBrand,
            tag: ultimo.oilTag,
            viscosity: ultimo.oilViscosity,
            synthetic: ultimo.oilSynthetic,
          }
        : null,
    };
  }

  /**
   * La lectura manual: la puerta que le dejamos abierta al usuario para el día
   * que SÍ mire el tablero. No se la exigimos —ese es justo el dato que no
   * tiene a mano—, pero cuando llega, la estimación deja de acumular error.
   */
  async reportOdometer(
    userId: string,
    vehicleId: string,
    km: number,
    now: Date = new Date(),
  ): Promise<OilStatusResponseDto> {
    await this.getOwnedVehicle(userId, vehicleId);

    const anterior = await this.odometer.findLatest(vehicleId);
    if (anterior) {
      if (km < anterior.km) throw Errors.odometerBackwards();

      // El piso de una hora evita que dos lecturas seguidas den una división
      // cercana a cero y disparen IMPLAUSIBLE por un salto normal.
      const dias = Math.max(daysBetween(anterior.readAt, now), 1 / 24);
      if ((km - anterior.km) / dias > KM_PER_DAY_MAX) {
        throw Errors.odometerImplausible();
      }
    }

    await this.odometer.create({
      vehicleId,
      km,
      readAt: now,
      source: 'MANUAL',
    });
    return this.getOilStatus(userId, vehicleId, now);
  }
}
