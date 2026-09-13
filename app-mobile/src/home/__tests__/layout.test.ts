import {
  DEFAULT_HIDDEN,
  DEFAULT_LAYOUT,
  HomeLayout,
  PINNED_WIDGETS,
  WIDGET_ORDER,
  WidgetId,
  moveWidget,
  reconcile,
  reorderables,
  toggleWidget,
  visibleWidgets,
} from '../layout';

const layout = (order: string[], hidden: string[] = []): HomeLayout =>
  ({ order, hidden } as HomeLayout);

// `to` habla en índices del grupo "Mostrados" (lo que devuelve `reorderables`),
// que es la única lista que la pantalla deja arrastrar.
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

  it('un widget oculto no se mueve: no está en la lista que se arrastra', () => {
    const l = layout(['a', 'b', 'c'], ['b']);
    expect(moveWidget(l, 'b' as WidgetId, 0)).toBe(l);
  });

  // El caso que justifica mover contra un ancla y no contra un índice absoluto.
  it('los ocultos se quedan en su lugar cuando se reordenan los mostrados', () => {
    const r = moveWidget(layout(['a', 'oculto', 'b', 'c'], ['oculto']), 'c' as WidgetId, 0);
    expect(r.order).toEqual(['c', 'a', 'oculto', 'b']);
    expect(reorderables(r, [] as unknown as WidgetId[])).toEqual(['c', 'a', 'b']);
  });

  it('un widget que vuelve de los ocultos reaparece entre los mismos vecinos', () => {
    const l = layout(['a', 'oculto', 'b'], ['oculto']);
    const r = moveWidget(l, 'b' as WidgetId, 0);
    expect(r.order).toEqual(['b', 'a', 'oculto']);
    expect(toggleWidget(r, 'oculto' as WidgetId, []).order).toEqual(['b', 'a', 'oculto']);
  });
});

describe('reorderables', () => {
  it('deja fuera a los fijos y a los ocultos', () => {
    const l = layout(['a', 'b', 'c', 'd'], ['c']);
    expect(reorderables(l, ['a'] as unknown as WidgetId[])).toEqual(['b', 'd']);
  });

  it('en el layout de fábrica es solo el historial reciente', () => {
    expect(reorderables(DEFAULT_LAYOUT)).toEqual(['recentHistory']);
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
      'gauge', 'techReadout', 'quickActions', 'kpis', 'recentHistory',
    ]);
  });
});

// El bloque fijo son los cuatro widgets del núcleo: siempre arriba, en este
// orden, siempre visibles. Lo que sigue es el contrato que lo sostiene.
describe('bloque fijo', () => {
  const fijos = ['a', 'b'] as unknown as WidgetId[];

  it('el default arranca con los cuatro fijos en el orden pedido', () => {
    expect(PINNED_WIDGETS).toEqual(['gauge', 'techReadout', 'quickActions', 'kpis']);
    expect(WIDGET_ORDER.slice(0, 4)).toEqual(PINNED_WIDGETS);
  });

  it('ninguno de los fijos nace oculto', () => {
    for (const id of PINNED_WIDGETS) expect(DEFAULT_HIDDEN).not.toContain(id);
  });

  it('un widget fijo no se puede mover', () => {
    const l = layout(['a', 'b', 'c', 'd']);
    expect(moveWidget(l, 'a' as WidgetId, 1, fijos)).toBe(l);
    expect(moveWidget(l, 'b' as WidgetId, 0, fijos)).toBe(l);
  });

  it('un widget libre no puede meterse dentro del bloque fijo', () => {
    const r = moveWidget(layout(['a', 'b', 'c', 'd']), 'd' as WidgetId, 0, fijos);
    expect(r.order).toEqual(['a', 'b', 'd', 'c']);
  });

  it('los libres se siguen reordenando entre ellos', () => {
    const r = moveWidget(layout(['a', 'b', 'c', 'd']), 'c' as WidgetId, 1, fijos);
    expect(r.order).toEqual(['a', 'b', 'd', 'c']);
  });

  it('un widget fijo no se puede apagar', () => {
    const l = layout(['a', 'b', 'c']);
    expect(toggleWidget(l, 'a' as WidgetId, fijos)).toBe(l);
  });

  it('reconcile reescribe el orden de los fijos aunque el guardado diga otra cosa', () => {
    const r = reconcile(
      { order: ['c', 'b', 'a'], hidden: [] },
      ['a', 'b', 'c'] as unknown as WidgetId[],
      [] as unknown as WidgetId[],
      fijos
    );
    expect(r.order).toEqual(['a', 'b', 'c']);
  });

  it('reconcile prende un fijo que había quedado oculto en el guardado', () => {
    const r = reconcile(
      { order: ['a', 'b', 'c'], hidden: ['a', 'c'] },
      ['a', 'b', 'c'] as unknown as WidgetId[],
      [] as unknown as WidgetId[],
      fijos
    );
    expect(r.hidden).toEqual(['c']);
  });

  it('un layout guardado con el orden viejo se normaliza al bloque fijo actual', () => {
    const viejo = { order: ['gauge', 'techReadout', 'kpis', 'quickActions', 'recentHistory', 'openAlerts'], hidden: ['openAlerts'] };
    expect(reconcile(viejo).order).toEqual(WIDGET_ORDER);
  });

  it('conserva el orden que el usuario le dio a los libres', () => {
    const guardado = { order: ['kpis', 'openAlerts', 'gauge', 'recentHistory', 'techReadout', 'quickActions'], hidden: [] };
    expect(reconcile(guardado).order).toEqual([
      'gauge', 'techReadout', 'quickActions', 'kpis', 'openAlerts', 'recentHistory',
    ]);
  });
});
