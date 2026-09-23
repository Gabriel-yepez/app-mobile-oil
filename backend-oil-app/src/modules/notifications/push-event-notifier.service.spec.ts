import { Test } from '@nestjs/testing';
import { PushDispatchService } from './push-dispatch.service';
import { PushEventNotifier } from './push-event-notifier.service';
import { PushSweepService } from './push-sweep.service';

const vaciarCola = () => new Promise((r) => setImmediate(r));

const armar = async (opts: {
  vehiculosDe?: () => Promise<unknown>;
  despachar?: () => Promise<unknown>;
}) => {
  const mod = await Test.createTestingModule({
    providers: [
      PushEventNotifier,
      {
        provide: PushSweepService,
        useValue: {
          vehiculosDe: opts.vehiculosDe ?? (() => Promise.resolve([])),
        },
      },
      {
        provide: PushDispatchService,
        useValue: {
          despacharUsuario: opts.despachar ?? (() => Promise.resolve({})),
        },
      },
    ],
  }).compile();
  return mod.get(PushEventNotifier);
};

describe('PushEventNotifier', () => {
  it('despacha al usuario con sus vehículos', async () => {
    const despachados: string[] = [];
    const notifier = await armar({
      despachar: ((userId: string) => {
        despachados.push(userId);
        return Promise.resolve({});
      }) as () => Promise<unknown>,
    });

    notifier.avisar('u1');
    await vaciarCola();

    expect(despachados).toEqual(['u1']);
  });

  // Estas dos son la razón de ser de la clase: quien la llama ya guardó el
  // cambio de aceite del usuario y su petición no puede caerse porque Expo
  // esté caído. `avisar` ni siquiera devuelve promesa, así que el que llama no
  // tiene dónde poner un catch: la garantía tiene que estar acá.
  it('un fallo asíncrono no propaga', async () => {
    const notifier = await armar({
      despachar: () => Promise.reject(new Error('Expo caído')),
    });

    expect(() => notifier.avisar('u1')).not.toThrow();
    await vaciarCola();
  });

  it('un fallo síncrono tampoco propaga', async () => {
    const notifier = await armar({
      vehiculosDe: () => {
        throw new Error('dependencia rota');
      },
    });

    expect(() => notifier.avisar('u1')).not.toThrow();
    await vaciarCola();
  });
});
