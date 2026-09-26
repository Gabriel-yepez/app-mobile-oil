import { contieneGroseria } from './palabras-vetadas';

describe('contieneGroseria', () => {
  it.each(['Mierda', 'PUTA', 'pendejo', 'Coño', 'Verga', 'Gonorrea'])(
    'rechaza %s',
    (n) => {
      expect(contieneGroseria(n)).toBe(true);
    },
  );

  it.each(['M13RD4', 'p3nd3j0', 'pu74', 'c0ñ0'])(
    'rechaza la variante con números: %s',
    (n) => {
      expect(contieneGroseria(n)).toBe(true);
    },
  );

  it('rechaza con letras repetidas de más', () => {
    expect(contieneGroseria('mierdaaaaa')).toBe(true);
  });

  it('rechaza cuando va separada con espacios', () => {
    expect(contieneGroseria('p e n d e j o')).toBe(true);
  });

  it('rechaza cuando está incrustada en una palabra más larga', () => {
    expect(contieneGroseria('supermierda')).toBe(true);
  });

  it('rechaza cuando acompaña a una marca real', () => {
    expect(contieneGroseria('Toyota Mierda')).toBe(true);
  });

  // ── El guard que de verdad importa ───────────────────────────────────────
  // Un filtro que rechaza una marca legítima rompe la feature para alguien
  // honesto que no entiende por qué. Si mañana alguien suma un término a la
  // lista y pisa una marca real, este bloque lo caza.
  describe('no rechaza marcas reales', () => {
    it.each([
      // Las 18 semillas
      'Toyota',
      'Chevrolet',
      'Ford',
      'Hyundai',
      'Kia',
      'Renault',
      'Fiat',
      'Jeep',
      'Nissan',
      'Mitsubishi',
      'Bera',
      'Empire Keeway',
      'MD',
      'Yamaha',
      'Suzuki',
      'Honda',
      'AVA',
      'Skygo',
      // Las que un usuario venezolano va a agregar
      'Chery',
      'JAC',
      'BYD',
      'Dongfeng',
      'Foton',
      'Haval',
      'Great Wall',
      'Zotye',
      'Changan',
      'SsangYong',
      'Mercedes-Benz',
      'BMW',
      'Audi',
      'Volkswagen',
      'Peugeot',
      'Citroën',
      'Dodge',
      'Chrysler',
      'Mack',
      'Iveco',
      'Encava',
      'Daihatsu',
      'Subaru',
      'Land Rover',
      'Mini',
      // Casos que un filtro ingenuo rompería
      'Passat', // contiene "ass"
      'Conosur', // contiene "cono", que es "coño" sin la eñe
      'Disputa', // contiene "puta"
      'Escort', // contiene "scort"
    ])('acepta %s', (marca) => {
      expect(contieneGroseria(marca)).toBe(false);
    });
  });
});
