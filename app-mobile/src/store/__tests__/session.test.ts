import { useSession } from '../session';

describe('useSession', () => {
  beforeEach(() => {
    useSession.setState({ remember: true, email: '', hydrated: false });
  });

  it('arranca sin correo guardado', () => {
    expect(useSession.getState().email).toBe('');
  });

  it('rememberEmail guarda el correo y deja la preferencia activa', () => {
    useSession.getState().rememberEmail('  luis@correo.com  ');
    const s = useSession.getState();
    expect(s.email).toBe('luis@correo.com');
    expect(s.remember).toBe(true);
  });

  it('forget borra el correo y apaga la preferencia', () => {
    useSession.getState().rememberEmail('luis@correo.com');
    useSession.getState().forget();
    const s = useSession.getState();
    expect(s.email).toBe('');
    expect(s.remember).toBe(false);
  });
});
