// Orquesta el dominio del aceite: carga lo que hace falta, se lo pasa al
// calculador y arma el bloque. Las reglas viven acá; el controlador solo habla
// HTTP y el calculador solo hace aritmética.
import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { Errors } from '../../common/errors';
import { PushEventNotifier } from '../notifications/push-event-notifier.service';
import { daysBetween } from './domain/dates';
import { computeOilStatus } from './domain/oil-status.calculator';
import { conAlertaResuelta, type OilChangeView } from './domain/resolved-alert';
import { KM_PER_DAY_MAX } from './domain/oil-status';
import type { OilStatusResponseDto } from './dto/oil-status-response.dto';
import {
  toVehicleResponse,
  type VehicleResponseDto,
} from './dto/vehicle-response.dto';
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
    // forwardRef porque NotificationsModule importa OilModule para leer
    // vehículos, ciclos y odómetro: el ciclo entre los dos módulos es real y
    // esta es la forma en que Nest lo resuelve.
    @Inject(forwardRef(() => PushEventNotifier))
    private readonly push: PushEventNotifier,
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

  /**
   * Edita la ficha. NO toca el espejo del ciclo ni el historial: eso se cambia
   * registrando o corrigiendo un cambio de aceite, no editando la ficha.
   */
  async updateVehicle(
    userId: string,
    vehicleId: string,
    patch: Partial<Omit<NewVehicle, 'userId'>>,
  ): Promise<Vehicle> {
    await this.getOwnedVehicle(userId, vehicleId);
    return this.vehicles.update(vehicleId, {
      ...patch,
      // Si pisó el ritmo a mano, la fuente vuelve a declarada: el usuario está
      // sobrescribiendo lo medido a propósito, y el próximo ciclo medido lo
      // recalibra solo.
      ...(patch.kmPerDay !== undefined
        ? { kmPerDaySource: 'DECLARED' as const }
        : {}),
    });
  }

  async removeVehicle(userId: string, vehicleId: string): Promise<void> {
    await this.getOwnedVehicle(userId, vehicleId);
    await this.vehicles.remove(vehicleId);
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
  ): Promise<OilChangeView> {
    return (await this.registerOilChangeIdempotent(userId, vehicleId, data))
      .change;
  }

  /** Igual, pero dice si registró o reusó, para que el controlador elija
   *  entre 201 y 200. Ver createVehicleIdempotent. */
  async registerOilChangeIdempotent(
    userId: string,
    vehicleId: string,
    data: Omit<NewOilChange, 'vehicleId'> & { id?: string },
  ): Promise<{ change: OilChangeView; created: boolean }> {
    await this.getOwnedVehicle(userId, vehicleId);

    // Mismo motivo que en createVehicle, pero acá el duplicado es peor: serían
    // dos ciclos abiertos y la barra reiniciada sin que el usuario tocara nada.
    if (data.id) {
      const existente = await this.changes.findById(data.id);
      if (existente) {
        await this.getOwnedVehicle(userId, existente.vehicleId);
        return {
          change: await this.conAlertaResuelta(existente),
          created: false,
        };
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
    // Lo pospuesto era sobre el ciclo que este cambio cierra. Arrastrarlo al
    // nuevo podría callar una alerta que todavía ni existe.
    await this.vehicles.setAlertSnooze(vehicleId, null);
    // Después de sincronizar el ciclo: el aviso depende del ciclo nuevo.
    this.push.avisar(userId);
    // `anterior` es justo el ciclo que este cambio cierra.
    return { change: conAlertaResuelta(creado, anterior), created: true };
  }

  /** El caso real: puso 48.000 y eran 45.000. */
  async updateOilChange(
    userId: string,
    changeId: string,
    patch: Partial<Omit<NewOilChange, 'vehicleId'>>,
  ): Promise<OilChangeView> {
    const existente = await this.changes.findById(changeId);
    // Mismo 404 que el vehículo ajeno, y por la misma razón: no confirmar que
    // ese id existe.
    if (!existente) throw Errors.vehicleNotFound();
    await this.getOwnedVehicle(userId, existente.vehicleId);

    const actualizado = await this.changes.update(changeId, patch);
    await this.cycle.syncVehicleCycle(existente.vehicleId);
    return this.conAlertaResuelta(actualizado);
  }

  async removeOilChange(userId: string, changeId: string): Promise<void> {
    const existente = await this.changes.findById(changeId);
    if (!existente) throw Errors.vehicleNotFound();
    await this.getOwnedVehicle(userId, existente.vehicleId);

    await this.changes.remove(changeId);
    await this.cycle.syncVehicleCycle(existente.vehicleId);
  }

  /**
   * La lista con el estado de cada vehículo.
   *
   * Existe para que la pantalla de la flota sea UNA llamada y no una por
   * vehículo: con cinco vehículos, la diferencia entre abrir al instante y
   * abrir con cinco peticiones en vuelo.
   */
  async listVehiclesWithStatus(
    userId: string,
    now: Date = new Date(),
  ): Promise<VehicleResponseDto[]> {
    const vehiculos = await this.vehicles.findByUser(userId);
    return Promise.all(vehiculos.map((v) => this.conEstado(v, now)));
  }

  /** La ficha con su medidor y su odómetro, como la lista de la flota. */
  private async conEstado(v: Vehicle, now: Date): Promise<VehicleResponseDto> {
    const ultimo = await this.changes.findLatest(v.id);
    const lectura = await this.odometer.findLatest(v.id);
    const status = computeOilStatus({
      now,
      kmPerDay: v.kmPerDay,
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
      ...toVehicleResponse(v),
      gauge: status.gauge,
      odometer: status.odometer,
    };
  }

  /**
   * "Posponer" en Alertas: calla la alerta del vehículo `dias` días. Se
   * guarda acá y no en el teléfono porque lo que más importa callar son las
   * push, y esas las decide el servidor.
   *
   * Devuelve la ficha con su estado para que la app la reemplace en la lista
   * sin volver a pedir la flota.
   */
  async snoozeAlert(
    userId: string,
    vehicleId: string,
    dias: number,
    now: Date = new Date(),
  ): Promise<VehicleResponseDto> {
    await this.getOwnedVehicle(userId, vehicleId);
    const hasta = new Date(now.getTime() + dias * 86_400_000);
    return this.conEstado(
      await this.vehicles.setAlertSnooze(vehicleId, hasta),
      now,
    );
  }

  /** Deshace el posponer antes de tiempo. */
  async unsnoozeAlert(
    userId: string,
    vehicleId: string,
    now: Date = new Date(),
  ): Promise<VehicleResponseDto> {
    await this.getOwnedVehicle(userId, vehicleId);
    const v = await this.vehicles.setAlertSnooze(vehicleId, null);
    // La alerta vuelve a estar viva: que el planificador la mire ya y no
    // recién en el barrido de mañana.
    this.push.avisar(userId);
    return this.conEstado(v, now);
  }

  /** Historial del vehículo, del más nuevo al más viejo. */
  async listOilChanges(
    userId: string,
    vehicleId: string,
    opts: { cursor?: string; limit?: number } = {},
  ): Promise<{ items: OilChangeView[]; nextCursor: string | null }> {
    await this.getOwnedVehicle(userId, vehicleId);
    // Tope duro: sin esto, un `limit=100000` es una descarga de toda la tabla
    // disfrazada de consulta normal.
    const limit = Math.min(Math.max(opts.limit ?? 20, 1), 100);
    const page = await this.changes.findPage(vehicleId, {
      cursor: opts.cursor,
      limit,
    });

    // Cada cambio necesita el que lo precedió, que en una lista del más nuevo
    // al más viejo es el de al lado. El del último vive en la página
    // siguiente: se pide solo si la hay, y es una fila.
    const despues = page.nextCursor
      ? await this.anteriorA(vehicleId, page.nextCursor)
      : null;

    return {
      items: page.items.map((c, i) =>
        conAlertaResuelta(c, page.items[i + 1] ?? despues),
      ),
      nextCursor: page.nextCursor,
    };
  }

  /** El cambio inmediatamente anterior (más viejo) a `changeId`, o null. */
  private async anteriorA(
    vehicleId: string,
    changeId: string,
  ): Promise<OilChangeRecord | null> {
    const { items } = await this.changes.findPage(vehicleId, {
      cursor: changeId,
      limit: 1,
    });
    return items[0] ?? null;
  }

  /** Un cambio suelto con su alerta resuelta: busca a su predecesor. */
  private async conAlertaResuelta(
    cambio: OilChangeRecord,
  ): Promise<OilChangeView> {
    return conAlertaResuelta(
      cambio,
      await this.anteriorA(cambio.vehicleId, cambio.id),
    );
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
    // Después de escribir, nunca antes: si se avisara primero, el planificador
    // leería el estado viejo y decidiría con datos que ya no son ciertos.
    this.push.avisar(userId);
    return this.getOilStatus(userId, vehicleId, now);
  }
}
