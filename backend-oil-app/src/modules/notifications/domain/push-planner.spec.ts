import type { OilStatus } from '../../oil/domain/oil-status';
import {
  DEFAULT_PREFS,
  type NotificationPrefs,
  type PlannerVehicle,
} from './push-message';
import { planPushes } from './push-planner';

const AHORA = new Date('2026-09-20T13:00:00.000Z'); // domingo
const CICLO = { changedAt: new Date('2026-03-01T00:00:00.000Z'), km: 40_000 };

/** Arma un OilStatus a mano: el planificador no calcula el medidor, lo lee. */
const status = (g: {
  kmLeft: number;
  daysLeft: number;
  asOf?: Date;
}): OilStatus => ({
  computedAt: AHORA,
  gauge: {
    pct: 20,
    status: g.kmLeft <= 0 || g.daysLeft <= 0 ? 'danger' : 'warn',
    limitedBy: 'km',
    kmLeft: g.kmLeft,
    daysLeft: g.daysLeft,
  },
  odometer: {
    km: 44_500,
    source: 'estimated',
    asOf: g.asOf ?? new Date('2026-09-15T00:00:00.000Z'),
  },
});

const vehiculo = (over: Partial<PlannerVehicle> = {}): PlannerVehicle => ({
  id: 'veh-1',
  label: 'Toyota Corolla',
  kmPerDay: 40,
  lastChangeKm: CICLO.km,
  lastChangeAt: CICLO.changedAt,
  status: status({ kmLeft: 300, daysLeft: 60 }),
  ...over,
});

const plan = (
  over: {
    vehicles?: PlannerVehicle[];
    prefs?: Partial<NotificationPrefs>;
    yaEnviado?: string[];
    now?: Date;
  } = {},
) =>
  planPushes({
    now: over.now ?? AHORA,
    userId: 'user-1',
    prefs: { ...DEFAULT_PREFS, ...(over.prefs ?? {}) },
    vehicles: over.vehicles ?? [vehiculo()],
    yaEnviado: new Set(over.yaEnviado ?? []),
  });

