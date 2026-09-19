import { apiFetch, ApiError, setOnSessionExpired, __resetClient } from '../client';
import { tokenStorage } from '../tokens';

jest.mock('../tokens', () => ({
  tokenStorage: { get: jest.fn(), save: jest.fn(), clear: jest.fn() },
}));
const storage = tokenStorage as jest.Mocked<typeof tokenStorage>;

const respuesta = (status: number, body: unknown) =>
  Promise.resolve({
    status,
    ok: status >= 200 && status < 300,
    json: () => Promise.resolve(body),
  } as Response);

describe('apiFetch', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    __resetClient();
    storage.get.mockResolvedValue({ accessToken: 'viejo', refreshToken: 'ref' });
  });

  it('manda el Bearer y devuelve el cuerpo', async () => {
    global.fetch = jest.fn().mockReturnValue(respuesta(200, { ok: true }));

    await expect(apiFetch('/auth/me', { auth: true })).resolves.toEqual({ ok: true });

    const init = (global.fetch as jest.Mock).mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer viejo');
  });

  it('no manda Bearer en las rutas públicas', async () => {
    global.fetch = jest.fn().mockReturnValue(respuesta(200, {}));

    await apiFetch('/auth/login', { method: 'POST', body: { email: 'a@b.c' } });

    const init = (global.fetch as jest.Mock).mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it('convierte el error del backend en ApiError con su código', async () => {
    global.fetch = jest
      .fn()
      .mockReturnValue(
        respuesta(409, { error: 'EMAIL_TAKEN', message: 'Ese correo ya tiene una cuenta.' }),
      );

    await expect(apiFetch('/auth/register', { method: 'POST' })).rejects.toMatchObject({
      code: 'EMAIL_TAKEN',
      status: 409,
      message: 'Ese correo ya tiene una cuenta.',
    });
  });

  it('ante 401 refresca una vez y reintenta con el token nuevo', async () => {
    global.fetch = jest
      .fn()
      .mockReturnValueOnce(respuesta(401, { error: 'INVALID_CREDENTIALS' }))
      .mockReturnValueOnce(respuesta(200, { accessToken: 'nuevo', refreshToken: 'ref2' }))
      .mockReturnValueOnce(respuesta(200, { ok: true }));

    await expect(apiFetch('/auth/me', { auth: true })).resolves.toEqual({ ok: true });
    expect(storage.save).toHaveBeenCalledWith({
      accessToken: 'nuevo',
      refreshToken: 'ref2',
    });

    const ultima = (global.fetch as jest.Mock).mock.calls[2][1] as RequestInit;
    expect((ultima.headers as Record<string, string>).Authorization).toBe('Bearer nuevo');
  });

  // EL test que justifica la cola: con rotación en el backend, dos refrescos
  // simultáneos se invalidan mutuamente y cierran la sesión de un usuario
  // legítimo. Sin esta cola, abrir la app con varias pantallas pidiendo datos
  // a la vez cerraría la sesión sola.
  it('con tres peticiones caducadas a la vez, refresca UNA sola vez', async () => {
    const llamadas: string[] = [];
    global.fetch = jest.fn().mockImplementation((url: string, init: RequestInit) => {
      llamadas.push(url);
      if (url.endsWith('/auth/refresh')) {
        return respuesta(200, { accessToken: 'nuevo', refreshToken: 'ref2' });
      }
      const auth = (init.headers as Record<string, string>).Authorization;
      return auth === 'Bearer nuevo' ? respuesta(200, { ok: true }) : respuesta(401, { error: 'X' });
    });

    await Promise.all([
      apiFetch('/a', { auth: true }),
      apiFetch('/b', { auth: true }),
      apiFetch('/c', { auth: true }),
    ]);

    expect(llamadas.filter((u) => u.endsWith('/auth/refresh'))).toHaveLength(1);
  });

  it('si el refresco falla, limpia los tokens y avisa que expiró la sesión', async () => {
    const expiro = jest.fn();
    setOnSessionExpired(expiro);
    global.fetch = jest
      .fn()
      .mockReturnValueOnce(respuesta(401, { error: 'X' }))
      .mockReturnValueOnce(respuesta(401, { error: 'INVALID_REFRESH_TOKEN' }));

    await expect(apiFetch('/auth/me', { auth: true })).rejects.toBeInstanceOf(ApiError);
    expect(storage.clear).toHaveBeenCalled();
    expect(expiro).toHaveBeenCalled();
  });

  // Sin sesión guardada no hay nada que refrescar: reintentar sería una
  // llamada perdida y un refresh con `undefined`.
  it('no intenta refrescar si no hay tokens guardados', async () => {
    storage.get.mockResolvedValue(null);
    global.fetch = jest.fn().mockReturnValue(respuesta(401, { error: 'X' }));

    await expect(apiFetch('/auth/me', { auth: true })).rejects.toBeInstanceOf(ApiError);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  // Un 204 no trae cuerpo: llamar a .json() ahí revienta.
  it('maneja el 204 del logout sin intentar parsear cuerpo', async () => {
    global.fetch = jest.fn().mockReturnValue(
      Promise.resolve({
        status: 204,
        ok: true,
        json: () => Promise.reject(new Error('sin cuerpo')),
      } as unknown as Response),
    );

    await expect(apiFetch('/auth/logout', { method: 'POST', auth: true })).resolves.toBeUndefined();
  });

  // Sin internet `fetch` lanza; el usuario merece un mensaje, no un crash.
  it('convierte un fallo de red en ApiError legible', async () => {
    global.fetch = jest.fn().mockRejectedValue(new TypeError('Network request failed'));

    await expect(apiFetch('/auth/login', { method: 'POST' })).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
    });
  });
});
