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
});