describe('planPushes', () => {
  describe('el interruptor maestro', () => {
    it('apagado no genera nada, sin caso especial por tipo', () => {
      expect(plan({ prefs: { enabled: false } })).toEqual([]);
    });
  });

  describe('cerca y vencido son mutuamente excluyentes', () => {
    it('un vehículo cerca del límite genera solo warn', () => {
      const r = plan({
        vehicles: [vehiculo({ status: status({ kmLeft: 300, daysLeft: 60 }) })],
      });
      expect(r.map((m) => m.kind)).toEqual(['warn']);
    });

    it('un vehículo pasado del límite genera solo overdue', () => {
      const r = plan({
        vehicles: [
          vehiculo({ status: status({ kmLeft: -800, daysLeft: 20 }) }),
        ],
      });
      expect(r.map((m) => m.kind)).toEqual(['overdue']);
    });

    it('por encima del umbral no genera nada', () => {
      const r = plan({
        vehicles: [
          vehiculo({ status: status({ kmLeft: 2_000, daysLeft: 90 }) }),
        ],
      });
      expect(r).toEqual([]);
    });

    it('un vehículo sin ciclo no genera nada: no hay nada que vencer', () => {
      const sinCiclo: OilStatus = {
        computedAt: AHORA,
        gauge: null,
        odometer: null,
      };
      expect(plan({ vehicles: [vehiculo({ status: sinCiclo })] })).toEqual([]);
    });
  });

  describe('la firma es del hecho, no del texto', () => {
    // EL test de este archivo. Si la firma dependiera del cuerpo del mensaje,
    // el km proyectado cambiaría mañana, la firma también, y al usuario le
    // llegaría el mismo aviso TODOS LOS DÍAS hasta que cambie el aceite.
    it('el warn no se repite aunque el km proyectado haya cambiado', () => {
      const hoy = plan({
        vehicles: [vehiculo({ status: status({ kmLeft: 300, daysLeft: 60 }) })],
      });
      const manana = plan({
        vehicles: [vehiculo({ status: status({ kmLeft: 260, daysLeft: 59 }) })],
        yaEnviado: [hoy[0].sig],
      });
      expect(manana).toEqual([]);
    });

    it('cambiar el aceite arranca ciclo nuevo y el warn vuelve a salir', () => {
      const viejo = plan({ vehicles: [vehiculo()] });
      const nuevoCiclo = vehiculo({
        lastChangeKm: 45_000,
        lastChangeAt: new Date('2026-09-18T00:00:00.000Z'),
        status: status({ kmLeft: 300, daysLeft: 60 }),
      });
      const r = plan({ vehicles: [nuevoCiclo], yaEnviado: [viejo[0].sig] });
      expect(r.map((m) => m.kind)).toEqual(['warn']);
    });

    it('pasar de cerca a vencido sí avisa: son hechos distintos', () => {
      const warn = plan({
        vehicles: [vehiculo({ status: status({ kmLeft: 300, daysLeft: 60 }) })],
      });
      const r = plan({
        vehicles: [vehiculo({ status: status({ kmLeft: -10, daysLeft: 40 }) })],
        yaEnviado: [warn[0].sig],
      });
      expect(r.map((m) => m.kind)).toEqual(['overdue']);
    });
  });

  describe('el vencido vuelve cada 14 días, no cada día', () => {
    // kmPerDay 40 y kmLeft -520 son 13 días vencido: mismo tramo que el día 0.
    it('al día 13 sigue siendo el mismo aviso', () => {
      const dia0 = plan({
        vehicles: [vehiculo({ status: status({ kmLeft: -40, daysLeft: 30 }) })],
      });
      const dia13 = plan({
        vehicles: [
          vehiculo({ status: status({ kmLeft: -520, daysLeft: 17 }) }),
        ],
        yaEnviado: [dia0[0].sig],
      });
      expect(dia13).toEqual([]);
    });

    it('al día 14 el aviso vuelve', () => {
      const dia0 = plan({
        vehicles: [vehiculo({ status: status({ kmLeft: -40, daysLeft: 30 }) })],
      });
      const dia14 = plan({
        vehicles: [
          vehiculo({ status: status({ kmLeft: -600, daysLeft: 16 }) }),
        ],
        yaEnviado: [dia0[0].sig],
      });
      expect(dia14.map((m) => m.kind)).toEqual(['overdue']);
    });

    it('cuenta por el eje que lleva más tiempo vencido', () => {
      // Vencido por tiempo hace 20 días y por km hace 1: manda el de 20.
      const r = plan({
        vehicles: [
          vehiculo({ status: status({ kmLeft: -40, daysLeft: -20 }) }),
        ],
      });
      expect(r[0].sig).toContain(':1'); // floor(20 / 14) = 1
    });
  });

  describe('el checkin pide confirmar el kilometraje', () => {
    const conLecturaVieja = () =>
      vehiculo({
        status: status({
          kmLeft: 5_000,
          daysLeft: 90,
          asOf: new Date('2026-07-01T00:00:00.000Z'),
        }),
      });

    it('sale el día de la semana configurado si la lectura está vieja', () => {
      const r = plan({
        vehicles: [conLecturaVieja()],
        prefs: { checkinWeekday: 1 }, // domingo, y AHORA es domingo
      });
      expect(r.map((m) => m.kind)).toEqual(['checkin']);
    });

    it('calla si la última lectura es reciente: no hay nada que pedir', () => {
      const r = plan({
        vehicles: [
          vehiculo({
            status: status({
              kmLeft: 5_000,
              daysLeft: 90,
              asOf: new Date('2026-09-15T00:00:00.000Z'),
            }),
          }),
        ],
        prefs: { checkinWeekday: 1 },
      });
      expect(r).toEqual([]);
    });

    it('no sale los demás días de la semana', () => {
      const r = plan({
        vehicles: [conLecturaVieja()],
        prefs: { checkinWeekday: 3 }, // martes
      });
      expect(r).toEqual([]);
    });

    it('sale una sola vez por semana', () => {
      const vehs = [conLecturaVieja()];
      const primero = plan({ vehicles: vehs, prefs: { checkinWeekday: 1 } });
      const segundo = plan({
        vehicles: vehs,
        prefs: { checkinWeekday: 1 },
        yaEnviado: [primero[0].sig],
      });
      expect(segundo).toEqual([]);
    });
  });

  describe('cada interruptor apaga solo lo suyo', () => {
    it('warnEnabled en false calla el warn', () => {
      expect(plan({ prefs: { warnEnabled: false } })).toEqual([]);
    });

    it('overdueEnabled en false calla el vencido', () => {
      const r = plan({
        vehicles: [
          vehiculo({ status: status({ kmLeft: -800, daysLeft: 20 }) }),
        ],
        prefs: { overdueEnabled: false },
      });
      expect(r).toEqual([]);
    });

    it('checkinEnabled en false calla el checkin', () => {
      const r = plan({
        vehicles: [
          vehiculo({
            status: status({
              kmLeft: 5_000,
              daysLeft: 90,
              asOf: new Date('2026-07-01T00:00:00.000Z'),
            }),
          }),
        ],
        prefs: { checkinEnabled: false, checkinWeekday: 1 },
      });
      expect(r).toEqual([]);
    });
  });

  describe('el mensaje lleva a dónde ir', () => {
    it('el warn navega al detalle del vehículo', () => {
      const r = plan();
      expect(r[0].data).toEqual({
        screen: 'VehicleDetail',
        vehicleId: 'veh-1',
      });
      expect(r[0].vehicleId).toBe('veh-1');
    });

    it('el checkin es del usuario, no de un vehículo', () => {
      const r = plan({
        vehicles: [
          vehiculo({
            status: status({
              kmLeft: 5_000,
              daysLeft: 90,
              asOf: new Date('2026-07-01T00:00:00.000Z'),
            }),
          }),
        ],
        prefs: { checkinWeekday: 1 },
      });
      expect(r[0].vehicleId).toBeNull();
      expect(r[0].data).toEqual({ screen: 'Alerts' });
    });
  });
});
