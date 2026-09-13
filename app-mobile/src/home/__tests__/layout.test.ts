import {
  DEFAULT_HIDDEN,
  DEFAULT_LAYOUT,
  HomeLayout,
  WIDGET_ORDER,
  WidgetId,
  moveWidget,
  reconcile,
  toggleWidget,
  visibleWidgets,
} from '../layout';

const layout = (order: string[], hidden: string[] = []): HomeLayout =>
  ({ order, hidden } as HomeLayout);

describe('moveWidget', () => {
  it('mueve un widget hacia abajo', () => {
    const r = moveWidget(layout(['a', 'b', 'c']), 'a' as WidgetId, 2);
    expect(r.order).toEqual(['b', 'c', 'a']);
  });

  it('mueve un widget hacia arriba', () => {
    const r = moveWidget(layout(['a', 'b', 'c']), 'c' as WidgetId, 0);
    expect(r.order).toEqual(['c', 'a', 'b']);
  });

  it('acota el destino al rango en vez de perder el widget', () => {
    expect(moveWidget(layout(['a', 'b']), 'a' as WidgetId, 99).order).toEqual(['b', 'a']);
    expect(moveWidget(layout(['a', 'b']), 'b' as WidgetId, -5).order).toEqual(['b', 'a']);
  });

  it('devuelve el mismo objeto si no hay nada que mover', () => {
    const l = layout(['a', 'b']);
    expect(moveWidget(l, 'a' as WidgetId, 0)).toBe(l);
    expect(moveWidget(l, 'zzz' as WidgetId, 1)).toBe(l);
  });

  it('no altera los ocultos', () => {
    const r = moveWidget(layout(['a', 'b', 'c'], ['b']), 'a' as WidgetId, 2);
    expect(r.hidden).toEqual(['b']);
  });
});

describe('toggleWidget', () => {
  it('oculta un widget visible', () => {
    expect(toggleWidget(layout(['a', 'b']), 'a' as WidgetId).hidden).toEqual(['a']);
  });

  it('vuelve a mostrar uno oculto', () => {
    expect(toggleWidget(layout(['a', 'b'], ['a']), 'a' as WidgetId).hidden).toEqual([]);
  });

  it('ocultar NO cambia el orden: el widget vuelve a su lugar al reaparecer', () => {
    const oculto = toggleWidget(layout(['a', 'b', 'c']), 'b' as WidgetId);
    expect(oculto.order).toEqual(['a', 'b', 'c']);
    expect(toggleWidget(oculto, 'b' as WidgetId).order).toEqual(['a', 'b', 'c']);
  });

  it('ignora un id desconocido', () => {
    const l = layout(['a']);
    expect(toggleWidget(l, 'zzz' as WidgetId)).toBe(l);
  });
});

describe('visibleWidgets', () => {
  it('filtra los ocultos conservando el orden', () => {
    expect(visibleWidgets(layout(['a', 'b', 'c'], ['b']))).toEqual(['a', 'c']);
  });
});

describe('reconcile', () => {
  // Ids sintéticos: reconcile es genérica sobre el registro que le pasen, y
  // así los casos de "widget nuevo" y "widget eliminado" no dependen del
  // catálogo real, que va a seguir cambiando.
  const known = ['a', 'b', 'c'] as unknown as WidgetId[];
  const defHidden = ['c'] as unknown as WidgetId[];

  it('sin nada guardado devuelve el layout por defecto', () => {
    expect(reconcile(undefined)).toEqual(DEFAULT_LAYOUT);
    expect(reconcile(null)).toEqual(DEFAULT_LAYOUT);
    expect(reconcile({})).toEqual(DEFAULT_LAYOUT);
  });

  it('agrega al final los widgets nuevos del registro', () => {
    const r = reconcile({ order: ['a', 'b'], hidden: [] }, known, defHidden);
    expect(r.order).toEqual(['a', 'b', 'c']);
  });

  it('un widget nuevo con defaultVisible false nace oculto', () => {
    const r = reconcile({ order: ['a', 'b'], hidden: [] }, known, defHidden);
    expect(r.hidden).toEqual(['c']);
  });

  it('respeta que el usuario ya había mostrado un widget oculto por defecto', () => {
    const r = reconcile({ order: ['c', 'a', 'b'], hidden: [] }, known, defHidden);
    expect(r.order).toEqual(['c', 'a', 'b']);
    expect(r.hidden).toEqual([]);
  });

  it('descarta ids que ya no existen en el registro', () => {
    const r = reconcile({ order: ['a', 'viejo', 'b', 'c'], hidden: ['viejo'] }, known, defHidden);
    expect(r.order).toEqual(['a', 'b', 'c']);
    expect(r.hidden).toEqual([]);
  });

  it('deduplica un orden corrupto', () => {
    const r = reconcile({ order: ['a', 'a', 'b', 'c'], hidden: [] }, known, defHidden);
    expect(r.order).toEqual(['a', 'b', 'c']);
  });

  it('tolera tipos basura en el almacenamiento', () => {
    expect(reconcile({ order: 'no soy un array' }, known, defHidden).order).toEqual(known);
    expect(reconcile(42, known, defHidden).order).toEqual(known);
  });

  it('el default real de la app tiene openAlerts oculto y el resto visible', () => {
    expect(DEFAULT_LAYOUT.order).toEqual(WIDGET_ORDER);
    expect(DEFAULT_HIDDEN).toEqual(['openAlerts']);
    expect(visibleWidgets(DEFAULT_LAYOUT)).toEqual([
      'gauge', 'techReadout', 'kpis', 'quickActions', 'recentHistory',
    ]);
  });
});
