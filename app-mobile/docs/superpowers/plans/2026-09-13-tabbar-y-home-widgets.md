# Tab bar de 3 destinos + inicio con widgets — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bajar el tab bar a Inicio / Vehículos / Menú y convertir el inicio en una pila de widgets que el usuario ordena arrastrando y prende o apaga.

**Architecture:** Un registro declarativo (`src/home/registry.tsx`) mapea cada `WidgetId` a su componente; un layout persistido (`src/store/homeLayout.ts`) guarda orden y ocultos; `HomeScreen` queda como hero fijo más un `map` sobre el orden visible. La lógica de orden vive en `src/home/layout.ts`, pura y sin React, que es lo que la hace testeable.

**Tech Stack:** Expo SDK 57, React Native 0.86.3, Tamagui v2, zustand 5 + `persist`, `expo-sqlite/kv-store`, Reanimated 4.5.1, `react-native-gesture-handler@~2.32.0` (a instalar), Jest + jest-expo.

**Spec:** `docs/superpowers/specs/2026-09-13-tabbar-y-home-widgets-design.md`

## Global Constraints

- **Expo SDK 57.** Antes de escribir código que toque APIs de Expo, consultar `https://docs.expo.dev/versions/v57.0.0/` (AGENTS.md).
- **`react-native-gesture-handler@~2.32.0`** — versión fijada por `node_modules/expo/bundledNativeModules.json`. Instalar con `npx expo install`, nunca con `npm install` a secas.
- **Iconos por sub-ruta, jamás del barrel.** `import Menu from 'lucide-react-native/icons/menu'`. El barrel mete +1.9MB al bundle contra +21KB por sub-ruta (AGENTS.md). Todo icono nuevo se registra en `src/components/Icon.tsx` y se usa vía `<Icon name="..." />`.
- **Tamagui v2: la prop es `transition`, no `animation`.**
- **Idioma:** todo el texto de UI y los comentarios de código, en español.
- **El color sale de tokens de tema** (`$ink`, `$muted`, `$surface`…), salvo lo que vive sobre el navy, que es oscuro en ambos temas y usa `tone="onDark"` o `rgba(255,255,255,…)` literal.
- **Cada tarea termina con `npx tsc --noEmit` y `npx jest` en verde** antes del commit.

---

### Task 1: Instalar gesture-handler y montar la raíz de gestos

Va primero porque el rebuild del development build tarda y bloquea probar el drag de la Task 8. Se lanza acá y compila mientras se trabaja en las tareas siguientes.

**Files:**
- Modify: `package.json` (vía `npx expo install`)
- Modify: `App.tsx:36-45`

**Interfaces:**
- Consumes: nada.
- Produces: `GestureHandlerRootView` montada como raíz — precondición de toda la Task 8.

- [ ] **Step 1: Instalar la dependencia**

```bash
npx expo install react-native-gesture-handler
```

Verificar que quedó `~2.32.0` en `package.json`. Si `npx expo install` propone otra versión, gana la del comando: lee `bundledNativeModules.json`, que es la fuente de verdad de SDK 57.

- [ ] **Step 2: Envolver la app**

`GestureHandlerRootView` debe ser la raíz, por fuera de `TamaguiProvider`. Sin ella los gestos no responden y **no hay mensaje de error** — es el fallo más común de esta librería.

En `App.tsx`, agregar el import:

```tsx
import { GestureHandlerRootView } from 'react-native-gesture-handler';
```

y reemplazar el `return` entero por:

```tsx
  return (
    // Raíz de gestos: por fuera de todo. Si falta, los gestos de
    // react-native-gesture-handler simplemente no disparan, sin error.
    <GestureHandlerRootView style={{ flex: 1 }}>
      <TamaguiProvider config={config} defaultTheme={scheme}>
        <Theme name={scheme}>
          <SafeAreaProvider>
            <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
            <AppNavigator scheme={scheme} />
          </SafeAreaProvider>
        </Theme>
      </TamaguiProvider>
    </GestureHandlerRootView>
  );
```

- [ ] **Step 3: Verificar que compila**

```bash
npx tsc --noEmit && npx jest
```

Esperado: sin errores, 31 tests en verde.

- [ ] **Step 4: Lanzar el rebuild**

```bash
npx expo run:android
```

En Android el JDK debe ser 17 — el JBR 25 que trae Android Studio falla con un error de CMake que no parece de CMake. Verificar con `java -version` antes de lanzar.

Este paso puede correr en segundo plano mientras se avanza con las tareas 2 a 7, que no dependen de él.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json App.tsx
git commit -m "build: instalar react-native-gesture-handler y montar la raíz de gestos"
```

---

### Task 2: Lógica de orden (`src/home/layout.ts`)

Pura: sin React, sin zustand, sin Expo. Es lo que permite testear reordenamiento y migración sin montar un componente.

**Files:**
- Create: `src/home/layout.ts`
- Test: `src/home/__tests__/layout.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `type WidgetId = 'gauge' | 'techReadout' | 'kpis' | 'quickActions' | 'recentHistory' | 'openAlerts'`
  - `type HomeLayout = { order: WidgetId[]; hidden: WidgetId[] }`
  - `WIDGET_ORDER: WidgetId[]`, `DEFAULT_HIDDEN: WidgetId[]`, `DEFAULT_LAYOUT: HomeLayout`
  - `moveWidget(layout: HomeLayout, id: WidgetId, to: number): HomeLayout`
  - `toggleWidget(layout: HomeLayout, id: WidgetId): HomeLayout`
  - `reconcile(persisted: unknown, known?: WidgetId[], defaultHidden?: WidgetId[]): HomeLayout`
  - `visibleWidgets(layout: HomeLayout): WidgetId[]`

- [ ] **Step 1: Escribir el test que falla**

Crear `src/home/__tests__/layout.test.ts`:

```ts
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
  const known = ['a', 'b', 'c'] as WidgetId[];
  const defHidden = ['c'] as WidgetId[];

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
```

- [ ] **Step 2: Correr el test para verificar que falla**

```bash
npx jest src/home/__tests__/layout.test.ts
```

Esperado: FAIL — `Cannot find module '../layout'`.

- [ ] **Step 3: Implementar**

Crear `src/home/layout.ts`:

```ts
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
```

- [ ] **Step 4: Correr el test para verificar que pasa**

```bash
npx jest src/home/__tests__/layout.test.ts
```

Esperado: PASS, 17 tests.

- [ ] **Step 5: Commit**

```bash
git add src/home/layout.ts src/home/__tests__/layout.test.ts
git commit -m "feat: lógica pura de orden y visibilidad de los widgets del inicio"
```

---

### Task 3: Store persistido (`src/store/homeLayout.ts`)

**Files:**
- Create: `src/store/homeLayout.ts`
- Test: `src/store/__tests__/homeLayout.test.ts`

