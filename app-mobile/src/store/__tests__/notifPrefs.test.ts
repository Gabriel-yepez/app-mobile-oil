import { DEFAULT_PREFS } from '../../notifications/types';
import { useNotifPrefs } from '../notifPrefs';

describe('useNotifPrefs', () => {
  beforeEach(() => {
    useNotifPrefs.setState({ prefs: { ...DEFAULT_PREFS } });
  });

  it('arranca con los valores por defecto', () => {
    expect(useNotifPrefs.getState().prefs).toEqual(DEFAULT_PREFS);
  });

  it('setPref cambia solo la clave indicada', () => {
    useNotifPrefs.getState().setPref('warnEnabled', false);
    const { prefs } = useNotifPrefs.getState();
    expect(prefs.warnEnabled).toBe(false);
    expect(prefs.overdueEnabled).toBe(true);
    expect(prefs.warnThresholdKm).toBe(500);
  });

  it('markPermissionAsked deja un timestamp', () => {
    expect(useNotifPrefs.getState().prefs.permissionAskedAt).toBeNull();
    useNotifPrefs.getState().markPermissionAsked();
    expect(typeof useNotifPrefs.getState().prefs.permissionAskedAt).toBe('number');
  });
});
