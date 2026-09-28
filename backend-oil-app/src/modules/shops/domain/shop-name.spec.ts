// TABLA COMPARTIDA: estos mismos casos están en
// app-mobile/src/data/talleres/__tests__/nombre.test.ts. Si cambias uno,
// cambia el otro.
import { claveDeTaller, nombreValido } from './shop-name';

describe('claveDeTaller', () => {
  it('colapsa a la misma clave las variantes de un mismo taller', () => {
    expect(claveDeTaller('Lubricantes El Marqués')).toBe(
      claveDeTaller('  lubricantes el marques '),
    );
  });
});

describe('nombreValido (taller)', () => {
  it.each([
    'Lubricantes El Marqués',
    'Auto Express C.A.',
    'Taller Hnos. Pérez (Los Ruices)',
    'Lubricentro #1',
    "Mike's Garage",
    'Servicio Rápido, S.A.',
    'a'.repeat(60),
  ])('acepta %s', (n) => {
    expect(nombreValido(n)).toBe(true);
  });

  it.each([
    ['', 'vacío'],
    ['   ', 'solo espacios'],
    ['#Taller', 'arranca con símbolo'],
    ['http://spam.com', 'URL'],
    ['Taller 24/7', 'barra'],
    ['<b>Taller</b>', 'etiquetas'],
    ['a'.repeat(61), '61 caracteres'],
  ])('rechaza %s (%s)', (n) => {
    expect(nombreValido(n)).toBe(false);
  });
});
