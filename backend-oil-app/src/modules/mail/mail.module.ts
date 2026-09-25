import { Module } from '@nestjs/common';
import { SmtpMailSender } from '../../infra/mail/smtp-mail.sender';
import { MAIL_SENDER } from './domain/mail-sender';

@Module({
  providers: [
    // La línea intercambiable: otro transporte (el SDK de un proveedor, una
    // cola) es otra clase que cumpla MailSender y este useClass.
    { provide: MAIL_SENDER, useClass: SmtpMailSender },
  ],
  exports: [MAIL_SENDER],
})
export class MailModule {}