**Interfaces:**
- Consumes: `DEFAULT_LAYOUT`, `HomeLayout`, `WidgetId`, `moveWidget`, `reconcile`, `toggleWidget` de `src/home/layout`.
- Produces: `useHomeLayout` — store zustand con `{ layout: HomeLayout; hydrated: boolean; move(id, to); toggle(id); reset() }`.

- [ ] **Step 1: Escribir el test que falla**

Crear `src/store/__tests__/homeLayout.test.ts`:

```ts
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
```

- [ ] **Step 2: Correr el test para verificar que falla**

```bash
npx jest src/store/__tests__/homeLayout.test.ts
```

Esperado: FAIL — `Cannot find module '../homeLayout'`.

- [ ] **Step 3: Implementar**

Crear `src/store/homeLayout.ts`. Calca el patrón de `src/store/notifPrefs.ts`, incluido el `merge` que reconcilia con los valores actuales — la diferencia es que acá reconcilia listas en vez de claves:

```ts
// Layout del inicio — segundo slice persistido de la app (el otro es notifPrefs).
// La lógica vive en src/home/layout.ts; acá solo se guarda y se rehidrata.
import AsyncStorage from 'expo-sqlite/kv-store';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import {
  DEFAULT_LAYOUT,
  HomeLayout,
  WidgetId,
  moveWidget,
  reconcile,
  toggleWidget,
} from '../home/layout';

type HomeLayoutStore = {
  layout: HomeLayout;
  /** false hasta que termina de leerse el almacenamiento. El inicio espera a
   *  esto para no pintar el layout de fábrica y reordenarse a la vista. */
  hydrated: boolean;
  move: (id: WidgetId, to: number) => void;
  toggle: (id: WidgetId) => void;
  reset: () => void;
};

export const useHomeLayout = create<HomeLayoutStore>()(
  persist(
    (set) => ({
      layout: DEFAULT_LAYOUT,
      hydrated: false,
      move: (id, to) => set((s) => ({ layout: moveWidget(s.layout, id, to) })),
      toggle: (id) => set((s) => ({ layout: toggleWidget(s.layout, id) })),
      reset: () => set({ layout: DEFAULT_LAYOUT }),
    }),
    {
      name: 'oiltrack:home-layout',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ layout: s.layout }),
      // `reconcile` es lo que hace que un widget agregado en una versión futura
      // aparezca en los usuarios que ya tienen layout guardado.
      merge: (persisted, current) => ({
        ...current,
        layout: reconcile((persisted as { layout?: unknown } | undefined)?.layout),
      }),
      onRehydrateStorage: () => () => useHomeLayout.setState({ hydrated: true }),
    }
  )
);
```

- [ ] **Step 4: Correr los tests**

```bash
npx jest
```

Esperado: PASS, todas las suites.

- [ ] **Step 5: Commit**

```bash
git add src/store/homeLayout.ts src/store/__tests__/homeLayout.test.ts
git commit -m "feat: persistir el layout del inicio"
```

---

### Task 4: Iconos nuevos

**Files:**
- Modify: `src/components/Icon.tsx`

**Interfaces:**
- Produces: `IconName` gana `'menu' | 'sliders' | 'grip'`.

- [ ] **Step 1: Agregar los tres imports por sub-ruta**

En el bloque de imports de `src/components/Icon.tsx`, **en orden alfabético** con los que ya están:

```tsx
import GripVertical from 'lucide-react-native/icons/grip-vertical';
import Menu from 'lucide-react-native/icons/menu';
import SlidersHorizontal from 'lucide-react-native/icons/sliders-horizontal';
```

Importar desde `'lucide-react-native'` a secas mete los ~1600 iconos al bundle (+1.9MB contra +21KB). No hay excepción.

- [ ] **Step 2: Registrarlos**

Agregar a la unión `IconName` los miembros `'menu'`, `'sliders'` y `'grip'`, y al `Record` `ICONS`:

```tsx
  menu: Menu,
  sliders: SlidersHorizontal,
  grip: GripVertical,
```

- [ ] **Step 3: Verificar**

```bash
npx tsc --noEmit
```

Esperado: sin errores.

- [ ] **Step 4: Commit**

```bash
git add src/components/Icon.tsx
git commit -m "feat: iconos menu, sliders y grip"
```

---

### Task 5: Registro de widgets y HomeScreen dinámico

Extrae los cuatro bloques que hoy viven inline en `HomeScreen` y los pone detrás del registro. **Al terminar, el inicio se ve igual que antes** (salvo que `gauge` y `techReadout` pasan a tener su propia card navy en vez de compartir el slab del hero): esta tarea no agrega funcionalidad visible, mueve código.

**Files:**
- Create: `src/home/DarkWidgetSurface.tsx`
- Create: `src/home/widgets/GaugeWidget.tsx`
- Create: `src/home/widgets/TechReadoutWidget.tsx`
- Create: `src/home/widgets/KpisWidget.tsx`
- Create: `src/home/widgets/RecentHistoryWidget.tsx`
- Create: `src/home/registry.tsx`
- Modify: `src/screens/HomeScreen.tsx`

**Interfaces:**
- Consumes: `WidgetId`, `visibleWidgets` de `src/home/layout`; `useHomeLayout` de `src/store/homeLayout`.
- Produces:
  - `DarkWidgetSurface({ children }: { children: ReactNode })`
  - `GaugeWidget()`, `TechReadoutWidget()`, `KpisWidget()`, `RecentHistoryWidget()` — todos sin props, leen del store.
  - `type WidgetDef = { label: string; description: string; icon: IconName; render: () => ReactNode }`
  - `HOME_WIDGETS: Record<WidgetId, WidgetDef>`

- [ ] **Step 1: La superficie oscura**

Crear `src/home/DarkWidgetSurface.tsx`:

```tsx
// Envoltorio navy para los widgets que nacieron dentro del hero.
//
// OilGauge y el readout técnico cablean rgba(255,255,255,...) y tone="onDark":
// funcionan solo sobre fondo oscuro. En vez de adaptarlos al tema claro —lo que
// obligaría a rediseñar los arcos y ticks del gauge— se les da su propio fondo,
// y así pueden caer en cualquier posición de la lista sin volverse ilegibles.
import React, { ReactNode } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Box, useAppColors } from '../ui';
import { TechGrid } from '../components/primitives';

export function DarkWidgetSurface({ children }: { children: ReactNode }) {
  const c = useAppColors();
  return (
    <Box mx="$lg" br={20} overflow="hidden">
      <LinearGradient
        colors={[c.primary, c.primary2]}
        style={{ paddingHorizontal: 16, paddingVertical: 16 }}
      >
        <TechGrid height={320} />
        {children}
      </LinearGradient>
    </Box>
  );
}
```

- [ ] **Step 2: Los cuatro widgets extraídos**

Crear `src/home/widgets/GaugeWidget.tsx` — el bloque del gauge de `HomeScreen`, ahora con su propia superficie:

