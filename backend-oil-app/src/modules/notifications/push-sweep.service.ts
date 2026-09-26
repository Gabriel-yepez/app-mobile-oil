// El barrido diario. No lo llama el @Cron por lógica sino por delegación: esto
// es un método normal, así que un test —o un endpoint el día que haga falta— lo
// puede llamar igual.
import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { computeOilStatus } from '../oil/domain/oil-status.calculator';
import {
  ODOMETER_REPOSITORY,
  type OdometerRepository,
} from '../oil/domain/odometer.repository';
import {
  OIL_CHANGE_REPOSITORY,
  type OilChangeRepository,
} from '../oil/domain/oil-change.repository';
import {
  VEHICLE_REPOSITORY,
  type Vehicle,
  type VehicleRepository,
} from '../oil/domain/vehicle.repository';
import type { PlannerVehicle } from './domain/push-message';
import { PushDispatchService } from './push-dispatch.service';

/** Cualquier número fijo sirve; solo tiene que ser el mismo en toda instancia. */
const LOCK_BARRIDO = 815_243;

@Injectable()
export class PushSweepService {
  private readonly log = new Logger(PushSweepService.name);

  constructor(
    private readonly dispatch: PushDispatchService,
    @Inject(VEHICLE_REPOSITORY) private readonly vehicles: VehicleRepository,
    @Inject(OIL_CHANGE_REPOSITORY)
    private readonly changes: OilChangeRepository,
    @Inject(ODOMETER_REPOSITORY) private readonly odometer: OdometerRepository,
    private readonly prisma: PrismaService,
  ) {}

  /** Traduce un vehículo del dominio a lo que el planificador entiende. */
  private async aPlanner(v: Vehicle, now: Date): Promise<PlannerVehicle> {
    const [ultimo, lectura] = await Promise.all([
      this.changes.findLatest(v.id),
      this.odometer.findLatest(v.id),
    ]);

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
      id: v.id,
      label: `${v.brand} ${v.model}`,
      kmPerDay: v.kmPerDay,
      lastChangeKm: v.lastChangeKm,
      lastChangeAt: v.lastChangeAt,
      alertSnoozedUntil: v.alertSnoozedUntil,
      status,
    };
  }

  /** Los vehículos de un usuario, listos para el planificador. */
  async vehiculosDe(userId: string, now: Date): Promise<PlannerVehicle[]> {
    const suyos = await this.vehicles.findByUser(userId);
    return Promise.all(suyos.map((v) => this.aPlanner(v, now)));
  }

  async run(
    now: Date = new Date(),
  ): Promise<{ usuarios: number; enviados: number }> {
    // Con más de una instancia del API, las dos despiertan a las 9:00 y al
    // usuario le llegarían dos notificaciones idénticas.
    const [{ pg_try_advisory_lock: concedido }] = await this.prisma.$queryRaw<
      { pg_try_advisory_lock: boolean }[]
    >`SELECT pg_try_advisory_lock(${LOCK_BARRIDO})`;

    if (!concedido) {
      this.log.log('Barrido saltado: otra instancia lo está corriendo.');
      return { usuarios: 0, enviados: 0 };
    }

    try {
      const todos = await this.vehicles.findAll();

      const porUsuario = new Map<string, Vehicle[]>();
      for (const v of todos) {
        const lista = porUsuario.get(v.userId) ?? [];
        lista.push(v);
        porUsuario.set(v.userId, lista);
      }

      let usuarios = 0;
      let enviados = 0;

      for (const [userId, suyos] of porUsuario) {
        try {
          const planner = await Promise.all(
            suyos.map((v) => this.aPlanner(v, now)),
          );
          const r = await this.dispatch.despacharUsuario(userId, planner, now);
          usuarios++;
          enviados += r.enviados;
        } catch (e) {
          // Un usuario con datos raros no puede dejar sin avisos a los demás.
          this.log.error(`Barrido: falló el usuario ${userId}`, e as Error);
        }
      }

      this.log.log(`Barrido: ${usuarios} usuarios, ${enviados} envíos.`);
      return { usuarios, enviados };
    } finally {
      // Se suelta pase lo que pase: un lock que queda tomado haría que el
      // barrido de mañana se saltara solo, y nadie recibiría nada nunca más.
      await this.prisma.$executeRaw`SELECT pg_advisory_unlock(${LOCK_BARRIDO})`;
    }
  }
}
