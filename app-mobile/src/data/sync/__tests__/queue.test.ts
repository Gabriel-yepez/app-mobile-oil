import { cabeza, encolar, esperaMs, marcarIntento, sacar } from '../queue';
import type { QueueEntry, QueueOp } from '../queue';

const vacia: QueueEntry[] = [];

const crearVehiculo = (id: string): QueueOp => ({
  op: 'CREATE_VEHICLE',
  id,
  payload: {
    kind: 'CAR',
    brand: 'Toyota',
    model: 'Corolla',
    year: 2019,
    plate: 'AB123CD',
    color: '#111111',
    kmPerDay: 30,
  },
});
const editarVehiculo = (id: string, patch: object): QueueOp => ({
  op: 'UPDATE_VEHICLE',
  id,
  payload: patch,
});
const borrarVehiculo = (id: string): QueueOp => ({ op: 'DELETE_VEHICLE', id });
const crearCambio = (id: string, vehicleId: string): QueueOp => ({
  op: 'CREATE_OIL_CHANGE',
  id,
  vehicleId,
  payload: {
    changedAt: '2026-06-04T00:00:00.000Z',
    km: 45_000,
    intervalKm: 5_000,
    intervalMonths: 6,
    oilBrand: 'Pennzoil',
    oilTag: 'Platinum',
    oilViscosity: '5W-30',
    oilSynthetic: true,
  },
});

const payloadDe = (e: QueueEntry) =>
  (e.op as { payload: Record<string, unknown> }).payload;

describe('colapso de operaciones', () => {
  it('crear y luego borrar el mismo vehículo deja la cola vacía', () => {
    // El vehículo nunca existió para el servidor: mandar el DELETE de algo
    // que no creamos es un 404 garantizado.
    let c = encolar(vacia, crearVehiculo('v1'));
    c = encolar(c, borrarVehiculo('v1'));
    expect(c).toHaveLength(0);
  });

  it('borrar un vehículo YA sincronizado sí encola el delete', () => {
    const c = encolar(vacia, borrarVehiculo('v1'));
    expect(c.map((e) => e.op.op)).toEqual(['DELETE_VEHICLE']);
  });

  it('crear y luego editar se fusionan en una sola creación', () => {
    let c = encolar(vacia, crearVehiculo('v1'));
    c = encolar(c, editarVehiculo('v1', { color: '#FF0000' }));

    expect(c).toHaveLength(1);
    expect(c[0].op.op).toBe('CREATE_VEHICLE');
    expect(payloadDe(c[0]).color).toBe('#FF0000');
    // Lo que no se tocó sobrevive a la fusión.
    expect(payloadDe(c[0]).brand).toBe('Toyota');
  });

  it('dos ediciones del mismo vehículo se fusionan, gana la última por campo', () => {
    let c = encolar(
      vacia,
      editarVehiculo('v1', { color: '#FF0000', year: 2019 }),
    );
    c = encolar(c, editarVehiculo('v1', { color: '#00FF00' }));

    expect(c).toHaveLength(1);
    expect(payloadDe(c[0])).toEqual({ color: '#00FF00', year: 2019 });
  });

  it('borrar un vehículo descarta las ops de sus cambios pendientes', () => {
    let c = encolar(vacia, crearCambio('c1', 'v1'));
    c = encolar(c, crearCambio('c2', 'v2'));
    c = encolar(c, borrarVehiculo('v1'));

    // Queda el cambio del OTRO vehículo, y el delete.
    expect(c.map((e) => e.op.op)).toEqual([
      'CREATE_OIL_CHANGE',
      'DELETE_VEHICLE',
    ]);
    expect((c[0].op as { vehicleId: string }).vehicleId).toBe('v2');
  });

  it('las ops de vehículos distintos conservan su orden', () => {
    let c = encolar(vacia, crearVehiculo('v1'));
    c = encolar(c, crearVehiculo('v2'));
    c = encolar(c, editarVehiculo('v2', { color: '#000000' }));

    expect(c.map((e) => e.op.id)).toEqual(['v1', 'v2']);
  });

  it('editar algo sin nada pendiente encola el update tal cual', () => {
    const c = encolar(vacia, editarVehiculo('v1', { color: '#FF0000' }));
    expect(c.map((e) => e.op.op)).toEqual(['UPDATE_VEHICLE']);
  });
});

describe('cabeza, salida e intentos', () => {
  it('cabeza devuelve la más vieja: la cola es FIFO', () => {
    let c = encolar(vacia, crearVehiculo('v1'));
    c = encolar(c, crearVehiculo('v2'));
    expect(cabeza(c)?.op.id).toBe('v1');
  });

  it('cabeza de una cola vacía es null', () => {
    expect(cabeza(vacia)).toBeNull();
  });

  it('sacar quita exactamente esa operación', () => {
    let c = encolar(vacia, crearVehiculo('v1'));
    c = encolar(c, crearVehiculo('v2'));
    c = sacar(c, c[0].op);
    expect(c.map((e) => e.op.id)).toEqual(['v2']);
  });

  it('marcarIntento sube el contador sin mover la op de lugar', () => {
    let c = encolar(vacia, crearVehiculo('v1'));
    c = encolar(c, crearVehiculo('v2'));
    c = marcarIntento(c, c[0].op);

    expect(c[0].intentos).toBe(1);
    expect(c[0].op.id).toBe('v1');
  });
});

describe('esperaMs', () => {
  it('crece con los intentos y se estanca en un minuto', () => {
    expect(esperaMs(0)).toBe(1_000);
    expect(esperaMs(1)).toBe(4_000);
    expect(esperaMs(2)).toBe(15_000);
    expect(esperaMs(3)).toBe(60_000);
    // Con techo: sin él, tras un día sin señal el próximo reintento caería
    // dentro de varias horas.
    expect(esperaMs(10)).toBe(60_000);
  });
});
