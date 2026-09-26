// Recuperar contraseña en tres pasos: pedir código → verificarlo → fijar la
// contraseña nueva.
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createHash,
  createHmac,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from 'node:crypto';
import { Errors } from '../../common/errors';
import { MAIL_SENDER, type MailSender } from '../mail/domain/mail-sender';
import {
  USER_REPOSITORY,
  type UserRepository,
} from '../users/domain/user.repository';
import { PASSWORD_HASHER, type PasswordHasher } from './domain/password-hasher';
import {
  PASSWORD_RESET_REPOSITORY,
  type PasswordResetRepository,
} from './domain/password-reset.repository';
import {
  REFRESH_TOKEN_REPOSITORY,
  type RefreshTokenRepository,
} from './domain/refresh-token.repository';
import { correoCodigo, correoContrasenaCambiada } from './password-reset.mails';

const MINUTOS_CODIGO = 15;
const SEGUNDOS_TOKEN = 10 * 60;
/**
 * Con 5 intentos por código, adivinarlo tiene una probabilidad de 1 en
 * 200.000. Sin tope, el millón de combinaciones se recorre en un rato.
 */
const MAX_INTENTOS = 5;

@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);
  private readonly secreto: string;

  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(PASSWORD_RESET_REPOSITORY)
    private readonly resets: PasswordResetRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    @Inject(REFRESH_TOKEN_REPOSITORY)
    private readonly refreshTokens: RefreshTokenRepository,
    @Inject(MAIL_SENDER) private readonly mail: MailSender,
    config: ConfigService,
  ) {
    this.secreto = config.getOrThrow<string>('RESET_CODE_SECRET');
  }

  // HMAC y no un SHA-256 simple: un código de 6 dígitos son un millón de
  // combinaciones y con un hash simple un volcado de la base alcanzaría para
  // sacarlos todos. El secreto no vive en la base, así que el volcado solo no
  // basta. Va atado al usuario: el mismo código para dos cuentas da dos
  // firmas distintas.
  private firmar(userId: string, codigo: string): string {
    return createHmac('sha256', this.secreto)
      .update(`${userId}:${codigo}`)
      .digest('hex');
  }

  // El token del último paso son 256 bits aleatorios: no hay espacio que
  // recorrer, así que un SHA-256 simple basta (igual que el refresh token).
  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  /**
   * Genera y envía un código si la cuenta existe. Nunca lanza por un correo
   * sin cuenta ni por un fallo del SMTP: el endpoint tiene que responder igual
   * en todos los casos, o delataría qué correos están registrados.
   */
  async solicitarCodigo(email: string): Promise<void> {
    const user = await this.users.findByEmail(email);
    if (!user) return;

    // randomInt es del generador criptográfico. Math.random() sería
    // predecible para quien vea suficientes códigos.
    const codigo = randomInt(0, 1_000_000).toString().padStart(6, '0');

    await this.resets.reemplazarCodigo({
      userId: user.id,
      codeHash: this.firmar(user.id, codigo),
      expiresAt: new Date(Date.now() + MINUTOS_CODIGO * 60_000),
    });

    try {
      await this.mail.enviar(correoCodigo(user.email, codigo, MINUTOS_CODIGO));
    } catch (e) {
      // Se registra y se sigue: el usuario puede pedir otro código. Que el
      // error suba haría que el endpoint respondiera distinto.
      this.logger.error(
        `No se pudo enviar el código de recuperación a ${user.id}`,
        e instanceof Error ? e.stack : String(e),
      );
    }
  }

  async verificarCodigo(
    email: string,
    codigo: string,
  ): Promise<{ resetToken: string; expiresIn: number }> {
    const user = await this.users.findByEmail(email);
    if (!user) throw Errors.invalidResetCode();

    const intento = await this.resets.vigenteDe(user.id);
    if (
      !intento ||
      intento.expiresAt.getTime() <= Date.now() ||
      intento.attempts >= MAX_INTENTOS
    ) {
      throw Errors.invalidResetCode();
    }

    // Comparación en tiempo constante: con un === el tiempo de respuesta
    // diría cuántos caracteres de la firma coinciden.
    const esperado = Buffer.from(intento.codeHash, 'hex');
    const recibido = Buffer.from(this.firmar(user.id, codigo), 'hex');
    if (
      esperado.length !== recibido.length ||
      !timingSafeEqual(esperado, recibido)
    ) {
      await this.resets.sumarIntento(intento.id);
      throw Errors.invalidResetCode();
    }

    const resetToken = randomBytes(32).toString('base64url');
    await this.resets.marcarVerificado(intento.id, {
      resetTokenHash: this.hashToken(resetToken),
      resetExpiresAt: new Date(Date.now() + SEGUNDOS_TOKEN * 1000),
    });

    return { resetToken, expiresIn: SEGUNDOS_TOKEN };
  }

  async restablecer(resetToken: string, password: string): Promise<void> {
    const intento = await this.resets.porResetToken(this.hashToken(resetToken));
    if (
      !intento ||
      intento.usedAt ||
      !intento.resetExpiresAt ||
      intento.resetExpiresAt.getTime() <= Date.now()
    ) {
      throw Errors.invalidResetToken();
    }

    // Se consume ANTES de cambiar nada, y de forma atómica: de dos peticiones
    // simultáneas con el mismo token, solo una llega a cambiar la contraseña.
    if (!(await this.resets.consumir(intento.id))) {
      throw Errors.invalidResetToken();
    }

    await this.users.updatePasswordHash(
      intento.userId,
      await this.hasher.hash(password),
    );

    // Si alguien robó la cuenta, cambiar la contraseña tiene que echarlo.
    await this.refreshTokens.revokeAllForUser(intento.userId);

    const user = await this.users.findById(intento.userId);
    if (user) {
      await this.mail
        .enviar(correoContrasenaCambiada(user.email))
        .catch((e: unknown) =>
          this.logger.error(
            `No se pudo avisar del cambio de contraseña a ${user.id}`,
            e instanceof Error ? e.stack : String(e),
          ),
        );
    }
  }
}
