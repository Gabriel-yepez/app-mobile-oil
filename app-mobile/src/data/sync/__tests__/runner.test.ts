import { ApiError } from '../../../api/base';
import { clasificarFallo, drenar } from '../runner';
import { encolar } from '../queue';
import type { QueueEntry, QueueOp } from '../queue';

const crearVehiculo = (id: string): QueueOp => ({
  op: 'CREATE_VEHICLE',
  id,
  payload: {
    kind: 'car',
    brand: 'Toyota',
    model: 'Corolla',
    year: 2019,
    plate: 'AB123CD',
    color: '#111111',
    kmPerDay: 30,
  },
});

describe('clasificarFallo', () => {
  it('sin red es transitorio', () => {
    expect(clasificarFallo(new ApiError(0, 'NETWORK', 'sin red'))).toBe(
      'transitorio',
    );
  });

  it.each([500, 502, 503, 504])('%i es transitorio', (status) => {
    expect(clasificarFallo(new ApiError(status, 'SERVER', 'x'))).toBe(
      'transitorio',
    );
  });

  it('429 es transitorio: hay que esperar, no descartar', () => {
    expect(clasificarFallo(new ApiError(429, 'THROTTLED', 'x'))).toBe(
      'transitorio',
    );
  });

  it.each([
    [422, 'OIL_CHANGE_BACKWARDS'],
    [409, 'PLATE_TAKEN'],
    [404, 'VEHICLE_NOT_FOUND'],
    [400, 'VALIDATION'],
  ])('%i %s es permanente', (status, code) => {
    // Reintentarlo mil veces da mil veces el mismo error y traba la cola.
    expect(clasificarFallo(new ApiError(status as number, code, 'x'))).toBe(
      'permanente',
    );
  });

  it('401 es de sesión: pausa la cola, no descarta', () => {
    expect(clasificarFallo(new ApiError(401, 'TOKEN_EXPIRED', 'x'))).toBe(
      'sesion',
    );
  });

  it('un error que no es ApiError se trata como transitorio', () => {
    // Ante lo desconocido, conservar. Descartar el trabajo del usuario por un
    // error que no entendemos es el peor default posible.
    expect(clasificarFallo(new Error('vaya'))).toBe('transitorio');
  });
});

describe('drenar', () => {
  const deps = (cola: QueueEntry[], api: Record<string, jest.Mock>) => {
    let actual = cola;
    const rechazos: { op: QueueOp; code: string }[] = [];
    return {
      d: {
        leerCola: () => actual,
        guardarCola: (c: QueueEntry[]) => {
          actual = c;
        },
        marcarRechazado: (op: QueueOp, code: string) => {
          rechazos.push({ op, code });
        },
        api: api as never,
      },
      cola: () => actual,
      rechazos,
    };
  };

  it('el éxito saca la op de la cola', async () => {
    const cola = encolar([], crearVehiculo('v1'));
    const { d, cola: leer } = deps(cola, {
      crear: jest.fn().mockResolvedValue({ id: 'v1' }),
    });

    await drenar(d);
    expect(leer()).toHaveLength(0);
  });

  it('un fallo transitorio deja la op en la cola y sube intentos', async () => {
    const cola = encolar([], crearVehiculo('v1'));
    const { d, cola: leer } = deps(cola, {
      crear: jest.fn().mockRejectedValue(new ApiError(0, 'NETWORK', 'x')),
    });

    const r = await drenar(d);
    expect(leer()).toHaveLength(1);
    expect(leer()[0].intentos).toBe(1);
    expect(r.esperarMs).toBe(4_000);
  });

  it('un fallo permanente saca la op y marca el registro como rechazado', async () => {
    // La regla más importante: sin ella, un registro inválido bloquea para
    // siempre todo lo que venga detrás.
    const cola = encolar([], crearVehiculo('v1'));
    const { d, cola: leer, rechazos } = deps(cola, {
      crear: jest.fn().mockRejectedValue(new ApiError(409, 'PLATE_TAKEN', 'x')),
    });

    await drenar(d);
    expect(leer()).toHaveLength(0);
    expect(rechazos).toEqual([
      { op: expect.objectContaining({ id: 'v1' }), code: 'PLATE_TAKEN' },
    ]);
  });

  it('un 401 pausa la cola entera sin descartar nada', async () => {
    const cola = encolar([], crearVehiculo('v1'));
    const { d, cola: leer, rechazos } = deps(cola, {
      crear: jest
        .fn()
        .mockRejectedValue(new ApiError(401, 'TOKEN_EXPIRED', 'x')),
    });

    const r = await drenar(d);
    expect(r.pausada).toBe(true);
    expect(leer()).toHaveLength(1);
    expect(rechazos).toHaveLength(0);
  });

  it('envía de a una: la segunda op espera al drenaje siguiente', async () => {
    let cola = encolar([], crearVehiculo('v1'));
    cola = encolar(cola, crearVehiculo('v2'));
    const crear = jest.fn().mockResolvedValue({ id: 'x' });
    const { d, cola: leer } = deps(cola, { crear });

    await drenar(d);
    expect(crear).toHaveBeenCalledTimes(1);
    expect(leer().map((e) => e.op.id)).toEqual(['v2']);
  });

  it('una cola vacía no llama a la API', async () => {
    const crear = jest.fn();
    const { d } = deps([], { crear });

    const r = await drenar(d);
    expect(crear).not.toHaveBeenCalled();
    expect(r.vacia).toBe(true);
  });
});
