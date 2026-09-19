// Sesión real. Distinto de `session.ts`, que solo recuerda el correo del
// "Recordarme" y sigue siendo una comodidad de UI, no una credencial.
import { create } from 'zustand';
import { ApiClient, ApiError } from '../api/base';
import {
  authController,
  type ApiUser,
  type RegisterInput,
} from '../api/controllers/auth.controller';
import { tokenStorage } from '../api/tokens';

type Estado = 'loading' | 'authed' | 'guest';

type AuthStore = {
  user: ApiUser | null;
  /** `loading` mientras se lee el almacenamiento seguro. La navegación espera
   *  a que salga de aquí para no mostrarle el Login a quien ya tiene sesión. */
  status: Estado;
  /** Mensaje del backend, listo para pintar en el formulario. */
  error: string | null;
  bootstrap: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (input: RegisterInput) => Promise<void>;
  signOut: () => Promise<void>;
};

const mensajeDe = (e: unknown): string =>
  e instanceof ApiError ? e.message : 'No pudimos conectar. Revisa tu conexión.';

export const useAuth = create<AuthStore>((set) => ({
  user: null,
  status: 'loading',
  error: null,

  bootstrap: async () => {
    const tokens = await tokenStorage.get();
    if (!tokens) {
      set({ status: 'guest', user: null });
      return;
    }

    try {
      // Tener el token guardado no basta: pudo revocarse desde otro
      // dispositivo. Solo /me confirma que la sesión sigue viva.
      const { user } = await authController.me();
      set({ user, status: 'authed', error: null });
    } catch (e) {
      // Los tokens SOLO se borran si el servidor dijo que no valen. Ante un
      // fallo de red o un timeout no sabemos nada del token: borrarlo echaría
      // de su cuenta a quien abrió la app sin cobertura, con una credencial
      // que seguía siendo buena. Conservándolos, el siguiente arranque con
      // conexión recupera la sesión solo.
      const loRechazoElServidor =
        e instanceof ApiError && (e.status === 401 || e.status === 403);
      if (loRechazoElServidor) await tokenStorage.clear();

      set({ status: 'guest', user: null });
    }
  },

  signIn: async (email, password) => {
    set({ error: null });
    try {
      const { user, accessToken, refreshToken } = await authController.login(email, password);
      await tokenStorage.save({ accessToken, refreshToken });
      set({ user, status: 'authed' });
    } catch (e) {
      set({ status: 'guest', error: mensajeDe(e) });
      throw e;
    }
  },

  signUp: async (input) => {
    set({ error: null });
    try {
      const { user, accessToken, refreshToken } = await authController.register(input);
      await tokenStorage.save({ accessToken, refreshToken });
      set({ user, status: 'authed' });
    } catch (e) {
      set({ status: 'guest', error: mensajeDe(e) });
      throw e;
    }
  },

  signOut: async () => {
    const tokens = await tokenStorage.get();
    try {
      if (tokens) await authController.logout(tokens.refreshToken);
    } catch {
      // Sin red el servidor no se entera, pero la sesión local se cierra
      // igual: dejar al usuario dentro por falta de internet sería peor.
    }
    await tokenStorage.clear();
    set({ user: null, status: 'guest', error: null });
  },
}));

// Si el refresco falla en cualquier petición, la sesión cae sola y la
// navegación reacciona: no hace falta que cada pantalla lo compruebe.
ApiClient.setOnSessionExpired(() =>
  useAuth.setState({ user: null, status: 'guest' }),
);