```tsx
// Gauge de vida del aceite del vehículo activo. Tocar → registrar un cambio.
import React from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Touchable } from '../../ui';
import { OilGauge } from '../../components/OilGauge';
import { kmLeft, oilPct, useActiveVehicle } from '../../store/useStore';
import { RootStackParamList } from '../../navigation/types';
import { DarkWidgetSurface } from '../DarkWidgetSurface';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function GaugeWidget() {
  const navigation = useNavigation<Nav>();
  const active = useActiveVehicle();

  return (
    <DarkWidgetSurface>
      <Touchable
        fade
        ai="center"
        onPress={() => navigation.navigate('AddOil', { vehicleId: active.id })}
      >
        <OilGauge pct={oilPct(active)} kmLeft={kmLeft(active)} size={220} />
      </Touchable>
    </DarkWidgetSurface>
  );
}
```

Crear `src/home/widgets/TechReadoutWidget.tsx`:

```tsx
// Lectura técnica del vehículo activo: odómetro, próximo cambio y aceite.
import React from 'react';
import { Col, Row, Txt } from '../../ui';
import { fmtKm } from '../../utils/format';
import { useActiveVehicle } from '../../store/useStore';
import { DarkWidgetSurface } from '../DarkWidgetSurface';

export function TechReadoutWidget() {
  const active = useActiveVehicle();

  const filas = [
    { l: 'Odómetro', v: fmtKm(active.km), u: 'km' },
    { l: 'Próximo', v: fmtKm(active.nextChange), u: 'km' },
    { l: 'Aceite', v: active.oil.viscosity, u: active.oil.brand },
  ];

  return (
    <DarkWidgetSurface>
      <Row ai="stretch">
        {filas.map((r) => (
          <Col key={r.l} f={1} ai="center">
            <Txt font="bold" fos={9} col="rgba(255,255,255,0.55)" ls={1.2} caps>
              {r.l}
            </Txt>
            <Txt font="mono" fos={16} tone="onDark" mt={2}>{r.v}</Txt>
            <Txt fos={10} col="rgba(255,255,255,0.55)">{r.u}</Txt>
          </Col>
        ))}
      </Row>
    </DarkWidgetSurface>
  );
}
```

Crear `src/home/widgets/KpisWidget.tsx`:

```tsx
// Tres KPIs de un vistazo: tamaño de la flota, días desde el último cambio y
// alertas abiertas.
import React from 'react';
import { Row, useAppColors } from '../../ui';
import { KPI } from '../../components/primitives';
import { Icon } from '../../components/Icon';
import { useActiveVehicle, useOpenAlerts, useStore } from '../../store/useStore';

export function KpisWidget() {
  const c = useAppColors();
  const vehicles = useStore((s) => s.vehicles);
  const active = useActiveVehicle();
  const openAlerts = useOpenAlerts();

  return (
    <Row gap={10} px="$lg" ai="stretch">
      <KPI icon={<Icon name="car" color={c.accent} size={18} />} label="Vehículos" value={vehicles.length} unit="activos" />
      <KPI icon={<Icon name="calendar" color={c.accent} size={18} />} label="Últ. cambio" value={active.daysSince} unit="días" />
      <KPI icon={<Icon name="bell" color={c.warn} size={18} />} label="Alertas" value={openAlerts} unit="abiertas" />
    </Row>
  );
}
```

Crear `src/home/widgets/RecentHistoryWidget.tsx`:

```tsx
// Los tres cambios de aceite más recientes de toda la flota.
import React from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Box, Col, Touchable, Txt, useAppColors } from '../../ui';
import { Card, SectionHead } from '../../components/primitives';
import { Icon } from '../../components/Icon';
import { fmtKm, fmtUsd } from '../../utils/format';
import { useStore } from '../../store/useStore';
import { RootStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function RecentHistoryWidget() {
  const navigation = useNavigation<Nav>();
  const c = useAppColors();
  const vehicles = useStore((s) => s.vehicles);
  const changes = useStore((s) => s.changes);

  const recent = changes.slice(0, 3);
  const vehicleName = (id: string) => {
    const v = vehicles.find((x) => x.id === id);
    return v ? `${v.brand} ${v.model.split(' ')[0]}` : '';
  };

  return (
    <Box>
      <SectionHead
        right={
          <Touchable onPress={() => navigation.navigate('History')} hitSlop={8} fade>
            <Txt font="semi" fos={12} tone="accent">Ver todo</Txt>
          </Touchable>
        }
      >
        Historial reciente
      </SectionHead>
      <Col gap={10} px="$lg">
        {recent.map((h) => (
          <Card key={h.id} fd="row" ai="center" gap="$md">
            <Box h={36} w={36} ai="center" jc="center" br={10} bg="$accentSoft">
              <Icon name="drop" color={c.accent} size={18} />
            </Box>
            <Col f={1}>
              <Txt font="bold" fos={14}>{vehicleName(h.vehicleId)}</Txt>
              <Txt fos={12} tone="muted" mt={1}>
                {h.date} · <Txt font="monoMed" fos={12} tone="muted">{fmtKm(h.km)}</Txt> km · {h.oil.brand} {h.oil.viscosity}
              </Txt>
            </Col>
            <Col ai="flex-end">
              <Txt font="mono" fos={14}>{fmtUsd(h.costUsd)}</Txt>
              <Txt fos={10} tone="muted2">USD</Txt>
            </Col>
          </Card>
        ))}
      </Col>
    </Box>
  );
}
```

- [ ] **Step 3: El registro**

Crear `src/home/registry.tsx`. Los widgets `quickActions` y `openAlerts` se agregan en la Task 6; para que el `Record` sea exhaustivo desde ahora, esta tarea los deja apuntando a `null` y la Task 6 los completa:

```tsx
// Catálogo de widgets del inicio.
//
// Es el único lugar que hay que tocar para agregar un widget: una entrada acá y
// su id en WIDGET_ORDER. HomeScreen no se entera.
import React, { ReactNode } from 'react';
import { IconName } from '../components/Icon';
import { WidgetId } from './layout';
import { GaugeWidget } from './widgets/GaugeWidget';
import { TechReadoutWidget } from './widgets/TechReadoutWidget';
import { KpisWidget } from './widgets/KpisWidget';
import { RecentHistoryWidget } from './widgets/RecentHistoryWidget';

export type WidgetDef = {
  /** Nombre en la pantalla de personalización. */
  label: string;
  /** Línea de ayuda debajo del nombre. */
  description: string;
  icon: IconName;
  render: () => ReactNode;
};

export const HOME_WIDGETS: Record<WidgetId, WidgetDef> = {
  gauge: {
    label: 'Nivel de aceite',
    description: 'Medidor del vehículo activo',
    icon: 'gauge',
    render: () => <GaugeWidget />,
  },
  techReadout: {
    label: 'Datos técnicos',
    description: 'Odómetro, próximo cambio y aceite',
    icon: 'oil',
    render: () => <TechReadoutWidget />,
  },
  kpis: {
    label: 'Resumen',
    description: 'Vehículos, último cambio y alertas',
    icon: 'spark',
    render: () => <KpisWidget />,
  },
  quickActions: {
    label: 'Accesos rápidos',
    description: 'Registrar cambio, agregar vehículo, historial',
    icon: 'plus',
    render: () => null,
  },
  recentHistory: {
    label: 'Historial reciente',
    description: 'Los últimos tres cambios',
    icon: 'history',
    render: () => <RecentHistoryWidget />,
  },
  openAlerts: {
    label: 'Alertas abiertas',
    description: 'Vehículos que necesitan atención',
    icon: 'bell',
    render: () => null,
  },
};
```

