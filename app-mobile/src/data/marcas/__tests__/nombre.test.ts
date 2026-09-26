// TABLA COMPARTIDA: los casos de `claveDeMarca` están duplicados en
// backend-oil-app/src/modules/brands/domain/brand-name.spec.ts. Si cambiás
// uno, cambiá el otro — que las dos normalizaciones no diverjan es justamente
// lo que estos casos protegen.
import { claveDeMarca, distancia, nombreValido, sugerirParecida } from '../nombre';

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
});

describe('nombreValido', () => {
  it.each(['Toyota', 'Mercedes-Benz', 'B.M.W.', 'MD', 'Empire Keeway'])(
    'acepta %s',
    (n) => {
      expect(nombreValido(n)).toBe(true);
    },
  );

  it.each(['', '   ', '-Toyota', 'http://spam.com', 'a'.repeat(41)])(
    'rechaza %s',
    (n) => {
      expect(nombreValido(n)).toBe(false);
    },
  );
});

describe('distancia', () => {
  it.each([
    ['TOYOTA', 'TOYOTA', 0],
    ['TOYTA', 'TOYOTA', 1],
    ['CHEVORLET', 'CHEVROLET', 2],
    ['MD', 'AVA', 3],
  ])('%s vs %s → %i', (a, b, esperado) => {
    expect(distancia(a as string, b as string)).toBe(esperado);
  });
});

describe('sugerirParecida', () => {
  const CARROS = ['Toyota', 'Chevrolet', 'Ford', 'Kia'];

  it('sugiere Toyota para un dedazo', () => {
    expect(sugerirParecida('toyta', CARROS)).toBe('Toyota');
  });

  it('sugiere Chevrolet para letras transpuestas', () => {
    expect(sugerirParecida('chevorlet', CARROS)).toBe('Chevrolet');
  });

  it('no sugiere nada si la marca ya existe exacta', () => {
    expect(sugerirParecida('Toyota', CARROS)).toBeNull();
    expect(sugerirParecida('  TOYOTA ', CARROS)).toBeNull();
  });

  it('no sugiere nada para una marca genuinamente nueva', () => {
    expect(sugerirParecida('Chery', CARROS)).toBeNull();
  });

  // El umbral por largo existe por ESTE caso: MD y AVA están a distancia 2 y
  // son dos marcas reales y distintas del catálogo de motos. Con un umbral
  // fijo de 2, la app ofrecería reemplazar una por la otra.
  it('no sugiere AVA cuando el usuario escribe MD', () => {
    expect(sugerirParecida('MD', ['AVA', 'Bera', 'Yamaha'])).toBeNull();
  });

  it('elige la más parecida cuando hay varias candidatas', () => {
    expect(sugerirParecida('Yamah', ['Yamaha', 'Yamahaa'])).toBe('Yamaha');
  });

  it('devuelve null con texto vacío', () => {
    expect(sugerirParecida('   ', CARROS)).toBeNull();
  });
});
