import { unirTalleres } from '../useShops';

const t = (name: string, nameKey: string, id = nameKey) => ({ id, name, nameKey });

describe('unirTalleres', () => {
  it('suma los pendientes a los del servidor, ordenados por nombre', () => {
    const r = unirTalleres(
      [t('Tecnicentro Cordero', 'TECNICENTROCORDERO')],
      [t('Auto Pérez', 'AUTOPEREZ')],
    );
    expect(r.map((x) => x.name)).toEqual(['Auto Pérez', 'Tecnicentro Cordero']);
  });

  it('con la misma clave gana el del servidor: es el que ven todos', () => {
    const r = unirTalleres(
      [t('Lubricantes El Marqués', 'LUBRICANTESELMARQUES', 'srv')],
      [t('lubricantes el marques', 'LUBRICANTESELMARQUES', 'local')],
    );
    expect(r).toHaveLength(1);
    expect(r[0].id).toBe('srv');
    expect(r[0].name).toBe('Lubricantes El Marqués');
  });
});
