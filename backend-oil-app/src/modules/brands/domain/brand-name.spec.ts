// TABLA COMPARTIDA: estos mismos casos están duplicados en
// app-mobile/src/data/marcas/__tests__/nombre.test.ts. Si cambiás uno,
// cambiá el otro — que las dos normalizaciones no diverjan es justamente
// lo que estos casos protegen.
import { claveDeMarca, nombreValido, normalizarNombre } from './brand-name';

describe('claveDeMarca', () => {
  it.each([
    ['  toyota ', 'TOYOTA'],
    ['TOYOTA', 'TOYOTA'],
    ['Toyotá', 'TOYOTA'],
    ['Empire Keeway', 'EMPIREKEEWAY'],
    ['Mercedes-Benz', 'MERCEDESBENZ'],
    ['B.M.W.', 'BMW'],
    ['MD', 'MD'],
  ])('%s → %s', (entrada, esperado) => {
    expect(claveDeMarca(entrada)).toBe(esperado);
  });

  it('colapsa a la misma clave las variantes de una misma marca', () => {
    expect(claveDeMarca('toyota')).toBe(claveDeMarca('  TOYOTÁ  '));
  });
});

describe('normalizarNombre', () => {
  it('recorta los extremos y colapsa los espacios internos', () => {
    expect(normalizarNombre('  Empire   Keeway ')).toBe('Empire Keeway');
  });

  it('NO cambia la capitalización: rompería los acrónimos reales', () => {
    expect(normalizarNombre('MD')).toBe('MD');
    expect(normalizarNombre('AVA')).toBe('AVA');
    expect(normalizarNombre('chery')).toBe('chery');
  });
});

describe('nombreValido', () => {
  it.each([
    'Toyota',
    'Mercedes-Benz',
    'B.M.W.',
    'MD',
    'Empire Keeway',
    'BYD & Co',
  ])('acepta %s', (n) => {
    expect(nombreValido(n)).toBe(true);
  });

  it.each([
    ['', 'vacío'],
    ['   ', 'solo espacios'],
    ['-Toyota', 'arranca con símbolo'],
    [' .Toyota', 'arranca con símbolo tras recortar'],
    ['http://spam.com', 'URL'],
    ['a'.repeat(41), '41 caracteres'],
    // Los controles que NO son espacio en blanco sí se rechazan. El override
    // de derecha-a-izquierda es el vector real: permite mostrar un nombre al
    // revés de como está guardado.
    ['Toyota\u202Eoo', 'override RTL'],
    ['Toyo\u0000ta', 'byte nulo'],
    ['Toyota/Chevrolet', 'barra'],
    ['<b>Toyota</b>', 'etiquetas'],
  ])('rechaza %s (%s)', (n) => {
    expect(nombreValido(n)).toBe(false);
  });

  it('acepta exactamente 40 caracteres', () => {
    expect(nombreValido('a'.repeat(40))).toBe(true);
  });

  // Un salto de línea NO se rechaza: `normalizarNombre` lo colapsa a un
  // espacio antes de validar. Es correcto — el riesgo de un salto de línea es
  // que rompa el renderizado en varias líneas, y colapsarlo lo elimina. Lo que
  // queda es indistinguible de escribir esas dos palabras separadas, que de
  // todos modos es un nombre válido.
  it('colapsa el salto de línea en vez de rechazar el nombre', () => {
    expect(nombreValido('Toyota\nChevrolet')).toBe(true);
    expect(normalizarNombre('Toyota\nChevrolet')).toBe('Toyota Chevrolet');
  });
});
