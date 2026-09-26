import { SALIDA_MS, toast, useToast } from '../toast';

describe('useToast', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    useToast.setState({ toast: null });
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('muestra el mensaje con su tipo', () => {
    toast.ok('Listo, tus datos quedaron actualizados.');

    expect(useToast.getState().toast).toMatchObject({
      kind: 'ok',
      text: 'Listo, tus datos quedaron actualizados.',
      saliendo: false,
    });
  });

  it('se va solo: primero anima la salida y después desmonta', () => {
    toast.ok('Guardado');

    jest.advanceTimersByTime(2600);
    // Sigue montado, pero ya saliendo: si desapareciera de golpe, el toast
    // parpadearía en vez de irse.
    expect(useToast.getState().toast?.saliendo).toBe(true);

    jest.advanceTimersByTime(SALIDA_MS);
    expect(useToast.getState().toast).toBeNull();
  });

  // Un error trae algo que hacer al respecto y se lee más despacio.
  it('el error dura más que la confirmación', () => {
    toast.error('Ese correo ya tiene una cuenta.');

    jest.advanceTimersByTime(2600);
    expect(useToast.getState().toast?.saliendo).toBe(false);

    jest.advanceTimersByTime(5000 - 2600);
    expect(useToast.getState().toast?.saliendo).toBe(true);
  });

  describe('cuando llega un mensaje nuevo con otro en pantalla', () => {
    it('lo reemplaza en vez de encolarlo', () => {
      toast.ok('Guardado');
      jest.advanceTimersByTime(1000);
      toast.error('No se pudo');

      expect(useToast.getState().toast).toMatchObject({
        kind: 'error',
        text: 'No se pudo',
        saliendo: false,
      });
    });

    // El fallo que motiva el limpiar(): sin él, el cierre programado por el
    // primer toast sigue vivo y se lleva por delante al segundo al cumplirse
    // el plazo del primero, que aparece y se va casi enseguida.
    it('el nuevo estrena su propio plazo, no hereda el del anterior', () => {
      toast.ok('Guardado');
      jest.advanceTimersByTime(2500);
      toast.error('No se pudo');

      // Aquí habría vencido el plazo del primero.
      jest.advanceTimersByTime(100);
      expect(useToast.getState().toast?.saliendo).toBe(false);

      jest.advanceTimersByTime(5000);
      expect(useToast.getState().toast?.saliendo).toBe(true);
    });

    it('le cambia el id, para que la vista reanime la entrada', () => {
      toast.ok('Guardado');
      const primero = useToast.getState().toast?.id;
      toast.ok('Guardado');

      expect(useToast.getState().toast?.id).not.toBe(primero);
    });
  });

  describe('hide', () => {
    it('cierra el toast actual', () => {
      toast.info('Algo');
      useToast.getState().hide();

      expect(useToast.getState().toast?.saliendo).toBe(true);

      jest.advanceTimersByTime(SALIDA_MS);
      expect(useToast.getState().toast).toBeNull();
    });

    it('no hace nada si no hay ninguno', () => {
      expect(() => useToast.getState().hide()).not.toThrow();
      expect(useToast.getState().toast).toBeNull();
    });
  });
});
