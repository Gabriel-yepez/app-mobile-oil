import { nuevoId } from '../ids';

describe('nuevoId', () => {
  it('devuelve un UUID v4', () => {
    expect(nuevoId()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it('no repite', () => {
    const muchos = new Set(Array.from({ length: 1000 }, () => nuevoId()));
    expect(muchos.size).toBe(1000);
  });
});
