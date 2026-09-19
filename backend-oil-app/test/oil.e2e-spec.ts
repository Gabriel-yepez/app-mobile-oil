import 'dotenv/config';
// Mismo motivo que en auth.e2e: el e2e crea más cuentas por minuto que el
// límite real. Debe fijarse ANTES de importar AppModule.
process.env.THROTTLE_AUTH_LIMIT = '1000';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';

const nuevoUsuario = () => ({
  fullName: 'Luis Guerrero',
  cedula: `V${Math.floor(10_000_000 + Math.random() * 89_999_999)}`,
  email: `oil-${Date.now()}-${Math.floor(Math.random() * 1e6)}@correo.com`,
  phone: '+58 414 528 9012',
  state: 'Distrito Capital',
  city: 'Caracas',
  password: 'contrasena1',
});

const nuevoVehiculo = () => ({
  kind: 'CAR',
  brand: 'Toyota',
  model: 'Corolla',
  year: 2019,
  plate: `AB${Math.floor(1000 + Math.random() * 8999)}`,
  color: '#1E88E5',
  kmPerDay: 40,
});

// `res.body` de supertest es `any`: se tipan las respuestas para que un cambio
// de forma salga como error de tipos y no como un test que pasa de milagro.
type CuerpoVehiculo = { id: string; plate: string; kmPerDaySource: string };
type CuerpoEstado = {
  vehicleId: string;
  computedAt: string;
  gauge: {
    pct: number;
    status: 'ok' | 'warn' | 'danger';
    limitedBy: 'km' | 'time';
    kmLeft: number;
    daysLeft: number;
  } | null;
  odometer: { km: number; source: 'reported' | 'estimated' } | null;
  cycle: { nextChangeKm: number; intervalMonths: number } | null;
  oil: { viscosity: string; brand: string } | null;
};
type CuerpoError = { statusCode: number; error: string; message: string };

const veh = (r: request.Response): CuerpoVehiculo => r.body as CuerpoVehiculo;
const est = (r: request.Response): CuerpoEstado => r.body as CuerpoEstado;
const err = (r: request.Response): CuerpoError => r.body as CuerpoError;

describe('Estado del aceite (e2e)', () => {
  let app: INestApplication;
  const http = () =>
    request(app.getHttpServer() as Parameters<typeof request>[0]);

  let token: string;
  let vehiculoId: string;

  const registrar = async (): Promise<string> => {
    const r = await http()
      .post('/api/v1/auth/register')
      .send(nuevoUsuario())
      .expect(201);
    return (r.body as { accessToken: string }).accessToken;
  };

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
    await app.init();

    token = await registrar();
    const v = await http()
      .post('/api/v1/vehicles')
      .set('Authorization', `Bearer ${token}`)
      .send(nuevoVehiculo())
      .expect(201);
    vehiculoId = veh(v).id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('flujo completo: cambio → estado → lectura manual', async () => {
    await http()
      .post(`/api/v1/vehicles/${vehiculoId}/oil-changes`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        changedAt: '2026-06-04T00:00:00.000Z',
        km: 45000,
        intervalKm: 5000,
        intervalMonths: 6,
        oilBrand: 'Pennzoil',
        oilTag: 'Platinum',
        oilViscosity: '5W-30',
        oilSynthetic: true,
        shop: 'Lubricentro El Rápido',
        costUsd: 32,
      })
      .expect(201);

    const estado = await http()
      .get(`/api/v1/vehicles/${vehiculoId}/oil-status`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(est(estado).cycle?.nextChangeKm).toBe(50000);
    expect(est(estado).oil?.viscosity).toBe('5W-30');
    expect(['km', 'time']).toContain(est(estado).gauge?.limitedBy);
    // El cambio es del pasado, así que el odómetro viene proyectado.
    expect(est(estado).odometer?.source).toBe('estimated');

    const reanclado = await http()
      .post(`/api/v1/vehicles/${vehiculoId}/odometer`)
      .set('Authorization', `Bearer ${token}`)
      .send({ km: 47250 })
      .expect(201);

    expect(est(reanclado).odometer).toMatchObject({
      km: 47250,
      source: 'reported',
    });
  });

  it('el vehículo de otro usuario responde 404 VEHICLE_NOT_FOUND', async () => {
    const otro = await registrar();
    const r = await http()
      .get(`/api/v1/vehicles/${vehiculoId}/oil-status`)
      .set('Authorization', `Bearer ${otro}`)
      .expect(404);
    expect(err(r).error).toBe('VEHICLE_NOT_FOUND');
  });

  it('una lectura hacia atrás responde 422 ODOMETER_BACKWARDS', async () => {
    const r = await http()
      .post(`/api/v1/vehicles/${vehiculoId}/odometer`)
      .set('Authorization', `Bearer ${token}`)
      .send({ km: 100 })
      .expect(422);
    expect(err(r).error).toBe('ODOMETER_BACKWARDS');
  });

  it('sin token responde 401', async () => {
    await http()
      .get(`/api/v1/vehicles/${vehiculoId}/oil-status`)
      .expect(401);
  });
});
