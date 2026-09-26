import { ApiError } from '../../../api/base';
import { avisoDeAlta, avisoDeFallo } from '../aviso';
import type { ApiBrandCreada } from '../../../api/controllers/brands.controller';

const respuesta = (name: string, created: boolean): ApiBrandCreada => ({
  id: 'b1',
  kind: 'car',
  name,
  nameKey: name.toUpperCase(),
  created,
});

describe('avisoDeAlta', () => {
  it('celebra la que se creó', () => {
    expect(avisoDeAlta(respuesta('Chery', true))).toEqual({
      kind: 'ok',
      text: 'Chery agregada al catálogo',
    });
  });

  // No es un fallo, pero tampoco es lo que el usuario creía estar haciendo:
  // por eso `info` y no `ok`.
  it('avisa sin celebrar la que ya estaba', () => {
    expect(avisoDeAlta(respuesta('Toyota', false))).toEqual({
      kind: 'info',
      text: 'Toyota ya estaba en el catálogo',
    });
  });

  it('usa el nombre que devolvió el servidor, no el que escribió el usuario', () => {
    // El servidor devuelve la capitalización del catálogo: quien escribió
    // "toyota" tiene que leer "Toyota ya estaba", no su propio texto.
    expect(avisoDeAlta(respuesta('Toyota', false))?.text).toContain('Toyota');
  });
});

describe('avisoDeFallo', () => {
  it('muestra el mensaje que manda la API en un rechazo permanente', () => {
    const e = new ApiError(422, 'BRAND_NAME_INVALID', 'Ese nombre no es válido.');
    expect(avisoDeFallo(e)).toEqual({ kind: 'error', text: 'Ese nombre no es válido.' });
  });

  // Un fallo de red se reintenta solo. Avisarle al usuario de algo que no hizo
  // mal y que se va a resolver solo es ruido.
  it.each([
    [0, 'sin red'],
    [500, 'servidor caído'],
    [429, 'demasiadas peticiones'],
  ])('no avisa nada ante un fallo transitorio (%i, %s)', (status) => {
    expect(avisoDeFallo(new ApiError(status, 'X', 'algo'))).toBeNull();
  });

  it('no avisa cuando la sesión se cayó: de eso se encarga el flujo de sesión', () => {
    expect(avisoDeFallo(new ApiError(401, 'UNAUTHORIZED', 'no autorizado'))).toBeNull();
  });

  it('ante un error desconocido no avisa: se trata como transitorio', () => {
    expect(avisoDeFallo(new Error('vaya a saber'))).toBeNull();
  });
});
