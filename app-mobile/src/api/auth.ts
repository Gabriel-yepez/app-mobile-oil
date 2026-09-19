import { apiFetch } from './client';
import type { Tokens } from './tokens';

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
  password: string;
};

export const authApi = {
  register: (input: RegisterInput) =>
    apiFetch<AuthResponse>('/auth/register', { method: 'POST', body: input }),

  login: (email: string, password: string) =>
    apiFetch<AuthResponse>('/auth/login', { method: 'POST', body: { email, password } }),

  me: () => apiFetch<{ user: ApiUser }>('/auth/me', { auth: true }),

  logout: (refreshToken: string) =>
    apiFetch<void>('/auth/logout', { method: 'POST', auth: true, body: { refreshToken } }),
};
