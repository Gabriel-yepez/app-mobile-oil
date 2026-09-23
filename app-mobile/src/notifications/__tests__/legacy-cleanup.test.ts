jest.mock('expo-notifications', () => ({
  getAllScheduledNotificationsAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn(),
}));

import * as Notifications from 'expo-notifications';
import { limpiarAvisosLocales } from '../legacy-cleanup';

const listar = Notifications.getAllScheduledNotificationsAsync as jest.Mock;
const cancelar = Notifications.cancelScheduledNotificationAsync as jest.Mock;

describe('limpiarAvisosLocales', () => {
  beforeEach(() => jest.clearAllMocks());

  // Los avisos ya programados viven en el SO y sobreviven a la actualización
  // de la app. Sin esto siguen saliendo durante SEMANAS, además de los push.
  it('cancela lo que programó la versión anterior', async () => {
    listar.mockResolvedValue([
      { identifier: 'ruedalo:oil-warn:v1' },
      { identifier: 'ruedalo:checkin' },
    ]);

    expect(await limpiarAvisosLocales()).toBe(2);
    expect(cancelar).toHaveBeenCalledWith('ruedalo:oil-warn:v1');
    expect(cancelar).toHaveBeenCalledWith('ruedalo:checkin');
  });

  it('no toca lo que no programó esta app', async () => {
    listar.mockResolvedValue([{ identifier: 'otra-app:algo' }]);

    expect(await limpiarAvisosLocales()).toBe(0);
    expect(cancelar).not.toHaveBeenCalled();
  });

  it('un fallo del SDK no propaga', async () => {
    listar.mockRejectedValue(new Error('x'));

    await expect(limpiarAvisosLocales()).resolves.toBe(0);
  });
});
