import { Argon2Hasher } from './argon2.hasher';

describe('Argon2Hasher', () => {
  const hasher = new Argon2Hasher();

  it('verifica la contraseña correcta', async () => {
    const hash = await hasher.hash('contraseña1');
    await expect(hasher.verify(hash, 'contraseña1')).resolves.toBe(true);
  });

  it('rechaza la incorrecta', async () => {
    const hash = await hasher.hash('contraseña1');
    await expect(hasher.verify(hash, 'contraseña2')).resolves.toBe(false);
  });

  // Si dos usuarios con la misma clave tuvieran el mismo hash, una tabla
  // precalculada los rompería a todos de una vez. La sal lo impide.
  it('produce hashes distintos para la misma contraseña', async () => {
    const [a, b] = await Promise.all([
      hasher.hash('igual'),
      hasher.hash('igual'),
    ]);
    expect(a).not.toBe(b);
  });

  it('usa argon2id', async () => {
    expect(await hasher.hash('x')).toMatch(/^\$argon2id\$/);
  });

  it('devuelve false con un hash corrupto en vez de lanzar', async () => {
    await expect(hasher.verify('esto-no-es-un-hash', 'x')).resolves.toBe(false);
  });
});
