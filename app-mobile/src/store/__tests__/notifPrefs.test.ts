jest.mock('../../api/controllers/notifications.controller', () => ({
  notificationsController: { obtenerPrefs: jest.fn(), guardarPrefs: jest.fn() },
}));

import { notificationsController } from '../../api/controllers/notifications.controller';
import { DEFAULT_PREFS, useNotifPrefs } from '../notifPrefs';

const api = notificationsController as jest.Mocked<
  typeof notificationsController
>;

describe('useNotifPrefs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useNotifPrefs.setState({
      prefs: { ...DEFAULT_PREFS },
      cargando: false,
      permissionAskedAt: null,
    });
  });

  it('arranca con los valores por defecto', () => {
    expect(useNotifPrefs.getState().prefs).toEqual(DEFAULT_PREFS);
  });

  it('carga las preferencias del backend', async () => {
    api.obtenerPrefs.mockResolvedValue({
      ...DEFAULT_PREFS,
      warnThresholdKm: 300,
    });

    await useNotifPrefs.getState().cargar();

    expect(useNotifPrefs.getState().prefs.warnThresholdKm).toBe(300);
    expect(useNotifPrefs.getState().cargando).toBe(false);
  });

  // Una pantalla de ajustes en blanco es peor que una desactualizada.
  it('si la carga falla, se queda con lo último conocido', async () => {
    useNotifPrefs.setState({
      prefs: { ...DEFAULT_PREFS, warnThresholdKm: 300 },
    });
    api.obtenerPrefs.mockRejectedValue(new Error('sin red'));

    await useNotifPrefs.getState().cargar();

    expect(useNotifPrefs.getState().prefs.warnThresholdKm).toBe(300);
    expect(useNotifPrefs.getState().cargando).toBe(false);
  });

  // El switch tiene que moverse al tocarlo, no cuando el servidor conteste.
  it('aplica el cambio de inmediato y manda solo lo que cambió', async () => {
    api.guardarPrefs.mockResolvedValue({ ...DEFAULT_PREFS, enabled: false });

    const promesa = useNotifPrefs.getState().setPref('enabled', false);
    expect(useNotifPrefs.getState().prefs.enabled).toBe(false);

    await promesa;
    expect(api.guardarPrefs).toHaveBeenCalledWith({ enabled: false });
  });

  it('si el guardado falla, el switch vuelve a donde estaba', async () => {
    api.guardarPrefs.mockRejectedValue(new Error('sin red'));

    await useNotifPrefs.getState().setPref('enabled', false);

    expect(useNotifPrefs.getState().prefs.enabled).toBe(true);
  });

  // permissionAskedAt es un hecho del TELÉFONO, no una preferencia de la
  // cuenta: no viaja al servidor y sobrevive a cerrar sesión.
  it('markPermissionAsked deja un timestamp local', () => {
    expect(useNotifPrefs.getState().permissionAskedAt).toBeNull();

    useNotifPrefs.getState().markPermissionAsked();

    expect(typeof useNotifPrefs.getState().permissionAskedAt).toBe('number');
    expect(api.guardarPrefs).not.toHaveBeenCalled();
  });
});
