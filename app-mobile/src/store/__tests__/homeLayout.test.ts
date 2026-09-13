import { DEFAULT_LAYOUT, WidgetId } from '../../home/layout';
import { useHomeLayout } from '../homeLayout';

describe('useHomeLayout', () => {
  beforeEach(() => {
    useHomeLayout.setState({ layout: DEFAULT_LAYOUT });
  });

  it('arranca con el layout por defecto', () => {
    expect(useHomeLayout.getState().layout).toEqual(DEFAULT_LAYOUT);
  });

  it('move reordena el layout', () => {
    useHomeLayout.getState().move('gauge' as WidgetId, 2);
    expect(useHomeLayout.getState().layout.order[2]).toBe('gauge');
  });

  it('toggle prende y apaga sin tocar el orden', () => {
    const antes = useHomeLayout.getState().layout.order;
    useHomeLayout.getState().toggle('kpis' as WidgetId);
    expect(useHomeLayout.getState().layout.hidden).toContain('kpis');
    expect(useHomeLayout.getState().layout.order).toEqual(antes);
    useHomeLayout.getState().toggle('kpis' as WidgetId);
    expect(useHomeLayout.getState().layout.hidden).not.toContain('kpis');
  });

  it('reset vuelve al layout de fábrica', () => {
    useHomeLayout.getState().move('gauge' as WidgetId, 3);
    useHomeLayout.getState().toggle('kpis' as WidgetId);
    useHomeLayout.getState().reset();
    expect(useHomeLayout.getState().layout).toEqual(DEFAULT_LAYOUT);
  });
});