- [ ] **Step 4: HomeScreen queda como hero + map**

Reemplazar `src/screens/HomeScreen.tsx` entero:

```tsx
// Home — hero fijo con el vehículo activo, y debajo los widgets que el usuario
// eligió y ordenó. El contenido de cada widget vive en src/home/widgets/; acá
// solo se decide el hero y se recorre el orden.
import React, { useState } from 'react';
import { FlatList, Modal } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Box, Col, Row, Scroll, Touchable, Txt, useAppColors } from '../ui';
import { Avatar, TechGrid, VehicleThumb } from '../components/primitives';
import { Icon } from '../components/Icon';
import { useActiveVehicle, useOpenAlerts, useStore } from '../store/useStore';
import { useHomeLayout } from '../store/homeLayout';
import { visibleWidgets } from '../home/layout';
import { HOME_WIDGETS } from '../home/registry';
import { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function HomeScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const c = useAppColors();
  const vehicles = useStore((s) => s.vehicles);
  const profile = useStore((s) => s.profile);
  const setActiveVehicle = useStore((s) => s.setActiveVehicle);
  const active = useActiveVehicle();
  const openAlerts = useOpenAlerts();
  const layout = useHomeLayout((s) => s.layout);
  const hydrated = useHomeLayout((s) => s.hydrated);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Mientras no terminó de leerse el layout guardado no se pinta la lista: si
  // no, se ve el orden de fábrica reacomodarse solo un instante después.
  const widgets = hydrated ? visibleWidgets(layout) : [];

  return (
    <Box f={1} bg="$bg3">
      <Scroll bg="$bg3" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Hero fijo: no es un widget. Es el ancla del vehículo activo del que
            dependen gauge, techReadout y quickActions — si se pudiera ocultar,
            esos widgets mostrarían datos de un vehículo imposible de cambiar. */}
        <LinearGradient
          colors={[c.primary, c.primary2]}
          style={{
            paddingTop: insets.top + 12,
            paddingHorizontal: 20,
            paddingBottom: 20,
            borderBottomLeftRadius: 32,
            borderBottomRightRadius: 32,
            overflow: 'hidden',
          }}
        >
          <TechGrid />

          <Row mb="$lg" jc="space-between" ai="center">
            <Row f={1} ai="center" gap={12}>
              <Avatar
                name={profile.fullName}
                size={44}
                onPress={() => navigation.navigate('Profile')}
              />
              <Col f={1}>
                <Txt font="display" fos={22} tone="onDark" ls={-0.4}>
                  Tu tablero del día
                </Txt>
              </Col>
            </Row>
            <Row gap={8}>
              <Touchable
                onPress={() => navigation.navigate('CustomizeHome')}
                fade
                transition="quick"
                h={40}
                w={40}
                ai="center"
                jc="center"
                br={12}
                bg="rgba(255,255,255,0.1)"
              >
                <Icon name="sliders" color="#fff" size={20} />
              </Touchable>
              <Touchable
                onPress={() => navigation.navigate('Alerts')}
                fade
                transition="quick"
                h={40}
                w={40}
                ai="center"
                jc="center"
                br={12}
                bg="rgba(255,255,255,0.1)"
              >
                <Icon name="bell" color="#fff" size={20} />
                {openAlerts > 0 ? (
                  <Box pos="absolute" r={8} t={8} h={8} w={8} br="$pill" bg="$warn" />
                ) : null}
              </Touchable>
            </Row>
          </Row>

          <Touchable
            onPress={() => setPickerOpen(true)}
            fade
            transition="quick"
            fd="row"
            ai="center"
            gap={10}
            br={14}
            bw={1}
            bc="rgba(255,255,255,0.1)"
            bg="rgba(255,255,255,0.06)"
            px="$md"
            py={10}
          >
            <VehicleThumb kind={active.kind} color={active.color} size={36} />
            <Col f={1}>
              <Txt font="bold" fos={14} tone="onDark">
                {active.brand} {active.model}
              </Txt>
              <Txt font="monoMed" fos={11} col="rgba(255,255,255,0.65)">
                {active.plate} · {active.year}
              </Txt>
            </Col>
            <Icon name="chevD" color="rgba(255,255,255,0.7)" size={20} />
          </Touchable>
        </LinearGradient>

        {/* Widgets, en el orden que eligió el usuario. */}
        <Col gap={18} pt="$lg">
          {widgets.map((id) => (
            <Box key={id}>{HOME_WIDGETS[id].render()}</Box>
          ))}
        </Col>
      </Scroll>

      {/* selector de vehículo activo */}
      <Modal visible={pickerOpen} transparent animationType="fade" onRequestClose={() => setPickerOpen(false)}>
        <Touchable f={1} jc="flex-end" bg="$scrim" onPress={() => setPickerOpen(false)}>
          <Box
            borderTopLeftRadius="$xl"
            borderTopRightRadius="$xl"
            bg="$surface"
            pt="$md"
            pb={insets.bottom + 12}
            transition="bouncy"
            enterStyle={{ y: 40, opacity: 0 }}
          >
            <FlatList
              data={vehicles}
              keyExtractor={(v) => v.id}
              renderItem={({ item }) => (
                <Touchable
                  fd="row"
                  ai="center"
                  gap="$md"
                  px="$2xl"
                  py="$md"
                  pressStyle={{ bg: '$bg2' }}
                  onPress={() => {
                    setActiveVehicle(item.id);
                    setPickerOpen(false);
                  }}
                >
                  <VehicleThumb kind={item.kind} color={item.color} size={40} />
                  <Col f={1}>
                    <Txt font="bold" fos={14}>
                      {item.brand} {item.model}
                    </Txt>
                    <Txt font="monoMed" fos={11} tone="muted">
                      {item.plate} · {item.year}
                    </Txt>
                  </Col>
                  {item.id === active.id ? <Icon name="check" color={c.accent} size={18} /> : null}
                </Touchable>
              )}
            />
          </Box>
        </Touchable>
      </Modal>
    </Box>
  );
}
```

**Nota:** este archivo ya referencia `navigation.navigate('Profile')`, `'Alerts'` y `'CustomizeHome'`, rutas que no existen hasta las tareas 7 y 8. `npx tsc --noEmit` va a fallar con tres errores de tipo hasta entonces — es esperado y se resuelve en la Task 7. No agregar `as never` para taparlo.

- [ ] **Step 5: Verificar los tests**

