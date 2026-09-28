import { mailtoSoporte } from '../soporte';

const base = {
  email: 'soporte@ejemplo.com',
  priority: false,
  cuenta: 'ana@correo.com',
  plan: 'Gratis',
  version: '1.0.0',
};

const partes = (url: string) => {
  const [destino, query] = url.split('?');
  const q = new URLSearchParams(query);
  return { destino, subject: q.get('subject'), body: q.get('body') };
};

describe('mailtoSoporte', () => {
  it('va a la dirección de soporte con un asunto normal', () => {
    const r = partes(mailtoSoporte(base));
    expect(r.destino).toBe('mailto:soporte@ejemplo.com');
    expect(r.subject).toBe('Soporte Ruédalo');
  });

  // Es lo que hace "prioritario" al soporte: se ve en la bandeja y se
  // atiende primero.
  it('el pro lleva [PRO] al inicio del asunto', () => {
    expect(partes(mailtoSoporte({ ...base, priority: true })).subject).toBe('[PRO] Soporte Ruédalo');
  });

  it('el cuerpo trae la cuenta, el plan y la versión para no tener que preguntarlos', () => {
    const { body } = partes(mailtoSoporte(base));
    expect(body).toContain('ana@correo.com');
    expect(body).toContain('Gratis');
    expect(body).toContain('1.0.0');
  });

  // Un espacio o un & sin codificar cortan el enlace o parten el asunto.
  it('codifica el asunto y el cuerpo', () => {
    const url = mailtoSoporte({ ...base, cuenta: 'a&b@correo.com' });
    expect(url).not.toMatch(/ /);
    expect(partes(url).body).toContain('a&b@correo.com');
  });
});
