import { COLORES, type VehicleColor } from './vehicle-color';

describe('catálogo de colores', () => {
  it('trae los 10 en el orden curado', () => {
    expect(COLORES.map((c) => c.name)).toEqual([
      'Negro', 'Gris', 'Plata', 'Blanco', 'Rojo',
      'Vinotinto', 'Azul', 'Verde', 'Amarillo', 'Beige',
    ]);
  });

  // Un hex mal escrito no rompe el backend: rompe la app, que lo pinta como
  // transparente o revienta. Se caza acá, que es donde se escribe la lista.
  it.each(COLORES.map((c): [string, VehicleColor] => [c.name, c]))(
    '%s tiene un hex válido de 6 dígitos',
    (_nombre, color) => {
      expect(color.hex).toMatch(/^#[0-9A-F]{6}$/i);
    },
  );

  it('no repite nombres', () => {
    const nombres = COLORES.map((c) => c.name);
    expect(new Set(nombres).size).toBe(nombres.length);
  });

  it('no repite hex: dos colores con el mismo tono son el mismo color', () => {
    const hexes = COLORES.map((c) => c.hex.toUpperCase());
    expect(new Set(hexes).size).toBe(hexes.length);
  });

  // Estos seis venían quemados en la app. Si alguien les cambia el tono, los
  // vehículos ya registrados dejan de calzar con el catálogo y la pantalla de
  // edición los muestra como "otro color".
  it.each([
    ['Negro', '#1F2937'],
    ['Gris', '#9CA3AF'],
    ['Blanco', '#F3F4F6'],
    ['Rojo', '#DC2626'],
    ['Azul', '#2563EB'],
    ['Verde', '#059669'],
  ])('conserva el hex histórico de %s', (nombre, hex) => {
    expect(COLORES.find((c) => c.name === nombre)?.hex).toBe(hex);
  });
});
