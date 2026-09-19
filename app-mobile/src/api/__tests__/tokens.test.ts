import * as SecureStore from 'expo-secure-store';
import { tokenStorage } from '../tokens';

jest.mock('expo-secure-store');
const mock = SecureStore as jest.Mocked<typeof SecureStore>;

describe('tokenStorage', () => {
  beforeEach(() => jest.resetAllMocks());

  it('guarda el par en el almacenamiento seguro', async () => {
    await tokenStorage.save({ accessToken: 'a', refreshToken: 'r' });

    expect(mock.setItemAsync).toHaveBeenCalledWith(
      expect.any(String),
      JSON.stringify({ accessToken: 'a', refreshToken: 'r' })
    );
  });

  it('recupera lo guardado', async () => {
    mock.getItemAsync.mockResolvedValue(
      JSON.stringify({ accessToken: 'a', refreshToken: 'r' })
    );

    await expect(tokenStorage.get()).resolves.toEqual({
      accessToken: 'a',
      refreshToken: 'r',
    });
  });

  it('devuelve null si no hay nada guardado', async () => {
    mock.getItemAsync.mockResolvedValue(null);
    await expect(tokenStorage.get()).resolves.toBeNull();
  });

  // Un JSON corrupto no debe dejar la app inarrancable: se trata como "no hay
  // sesión" y el usuario entra de nuevo.
  it('devuelve null si lo guardado está corrupto', async () => {
    mock.getItemAsync.mockResolvedValue('{esto no es json');
    await expect(tokenStorage.get()).resolves.toBeNull();
  });

  // Media sesión no es sesión: con solo uno de los dos tokens no se puede ni
  // pedir /me ni refrescar.
  it('devuelve null si falta uno de los dos tokens', async () => {
    mock.getItemAsync.mockResolvedValue(JSON.stringify({ accessToken: 'a' }));
    await expect(tokenStorage.get()).resolves.toBeNull();
  });

  // Keychain puede fallar (dispositivo bloqueado, por ejemplo). Que reviente
  // el arranque de la app sería peor que pedir login otra vez.
  it('devuelve null si el almacenamiento seguro lanza', async () => {
    mock.getItemAsync.mockRejectedValue(new Error('keychain no disponible'));
    await expect(tokenStorage.get()).resolves.toBeNull();
  });

  it('borra el par al cerrar sesión', async () => {
    await tokenStorage.clear();
    expect(mock.deleteItemAsync).toHaveBeenCalled();
  });
});
