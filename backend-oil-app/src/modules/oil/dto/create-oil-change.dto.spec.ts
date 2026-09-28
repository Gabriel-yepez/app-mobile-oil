import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CreateOilChangeDto } from './create-oil-change.dto';

const base = {
  changedAt: '2026-09-28T00:00:00.000Z',
  km: 45000,
  intervalKm: 5000,
  intervalMonths: 6,
  oilBrand: 'Pennzoil',
  oilTag: 'Platinum',
  oilViscosity: '5W-30',
  oilSynthetic: true,
};

const errores = (cuerpo: Record<string, unknown>) =>
  validateSync(plainToInstance(CreateOilChangeDto, cuerpo), {
    whitelist: true,
    forbidNonWhitelisted: true,
  }).map((e) => e.property);

describe('CreateOilChangeDto', () => {
  // El aceite, la viscosidad y el tipo los escribe el usuario a mano: no hay
  // catálogo. Lo que acá se valida es solo que quepa en la columna.
  describe('el aceite es texto libre', () => {
    it('acepta un nombre de una sola palabra (oilTag vacío)', () => {
      expect(errores({ ...base, oilBrand: 'Castrol', oilTag: '' })).toEqual([]);
    });

    it('acepta el tipo tal como lo escribió el usuario', () => {
      expect(errores({ ...base, oilType: 'Full synthetic' })).toEqual([]);
    });

    it('no exige el tipo: la app vieja no lo manda', () => {
      expect(errores(base)).toEqual([]);
    });

    it('acepta una viscosidad fuera de las comunes', () => {
      expect(errores({ ...base, oilViscosity: '15W40' })).toEqual([]);
    });
  });

  describe('rechaza lo que no cabe', () => {
    it('un aceite sin marca', () => {
      expect(errores({ ...base, oilBrand: '' })).toEqual(['oilBrand']);
    });

    it('un tipo de más de 30 caracteres', () => {
      expect(errores({ ...base, oilType: 'x'.repeat(31) })).toEqual([
        'oilType',
      ]);
    });
  });
});
