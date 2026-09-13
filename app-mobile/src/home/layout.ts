// Orden y visibilidad de los widgets del inicio.
//
// Puro a propósito: sin React, sin zustand, sin Expo. Toda la lógica que decide
// QUÉ se ve y en qué orden vive acá, así se testea sin montar un componente;
// el store de al lado solo la persiste.
export type WidgetId =
  | 'gauge'
  | 'techReadout'
  | 'kpis'
  | 'quickActions'
  | 'recentHistory'
  | 'openAlerts';

export type HomeLayout = {
  /** TODOS los widgets conocidos, en orden de aparición: visibles y ocultos. */
  order: WidgetId[];
  /** Subconjunto de `order` que no se pinta. */
  hidden: WidgetId[];
};

/** Orden de fábrica. Reproduce el inicio previo a los widgets, con
 *  quickActions intercalado para reemplazar al FAB que se eliminó. */
export const WIDGET_ORDER: WidgetId[] = [
  'gauge',
  'techReadout',
  'kpis',
  'quickActions',
  'recentHistory',
  'openAlerts',
];

export const DEFAULT_HIDDEN: WidgetId[] = ['openAlerts'];

export const DEFAULT_LAYOUT: HomeLayout = {
  order: WIDGET_ORDER,
  hidden: DEFAULT_HIDDEN,
};

export function visibleWidgets(layout: HomeLayout): WidgetId[] {
  return layout.order.filter((id) => !layout.hidden.includes(id));
}

/** Mueve `id` a la posición `to`. `to` se acota al rango: un destino fuera de
 *  la lista aterriza en el borde, nunca hace desaparecer el widget. */
export function moveWidget(layout: HomeLayout, id: WidgetId, to: number): HomeLayout {
  const from = layout.order.indexOf(id);
  if (from === -1) return layout;

  const target = Math.max(0, Math.min(layout.order.length - 1, to));
  if (target === from) return layout;

  const order = [...layout.order];
  order.splice(from, 1);
  order.splice(target, 0, id);
  return { ...layout, order };
}

/** Prende o apaga un widget. Deliberadamente NO toca `order`: un widget oculto
 *  conserva su posición y reaparece donde estaba, no al final. */
export function toggleWidget(layout: HomeLayout, id: WidgetId): HomeLayout {
  if (!layout.order.includes(id)) return layout;
  const hidden = layout.hidden.includes(id)
    ? layout.hidden.filter((x) => x !== id)
    : [...layout.hidden, id];
  return { ...layout, hidden };
}

/**
 * Reconcilia lo que había guardado contra el registro actual.
 *
 * Es la función que evita el bug de las migraciones: sin el paso de "agregar al
 * final lo que no estaba", el día que sumemos un widget nadie con layout
 * guardado lo vería nunca. También descarta ids de widgets eliminados y
 * sobrevive a un almacenamiento corrupto.
 */
export function reconcile(
  persisted: unknown,
  known: WidgetId[] = WIDGET_ORDER,
  defaultHidden: WidgetId[] = DEFAULT_HIDDEN
): HomeLayout {
  const raw = (persisted ?? {}) as { order?: unknown; hidden?: unknown };
  const savedOrder = Array.isArray(raw.order) ? (raw.order as WidgetId[]) : [];
  const savedHidden = Array.isArray(raw.hidden) ? (raw.hidden as WidgetId[]) : [];

  const order: WidgetId[] = [];
  for (const id of savedOrder) {
    if (known.includes(id) && !order.includes(id)) order.push(id);
  }

  const nuevos = known.filter((id) => !order.includes(id));
  const finalOrder = [...order, ...nuevos];

  const hidden = [
    ...savedHidden.filter((id) => finalOrder.includes(id)),
    ...nuevos.filter((id) => defaultHidden.includes(id)),
  ];

  return { order: finalOrder, hidden: [...new Set(hidden)] };
}
