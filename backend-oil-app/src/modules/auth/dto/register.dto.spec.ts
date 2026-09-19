import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { RegisterDto } from './register.dto';

const base = {
  fullName: 'Luis Guerrero',
  cedula: 'V-25.481.073',
  email: '  Luis.Guerrero@Correo.COM ',
  phone: '+58 414 528 9012',
  state: '  distrito   CAPITAL ',
  city: 'caracas',
  password: 'contrasena1',
};

const construir = (over: Partial<typeof base> = {}) =>
  plainToInstance(RegisterDto, { ...base, ...over });

describe('RegisterDto', () => {
  it('normaliza el correo a minúsculas y sin espacios', () => {
    expect(construir().email).toBe('luis.guerrero@correo.com');
  });

  // Sin esto, "V-25.481.073" y "25481073" crearían dos cuentas de la misma
  // persona y el índice único de la base no serviría de nada.
  it.each([
    ['V-25.481.073', 'V25481073'],
    ['25.481.073', 'V25481073'],
    ['v25481073', 'V25481073'],
    ['E-84.123.456', 'E84123456'],
  ])('normaliza la cédula %s → %s', (entrada, esperado) => {
    expect(construir({ cedula: entrada }).cedula).toBe(esperado);
  });

  // Estado y ciudad son texto libre por decisión de producto. La
  // normalización no sustituye a un catálogo cerrado, pero evita el caso
  // frecuente: que "Caracas", "caracas" y "CARACAS" acaben siendo tres zonas
  // distintas en cualquier agrupación.
  it.each([
    ['  distrito   CAPITAL ', 'Distrito Capital'],
    ['caracas', 'Caracas'],
    ['SAN JUAN DE LOS MORROS', 'San Juan de los Morros'],
    ['nueva  esparta', 'Nueva Esparta'],
  ])('normaliza el lugar %s → %s', (entrada, esperado) => {
    expect(construir({ state: entrada }).state).toBe(esperado);
    expect(construir({ city: entrada }).city).toBe(esperado);
  });

  it('la moneda por defecto es BOTH cuando no se envía', () => {
    const dto = plainToInstance(RegisterDto, { ...base });
    expect(dto.currency).toBe('BOTH');
    expect(validateSync(dto)).toHaveLength(0);
  });

  it('acepta un registro válido', () => {
    expect(validateSync(construir())).toHaveLength(0);
  });

  it.each([
    ['contraseña de 7', { password: 'abc123x' }],
    ['contraseña sin dígito', { password: 'solamenteletras' }],
    ['contraseña sin letra', { password: '12345678' }],
    ['correo inválido', { email: 'no-es-correo' }],
    ['nombre vacío', { fullName: '   ' }],
    ['cédula corta', { cedula: 'V-123' }],
    ['estado vacío', { state: '   ' }],
    ['ciudad vacía', { city: '' }],
  ])('rechaza %s', (_, over) => {
    expect(validateSync(construir(over)).length).toBeGreaterThan(0);
  });
});
