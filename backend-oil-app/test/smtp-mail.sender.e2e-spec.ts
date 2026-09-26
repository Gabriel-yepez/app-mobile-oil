// Integración real: manda un correo por SMTP a Mailpit (docker-compose) y lo
// busca en su API. Es el único test que prueba que el adaptador habla SMTP de
// verdad; el resto usa FakeMailSender.
import 'dotenv/config';
import { ConfigService } from '@nestjs/config';
import { SmtpMailSender } from '../src/infra/mail/smtp-mail.sender';

const MAILPIT = 'http://localhost:8025/api/v1';

type Resumen = { ID: string; Subject: string };
type Mensaje = {
  Subject: string;
  Text: string;
  HTML: string;
  From: { Address: string };
};

/** Mailpit indexa el correo un instante después de recibirlo: se reintenta. */
async function buscarPara(direccion: string): Promise<Mensaje> {
  for (let intento = 0; intento < 20; intento++) {
    const res = await fetch(
      `${MAILPIT}/search?query=${encodeURIComponent(`to:"${direccion}"`)}`,
    );
    const { messages } = (await res.json()) as { messages: Resumen[] };
    if (messages.length > 0) {
      const detalle = await fetch(`${MAILPIT}/message/${messages[0].ID}`);
      return (await detalle.json()) as Mensaje;
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error(`Mailpit no recibió nada para ${direccion}`);
}

describe('SmtpMailSender (integración con Mailpit)', () => {
  const sender = new SmtpMailSender(new ConfigService());

  it('entrega el correo con asunto, texto y HTML', async () => {
    const para = `smtp-${Date.now()}-${Math.floor(Math.random() * 1e6)}@e2e.local`;

    await sender.enviar({
      para,
      asunto: 'Prueba de integración',
      texto: 'Tu código es 123456',
      html: '<p>Tu código es <b>123456</b></p>',
    });

    const recibido = await buscarPara(para);
    expect(recibido.Subject).toBe('Prueba de integración');
    expect(recibido.Text).toContain('123456');
    expect(recibido.HTML).toContain('<b>123456</b>');
    expect(recibido.From.Address).toContain('@');
  });

  // Los acentos y la ñ son lo primero que se rompe cuando la codificación del
  // correo está mal configurada, y los usuarios escriben en español.
  it('conserva los acentos del asunto y del cuerpo', async () => {
    const para = `acentos-${Date.now()}@e2e.local`;

    await sender.enviar({
      para,
      asunto: 'Recuperación de contraseña — Ruédalo',
      texto: 'Código de recuperación: ñandú',
    });

    const recibido = await buscarPara(para);
    expect(recibido.Subject).toBe('Recuperación de contraseña — Ruédalo');
    expect(recibido.Text).toContain('ñandú');
  });
});