```bash
npx jest
```

Esperado: PASS. (`tsc` seguirá con los tres errores de rutas hasta la Task 7.)

- [ ] **Step 6: Commit**

```bash
git add src/home src/screens/HomeScreen.tsx
git commit -m "refactor: mover los bloques del inicio detrás del registro de widgets"
```

---

### Task 6: Widgets nuevos — accesos rápidos y alertas abiertas

**Files:**
- Create: `src/home/widgets/QuickActionsWidget.tsx`
- Create: `src/home/widgets/OpenAlertsWidget.tsx`
- Modify: `src/home/registry.tsx`

**Interfaces:**
- Consumes: `Card`, `SectionHead` de `src/components/primitives`; `vehicleStatus`, `kmLeft`, `useStore` de `src/store/useStore`.
- Produces: `QuickActionsWidget()`, `OpenAlertsWidget()` — sin props.

- [ ] **Step 1: Accesos rápidos**

Crear `src/home/widgets/QuickActionsWidget.tsx`. Existe porque al eliminar el FAB, "registrar un cambio" se quedó sin atajo desde el inicio:

```tsx
// Accesos rápidos. Reemplaza al FAB que se eliminó del tab bar: sin esto,
// registrar un cambio de aceite deja de tener un atajo desde el inicio.
import React from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Col, Row, Touchable, Txt, useAppColors } from '../../ui';
import { Icon, IconName } from '../../components/Icon';
import { useActiveVehicle } from '../../store/useStore';
import { RootStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function QuickActionsWidget() {
  const navigation = useNavigation<Nav>();
  const c = useAppColors();
  const active = useActiveVehicle();

  const acciones: { label: string; icon: IconName; onPress: () => void }[] = [
    {
      label: 'Registrar cambio',
      icon: 'drop',
      onPress: () => navigation.navigate('AddOil', { vehicleId: active.id }),
    },
    {
      label: 'Agregar vehículo',
      icon: 'plus',
      onPress: () => navigation.navigate('AddVehicleType'),
    },
    {
      label: 'Historial',
      icon: 'history',
      onPress: () => navigation.navigate('History'),
    },
  ];

  return (
    <Row gap={10} px="$lg" ai="stretch">
      {acciones.map((a) => (
        <Touchable
          key={a.label}
          onPress={a.onPress}
          fade
          sink
          transition="quick"
          f={1}
          ai="center"
          gap={8}
          br="$md"
          bw={1}
          bc="$line"
          bg="$surface"
          px="$sm"
          py={14}
        >
          <Col h={36} w={36} ai="center" jc="center" br={10} bg="$accentSoft">
            <Icon name={a.icon} color={c.accent} size={18} />
          </Col>
          <Txt font="semi" fos={11} ta="center" tone="ink2">
            {a.label}
          </Txt>
        </Touchable>
      ))}
    </Row>
  );
}
```

- [ ] **Step 2: Alertas abiertas**

Crear `src/home/widgets/OpenAlertsWidget.tsx`. Cuando no hay nada abierto el widget no se pinta: una card que dice "todo bien" es ruido permanente en una lista que el usuario armó:

```tsx
// Vehículos que necesitan atención, ordenados por urgencia. Gana relevancia
// ahora que Alertas dejó de ser un tab.
import React from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Box, Col, Row, Touchable, Txt, useAppColors } from '../../ui';
import { Card, SectionHead, StatusPill, VehicleThumb } from '../../components/primitives';
import { Icon } from '../../components/Icon';
import { fmtKm } from '../../utils/format';
import { kmLeft, useStore, vehicleStatus } from '../../store/useStore';
import { RootStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function OpenAlertsWidget() {
  const navigation = useNavigation<Nav>();
  const c = useAppColors();
  const vehicles = useStore((s) => s.vehicles);

  // Vencidos primero, después los que se acercan.
  const abiertos = vehicles
    .filter((v) => vehicleStatus(v) !== 'ok')
    .sort((a, b) => kmLeft(a) - kmLeft(b))
    .slice(0, 3);

  // Sin alertas no se pinta nada: una card de "todo en orden" sería ruido fijo.
  if (abiertos.length === 0) return null;

  return (
    <Box>
      <SectionHead
        right={
          <Touchable onPress={() => navigation.navigate('Alerts')} hitSlop={8} fade>
            <Txt font="semi" fos={12} tone="accent">Ver todo</Txt>
          </Touchable>
        }
      >
        Alertas abiertas
      </SectionHead>
      <Col gap={10} px="$lg">
        {abiertos.map((v) => (
          // Card táctil: el chevrón promete navegación, así que tiene que navegar.
          <Card
            key={v.id}
            fd="row"
            ai="center"
            gap="$md"
            onPress={() => navigation.navigate('VehicleDetail', { vehicleId: v.id })}
            pressStyle={{ opacity: 0.85 }}
          >
            <VehicleThumb kind={v.kind} color={v.color} size={36} />
            <Col f={1}>
              <Txt font="bold" fos={14}>{v.brand} {v.model}</Txt>
              <Txt fos={12} tone="muted" mt={1}>
                {kmLeft(v) > 0
                  ? `Faltan ${fmtKm(kmLeft(v))} km`
                  : `Vencido por ${fmtKm(Math.abs(kmLeft(v)))} km`}
              </Txt>
            </Col>
            <StatusPill status={vehicleStatus(v)} />
            <Icon name="chevR" color={c.muted2} size={20} />
          </Card>
        ))}
      </Col>
    </Box>
  );
}
```

- [ ] **Step 3: Conectarlos al registro**

En `src/home/registry.tsx`, agregar los imports:

```tsx
import { QuickActionsWidget } from './widgets/QuickActionsWidget';
import { OpenAlertsWidget } from './widgets/OpenAlertsWidget';
```

y reemplazar los dos `render: () => null` por:

```tsx
    render: () => <QuickActionsWidget />,
```

```tsx
    render: () => <OpenAlertsWidget />,
```

- [ ] **Step 4: Verificar**

```bash
npx jest
```

Esperado: PASS. (`tsc` sigue con los errores de rutas de la Task 5 hasta la Task 7.)

- [ ] **Step 5: Commit**

```bash
git add src/home
git commit -m "feat: widgets de accesos rápidos y alertas abiertas"
```

---

### Task 7: Tab bar de 3 destinos, Menú, y mudanza de Alertas y Perfil al stack

Las tres cosas van juntas porque no compilan por separado: el tab bar no puede apuntar a `Menu` sin `MenuScreen`, y sacar `Alerts` y `Me` de los tabs obliga a arreglar el deep-link en el mismo movimiento.

**Files:**
- Create: `src/screens/MenuScreen.tsx`
- Modify: `src/navigation/types.ts:14-32`
- Modify: `src/navigation/index.tsx:30-51,83-94`
- Modify: `src/components/TabBar.tsx:1-33,126-156`
- Modify: `src/notifications/useNotificationResponse.ts:15`
- Modify: `src/screens/ProfileScreen.tsx` (sacar "Cerrar sesión")

