import 'dotenv/config';
// El e2e crea más cuentas por minuto que el límite real de producción. En vez
// de relajar el límite en el código o espaciar los tests, se sube por entorno:
// la palanca existe justo para esto. Debe fijarse ANTES de importar AppModule,
// porque ConfigModule lee el entorno al construirse.
process.env.THROTTLE_AUTH_LIMIT = '1000';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { PrismaService } from '../src/infra/prisma/prisma.service';

const nuevo = () => ({
  fullName: 'Luis Guerrero',
  cedula: `V${Math.floor(10_000_000 + Math.random() * 89_999_999)}`,
  email: `luis-${Date.now()}-${Math.floor(Math.random() * 1e6)}@correo.com`,
  phone: '+58 414 528 9012',
  state: 'Distrito Capital',
  city: 'Caracas',
  password: 'contrasena1',
});

// `res.body` de supertest es `any`. En vez de silenciar la regla de lint en
// los tests, se tipan las dos formas de respuesta: así el test documenta el
// contrato y un cambio de forma sale como error de tipos.
type CuerpoAuth = {
  user: {
    id: string;
    email: string;
    fullName: string;
    cedula: string;
    state: string | null;
    city: string | null;
    currency: 'USD' | 'BS' | 'BOTH';
  };
  accessToken: string;
  refreshToken: string;
};
type CuerpoError = { statusCode: number; error: string; message: string };

const auth = (r: request.Response): CuerpoAuth => r.body as CuerpoAuth;
const err = (r: request.Response): CuerpoError => r.body as CuerpoError;

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const http = () =>
    request(app.getHttpServer() as Parameters<typeof request>[0]);

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
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('flujo completo: registrar → /me → refrescar → /me → cerrar sesión', async () => {
    const datos = nuevo();

    const reg = await http()
      .post('/api/v1/auth/register')
      .send(datos)
      .expect(201);
    expect(auth(reg).user.email).toBe(datos.email);
    expect(auth(reg).user).not.toHaveProperty('passwordHash');
    expect(JSON.stringify(reg.body)).not.toContain('argon2');

    await http()
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${auth(reg).accessToken}`)
      .expect(200)
      .expect((r) => expect(auth(r).user.email).toBe(datos.email));

    const ref = await http()
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: auth(reg).refreshToken })
      .expect(200);
    expect(auth(ref).refreshToken).not.toBe(auth(reg).refreshToken);

    await http()
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${auth(ref).accessToken}`)
      .expect(200);

    await http()
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${auth(ref).accessToken}`)
      .send({ refreshToken: auth(ref).refreshToken })
      .expect(204);

    await http()
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: auth(ref).refreshToken })
      .expect(401);
  });

  // El caso que justifica toda la rotación.
  it('reusar un refresh ya rotado tumba todas las sesiones', async () => {
    const reg = await http()
      .post('/api/v1/auth/register')
      .send(nuevo())
      .expect(201);
    const ref = await http()
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: auth(reg).refreshToken })
      .expect(200);

    // El robado (ya rotado) vuelve a aparecer → se revoca todo.
    await http()
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: auth(reg).refreshToken })
      .expect(401);

    // Y el legítimo también deja de servir: no sabemos cuál fue robado.
    await http()
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: auth(ref).refreshToken })
      .expect(401);
  });

  it('login con contraseña errada y con correo inexistente dan el mismo cuerpo', async () => {
    const datos = nuevo();
    await http().post('/api/v1/auth/register').send(datos).expect(201);

    const a = await http()
      .post('/api/v1/auth/login')
      .send({ email: datos.email, password: 'otra1234' })
      .expect(401);
    const b = await http()
      .post('/api/v1/auth/login')
      .send({ email: 'nadie@correo.com', password: 'otra1234' })
      .expect(401);

    expect(err(a).error).toBe('INVALID_CREDENTIALS');
    expect(err(a).error).toBe(err(b).error);
    expect(err(a).message).toBe(err(b).message);
  });

  it('login correcto tras registrarse', async () => {
    const datos = nuevo();
    await http().post('/api/v1/auth/register').send(datos).expect(201);

    await http()
      .post('/api/v1/auth/login')
      .send({ email: datos.email, password: datos.password })
      .expect(200)
      .expect((r) => expect(auth(r).accessToken).toBeTruthy());
  });

  it('rechaza correo duplicado y cédula duplicada con su código', async () => {
    const datos = nuevo();
    await http().post('/api/v1/auth/register').send(datos).expect(201);

    await http()
      .post('/api/v1/auth/register')
      .send({
        ...datos,
        cedula: `V${Math.floor(10_000_000 + Math.random() * 89_999_999)}`,
      })
      .expect(409)
      .expect((r) => expect(err(r).error).toBe('EMAIL_TAKEN'));

    await http()
      .post('/api/v1/auth/register')
      .send({ ...nuevo(), cedula: datos.cedula })
      .expect(409)
      .expect((r) => expect(err(r).error).toBe('CEDULA_TAKEN'));
  });

  // forbidNonWhitelisted: un campo de más no se ignora, se rechaza.
  it('rechaza campos que no están en el DTO', async () => {
    await http()
      .post('/api/v1/auth/register')
      .send({ ...nuevo(), esAdmin: true })
      .expect(400)
      .expect((r) => expect(err(r).error).toBe('VALIDATION_ERROR'));
  });

  it('normaliza la cédula: V-25.481.073 y 25481073 son la misma persona', async () => {
    const datos = nuevo();
    const digitos = datos.cedula.slice(1);

    await http()
      .post('/api/v1/auth/register')
      .send({ ...datos, cedula: `V-${digitos}` })
      .expect(201);

    await http()
      .post('/api/v1/auth/register')
      .send({ ...nuevo(), cedula: digitos })
      .expect(409)
      .expect((r) => expect(err(r).error).toBe('CEDULA_TAKEN'));
  });

  it('/me sin token da 401 con UNAUTHORIZED', async () => {
    await http()
      .get('/api/v1/auth/me')
      .expect(401)
      .expect((r) => expect(err(r).error).toBe('UNAUTHORIZED'));
  });

  // Este es el único sitio donde se puede comprobar que el AppError lanzado
  // DENTRO de JwtStrategy.validate atraviesa el guard de Passport sin que lo
  // reemplacen por un 401 pelado. El test unitario de la estrategia la llama
  // directo y nunca pasa por el guard, así que no vería una regresión acá.
  it('token válido de una cuenta borrada da ACCOUNT_NOT_FOUND, no UNAUTHORIZED', async () => {
    const reg = await http()
      .post('/api/v1/auth/register')
      .send(nuevo())
      .expect(201);

    // El token sigue firmado y sin vencer; lo que desaparece es la cuenta.
    await prisma.user.delete({ where: { id: auth(reg).user.id } });

    await http()
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${auth(reg).accessToken}`)
      .expect(401)
      .expect((r) => expect(err(r).error).toBe('ACCOUNT_NOT_FOUND'));

    // Y refrescar tampoco sirve: los refresh cayeron en cascada con el
    // usuario. Justo por eso la app necesita distinguir los dos códigos.
    await http()
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: auth(reg).refreshToken })
      .expect(401)
      .expect((r) => expect(err(r).error).toBe('INVALID_REFRESH_TOKEN'));
  });
});
