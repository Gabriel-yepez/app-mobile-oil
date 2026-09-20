import { ProfileService } from './profile.service';
import { InMemoryUserRepository } from './testing/in-memory-user.repository';
import type { NewUser, User } from './domain/user';

const nuevo = (over: Partial<NewUser> = {}): NewUser => ({
  fullName: 'Luis Guerrero',
  cedula: 'V25481073',
  email: 'luis@correo.com',
  phone: '+58 414 528 9012',
  passwordHash: 'hash:contrasena1',
  state: 'Distrito Capital',
  city: 'Caracas',
  currency: 'BOTH',
  ...over,
});

describe('ProfileService', () => {
  let users: InMemoryUserRepository;
  let service: ProfileService;
  let luis: User;

  beforeEach(async () => {
    users = new InMemoryUserRepository();
    service = new ProfileService(users);
    luis = await users.create(nuevo());
  });

  it('guarda los campos que vinieron y deja los demás intactos', async () => {
    const { user, changed } = await service.updateProfile(luis, {
      phone: '+58 412 111 2222',
      city: 'Valencia',
    });

    expect(user.phone).toBe('+58 412 111 2222');
    expect(user.city).toBe('Valencia');
    expect(changed.sort()).toEqual(['city', 'phone']);
    // Lo que no vino no se toca.
    expect(user.fullName).toBe('Luis Guerrero');
    expect(user.state).toBe('Distrito Capital');
    expect(user.currency).toBe('BOTH');
  });

  it('persiste el cambio: la siguiente lectura ya lo trae', async () => {
    await service.updateProfile(luis, { fullName: 'Luis A. Guerrero' });

    expect((await users.findById(luis.id))?.fullName).toBe('Luis A. Guerrero');
  });

  it('nunca toca la cédula ni el hash de la contraseña', async () => {
    // El tipo ya lo impide; el cast comprueba que además lo impide en
    // ejecución, que es lo que corre si alguien manda esos campos por HTTP.
    const { user } = await service.updateProfile(luis, {
      cedula: 'V99999999',
      passwordHash: 'hash:otra',
    } as never);

    expect(user.cedula).toBe('V25481073');
    expect(user.passwordHash).toBe('hash:contrasena1');
  });

  describe('cuando no hay nada que cambiar', () => {
    it('devuelve changed vacío si el cuerpo viene vacío', async () => {
      const { user, changed } = await service.updateProfile(luis, {});

      expect(changed).toEqual([]);
      expect(user).toBe(luis);
    });

    it('ignora los campos que llegan con el valor que ya tenían', async () => {
      const { changed } = await service.updateProfile(luis, {
        fullName: 'Luis Guerrero',
        email: 'luis@correo.com',
        city: 'Caracas',
      });

      expect(changed).toEqual([]);
    });

    // Este es el motivo de que el diff exista. La pantalla manda el formulario
    // entero porque no sabe qué tocó el usuario; sin el filtro, el correo
    // propio reaparecería en el patch, chocaría contra el índice único y el
    // usuario vería "ese correo ya tiene una cuenta" hablándole de la suya.
    it('no da EMAIL_TAKEN cuando el correo que reenvía es el propio', async () => {
      const { user, changed } = await service.updateProfile(luis, {
        email: 'luis@correo.com',
        phone: '+58 412 111 2222',
      });

      expect(changed).toEqual(['phone']);
      expect(user.email).toBe('luis@correo.com');
    });

    it('no escribe en el repositorio', async () => {
      const update = jest.spyOn(users, 'update');

      await service.updateProfile(luis, { city: 'Caracas' });

      expect(update).not.toHaveBeenCalled();
    });
  });

  describe('correo', () => {
    it('lo cambia si está libre', async () => {
      const { user, changed } = await service.updateProfile(luis, {
        email: 'luis.nuevo@correo.com',
      });

      expect(user.email).toBe('luis.nuevo@correo.com');
      expect(changed).toEqual(['email']);
    });

    it('rechaza con EMAIL_TAKEN el que ya es de otra cuenta', async () => {
      await users.create(
        nuevo({ email: 'ana@correo.com', cedula: 'V11111111' }),
      );

      await expect(
        service.updateProfile(luis, { email: 'ana@correo.com' }),
      ).rejects.toMatchObject({ response: { error: 'EMAIL_TAKEN' } });
    });

    it('no escribe NADA si el correo choca, ni siquiera los otros campos', async () => {
      await users.create(
        nuevo({ email: 'ana@correo.com', cedula: 'V11111111' }),
      );

      await expect(
        service.updateProfile(luis, {
          email: 'ana@correo.com',
          phone: '+58 412 111 2222',
        }),
      ).rejects.toBeDefined();

      // El patch es una sola escritura: o entra entero o no entra. Si el
      // teléfono se hubiera guardado igual, el usuario tendría medio
      // formulario aplicado y un error en pantalla diciéndole que no se guardó.
      expect((await users.findById(luis.id))?.phone).toBe('+58 414 528 9012');
    });
  });

  it('admite llenar estado y ciudad en una cuenta vieja que los tenía en null', async () => {
    const viejo = await users.create(
      nuevo({
        email: 'vieja@correo.com',
        cedula: 'V22222222',
        state: null,
        city: null,
      }),
    );

    const { user, changed } = await service.updateProfile(viejo, {
      state: 'Miranda',
      city: 'Los Teques',
    });

    expect(user.state).toBe('Miranda');
    expect(user.city).toBe('Los Teques');
    expect(changed.sort()).toEqual(['city', 'state']);
  });
});
