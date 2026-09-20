import type { NewUser, User } from './user';

/** Token de inyección: los servicios piden ESTO, no una clase concreta. */
export const USER_REPOSITORY = Symbol('USER_REPOSITORY');

/**
 * Lo que el dueño de la cuenta puede cambiar de sí mismo.
 *
 * Está definido por LISTA BLANCA, igual que la respuesta: si fuera un
 * `Partial<User>` con exclusiones, sumar mañana un campo sensible al modelo lo
 * volvería editable en silencio. Quedan fuera a propósito:
 *
 * - `passwordHash`: cambiar la contraseña es otro trámite, con la contraseña
 *   actual por delante y revocación de sesiones detrás.
 * - `cedula`: es la identidad de la cuenta. Cambiarla exige verificación, no
 *   un formulario. La app ya la muestra de solo lectura.
 * - `id`, `createdAt`, `updatedAt`: los pone el almacén.
 */
export type UserProfilePatch = Partial<
  Pick<User, 'fullName' | 'email' | 'phone' | 'state' | 'city' | 'currency'>
>;

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  existsByEmail(email: string): Promise<boolean>;
  existsByCedula(cedula: string): Promise<boolean>;
  create(data: NewUser): Promise<User>;
  /** Escritura parcial: solo toca las claves presentes en `patch`. */
  update(id: string, patch: UserProfilePatch): Promise<User>;
}
