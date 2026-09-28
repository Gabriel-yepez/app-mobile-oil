import { htmlHistorial, type FilaPdf } from '../historialPdf';

const fila = (over: Partial<FilaPdf> = {}): FilaPdf => ({
  fecha: '2026-09-10T00:00:00.000Z',
  vehiculo: 'Toyota Corolla · AB123CD',
  km: 45_000,
  aceite: 'Pennzoil Platinum 5W-30',
  taller: 'Lubricentro El Rápido',
  costoUsd: 32,
  ...over,
});

const doc = (filas: FilaPdf[]) =>
  htmlHistorial({ titular: 'Ana Pérez', generado: new Date('2026-09-26T15:00:00Z'), filas });

describe('htmlHistorial', () => {
  it('lista cada cambio con fecha, km y costo en formato es-VE', () => {
    const html = doc([fila()]);
    expect(html).toContain('10 sep 2026');
    expect(html).toContain('45.000');
    expect(html).toContain('$32,00');
    expect(html).toContain('Toyota Corolla · AB123CD');
  });

  it('suma el total en USD', () => {
    expect(doc([fila({ costoUsd: 32 }), fila({ costoUsd: 18.5 })])).toContain('$50,50');
  });

  // El taller y el aceite los escribe el usuario: sin escapar, un "<" rompe
  // el documento o mete marcado ajeno en el PDF.
  it('escapa lo que escribió el usuario', () => {
    const html = doc([fila({ taller: '<b>Taller & Hijos</b>' })]);
    expect(html).toContain('&lt;b&gt;Taller &amp; Hijos&lt;/b&gt;');
    expect(html).not.toContain('<b>Taller');
  });

  it('un cambio sin taller ni costo muestra un guion', () => {
    const html = doc([fila({ taller: null, costoUsd: null })]);
    expect(html).toContain('—');
  });

  it('dice para quién es y cuándo se generó', () => {
    const html = doc([fila()]);
    expect(html).toContain('Ana Pérez');
    expect(html).toContain('26 sep 2026');
  });
});
