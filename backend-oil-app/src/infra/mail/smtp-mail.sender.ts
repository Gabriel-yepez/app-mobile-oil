// Adaptador SMTP del puerto MAIL_SENDER.
//
// nodemailer va fijado a la 9.x: la 10 es ESM puro y este backend compila a
// CommonJS — cargarla tumbaría Jest entero, como ya pasó con expo-server-sdk.
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';
import type { Correo, MailSender } from '../../modules/mail/domain/mail-sender';

@Injectable()
export class SmtpMailSender implements MailSender {
  private readonly transporte: Transporter;
  private readonly remitente: string;

  constructor(config: ConfigService) {
    const puerto = config.get<number>('SMTP_PORT', 1025);
    const usuario = config.get<string>('SMTP_USER');

    this.transporte = createTransport({
      host: config.get<string>('SMTP_HOST', 'localhost'),
      port: puerto,
      // 465 es TLS desde el primer byte; el resto de puertos arrancan en claro
      // y nodemailer sube a TLS con STARTTLS si el servidor lo ofrece. Por
      // eso no hay una variable SMTP_SECURE: sería una bandera más que
      // configurar mal, y el puerto ya dice cuál de los dos es.
      secure: puerto === 465,
      // Sin usuario no hay auth: es el caso de Mailpit. Una cadena vacía en el
      // .env cuenta como "sin usuario".
      ...(usuario
        ? { auth: { user: usuario, pass: config.get<string>('SMTP_PASS') } }
        : {}),
      // Topes explícitos: los de nodemailer son de minutos, y un proveedor
      // que no contesta no debe dejar colgada una petición HTTP tanto tiempo.
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
    });

    this.remitente = config.get<string>(
      'MAIL_FROM',
      'Ruédalo <no-responder@ruedalo.local>',
    );
  }

  async enviar(correo: Correo): Promise<void> {
    await this.transporte.sendMail({
      from: this.remitente,
      to: correo.para,
      subject: correo.asunto,
      text: correo.texto,
      ...(correo.html ? { html: correo.html } : {}),
    });
  }
}
