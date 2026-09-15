import type { NewUser, User } from './user';

/** Token de inyección: los servicios piden ESTO, no una clase concreta. */
export const USER_REPOSITORY = Symbol('USER_REPOSITORY');

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  existsByEmail(email: string): Promise<boolean>;
  existsByCedula(cedula: string): Promise<boolean>;
  create(data: NewUser): Promise<User>;
}
