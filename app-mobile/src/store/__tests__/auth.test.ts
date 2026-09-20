import { useAuth } from '../auth';
import { authController } from '../../api/controllers/auth.controller';
import { tokenStorage } from '../../api/tokens';
import { ApiError } from '../../api/base';

jest.mock('../../api/controllers/auth.controller');
jest.mock('../../api/tokens', () => ({
  tokenStorage: { get: jest.fn(), save: jest.fn(), clear: jest.fn() },
}));

const api = authController as jest.Mocked<typeof authController>;
const storage = tokenStorage as jest.Mocked<typeof tokenStorage>;

const usuario = {
  id: '1',
  fullName: 'Luis Guerrero',
  cedula: 'V25481073',
  email: 'luis@correo.com',
  phone: '+58 414 528 9012',
  state: null,
  city: null,
  currency: 'BOTH' as const,
};

describe('useAuth', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    useAuth.setState({ user: null, status: 'loading', error: null });
  });

  it('arranca en guest cuando no hay tokens guardados', async () => {
    storage.get.mockResolvedValue(null);

    await useAuth.getState().bootstrap();

    expect(useAuth.getState().status).toBe('guest');
    expect(api.me).not.toHaveBeenCalled();
  });

  it('arranca en authed y trae el usuario si hay tokens válidos', async () => {
    storage.get.mockResolvedValue({ accessToken: 'a', refreshToken: 'r' });
    api.me.mockResolvedValue({ user: usuario });

    await useAuth.getState().bootstrap();

    expect(useAuth.getState().status).toBe('authed');
    expect(useAuth.getState().user?.email).toBe('luis@correo.com');
  });

  // Tener el token guardado no basta: pudo ser revocado desde otro
  // dispositivo, o caducar el refresh entero.
  it('cae a guest si el token guardado ya no sirve', async () => {
    storage.get.mockResolvedValue({ accessToken: 'a', refreshToken: 'r' });
    api.me.mockRejectedValue(new ApiError(401, 'INVALID_REFRESH_TOKEN', 'expiró'));

    await useAuth.getState().bootstrap();

    expect(useAuth.getState().status).toBe('guest');
    expect(storage.clear).toHaveBeenCalled();
  });

  // Encontrado probando a mano: el backend se reinició justo cuando la app
  // arrancaba, /me falló por red, y la sesión se borró aunque el token era
  // válido. En la vida real eso es abrir la app en el metro y quedarte fuera.
  it('ante un fallo de RED conserva los tokens y no cierra la sesión', async () => {
    storage.get.mockResolvedValue({ accessToken: 'a', refreshToken: 'r' });
    api.me.mockRejectedValue(
      new ApiError(0, 'NETWORK_ERROR', 'No pudimos conectar.'),
    );

    await useAuth.getState().bootstrap();

    expect(useAuth.getState().status).toBe('guest');
    // Lo que importa: el token sobrevive, así que el próximo arranque con
    // conexión entra solo.
    expect(storage.clear).not.toHaveBeenCalled();
  });

  it('ante un TIMEOUT tampoco borra los tokens', async () => {
    storage.get.mockResolvedValue({ accessToken: 'a', refreshToken: 'r' });
    api.me.mockRejectedValue(new ApiError(0, 'TIMEOUT', 'Tardó demasiado.'));

    await useAuth.getState().bootstrap();

    expect(storage.clear).not.toHaveBeenCalled();
  });

  it('signIn guarda los tokens y deja la sesión abierta', async () => {
    api.login.mockResolvedValue({ user: usuario, accessToken: 'a', refreshToken: 'r' });

    await useAuth.getState().signIn('luis@correo.com', 'contrasena1');

    expect(storage.save).toHaveBeenCalledWith({ accessToken: 'a', refreshToken: 'r' });
    expect(useAuth.getState().status).toBe('authed');
    expect(useAuth.getState().error).toBeNull();
  });

  it('signIn expone el mensaje del backend y no abre sesión', async () => {
    api.login.mockRejectedValue(
      new ApiError(401, 'INVALID_CREDENTIALS', 'Correo o contraseña incorrectos.')
    );

    await expect(
      useAuth.getState().signIn('luis@correo.com', 'mala')
    ).rejects.toBeInstanceOf(ApiError);

    expect(useAuth.getState().status).toBe('guest');
    expect(useAuth.getState().error).toBe('Correo o contraseña incorrectos.');
    expect(storage.save).not.toHaveBeenCalled();
  });

  it('signUp entra directo tras registrarse', async () => {
    api.register.mockResolvedValue({ user: usuario, accessToken: 'a', refreshToken: 'r' });

    await useAuth.getState().signUp({
      fullName: 'Luis Guerrero',
      cedula: 'V-25.481.073',
      email: 'luis@correo.com',
      phone: '+58 414 528 9012',
      state: 'Distrito Capital',
      city: 'Caracas',
      currency: 'BOTH',
      password: 'contrasena1',
    });

    expect(useAuth.getState().status).toBe('authed');
    expect(storage.save).toHaveBeenCalled();
  });

  // Si el logout del servidor falla (sin red), la sesión local igual se
  // cierra: dejar al usuario dentro porque no hubo internet sería peor.
  it('signOut limpia la sesión local aunque falle la llamada', async () => {
    storage.get.mockResolvedValue({ accessToken: 'a', refreshToken: 'r' });
    api.logout.mockRejectedValue(new Error('sin red'));
    useAuth.setState({ user: usuario, status: 'authed' });

    await useAuth.getState().signOut();

    expect(useAuth.getState().status).toBe('guest');
    expect(useAuth.getState().user).toBeNull();
    expect(storage.clear).toHaveBeenCalled();
  });

  it('signOut revoca el refresh en el servidor cuando hay red', async () => {
    storage.get.mockResolvedValue({ accessToken: 'a', refreshToken: 'r' });
    api.logout.mockResolvedValue(undefined);
    useAuth.setState({ user: usuario, status: 'authed' });

    await useAuth.getState().signOut();

    expect(api.logout).toHaveBeenCalledWith('r');
  });

  describe('updateProfile', () => {
    it('manda el patch y deja el usuario que responde el servidor', async () => {
      // El servidor devuelve la ciudad NORMALIZADA, distinta de lo que se
      // mandó. Es la razón de que el store se quede con su respuesta en vez
      // de con el patch: si no, la pantalla enseñaría "caracas" hasta el
      // siguiente arranque.
      api.updateMe.mockResolvedValue({
        user: { ...usuario, city: 'Caracas' },
        message: 'Listo, tus datos quedaron actualizados.',
        changed: ['city'],
      });
      useAuth.setState({ user: usuario, status: 'authed' });

      const mensaje = await useAuth.getState().updateProfile({ city: 'caracas' });

      expect(api.updateMe).toHaveBeenCalledWith({ city: 'caracas' });
      expect(useAuth.getState().user?.city).toBe('Caracas');
      expect(mensaje).toBe('Listo, tus datos quedaron actualizados.');
    });

    // La pantalla necesita enterarse para quedarse abierta con lo escrito: si
    // el store se tragara el error, el usuario volvería atrás creyendo que
    // guardó.
    it('propaga el error y no toca el usuario', async () => {
      api.updateMe.mockRejectedValue(
        new ApiError(409, 'EMAIL_TAKEN', 'Ese correo ya tiene una cuenta.'),
      );
      useAuth.setState({ user: usuario, status: 'authed' });

      await expect(
        useAuth.getState().updateProfile({ email: 'ana@correo.com' }),
      ).rejects.toMatchObject({ code: 'EMAIL_TAKEN' });

      expect(useAuth.getState().user).toEqual(usuario);
      expect(useAuth.getState().status).toBe('authed');
    });
  });
});
