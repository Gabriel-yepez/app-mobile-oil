import 'dotenv/config';
// Mismo motivo que en auth.e2e: el e2e crea más cuentas por minuto que el
// límite real. Debe fijarse ANTES de importar AppModule.
process.env.THROTTLE_AUTH_LIMIT = '1000';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { PrismaService } from '../src/infra/prisma/prisma.service';
import { emailE2E, limpiarUsuariosE2E } from './support/e2e-db';

const nuevoUsuario = () => ({
  fullName: 'Luis Guerrero',
  cedula: `V${Math.floor(10_000_000 + Math.random() * 89_999_999)}`,
  email: emailE2E('marcas'),
  phone: '+58 414 528 9012',
  state: 'Distrito Capital',
  city: 'Caracas',
  password: 'Clave#2026',
});

type CuerpoMarca = {
  id: string;
  kind: string;
  name: string;
  nameKey: string;
  created?: boolean;
};
const marca = (r: request.Response) => r.body as CuerpoMarca;
const lista = (r: request.Response) => r.body as CuerpoMarca[];

describe('Catálogo de marcas (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const http = () =>
    request(app.getHttpServer() as Parameters<typeof request>[0]);

  // Nombre único por corrida: el catálogo es global y persiste entre corridas,
  // así que un nombre fijo chocaría con el de la corrida anterior y el test
  // pasaría o fallaría según el orden. Las marcas creadas se borran al final.
  const sufijo = Date.now().toString(36).toUpperCase();
  const MARCA_NUEVA = `Chery${sufijo}`;

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
    // Escucha UNA vez y atado a 127.0.0.1, no app.init(): ver test/setup-env.ts.
    await app.listen(0, '127.0.0.1');
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    // Las marcas no cuelgan de User, así que el barrido de cuentas no se las
    // lleva: hay que borrarlas explícitamente.
    await prisma.brand.deleteMany({ where: { name: { contains: sufijo } } });
    await limpiarUsuariosE2E(prisma);
    await app.close();
  });

  it('el catálogo arranca con las marcas semilla', async () => {
    const token = await registrar();
    const r = await http()
      .get('/api/v1/brands?kind=CAR')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(lista(r).map((b) => b.name)).toEqual(
      expect.arrayContaining(['Toyota', 'Chevrolet']),
    );
  });

  it('lo que agrega un usuario lo ve OTRO usuario', async () => {
    const tokenA = await registrar();
    const tokenB = await registrar();

    const creada = await http()
      .post('/api/v1/brands')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ kind: 'CAR', name: MARCA_NUEVA })
      .expect(201);
    expect(marca(creada).name).toBe(MARCA_NUEVA);

    const vistaPorB = await http()
      .get('/api/v1/brands?kind=CAR')
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);

    expect(lista(vistaPorB).map((b) => b.name)).toContain(MARCA_NUEVA);
  });

  // La app decide qué avisarle al usuario con este campo: "agregada" o "ya
  // estaba". Sin él tendría que leer el código HTTP, que el cliente descarta.
  it('dice created:true al crearla y created:false cuando ya estaba', async () => {
    const token = await registrar();
    const nombre = `Haval${sufijo}`;

    const primera = await http()
      .post('/api/v1/brands')
      .set('Authorization', `Bearer ${token}`)
      .send({ kind: 'CAR', name: nombre })
      .expect(201);
    expect(marca(primera).created).toBe(true);

    const repetida = await http()
      .post('/api/v1/brands')
      .set('Authorization', `Bearer ${token}`)
      .send({ kind: 'CAR', name: nombre })
      .expect(200);
    expect(repetida.body).toMatchObject({ created: false, name: nombre });
  });

  it('el listado NO trae created: ahí no significaría nada', async () => {
    const token = await registrar();
    const r = await http()
      .get('/api/v1/brands?kind=CAR')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(lista(r)[0]).not.toHaveProperty('created');
  });

  it('dos usuarios creando la misma marca terminan con una sola fila', async () => {
    const tokenA = await registrar();
    const tokenB = await registrar();
    const nombre = `Dongfeng${sufijo}`;

    const primera = await http()
      .post('/api/v1/brands')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ kind: 'CAR', name: nombre })
      .expect(201);

    // B la escribe distinto: debe caer sobre la misma fila.
    const segunda = await http()
      .post('/api/v1/brands')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ kind: 'CAR', name: `  ${nombre.toUpperCase()} ` })
      .expect(200);

    expect(segunda.body).toMatchObject({ id: marca(primera).id });

    const filas = await prisma.brand.count({
      where: { kind: 'CAR', nameKey: nombre.toUpperCase() },
    });
    expect(filas).toBe(1);
  });

  it('una marca de moto no aparece en el catálogo de carros', async () => {
    const token = await registrar();
    const nombre = `Ssenda${sufijo}`;

    await http()
      .post('/api/v1/brands')
      .set('Authorization', `Bearer ${token}`)
      .send({ kind: 'MOTO', name: nombre })
      .expect(201);

    const carros = await http()
      .get('/api/v1/brands?kind=CAR')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(lista(carros).map((b) => b.name)).not.toContain(nombre);
  });

  it('rechaza un nombre con URL', async () => {
    const token = await registrar();
    const r = await http()
      .post('/api/v1/brands')
      .set('Authorization', `Bearer ${token}`)
      .send({ kind: 'CAR', name: 'http://spam.com' })
      .expect(422);

    expect(r.body).toMatchObject({ error: 'BRAND_NAME_INVALID' });
  });

  // Regresión del TOCTOU: antes, contar el cupo y después insertar eran dos
  // operaciones separadas, así que diez peticiones simultáneas contaban cero
  // cada una y las diez insertaban. El tope se saltaba con un bucle en
  // paralelo. Con el lock por usuario, exactamente cinco entran.
  it('el tope aguanta diez peticiones simultáneas', async () => {
    const token = await registrar();

    const respuestas = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        http()
          .post('/api/v1/brands')
          .set('Authorization', `Bearer ${token}`)
          .send({ kind: 'CAR', name: `Rafaga${i}${sufijo}` }),
      ),
    );

    const creadas = respuestas.filter((r) => r.status === 201).length;
    const rechazadas = respuestas.filter((r) => r.status === 429).length;

    expect(creadas).toBe(5);
    expect(rechazadas).toBe(5);

    const enBase = await prisma.brand.count({
      where: { name: { startsWith: 'Rafaga' } },
    });
    expect(enBase).toBe(5);
  });

  it('rechaza una grosería y no la deja en el catálogo', async () => {
    const token = await registrar();
    const sucia = `Mierda${sufijo}`;

    const r = await http()
      .post('/api/v1/brands')
      .set('Authorization', `Bearer ${token}`)
      .send({ kind: 'CAR', name: sucia })
      .expect(422);

    // Mismo código que el charset: no se le dice cuál regla le pegó.
    expect(r.body).toMatchObject({ error: 'BRAND_NAME_INVALID' });

    const enBase = await prisma.brand.count({ where: { name: sucia } });
    expect(enBase).toBe(0);
  });

  it('corta al sexto aporte del día', async () => {
    const token = await registrar();
    for (let i = 0; i < 5; i++) {
      await http()
        .post('/api/v1/brands')
        .set('Authorization', `Bearer ${token}`)
        .send({ kind: 'CAR', name: `Tope${i}${sufijo}` })
        .expect(201);
    }
    const r = await http()
      .post('/api/v1/brands')
      .set('Authorization', `Bearer ${token}`)
      .send({ kind: 'CAR', name: `Tope5${sufijo}` })
      .expect(429);

    expect(r.body).toMatchObject({ error: 'BRAND_LIMIT_REACHED' });
  });
});
