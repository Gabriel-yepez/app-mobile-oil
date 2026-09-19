// Los tokens van a Keychain (iOS) / Keystore (Android), NO a
// `expo-sqlite/kv-store`: ese es almacenamiento plano, y un token sacado de
// ahí es una sesión robada. Es justo lo que advierte el comentario de
// `src/store/session.ts`, que sigue guardando solo el correo del "Recordarme".
import * as SecureStore from 'expo-secure-store';

const CLAVE = 'ruedalo.tokens';

export type Tokens = { accessToken: string; refreshToken: string };

export const tokenStorage = {
  /** `null` ante cualquier problema: sin sesión utilizable el usuario entra de
   *  nuevo, que es mucho mejor que dejar la app inarrancable. */
  async get(): Promise<Tokens | null> {
    try {
      const crudo = await SecureStore.getItemAsync(CLAVE);
      if (!crudo) return null;

      const t = JSON.parse(crudo) as Partial<Tokens>;
      // Media sesión no es sesión: con uno solo de los dos no se puede ni
      // pedir /me ni refrescar.
      return t.accessToken && t.refreshToken
        ? { accessToken: t.accessToken, refreshToken: t.refreshToken }
        : null;
    } catch {
      // JSON corrupto, o Keychain inaccesible (dispositivo bloqueado).
      return null;
    }
  },

  async save(tokens: Tokens): Promise<void> {
    await SecureStore.setItemAsync(CLAVE, JSON.stringify(tokens));
  },

  async clear(): Promise<void> {
    await SecureStore.deleteItemAsync(CLAVE);
  },
};
