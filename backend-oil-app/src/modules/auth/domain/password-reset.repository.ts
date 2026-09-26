export const PASSWORD_RESET_REPOSITORY = Symbol('PASSWORD_RESET_REPOSITORY');

/** Un intento de recuperar contraseña: código → verificado → usado. */
export type ResetRecord = {
  id: string;
  userId: string;
  /** HMAC del código con RESET_CODE_SECRET, nunca el código. */
  codeHash: string;
  expiresAt: Date;
  attempts: number;
  /** SHA-256 del token del último paso. Null hasta verificar el código. */
  resetTokenHash: string | null;
  resetExpiresAt: Date | null;
  usedAt: Date | null;
};

export interface PasswordResetRepository {
  /**
   * Crea un código nuevo e invalida los anteriores sin usar del usuario. Pedir
   * otro código tiene que matar el viejo: si no, quien tenga acceso a un correo
   * antiguo del usuario seguiría pudiendo usarlo.
   */
  reemplazarCodigo(datos: {
    userId: string;
    codeHash: string;
    expiresAt: Date;
  }): Promise<ResetRecord>;

  /** El código más reciente sin usar del usuario, o null. */
  vigenteDe(userId: string): Promise<ResetRecord | null>;

  /** Suma un intento fallido y devuelve el total. */
  sumarIntento(id: string): Promise<number>;

  marcarVerificado(
    id: string,
    token: { resetTokenHash: string; resetExpiresAt: Date },
  ): Promise<void>;

  porResetToken(resetTokenHash: string): Promise<ResetRecord | null>;

  /**
   * Marca el intento como usado SOLO si nadie lo usó antes, y dice si lo
   * consiguió. Tiene que ser atómico: con leer-y-luego-escribir, dos
   * peticiones simultáneas con el mismo token pasarían las dos la comprobación
   * y cambiarían la contraseña dos veces.
   */
  consumir(id: string): Promise<boolean>;
}
