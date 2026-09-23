jest.mock('expo-notifications', () => ({
  getExpoPushTokenAsync: jest.fn(),
}));

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { extra: { eas: { projectId: 'proj-1' } } } },
}));

jest.mock('../permissions', () => ({ isPermissionGranted: jest.fn() }));

jest.mock('../../api/controllers/notifications.controller', () => ({
  notificationsController: {
    registrarDispositivo: jest.fn(),
    darDeBaja: jest.fn(),
  },
}));

import * as Notifications from 'expo-notifications';
import { notificationsController } from '../../api/controllers/notifications.controller';
import { isPermissionGranted } from '../permissions';
import { darDeBajaDispositivo, registrarDispositivo } from '../push';

const pedirToken = Notifications.getExpoPushTokenAsync as jest.Mock;
const permiso = isPermissionGranted as jest.Mock;
const api = notificationsController as jest.Mocked<
  typeof notificationsController
>;

describe('registrarDispositivo', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    permiso.mockResolvedValue(true);
    pedirToken.mockResolvedValue({ data: 'ExponentPushToken[abc]' });
  });

  it('pide el token y lo registra contra el API', async () => {
    const r = await registrarDispositivo();

    expect(r).toBe('ExponentPushToken[abc]');
    expect(api.registrarDispositivo).toHaveBeenCalledWith(
      'ExponentPushToken[abc]',
      expect.stringMatching(/^(IOS|ANDROID)$/)
    );
  });

  it('pasa el projectId de EAS: sin él Expo no sabe a qué proyecto pedirlo', async () => {
    await registrarDispositivo();

    expect(pedirToken).toHaveBeenCalledWith({ projectId: 'proj-1' });
  });

  it('sin permiso no pide token ni llama al API', async () => {
    permiso.mockResolvedValue(false);

    expect(await registrarDispositivo()).toBeNull();
    expect(pedirToken).not.toHaveBeenCalled();
    expect(api.registrarDispositivo).not.toHaveBeenCalled();
  });

  // Se llama en CADA arranque: si un fallo del API propagara, la app no abre.
  it('un fallo del API no propaga', async () => {
    api.registrarDispositivo.mockRejectedValue(new Error('sin red'));

    await expect(registrarDispositivo()).resolves.toBeNull();
  });

  // En Expo Go el push remoto no existe (Android, desde SDK 53), así que pedir
  // el token lanza. No es un error: es la app corriendo donde no puede.
  it('en Expo Go devuelve null sin intentar nada', async () => {
    pedirToken.mockRejectedValue(new Error('Expo Go no soporta push remoto'));

    expect(await registrarDispositivo()).toBeNull();
    expect(api.registrarDispositivo).not.toHaveBeenCalled();
  });

  // Si leer el permiso reventara y la excepción subiera, arrastraría a
  // signOut: el usuario no podría cerrar sesión por culpa de una
  // notificación. Ningún fallo de acá puede impedir algo que el usuario pidió.
  it('un fallo al leer el permiso no propaga', async () => {
    permiso.mockRejectedValue(new Error('módulo nativo no disponible'));

    await expect(registrarDispositivo()).resolves.toBeNull();
  });
});

describe('darDeBajaDispositivo', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    permiso.mockResolvedValue(true);
    pedirToken.mockResolvedValue({ data: 'ExponentPushToken[abc]' });
  });

  it('da de baja el token del dispositivo', async () => {
    await darDeBajaDispositivo();

    expect(api.darDeBaja).toHaveBeenCalledWith('ExponentPushToken[abc]');
  });

  // Dejar al usuario dentro de su cuenta porque el servidor no contesta sería
  // peor que un token huérfano, y el DeviceNotRegistered lo limpia solo.
  it('no revienta si el API falla: la sesión se cierra igual', async () => {
    api.darDeBaja.mockRejectedValue(new Error('sin red'));

    await expect(darDeBajaDispositivo()).resolves.toBeUndefined();
  });

  it('tampoco revienta si el módulo de notificaciones falla', async () => {
    permiso.mockRejectedValue(new Error('módulo nativo no disponible'));

    await expect(darDeBajaDispositivo()).resolves.toBeUndefined();
    expect(api.darDeBaja).not.toHaveBeenCalled();
  });
});
