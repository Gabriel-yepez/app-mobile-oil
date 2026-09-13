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

/**
 * Núcleo fijo del inicio: estos cuatro van siempre arriba, en este orden y
 * siempre visibles. No se arrastran ni se apagan — son la lectura mínima del
 * vehículo activo (nivel, datos, acciones, resumen) y la personalización
 * empieza recién debajo.
 */
export const PINNED_WIDGETS: WidgetId[] = [
  'gauge',
  'techReadout',
  'quickActions',
  'kpis',
];

/** Orden de fábrica: el bloque fijo y, debajo, los widgets que el usuario
 *  puede prender, apagar y reordenar. */
export const WIDGET_ORDER: WidgetId[] = [
  ...PINNED_WIDGETS,
  'recentHistory',
  'openAlerts',
];

export const DEFAULT_HIDDEN: WidgetId[] = ['openAlerts'];

export function isPinned(id: WidgetId, pinned: WidgetId[] = PINNED_WIDGETS): boolean {
  return pinned.includes(id);
}

export const DEFAULT_LAYOUT: HomeLayout = {
  order: WIDGET_ORDER,
  hidden: DEFAULT_HIDDEN,
};

export function visibleWidgets(layout: HomeLayout): WidgetId[] {
  return layout.order.filter((id) => !layout.hidden.includes(id));
}

/** Los widgets que la pantalla de personalizar deja reordenar: ni fijos ni
 *  ocultos. Es exactamente el grupo "Mostrados". */
export function reorderables(
  layout: HomeLayout,
  pinned: WidgetId[] = PINNED_WIDGETS
): WidgetId[] {
  return layout.order.filter((id) => !isPinned(id, pinned) && !layout.hidden.includes(id));
}

/**
 * Mueve `id` a la posición `to` DENTRO del grupo "Mostrados" — que es la única
 * lista que se arrastra en pantalla, así que `to` habla en sus índices, no en
 * los de `order`.
 *
 * El traslado se hace contra un ancla (el vecino que va a quedar antes, o el
 * primero del grupo si `to` es 0) en vez de con un índice absoluto: así los
 * ocultos y los fijos se quedan exactamente donde están, y un widget que se
 * vuelva a mostrar reaparece entre los mismos vecinos que tenía.
 */
export function moveWidget(
  layout: HomeLayout,
  id: WidgetId,
  to: number,
  pinned: WidgetId[] = PINNED_WIDGETS
): HomeLayout {
  if (isPinned(id, pinned) || layout.hidden.includes(id)) return layout;

  const mostrados = reorderables(layout, pinned);
  const from = mostrados.indexOf(id);
  if (from === -1) return layout;

  const target = Math.max(0, Math.min(mostrados.length - 1, to));
  if (target === from) return layout;

  const resto = mostrados.filter((x) => x !== id);
  const ancla = target === 0 ? resto[0] : resto[target - 1];

  const order = layout.order.filter((x) => x !== id);
  order.splice(order.indexOf(ancla) + (target === 0 ? 0 : 1), 0, id);
  return { ...layout, order };
}

/** Prende o apaga un widget. Deliberadamente NO toca `order`: un widget oculto
 *  conserva su posición y reaparece donde estaba, no al final.
 *
 *  Un widget fijo no se puede apagar. */
export function toggleWidget(
  layout: HomeLayout,
  id: WidgetId,
  pinned: WidgetId[] = PINNED_WIDGETS
): HomeLayout {
  if (!layout.order.includes(id) || isPinned(id, pinned)) return layout;
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
 *
 * Y es donde se impone el bloque fijo: un layout guardado antes de que existiera
 * (con los cuatro en otro orden, o con alguno apagado) se normaliza al abrir.
 */
export function reconcile(
  persisted: unknown,
  known: WidgetId[] = WIDGET_ORDER,
  defaultHidden: WidgetId[] = DEFAULT_HIDDEN,
  pinned: WidgetId[] = PINNED_WIDGETS
): HomeLayout {
  const raw = (persisted ?? {}) as { order?: unknown; hidden?: unknown };
  const savedOrder = Array.isArray(raw.order) ? (raw.order as WidgetId[]) : [];
  const savedHidden = Array.isArray(raw.hidden) ? (raw.hidden as WidgetId[]) : [];

  const order: WidgetId[] = [];
  for (const id of savedOrder) {
    if (known.includes(id) && !order.includes(id)) order.push(id);
  }

  const nuevos = known.filter((id) => !order.includes(id));
  const conNuevos = [...order, ...nuevos];

  // El bloque fijo se reescribe desde el registro, no desde lo guardado: manda
  // el orden de `pinned`, no el que el usuario hubiera dejado antes.
  const fijos = pinned.filter((id) => known.includes(id));
  const libres = conNuevos.filter((id) => !fijos.includes(id));
  const finalOrder = [...fijos, ...libres];

  const hidden = [
    ...savedHidden.filter((id) => libres.includes(id)),
    ...nuevos.filter((id) => defaultHidden.includes(id) && libres.includes(id)),
  ];

  return { order: finalOrder, hidden: [...new Set(hidden)] };
}