**Interfaces:**
- Consumes: `HOME_WIDGETS` no; `useOpenAlerts` de `src/store/useStore`.
- Produces: `MenuScreen()`; `TabParamList = { Home; Vehicles; Menu }`; `RootStackParamList` gana `Alerts`, `Profile`, `CustomizeHome`.

- [ ] **Step 1: Tipos de navegación**

En `src/navigation/types.ts`, reemplazar `TabParamList` y agregar las tres rutas nuevas al stack:

```ts
export type TabParamList = {
  Home: undefined;
  Vehicles: undefined;
  Menu: undefined;
};

export type RootStackParamList = {
  Onboarding: undefined;
  Login: undefined;
  Signup: undefined;
  Tabs: NavigatorScreenParams<TabParamList> | undefined;
  VehicleDetail: { vehicleId: string };
  AddVehicleType: undefined;
  AddVehicleForm: { kind: 'car' | 'moto' };
  AddOil: { vehicleId?: string; draft?: VehicleDraft };
  History: undefined;
  Notifications: undefined;
  Alerts: undefined;
  Profile: undefined;
  CustomizeHome: undefined;
};
```

- [ ] **Step 2: La pantalla de Menú**

Crear `src/screens/MenuScreen.tsx`:

```tsx
// Menú — tercer destino del tab bar. No tiene contenido propio: es el índice
// de todo lo que dejó de ser un tab cuando la barra bajó a tres destinos.
import React from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Box, Col, Row, Scroll, Touchable, Txt, useAppColors } from '../ui';
import { Card, SectionHead } from '../components/primitives';
import { Icon, IconName } from '../components/Icon';
import { useOpenAlerts, useStore } from '../store/useStore';
import { useNotifPrefs } from '../store/notifPrefs';
import { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

type Fila = { k: string; v?: string; icon: IconName; onPress: () => void };

export function MenuScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const c = useAppColors();
  const profile = useStore((s) => s.profile);
  const openAlerts = useOpenAlerts();
  const notifEnabled = useNotifPrefs((s) => s.prefs.enabled);

  const cuenta: Fila[] = [
    { k: 'Mi perfil', v: profile.fullName, icon: 'user', onPress: () => navigation.navigate('Profile') },
    {
      k: 'Alertas',
      v: openAlerts > 0 ? `${openAlerts} abiertas` : 'Al día',
      icon: 'bell',
      onPress: () => navigation.navigate('Alerts'),
    },
    { k: 'Historial', icon: 'history', onPress: () => navigation.navigate('History') },
  ];

  const gestion: Fila[] = [
    { k: 'Agregar vehículo', icon: 'plus', onPress: () => navigation.navigate('AddVehicleType') },
    { k: 'Personalizar inicio', icon: 'sliders', onPress: () => navigation.navigate('CustomizeHome') },
    {
      k: 'Notificaciones',
      v: notifEnabled ? 'Activadas' : 'Desactivadas',
      icon: 'settings',
      onPress: () => navigation.navigate('Notifications'),
    },
  ];

  const grupo = (filas: Fila[]) => (
    <Box px="$lg">
      <Card padded={false}>
        {filas.map((r, i) => (
          <Touchable
            key={r.k}
            onPress={r.onPress}
            fd="row"
            ai="center"
            gap="$md"
            px="$lg"
            py={14}
            pressStyle={{ bg: '$bg2' }}
            borderBottomWidth={i !== filas.length - 1 ? 1 : 0}
            borderBottomColor="$line2"
          >
            <Box h={32} w={32} ai="center" jc="center" br={10} bg="$accentSoft">
              <Icon name={r.icon} color={c.accent} size={18} />
            </Box>
            <Txt f={1} font="semi" fos={14}>{r.k}</Txt>
            {r.v ? <Txt fos={13} tone="muted">{r.v}</Txt> : null}
            <Icon name="chevR" color={c.muted2} size={20} />
          </Touchable>
        ))}
      </Card>
    </Box>
  );

  return (
    <Box f={1} bg="$bg3">
      <Row jc="space-between" px="$xl" pb={14} pt={insets.top + 12}>
        <Col>
          <Txt fos={12} tone="muted" ls={1} caps>
            OilTrack VE
          </Txt>
          <Txt font="display" fos={26} ls={-0.5}>
            Menú
          </Txt>
        </Col>
      </Row>

      <Scroll bg="$bg3" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        <SectionHead>Cuenta</SectionHead>
        {grupo(cuenta)}

        <Box pt={18}>
          <SectionHead>Gestión</SectionHead>
          {grupo(gestion)}
        </Box>

        {/* Cerrar sesión se mudó acá desde Perfil: ahora que el perfil dejó de
            ser un destino raíz, el menú es el lugar donde se lo busca. */}
        <Box px="$lg" pt={18}>
          <Touchable
            onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Login' }] })}
            transition="quick"
            h={48}
            fd="row"
            ai="center"
            jc="center"
            gap="$sm"
            br="$md"
            bw={1.5}
            bc="$line"
            bg="transparent"
            pressStyle={{ bg: '$bg2' }}
          >
            <Icon name="logout" color={c.danger} size={20} />
            <Txt font="semi" fos={15} tone="danger">Cerrar sesión</Txt>
          </Touchable>
          <Txt font="monoMed" fos={11} tone="muted2" ls={0.4} ta="center" mt="$md">
            OilTrack VE · v1.0.0
          </Txt>
        </Box>
      </Scroll>
    </Box>
  );
}
```

- [ ] **Step 3: Registrar las pantallas**

En `src/navigation/index.tsx`: cambiar el import de `ProfileScreen` por uno que también traiga `MenuScreen`, reemplazar los cuatro `Tab.Screen` por tres, y sumar las tres rutas al stack.

Imports (agregar junto a los existentes):

```tsx
import { MenuScreen } from '../screens/MenuScreen';
import { CustomizeHomeScreen } from '../screens/CustomizeHomeScreen';
```

Los tabs:

```tsx
        <Tab.Screen name="Home" component={HomeScreen} />
        <Tab.Screen name="Vehicles" component={VehiclesScreen} />
        <Tab.Screen name="Menu" component={MenuScreen} />
```

El stack, después de `Notifications`:

```tsx
        <Stack.Screen name="Alerts" component={AlertsScreen} />
        <Stack.Screen name="Profile" component={ProfileScreen} />
        <Stack.Screen name="CustomizeHome" component={CustomizeHomeScreen} />
```

`CustomizeHomeScreen` no existe hasta la Task 8. Para que esta tarea compile sola, crear el archivo mínimo ahora y completarlo después:

```tsx
// src/screens/CustomizeHomeScreen.tsx — se completa en la Task 8.
import React from 'react';
import { Box } from '../ui';

export function CustomizeHomeScreen() {
  return <Box f={1} bg="$bg3" />;
}
```

- [ ] **Step 4: Arreglar el deep-link de las notificaciones**

