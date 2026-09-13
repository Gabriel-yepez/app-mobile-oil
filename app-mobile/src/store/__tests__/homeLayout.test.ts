import { DEFAULT_LAYOUT, WidgetId, reorderables, visibleWidgets } from '../../home/layout';
import { useHomeLayout } from '../homeLayout';

describe('useHomeLayout', () => {
  beforeEach(() => {
    useHomeLayout.setState({ layout: DEFAULT_LAYOUT });
  });

  it('arranca con el layout por defecto', () => {
    expect(useHomeLayout.getState().layout).toEqual(DEFAULT_LAYOUT);
  });

  // `move` habla en índices del grupo "Mostrados", que de fábrica está vacío:
  // hay que agregar los dos antes de tener algo que reordenar.
  it('move reordena el grupo de los mostrados', () => {
    useHomeLayout.getState().toggle('recentHistory' as WidgetId);
    useHomeLayout.getState().toggle('openAlerts' as WidgetId);
    useHomeLayout.getState().move('openAlerts' as WidgetId, 0);
    expect(visibleWidgets(useHomeLayout.getState().layout)).toEqual([
      'gauge', 'techReadout', 'quickActions', 'kpis', 'openAlerts', 'recentHistory',
    ]);
  });

  it('un widget oculto no se reordena', () => {
    const antes = useHomeLayout.getState().layout;
    useHomeLayout.getState().move('openAlerts' as WidgetId, 0);
    expect(useHomeLayout.getState().layout).toEqual(antes);
  });

  it('toggle prende y apaga sin tocar el orden', () => {
    const antes = useHomeLayout.getState().layout.order;
    useHomeLayout.getState().toggle('recentHistory' as WidgetId);
    expect(useHomeLayout.getState().layout.hidden).not.toContain('recentHistory');
    expect(useHomeLayout.getState().layout.order).toEqual(antes);
    useHomeLayout.getState().toggle('recentHistory' as WidgetId);
    expect(useHomeLayout.getState().layout.hidden).toContain('recentHistory');
  });

  // El bloque fijo también se defiende desde el store: aunque la pantalla no
  // ofrece asa ni interruptor para estos widgets, la acción no hace nada.
  it('el bloque fijo no se mueve ni se apaga', () => {
    const antes = useHomeLayout.getState().layout;
    useHomeLayout.getState().move('gauge' as WidgetId, 1);
    useHomeLayout.getState().toggle('kpis' as WidgetId);
    expect(useHomeLayout.getState().layout).toEqual(antes);
  });

  it('reset deja el inicio sin ningún widget opcional', () => {
    useHomeLayout.getState().toggle('openAlerts' as WidgetId);
    useHomeLayout.getState().toggle('recentHistory' as WidgetId);
    useHomeLayout.getState().reset();
    expect(reorderables(useHomeLayout.getState().layout)).toEqual([]);
    expect(useHomeLayout.getState().layout).toEqual(DEFAULT_LAYOUT);
  });
});
