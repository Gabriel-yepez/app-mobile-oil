/** Token de inyección: el servicio pide ESTO, no Argon2 directamente. */
export const PASSWORD_HASHER = Symbol('PASSWORD_HASHER');

export interface PasswordHasher {
  hash(plain: string): Promise<string>;
  /** `false` en vez de lanzar si el hash está corrupto: un registro dañado
   *  debe negar el acceso, no tumbar el login de todos. */
  verify(hash: string, plain: string): Promise<boolean>;
}
