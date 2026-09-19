// Endpoints de /auth. Un archivo por recurso, nombrado <recurso>.controller.ts.
import { ApiClient } from '../base';
import type { Tokens } from '../tokens';

export type ApiUser = {
  id: string;
  fullName: string;
  cedula: string;
  email: string;
  phone: string;
  /** El registro no los pide: nacen nulos y se llenan en EditProfile. */
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

  logout(refreshToken: string) {
    return this.post<void>('/logout', { auth: true, body: { refreshToken } });
  }
}

/** Instancia única: los controladores no guardan estado propio. */
export const authController = new AuthController();
