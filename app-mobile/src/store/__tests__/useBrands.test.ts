import { unirMarcas } from '../useBrands';
import type { ApiBrand } from '../../api/controllers/brands.controller';

const marca = (id: string, name: string, nameKey: string): ApiBrand => ({
  id,
  kind: 'car',
  name,
  nameKey,
});

describe('unirMarcas', () => {
  it('une las del servidor con las pendientes, ordenadas', () => {
    const servidor = [marca('1', 'Toyota', 'TOYOTA')];
    const pendientes = [marca('2', 'Chery', 'CHERY')];

    expect(unirMarcas(servidor, pendientes).map((b) => b.name)).toEqual([
      'Chery',
      'Toyota',
    ]);
  });

  it('no muestra duplicados cuando la pendiente ya llegó al servidor', () => {
    // El caso real: se agregó sin señal, la cola la envió, el refresco la trajo
    // de vuelta, y la pendiente todavía no se limpió del estado local.
    const servidor = [marca('1', 'Chery', 'CHERY')];
    const pendientes = [marca('2', 'chery', 'CHERY')];

    const r = unirMarcas(servidor, pendientes);
    expect(r).toHaveLength(1);
    // Gana la del servidor: es la que van a ver los demás.
    expect(r[0].name).toBe('Chery');
  });

  it('ordena ignorando mayúsculas y acentos', () => {
    const servidor = [
      marca('1', 'ávila', 'AVILA'),
      marca('2', 'Bera', 'BERA'),
      marca('3', 'AVA', 'AVA'),
    ];
    expect(unirMarcas(servidor, []).map((b) => b.name)).toEqual([
      'AVA',
      'ávila',
      'Bera',
    ]);
  });
});
