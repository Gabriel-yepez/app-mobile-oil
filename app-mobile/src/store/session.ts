// Sesión recordada — lo que respalda el "Recordarme" del login.
//
// Guarda SOLO el correo y la preferencia: la contraseña nunca se persiste.
// Cuando llegue el backend, el token de sesión vivirá aparte (almacenamiento
// seguro), no acá: este store es una comodidad de UI, no una credencial.
import AsyncStorage from 'expo-sqlite/kv-store';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

type SessionStore = {
  remember: boolean;
  /** Correo del último acceso, o '' si el usuario pidió no recordarlo. */
  email: string;
  /** false hasta que termina de leerse el almacenamiento. El login espera a
   *  esto para no pisar el correo guardado con el valor por defecto. */
  hydrated: boolean;
  rememberEmail: (email: string) => void;
  forget: () => void;
};

export const useSession = create<SessionStore>()(
  persist(
    (set) => ({
      remember: true,
      email: '',
      hydrated: false,
      rememberEmail: (email) => set({ remember: true, email: email.trim() }),
      forget: () => set({ remember: false, email: '' }),
    }),
    {
      name: 'ruedalo:session',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ remember: s.remember, email: s.email }),
      onRehydrateStorage: () => () => useSession.setState({ hydrated: true }),
    }
  )
);
