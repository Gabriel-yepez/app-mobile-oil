// Endpoints de /auth/password: recuperar la contraseña en tres pasos.
// Ninguno va autenticado: sirven justamente para quien no puede entrar.
import { ApiClient } from '../base';

export type VerifyResetCodeResponse = {
  /** Para el último paso. Un solo uso, 10 minutos de vida. */
  resetToken: string;
  expiresIn: number;
};

class PasswordController extends ApiClient {
  constructor() {
    super('/auth/password');
  }

  /**
   * Pide el código de 6 dígitos. Responde lo mismo exista o no la cuenta —a
   * propósito, para no delatar qué correos están registrados—, así que el
   * éxito de esta llamada NO significa que el correo tenga cuenta.
   */
  forgot(email: string) {
    return this.post<{ message: string }>('/forgot', { body: { email } });
  }

  /** Error `INVALID_RESET_CODE` si el código no sirve, por el motivo que sea. */
  verify(email: string, code: string) {
    return this.post<VerifyResetCodeResponse>('/verify', { body: { email, code } });
  }

  /**
   * Fija la contraseña nueva. Un 400 `VALIDATION_ERROR` trae en `details`
   * todas las reglas incumplidas; `INVALID_RESET_TOKEN` significa que hay que
   * empezar de nuevo. Al terminar, el servidor cierra TODAS las sesiones.
   */
  reset(resetToken: string, password: string, confirmPassword: string) {
    return this.post<void>('/reset', {
      body: { resetToken, password, confirmPassword },
    });
  }
}

export const passwordController = new PasswordController();
