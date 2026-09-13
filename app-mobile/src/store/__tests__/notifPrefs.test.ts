import { DEFAULT_PREFS } from '../../notifications/types';
import { useNotifPrefs } from '../notifPrefs';

// El backend de persistencia es nativo; en Node lo reemplazamos por memoria.
jest.mock('expo-sqlite/kv-store', () => {
  const mem = new Map<string, string>();
  return {
    __esModule: true,
    default: {
      getItem: async (k: string) => mem.get(k) ?? null,
      setItem: async (k: string, v: string) => void mem.set(k, v),
      removeItem: async (k: string) => void mem.delete(k),
    },
  };
});

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