En `src/notifications/useNotificationResponse.ts:15`, `Alerts` ya no es un tab:

```ts
    navigationRef.navigate('Alerts');
```

Y actualizar el comentario de cabecera del archivo, que dice "la pestaña de Alertas":

```ts
// Qué pasa al tocar una notificación: navegar al vehículo del aviso, o a la
// pantalla de Alertas si es el recordatorio semanal.
```

**Esto es obligatorio.** Sin este cambio, tocar una notificación navega a un tab inexistente — un camino que no se recorre en el arranque normal y que es fácil no volver a probar.

- [ ] **Step 5: Tab bar a tres destinos**

En `src/components/TabBar.tsx`:

`TAB_META` pasa a:

```tsx
const TAB_META: Record<string, { label: string; icon: IconName }> = {
  Home: { label: 'Inicio', icon: 'home' },
  Vehicles: { label: 'Vehículos', icon: 'car' },
  Menu: { label: 'Menú', icon: 'menu' },
};
```

Borrar la constante `FAB_SIZE`. **No** tocar `sh.primary` (lo usan `Btn` e `IconBtn`) ni el import de `useShadows` (la barra usa `sh.tabbar`).

Dentro del `Row`, reemplazar los cinco hijos por tres:

```tsx
            {renderTab('Home')}
            {renderTab('Vehicles')}
            {renderTab('Menu')}
```

y borrar el bloque entero del FAB — el `<Box pos="absolute" t={-22} ...>` con su `Touchable`.

Reescribir el comentario de cabecera, que hoy documenta dos decisiones sobre un FAB que deja de existir:

```tsx
// Tab bar flotante de cristal — tres destinos: Inicio, Vehículos, Menú.
//
// El cristal (liquid glass en iOS 26, blur nativo en el resto) lo resuelve
// GlassSurface; aquí solo se decide la composición. Dos decisiones que no son
// obvias mirando el resultado:
//
//  · No hay degradado que funda la barra con el fondo. Lo había cuando la pill
//    era opaca; con cristal sobraría y además taparía justo lo que tiene que
//    verse pasar por debajo.
//
//  · La lente del item activo es UNA sola y se desplaza, en vez de una por tab
//    que aparece y desaparece. Ver abajo.
```

La maquinaria de la lente (`slots`, `measure`, `LENS_INSET`) no se toca: está escrita midiendo justamente para sobrevivir a un cambio de cantidad de tabs.

- [ ] **Step 6: Sacar "Cerrar sesión" de Perfil**

En `src/screens/ProfileScreen.tsx`, borrar el bloque final `{/* cerrar sesión */}` completo (el `Touchable` de logout y el `Txt` de la versión), que ahora vive en el Menú. Quitar del array `prefRows` la fila de Notificaciones, que también se mudó al Menú.

Eso deja tres cosas huérfanas en el archivo, y TypeScript **no** avisa de imports sin usar: borrar a mano el import y la llamada de `useNotifPrefs`, la constante `notifEnabled`, y —si ya nada más lo usa— el hook `useNavigation` con su import y el tipo `Nav`. Verificar con `npx tsc --noEmit` y releyendo el archivo.

- [ ] **Step 7: Verificar**

```bash
npx tsc --noEmit && npx jest
```

Esperado: **ahora sí**, sin errores de tipo (se resuelven los tres que la Task 5 dejó pendientes) y todos los tests en verde.

- [ ] **Step 8: Probar en el dispositivo**

Con el development build de la Task 1 instalado: abrir la app y verificar que la barra muestra tres destinos, que la lente se desplaza entre los tres, que Menú abre y que desde ahí se llega a Perfil y a Alertas.

- [ ] **Step 9: Commit**

```bash
git add src/navigation src/screens src/components/TabBar.tsx src/notifications/useNotificationResponse.ts
git commit -m "feat: tab bar de tres destinos con pantalla de menú"
```

---

### Task 8: Pantalla "Personalizar inicio" con arrastre

**Files:**
- Modify: `src/screens/CustomizeHomeScreen.tsx` (creado mínimo en la Task 7)

**Interfaces:**
- Consumes: `HOME_WIDGETS` de `src/home/registry`; `WidgetId` de `src/home/layout`; `useHomeLayout` de `src/store/homeLayout`.
- Produces: `CustomizeHomeScreen()`.

- [ ] **Step 1: Escribir la pantalla**

Reemplazar `src/screens/CustomizeHomeScreen.tsx` entero.

El drag usa filas de **altura fija**: con `ROW_H` conocido, el hueco destino es `index + Math.round(translationY / ROW_H)`, una división. Arrastrar las cards reales del inicio obligaría a medir alturas variables y mantenerlas sincronizadas frame a frame.

Tres shared values viven en el padre porque **todas** las filas necesitan verlos: la arrastrada para seguir al dedo, y las demás para correrse y mostrar dónde va a caer.

