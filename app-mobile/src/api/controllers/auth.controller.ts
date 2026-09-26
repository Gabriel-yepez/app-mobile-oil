// Endpoints de /auth. Un archivo por recurso, nombrado <recurso>.controller.ts.
import { ApiClient } from '../base';
import type { Tokens } from '../tokens';

export type ApiUser = {
  id: string;
  fullName: string;
  cedula: string;
  email: string;
  phone: string;
  /** Anulables solo por las cuentas viejas: el registro ya los exige, así que
   *  en las nuevas nunca vienen en null. Se llenan desde EditProfile. */
  state: string | null;
  city: string | null;
  currency: 'USD' | 'BS' | 'BOTH';
};

export type AuthResponse = { user: ApiUser } & Tokens;

export type RegisterInput = {
  fullName: string;
  cedula: string;
  email: string;
  phone: string;
  /** El registro los pide obligatoriamente: el perfil nace completo. */
  state: string;
  city: string;
  currency: ApiUser['currency'];
  password: string;
};

/**
 * El perfil editable. Todo opcional porque el backend recibe un PATCH: lo que
 * no se manda se queda como está.
 *
 * `cedula` no aparece a propósito —identifica la cuenta y el backend la
 * rechaza— y la contraseña tampoco: ese es otro trámite.
 */
export type UpdateProfileInput = Partial<
  Pick<ApiUser, 'fullName' | 'email' | 'phone' | 'state' | 'city' | 'currency'>
>;

export type UpdateProfileResponse = {
  user: ApiUser;
  /** Texto del servidor, listo para el toast. No ramifiques por él. */
  message: string;
  /** Los campos que cambiaron de verdad. Vacío = no había nada que cambiar. */
  changed: string[];
};

class AuthController extends ApiClient {
  constructor() {
    super('/auth');
  }

  register(input: RegisterInput) {
    return this.post<AuthResponse>('/register', { body: input });
  }

  login(email: string, password: string) {
    return this.post<AuthResponse>('/login', { body: { email, password } });
  }

  me() {
    return this.get<{ user: ApiUser }>('/me', { auth: true });
  }

  /**
   * Edita el perfil de la sesión. Mismo recurso que `me()`, así que devuelve
   * el usuario entero ya actualizado —no solo lo que mandaste— y vale para
   * pisar el que tiene el store sin pedir un `/me` detrás.
   */
  updateMe(patch: UpdateProfileInput) {
    return this.patch<UpdateProfileResponse>('/me', { auth: true, body: patch });
  }

  logout(refreshToken: string) {
    return this.post<void>('/logout', { auth: true, body: { refreshToken } });
  }
}

/** Instancia única: los controladores no guardan estado propio. */
export const authController = new AuthController();
