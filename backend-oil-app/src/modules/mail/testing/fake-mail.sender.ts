// Doble de test: guarda los correos en vez de mandarlos, para que un test
// pueda leer el código que "llegó" sin depender de un servidor SMTP.
import type { Correo, MailSender } from '../domain/mail-sender';

export class FakeMailSender implements MailSender {
  readonly enviados: Correo[] = [];

  /** Si se pone, `enviar` falla: para probar qué pasa cuando el SMTP cae. */
  fallarCon: Error | null = null;

  enviar(correo: Correo): Promise<void> {
    if (this.fallarCon) return Promise.reject(this.fallarCon);
    this.enviados.push(correo);
    return Promise.resolve();
  }

  /** El último correo que se le mandó a esa dirección, o undefined. */
  ultimoPara(para: string): Correo | undefined {
    return [...this.enviados].reverse().find((c) => c.para === para);
  }
}