```tsx
// Personalizar inicio — orden y visibilidad de los widgets.
//
// Las filas tienen altura fija (ROW_H) a propósito: así el hueco destino del
// arrastre es una división, y no hay que medir y sincronizar alturas variables
// en cada frame como pasaría arrastrando las cards reales del inicio.
import React from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Switch } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { Box, Col, Row, Touchable, Txt, useAppColors } from '../ui';
import { IconBtn } from '../components/primitives';
import { Icon } from '../components/Icon';
import { WidgetId } from '../home/layout';
import { HOME_WIDGETS } from '../home/registry';
import { useHomeLayout } from '../store/homeLayout';

const ROW_H = 68;

type FilaProps = {
  id: WidgetId;
  index: number;
  total: number;
  oculto: boolean;
  /** Índice de la fila que se está arrastrando, o -1. Compartido por todas. */
  activeIndex: SharedValue<number>;
  /** Índice donde caería ahora mismo. */
  hoverIndex: SharedValue<number>;
  /** Desplazamiento vertical del dedo. */
  dragY: SharedValue<number>;
  onMove: (id: WidgetId, to: number) => void;
  onToggle: (id: WidgetId) => void;
};

function Fila({
  id, index, total, oculto, activeIndex, hoverIndex, dragY, onMove, onToggle,
}: FilaProps) {
  const c = useAppColors();
  const def = HOME_WIDGETS[id];

  // Solo el handle arrastra: si el gesto cubriera la fila entera, el switch
  // dejaría de responder.
  const pan = Gesture.Pan()
    .onStart(() => {
      activeIndex.value = index;
      hoverIndex.value = index;
      dragY.value = 0;
    })
    .onUpdate((e) => {
      dragY.value = e.translationY;
      const destino = index + Math.round(e.translationY / ROW_H);
      hoverIndex.value = Math.max(0, Math.min(total - 1, destino));
    })
    .onEnd(() => {
      if (hoverIndex.value !== index) runOnJS(onMove)(id, hoverIndex.value);
      activeIndex.value = -1;
      hoverIndex.value = -1;
      dragY.value = 0;
    });

  const style = useAnimatedStyle(() => {
    // Esta fila es la que se arrastra: sigue al dedo, por encima del resto.
    if (activeIndex.value === index) {
      return { transform: [{ translateY: dragY.value }], zIndex: 10, opacity: 0.95 };
    }
    // Nadie arrastra: todo en su lugar.
    if (activeIndex.value === -1) {
      return { transform: [{ translateY: withTiming(0, { duration: 140 }) }], zIndex: 1, opacity: 1 };
    }
    // Otra fila se arrastra: correrse para abrir el hueco.
    const desde = activeIndex.value;
    const hasta = hoverIndex.value;
    let corrimiento = 0;
    if (desde < hasta && index > desde && index <= hasta) corrimiento = -ROW_H;
    else if (desde > hasta && index >= hasta && index < desde) corrimiento = ROW_H;
    return {
      transform: [{ translateY: withTiming(corrimiento, { duration: 140 }) }],
      zIndex: 1,
      opacity: 1,
    };
  });

  return (
    <Animated.View style={[{ height: ROW_H }, style]}>
      <Row f={1} ai="center" gap="$md" px="$lg">
        <GestureDetector gesture={pan}>
          <Box py="$sm" pr={4}>
            <Icon name="grip" color={c.muted2} size={22} />
          </Box>
        </GestureDetector>

        <Box h={36} w={36} ai="center" jc="center" br={10} bg="$accentSoft" opacity={oculto ? 0.4 : 1}>
          <Icon name={def.icon} color={c.accent} size={18} />
        </Box>

        <Col f={1} opacity={oculto ? 0.4 : 1}>
          <Txt font="semi" fos={14}>{def.label}</Txt>
          <Txt fos={12} tone="muted" mt={1}>{def.description}</Txt>
        </Col>

        <Switch
          value={!oculto}
          onValueChange={() => onToggle(id)}
          trackColor={{ false: c.line, true: c.accent }}
        />
      </Row>
    </Animated.View>
  );
}

export function CustomizeHomeScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const c = useAppColors();
  const layout = useHomeLayout((s) => s.layout);
  const move = useHomeLayout((s) => s.move);
  const toggle = useHomeLayout((s) => s.toggle);
  const reset = useHomeLayout((s) => s.reset);

  const activeIndex = useSharedValue(-1);
  const hoverIndex = useSharedValue(-1);
  const dragY = useSharedValue(0);

  return (
    <Box f={1} bg="$bg3">
      <Row jc="space-between" ai="center" px="$xl" pb={14} pt={insets.top + 12}>
        <Row f={1} ai="center" gap="$md">
          <IconBtn
            icon={<Icon name="chevL" color={c.ink} size={22} />}
            size={40}
            onPress={() => navigation.goBack()}
          />
          <Col f={1}>
            <Txt fos={12} tone="muted" ls={1} caps>
              Inicio
            </Txt>
            <Txt font="display" fos={22} ls={-0.5}>
              Personalizar
            </Txt>
          </Col>
        </Row>
        <Touchable onPress={reset} hitSlop={8} fade>
          <Txt font="semi" fos={12} tone="accent">Restablecer</Txt>
        </Touchable>
      </Row>

      <Txt fos={13} tone="muted" px="$xl" pb="$md">
        Arrastrá desde el asa para cambiar el orden. El interruptor muestra u
        oculta el widget sin perder su lugar.
      </Txt>

      {/* Altura fija: la lista completa entra sin scroll con seis widgets, y
          mezclar scroll con arrastre vertical pelearía por el mismo gesto. */}
      <Box h={layout.order.length * ROW_H}>
        {layout.order.map((id, i) => (
          <Fila
            key={id}
            id={id}
            index={i}
            total={layout.order.length}
            oculto={layout.hidden.includes(id)}
            activeIndex={activeIndex}
            hoverIndex={hoverIndex}
            dragY={dragY}
            onMove={move}
            onToggle={toggle}
          />
        ))}
      </Box>
    </Box>
  );
}
```

Las filas se posicionan con el flujo normal (una debajo de otra, cada una de `ROW_H`); el `translateY` animado solo las corre visualmente durante el arrastre y vuelve a cero cuando el store ya tiene el orden nuevo.

- [ ] **Step 2: Verificar que compila**

```bash
npx tsc --noEmit && npx jest
```

Esperado: sin errores, todos los tests en verde.

- [ ] **Step 3: Probar el arrastre en el dispositivo**

Requiere el development build de la Task 1 instalado. Verificar, en este orden:

1. Menú → Personalizar inicio abre la lista con los seis widgets.
2. Arrastrar el asa de un widget: la fila sigue al dedo y las otras se corren.
3. Al soltar, el orden queda como se veía; volver al inicio y confirmar que los widgets están en ese orden.
4. Apagar un widget: desaparece del inicio pero **sigue en su lugar** en la lista.
5. Volver a prenderlo: reaparece en el inicio **en la misma posición**, no al final.
6. Cerrar y reabrir la app por completo: el orden y los ocultos se conservan.
7. "Restablecer" devuelve el orden de fábrica con Alertas abiertas apagado.

Si ningún gesto responde y no hay error en consola, falta `GestureHandlerRootView` (Task 1, Step 2).

- [ ] **Step 4: Commit**

```bash
git add src/screens/CustomizeHomeScreen.tsx
git commit -m "feat: pantalla para ordenar y ocultar los widgets del inicio"
```

---

### Task 9: Verificación final y documentación

**Files:**
- Modify: `README.md` (si menciona la estructura de tabs)

- [ ] **Step 1: Suite completa**

```bash
npx tsc --noEmit && npx jest
```

Esperado: sin errores de tipo; todas las suites en verde.

- [ ] **Step 2: Buscar restos del tab bar viejo**

```bash
grep -rn "Tabs'.*screen.*Alerts\|screen: 'Me'\|AddVehicleType' as never\|FAB_SIZE" src/
```

Esperado: sin resultados. Cualquier coincidencia es una referencia a un destino que ya no existe.

- [ ] **Step 3: Confirmar que no entró el barrel de iconos**

```bash
grep -rn "from 'lucide-react-native'" src/ | grep -v "import type"
```

Esperado: sin resultados. Solo se permite `import type { LucideIcon }` desde la raíz, porque los tipos se borran al compilar.

- [ ] **Step 4: Recorrido manual completo**

Inicio (con los widgets en orden propio) → tocar el avatar → Perfil → volver → campana → Alertas → volver → Vehículos → Menú → cada fila del menú abre lo que dice → Personalizar inicio → reordenar → volver al inicio y ver el cambio.

- [ ] **Step 5: Actualizar el README si hace falta**

```bash
grep -n "tab\|Tab\|FAB\|Alertas" README.md
```

Si describe la barra de cinco destinos o el FAB, corregirlo a los tres destinos actuales.

- [ ] **Step 6: Commit final**

```bash
git add -A
git commit -m "docs: actualizar el README con la barra de tres destinos"
```
