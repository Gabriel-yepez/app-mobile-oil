import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { UpdatePrefsDto } from './update-prefs.dto';

const construir = (cuerpo: Record<string, unknown>) =>
  plainToInstance(UpdatePrefsDto, cuerpo);

const errores = (cuerpo: Record<string, unknown>) =>
  validateSync(construir(cuerpo), {
    whitelist: true,
    forbidNonWhitelisted: true,
  }).map((e) => e.property);

describe('UpdatePrefsDto', () => {
  // EL test de este archivo, por lo mismo que en UpdateProfileDto: un
  // @Transform sin guarda corre también sobre las claves ausentes y las
  // convierte en '' — y una cadena vacía ya no es opcional. Acá no hay ningún
  // @Transform justamente para que eso no pueda pasar.
  describe('un PATCH parcial no inventa los campos que no vinieron', () => {
    it('deja en undefined lo que no se mandó', () => {
      const dto = construir({ enabled: false });

      expect(dto.enabled).toBe(false);
      expect(dto.warnEnabled).toBeUndefined();
      expect(dto.overdueEnabled).toBeUndefined();
      expect(dto.checkinEnabled).toBeUndefined();
      expect(dto.warnThresholdKm).toBeUndefined();
      expect(dto.checkinWeekday).toBeUndefined();
    });

    it('valida sin errores mandando un solo campo', () => {
      expect(errores({ enabled: false })).toEqual([]);
    });

    it('acepta un cuerpo vacío: guardar sin cambiar nada no es un error', () => {
      expect(errores({})).toEqual([]);
    });
  });

  describe('rechaza lo que no tiene sentido', () => {
    it('un umbral fuera de rango', () => {
      expect(errores({ warnThresholdKm: 0 })).toContain('warnThresholdKm');
      expect(errores({ warnThresholdKm: 20_000 })).toContain('warnThresholdKm');
    });

    it('un día de la semana fuera de 1..7', () => {
      expect(errores({ checkinWeekday: 0 })).toContain('checkinWeekday');
      expect(errores({ checkinWeekday: 8 })).toContain('checkinWeekday');
    });

    it('campos que no son del recurso', () => {
      expect(errores({ userId: 'x' })).toContain('userId');
    });
  });
});
