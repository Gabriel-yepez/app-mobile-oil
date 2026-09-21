import { Test } from '@nestjs/testing';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { ODOMETER_REPOSITORY } from '../oil/domain/odometer.repository';
import { OIL_CHANGE_REPOSITORY } from '../oil/domain/oil-change.repository';
import {
  VEHICLE_REPOSITORY,
  type Vehicle,
} from '../oil/domain/vehicle.repository';
import { PushDispatchService } from './push-dispatch.service';
import { PushSweepService } from './push-sweep.service';

const AHORA = new Date('2026-09-22T13:00:00.000Z');

const vehiculos: Vehicle[] = [
  {
    id: 'veh-1',
    userId: 'user-1',
    kind: 'CAR',
    brand: 'Toyota',
    model: 'Corolla',
    year: 2018,
    plate: 'AB123CD',
    color: 'Gris',
    kmPerDay: 40,
    kmPerDaySource: 'DECLARED',
    lastChangeKm: 45_000,
    lastChangeAt: new Date('2026-03-01T00:00:00.000Z'),
    nextChangeKm: 50_000,
    nextChangeDueAt: new Date('2026-09-01T00:00:00.000Z'),
  },
  {
    id: 'veh-2',
    userId: 'user-2',
    kind: 'MOTO',
    brand: 'Bera',
    model: 'BR200',
    year: 2021,
    plate: 'ZZ999ZZ',
    color: 'Negro',
    kmPerDay: 15,
    kmPerDaySource: 'DECLARED',
    lastChangeKm: 8_000,
    lastChangeAt: new Date('2026-08-01T00:00:00.000Z'),
    nextChangeKm: 10_000,
    nextChangeDueAt: new Date('2027-02-01T00:00:00.000Z'),
  },
];

/** Arma el módulo con los dobles justos. `lock` decide si se concede. */
const armar = async (opts: {
  despachar: (userId: string) => Promise<unknown>;
  lock?: boolean;
}) => {
  const mod = await Test.createTestingModule({
    providers: [
      PushSweepService,
      {
        provide: PushDispatchService,
        useValue: { despacharUsuario: opts.despachar },
      },
      {
        provide: VEHICLE_REPOSITORY,
        useValue: {
          findAll: () => Promise.resolve(vehiculos),
          findByUser: (u: string) =>
            Promise.resolve(vehiculos.filter((v) => v.userId === u)),
        },
      },
      {
        provide: OIL_CHANGE_REPOSITORY,
        useValue: { findLatest: () => Promise.resolve(null) },
      },
      {
        provide: ODOMETER_REPOSITORY,
        useValue: { findLatest: () => Promise.resolve(null) },
      },
      {
        provide: PrismaService,
        useValue: {
          $queryRaw: () =>
            Promise.resolve([{ pg_try_advisory_lock: opts.lock ?? true }]),
          $executeRaw: () => Promise.resolve(1),
        },
      },
    ],
  }).compile();

  return mod.get(PushSweepService);
};

describe('PushSweepService', () => {
  it('despacha una vez por usuario, no una vez por vehículo', async () => {
    const despachos: string[] = [];
    const service = await armar({
      despachar: (userId) => {
        despachos.push(userId);
        return Promise.resolve({
          planificados: 1,
          enviados: 1,
          fallidos: 0,
          tokensApagados: 0,
        });
      },
    });

    const r = await service.run(AHORA);

    expect(despachos.sort()).toEqual(['user-1', 'user-2']);
    expect(r.usuarios).toBe(2);
  });

  // Con dos instancias del API, las dos despiertan a las 9:00. Sin el lock, al
  // usuario le llegan dos notificaciones idénticas.
  it('sin el lock no despacha a nadie', async () => {
    const despachos: string[] = [];
    const service = await armar({
      lock: false,
      despachar: (userId) => {
        despachos.push(userId);
        return Promise.resolve({});
      },
    });

    const r = await service.run(AHORA);

    expect(despachos).toEqual([]);
    expect(r.usuarios).toBe(0);
  });

  it('un usuario que revienta no aborta el barrido', async () => {
    const despachos: string[] = [];
    const service = await armar({
      despachar: (userId) => {
        if (userId === 'user-1') return Promise.reject(new Error('boom'));
        despachos.push(userId);
        return Promise.resolve({
          planificados: 0,
          enviados: 0,
          fallidos: 0,
          tokensApagados: 0,
        });
      },
    });

    await expect(service.run(AHORA)).resolves.toBeDefined();
    expect(despachos).toEqual(['user-2']);
  });

  // El lock se suelta pase lo que pase: si quedara tomado, el barrido de
  // mañana se saltaría solo y nadie recibiría nada nunca más.
  it('suelta el lock aunque el barrido reviente entero', async () => {
    let soltado = false;
    const mod = await Test.createTestingModule({
      providers: [
        PushSweepService,
        { provide: PushDispatchService, useValue: { despacharUsuario: jest.fn() } },
        {
          provide: VEHICLE_REPOSITORY,
          useValue: {
            findAll: () => Promise.reject(new Error('base caída')),
          },
        },
        {
          provide: OIL_CHANGE_REPOSITORY,
          useValue: { findLatest: () => Promise.resolve(null) },
        },
        {
          provide: ODOMETER_REPOSITORY,
          useValue: { findLatest: () => Promise.resolve(null) },
        },
        {
          provide: PrismaService,
          useValue: {
            $queryRaw: () =>
              Promise.resolve([{ pg_try_advisory_lock: true }]),
            $executeRaw: () => {
              soltado = true;
              return Promise.resolve(1);
            },
          },
        },
      ],
    }).compile();

    await expect(mod.get(PushSweepService).run(AHORA)).rejects.toThrow(
      'base caída',
    );
    expect(soltado).toBe(true);
  });
});
