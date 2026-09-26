import 'dotenv/config';
// Mismo motivo que en auth.e2e: debe fijarse ANTES de importar AppModule.
process.env.THROTTLE_AUTH_LIMIT = '1000';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { PrismaService } from '../src/infra/prisma/prisma.service';
import { emailE2E, limpiarUsuariosE2E } from './support/e2e-db';

type Suscripcion = {
  plan: { id: string; maxVehicles: number | null };
  subscribedPlan: string;
  status: string;
  usage: { vehicles: number; changesThisMonth: number };
};

describe('Planes y topes (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const http = () =>
    request(app.getHttpServer() as Parameters<typeof request>[0]);

  const registrar = async (): Promise<{ token: string; userId: string }> => {
    const r = await http()
      .post('/api/v1/auth/register')
      .send({
        fullName: 'Ana Pérez',
        cedula: `V${Math.floor(10_000_000 + Math.random() * 89_999_999)}`,
        email: emailE2E('plan'),
        phone: '+58 414 528 9012',
        state: 'Distrito Capital',
        city: 'Caracas',
        password: 'Clave#2026',
      })
      .expect(201);
    const body = r.body as { accessToken: string; user: { id: string } };
    return { token: body.accessToken, userId: body.user.id };
  };

  const crearVehiculo = (token: string, i: number) =>
    http()
      .post('/api/v1/vehicles')
      .set('Authorization', `Bearer ${token}`)
      .send({
        kind: 'CAR',
        brand: 'Toyota',
        model: 'Corolla',
        year: 2019,
        plate: `PL${i}${Math.floor(100 + Math.random() * 899)}`,
        color: '#1E88E5',
        kmPerDay: 40,
      });

  const suscripcion = async (token: string): Promise<Suscripcion> =>
    (
      await http()
        .get('/api/v1/me/subscription')
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
    ).body as Suscripcion;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new AllExceptionsFilter());
    // Escucha UNA vez y atado a 127.0.0.1, no app.init(): ver test/setup-env.ts.
    await app.listen(0, '127.0.0.1');
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await limpiarUsuariosE2E(prisma);
    await app.close();
  });

  it('GET /plans trae el gratis primero y el pro sin topes', async () => {
    const { token } = await registrar();
    const r = await http()
      .get('/api/v1/plans')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const planes = r.body as { id: string; maxVehicles: number | null }[];
    expect(planes.map((p) => [p.id, p.maxVehicles])).toEqual([
      ['FREE', 5],
      ['PRO', null],
    ]);
  });

  it('una cuenta nueva está en el gratis, sin fila de suscripción', async () => {
    const { token, userId } = await registrar();
    const s = await suscripcion(token);
    expect(s).toMatchObject({
      plan: { id: 'FREE' },
      subscribedPlan: 'FREE',
      status: 'active',
      usage: { vehicles: 0, changesThisMonth: 0 },
    });
    expect(
      await prisma.subscription.findUnique({ where: { userId } }),
    ).toBeNull();
  });

  it('el gratis no pasa de 5 vehículos; el pro sí', async () => {
    const { token, userId } = await registrar();
    for (let i = 0; i < 5; i++) await crearVehiculo(token, i).expect(201);

    const sexto = await crearVehiculo(token, 5).expect(403);
    expect((sexto.body as { error: string }).error).toBe(
      'VEHICLE_LIMIT_REACHED',
    );
    expect((await suscripcion(token)).usage.vehicles).toBe(5);

    await prisma.subscription.create({ data: { userId, plan: 'PRO' } });
    await crearVehiculo(token, 5).expect(201);
    expect((await suscripcion(token)).plan.id).toBe('PRO');
  });

  it('un pro vencido vuelve a los topes del gratis', async () => {
    const { token, userId } = await registrar();
    await prisma.subscription.create({
      data: {
        userId,
        plan: 'PRO',
        expiresAt: new Date('2026-01-01T00:00:00Z'),
      },
    });
    for (let i = 0; i < 5; i++) await crearVehiculo(token, i).expect(201);
    await crearVehiculo(token, 5).expect(403);

    expect(await suscripcion(token)).toMatchObject({
      plan: { id: 'FREE' },
      subscribedPlan: 'PRO',
      status: 'expired',
    });
  });

  it('cuenta los cambios del mes y corta en el décimo', async () => {
    const { token } = await registrar();
    const v = await crearVehiculo(token, 0).expect(201);
    const id = (v.body as { id: string }).id;
    const hoy = new Date();

    for (let i = 0; i < 10; i++) {
      await http()
        .post(`/api/v1/vehicles/${id}/oil-changes`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          changedAt: hoy.toISOString(),
          km: 45000 + i * 100,
          intervalKm: 5000,
          intervalMonths: 6,
          oilBrand: 'Pennzoil',
          oilTag: 'Platinum',
          oilViscosity: '5W-30',
          oilSynthetic: true,
        })
        .expect(201);
    }
    expect((await suscripcion(token)).usage.changesThisMonth).toBe(10);

    const onceavo = await http()
      .post(`/api/v1/vehicles/${id}/oil-changes`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        changedAt: hoy.toISOString(),
        km: 47000,
        intervalKm: 5000,
        intervalMonths: 6,
        oilBrand: 'Pennzoil',
        oilTag: 'Platinum',
        oilViscosity: '5W-30',
        oilSynthetic: true,
      })
      .expect(403);
    expect((onceavo.body as { error: string }).error).toBe(
      'OIL_CHANGE_LIMIT_REACHED',
    );
  });
});
