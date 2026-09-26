// El puerto de salida del correo. Lo implementa SmtpMailSender en producción y
// FakeMailSender en los tests: ningún test manda correos de verdad.
//
// Es SMTP y no el SDK de un proveedor porque todos los proveedores razonables
// (Brevo, Resend, SendGrid, SES) hablan SMTP: cambiar de uno a otro son
// variables de entorno, no código.
export const MAIL_SENDER = Symbol('MAIL_SENDER');

export type Correo = {
  para: string;
  asunto: string;
  /** Siempre va texto plano: hay clientes que no muestran HTML. */
  texto: string;
  html?: string;
};

export interface MailSender {
  enviar(correo: Correo): Promise<void>;
}
