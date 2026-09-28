import { parsearArgs } from './plan-set.args';

describe('plan:set — argumentos', () => {
  it('correo y plan, sin vencimiento', () => {
    expect(parsearArgs(['ana@correo.com', 'PRO'])).toEqual({
      email: 'ana@correo.com',
      plan: 'PRO',
      expiresAt: null,
    });
  });

  it('acepta el plan en minúsculas y normaliza el correo', () => {
    expect(parsearArgs([' Ana@Correo.com ', 'pro'])).toMatchObject({
      email: 'ana@correo.com',
      plan: 'PRO',
    });
  });

  // El vencimiento es el FINAL de ese día: "--hasta 2026-12-31" tiene que
  // incluir el 31, no cortarse a medianoche del 30.
  it('--hasta vence al final del día indicado', () => {
    expect(
      parsearArgs(['ana@correo.com', 'PRO', '--hasta', '2026-12-31']).expiresAt,
    ).toEqual(new Date('2027-01-01T00:00:00.000Z'));
  });

  it('volver al gratis no lleva vencimiento', () => {
    expect(parsearArgs(['ana@correo.com', 'FREE']).expiresAt).toBeNull();
  });

  it.each([
    [[]],
    [['ana@correo.com']],
    [['ana@correo.com', 'GOLD']],
    [['no-es-correo', 'PRO']],
    [['ana@correo.com', 'PRO', '--hasta', '31/12/2026']],
    [['ana@correo.com', 'FREE', '--hasta', '2026-12-31']],
  ])('rechaza %j con el modo de uso', (args) => {
    expect(() => parsearArgs(args)).toThrow(/Uso: pnpm plan:set/);
  });
});
