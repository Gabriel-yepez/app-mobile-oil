import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { UpdateProfileDto } from './update-profile.dto';

const construir = (cuerpo: Record<string, unknown>) =>
  plainToInstance(UpdateProfileDto, cuerpo);

const errores = (cuerpo: Record<string, unknown>) =>
  validateSync(construir(cuerpo), {
    whitelist: true,
    forbidNonWhitelisted: true,
  }).map((e) => e.property);

describe('UpdateProfileDto', () => {
  // EL test de este archivo. Los @Transform de class-transformer corren
  // también sobre las claves ausentes, así que una normalización sin guarda
  // convierte un `undefined` en `''` — y una cadena vacía ya no es opcional.
  // El síntoma sería absurdo desde el formulario: cambiar solo el teléfono
  // rebotaría con "La ciudad debe tener entre 2 y 60 caracteres".
  describe('un PATCH parcial no inventa los campos que no vinieron', () => {
    it('deja en undefined lo que no se mandó', () => {
      const dto = construir({ phone: '+58 412 111 2222' });

      expect(dto.phone).toBe('+58 412 111 2222');
      expect(dto.city).toBeUndefined();
      expect(dto.state).toBeUndefined();
      expect(dto.fullName).toBeUndefined();
      expect(dto.email).toBeUndefined();
      expect(dto.currency).toBeUndefined();
    });

    it('valida sin errores mandando un solo campo', () => {
      expect(errores({ phone: '+58 412 111 2222' })).toEqual([]);
    });

    it('acepta un cuerpo vacío: guardar sin cambiar nada no es un error', () => {
      expect(errores({})).toEqual([]);
    });
  });

  describe('normaliza igual que el registro', () => {
    it('pasa el correo a minúsculas y lo recorta', () => {
      expect(construir({ email: '  Luis@Correo.COM ' }).email).toBe(
        'luis@correo.com',
      );
    });

    it.each([
      ['  distrito   CAPITAL ', 'Distrito Capital'],
      ['caracas', 'Caracas'],
      ['san juan DE los morros', 'San Juan de los Morros'],
    ])('normaliza el lugar %s → %s', (entrada, esperado) => {
      expect(construir({ city: entrada }).city).toBe(esperado);
    });

    it('recorta el nombre', () => {
      expect(construir({ fullName: '  Luis Guerrero ' }).fullName).toBe(
        'Luis Guerrero',
      );
    });
  });

  describe('rechaza lo que no se edita por acá', () => {
    // No es un olvido de la lista blanca: es la razón de que la lista sea a
    // mano y no un PartialType(RegisterDto), que sí los dejaría pasar.
    it.each(['cedula', 'password', 'id'])('rechaza %s', (campo) => {
      expect(errores({ [campo]: 'loquesea' })).toContain(campo);
    });
  });

  describe('valida lo que sí acepta', () => {
    it.each([
      ['email', 'no-es-un-correo'],
      ['phone', 'llámame'],
      ['fullName', 'L'],
      ['city', 'C'],
      ['currency', 'EUR'],
    ])('rechaza un %s inválido', (campo, valor) => {
      expect(errores({ [campo]: valor })).toContain(campo);
    });
  });
});
