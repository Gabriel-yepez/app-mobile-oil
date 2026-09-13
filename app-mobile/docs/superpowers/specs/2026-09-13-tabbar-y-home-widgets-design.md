# Tab bar de 3 destinos + inicio personalizable con widgets — OilTrack VE

**Fecha:** 2026-09-13
**Estado:** diseño aprobado, pendiente de implementación
**Alcance:** rediseño del tab bar, pantalla de Menú, y sistema de widgets
reordenables en Home. La data sigue siendo mock; el backend queda fuera.

## Problema

Dos cosas, relacionadas por la barra inferior.

**El tab bar tiene demasiados destinos.** Hoy son cinco —Inicio, Vehículos, +,
Alertas, Perfil— y el del medio no es un destino sino una acción (abre
`AddVehicleType`). Mezclar navegación y acción primaria en la misma barra obliga
al FAB a vivir fuera del cristal, sobresaliendo 22px y partiendo la fila en dos
mitades. El pedido es bajar a tres: **Inicio, Vehículos, Menú**.

**El inicio es el mismo para todos.** `HomeScreen` apila cuatro bloques en orden
fijo: gauge, datos técnicos, KPIs e historial reciente. Un usuario con un solo
vehículo y otro con una flota de ocho quieren ver cosas distintas arriba, y hoy
no hay forma de expresarlo.

## Restricciones del contexto

- **`react-native-gesture-handler` no está instalado.** SDK 57 fija `~2.32.0`
  (`node_modules/expo/bundledNativeModules.json`). Reanimated ya está en 4.5.1,
  la versión que le corresponde. Instalarlo obliga a **regenerar el development
  build** — en Android, con JDK 17, no con el JBR de Android Studio.
- **Expo Go no corre esta app.** `expo-notifications` hace throw al importarse,
  así que ya se trabaja con development build; el rebuild es fricción conocida,
  no un cambio de flujo.
- **El store es memoria pura.** `useStore` arranca siempre de `MOCK_FLEET`. El
  único estado persistido hoy es `notifPrefs`, con zustand `persist` +
  `expo-sqlite/kv-store`.
- **Los iconos se importan por sub-ruta.** El barrel de lucide pesa +1.9MB
  contra +21KB por sub-ruta (AGENTS.md). Todo icono nuevo entra en `Icon.tsx`.
- **Una notificación hace deep-link a un tab que se muda.**
  `useNotificationResponse.ts:15` navega a `Tabs → Alerts`.

## Decisiones

| Decisión | Elegido | Descartado |
|---|---|---|
| Destinos del tab bar | Inicio, Vehículos, Menú | Mantener 5 + FAB |
| Dónde va "agregar vehículo" | Ya vive en Vehículos (dos entradas) | FAB; botón suelto en Home |
| Qué es el Menú | Pantalla con botones a otras páginas | Hub que absorbe el perfil; bottom sheet |
| Alcance de la personalización | Elegir cuáles y en qué orden | Tamaños chico/grande; solo mostrar/ocultar |
| Header del Home | Saludo fijo, gauge movible | Header entero fijo; todo es widget |
| Reordenar | Arrastrar con gesture-handler | Flechas ↑↓; PanResponder sin dependencias |
| Dónde se arrastra | Pantalla "Personalizar inicio", filas de altura fija | Jiggle mode sobre las cards reales del Home |
| Arquitectura de widgets | Registro + layout persistido | Switch dentro de HomeScreen; widgets parametrizables |

### Por qué un registro y no un switch en HomeScreen

`HomeScreen` ya tiene 229 líneas con los cuatro bloques inline. Meter ahí el
orden dinámico y dos widgets nuevos la lleva a territorio inmanejable, y cada
widget futuro obliga a editarla.

Con un registro, `HomeScreen` queda en el hero fijo más un `map` sobre el orden,
y cada widget es un archivo con un propósito: recibe lo que necesita del store,
devuelve una card. Agregar un widget es agregar una entrada al registro — no
tocar la pantalla de inicio. Es también lo que hace testeable la lógica de
orden, porque queda separada del render.

### Por qué filas de altura fija y no arrastrar las cards reales

Arrastrar las cards del Home directamente (tipo jiggle de iOS) es más vistoso,
pero las cards tienen alturas distintas: hay que medir cada una con `onLayout`,
mantener las medidas sincronizadas mientras cambian de posición, y recalcular
los umbrales de "en qué hueco caí" en cada frame.

Con filas uniformes en una pantalla dedicada, la posición destino es
`Math.round(desplazamiento / ALTURA_FILA)` — una división. Es la versión del
drag que se puede escribir bien a la primera.

## Arquitectura

```
src/home/
├── registry.tsx          # HOME_WIDGETS: Record<WidgetId, WidgetDef>
├── layout.ts             # moveWidget, toggleWidget, reconcile — PURAS, sin React
└── widgets/
    ├── GaugeWidget.tsx
    ├── TechReadoutWidget.tsx
    ├── KpisWidget.tsx
    ├── QuickActionsWidget.tsx
    ├── RecentHistoryWidget.tsx
    └── OpenAlertsWidget.tsx
src/store/homeLayout.ts           # slice Zustand persistido
src/screens/MenuScreen.tsx
src/screens/CustomizeHomeScreen.tsx
```

`layout.ts` no importa nada de React ni de zustand: recibe un layout y el
registro, devuelve un layout nuevo. Esa frontera es lo que permite testear el
reordenamiento y la migración sin montar un solo componente.

### Modelo de datos

```ts
// src/home/registry.tsx
export type WidgetId =
  | 'gauge' | 'techReadout' | 'kpis'
  | 'quickActions' | 'recentHistory' | 'openAlerts';

export type WidgetDef = {
  label: string;          // "Nivel de aceite"
  description: string;    // línea de ayuda en Personalizar inicio
  icon: IconName;
  defaultVisible: boolean;
  render: () => ReactNode;
};

// src/store/homeLayout.ts
export type HomeLayout = {
  /** Todos los ids conocidos, en orden de aparición. */
  order: WidgetId[];
  /** Subconjunto de `order` que NO se muestra. */
  hidden: WidgetId[];
};
```

`order` contiene **todos** los widgets, visibles u ocultos, y `hidden` marca
cuáles no se pintan. Guardar el orden completo hace que ocultar y volver a
mostrar un widget lo devuelva a su lugar en vez de mandarlo al final.

### Catálogo v1

| id | Qué muestra | Origen | Visible por defecto |
|---|---|---|---|
| `gauge` | `OilGauge` del vehículo activo | extraído de HomeScreen | sí |
| `techReadout` | Odómetro · Próximo · Aceite | extraído de HomeScreen | sí |
| `kpis` | Vehículos · Últ. cambio · Alertas | extraído de HomeScreen | sí |
| `quickActions` | Registrar cambio · Agregar vehículo · Historial | **nuevo** | sí |
| `recentHistory` | Últimos 3 cambios | extraído de HomeScreen | sí |
| `openAlerts` | Alertas abiertas, lista corta | **nuevo** | no |

Los cuatro extraídos se mueven **tal cual**, sin rediseño: el objetivo de esta
etapa es hacerlos movibles, no cambiarlos.

`quickActions` existe porque al sacar el FAB, "registrar un cambio de aceite" se
queda sin atajo desde el inicio. El orden por defecto reproduce el Home actual
con `quickActions` intercalado después de los KPIs, así que un usuario que nunca
entre a personalizar ve casi exactamente lo de hoy.

### Qué queda fijo en Home

El bloque navy de arriba no entra al sistema de widgets: avatar, campana,
selector de vehículo activo. Es la identidad de la pantalla y, sobre todo, el
ancla del vehículo activo del que dependen `gauge`, `techReadout` y
`quickActions`. Si se pudiera ocultar, esos widgets quedarían mostrando datos de
un vehículo que el usuario no tiene forma de cambiar.

Se le suma un botón de sliders junto a la campana → `CustomizeHome`.

## Navegación

```ts
type TabParamList = { Home: undefined; Vehicles: undefined; Menu: undefined };

type RootStackParamList = {
  // ...lo existente
  Alerts: undefined;        // ← era tab
  Profile: undefined;       // ← era el tab "Me"
  CustomizeHome: undefined; // ← nueva
};
```

Cambios obligados por la mudanza de `Alerts` y `Me` al stack:

- `useNotificationResponse.ts:15` — `navigate('Tabs', { screen: 'Alerts' })`
  pasa a `navigate('Alerts')`. **Sin esto, tocar una notificación crashea.**
- `HomeScreen` — el avatar apunta a `Tabs → Me`; pasa a `Profile`.
- `TabBar` — `TAB_META` baja a tres entradas.

`useFirstRunPermission()` sigue colgando de `Tabs`, que se sigue montando igual.

## Tab bar

`TAB_META` pasa a `Home` / `Vehicles` / `Menu`. Se eliminan el bloque del FAB y
el `Box w={FAB_SIZE + 12}` que le reservaba el hueco, y con ellos la constante
`FAB_SIZE`. `sh.primary` no se toca: lo usan `Btn` e `IconBtn`. `useShadows`
sigue importado en el archivo porque la barra usa `sh.tabbar`.

La maquinaria de la lente (`slots`, `measure`, el `transition="quick"` sobre
`x`) **no se toca**: está escrita midiendo en vez de calculando justamente para
sobrevivir a un cambio de cantidad de tabs.

El comentario de cabecera del archivo sí se reescribe: hoy documenta tres
decisiones, dos de las cuales son sobre un FAB que deja de existir.

## Menú

Lista de filas —icono en cuadrado `$accentSoft`, label, valor opcional,
chevrón— reusando el patrón de "Preferencias" de `ProfileScreen`:

**Mi perfil** · **Alertas** (con el conteo de abiertas) · **Historial** ·
**Notificaciones** · **Agregar vehículo** · **Personalizar inicio**, y separado
abajo, **Cerrar sesión** (que se va de `ProfileScreen`, donde deja de tener
sentido ahora que el perfil no es un destino raíz).

## Personalizar inicio

Una fila por widget del registro, altura fija `ROW_H = 64`:

```
[⠿]  Nivel de aceite                          [switch]
     Gauge del vehículo activo
```

- **Arrastrar** (`Gesture.Pan` sobre el handle): la fila arrastrada sube de
  elevación y sigue al dedo; las demás se corren con `withTiming`. Al soltar,
  el índice destino es `Math.round(dy / ROW_H)` acotado al rango.
- **Switch**: alterna `hidden`. Un widget oculto se ve atenuado pero sigue en su
  posición, arrastrable.
- Sin botón de guardar: cada cambio escribe en el store, que persiste solo.

## Iconos

Tres iconos que el set de `Icon.tsx` todavía no tiene, y que por AGENTS.md
entran **por sub-ruta**, nunca desde el barrel de lucide:

| Nombre en el set | Módulo | Para qué |
|---|---|---|
| `menu` | `lucide-react-native/icons/menu` | tab Menú |
| `sliders` | `lucide-react-native/icons/sliders-horizontal` | acceso a Personalizar inicio |
| `grip` | `lucide-react-native/icons/grip-vertical` | handle de arrastre |

## Persistencia

`src/store/homeLayout.ts`, mismo patrón que `notifPrefs.ts`: zustand `persist` +
`createJSONStorage(() => AsyncStorage)` de `expo-sqlite/kv-store`, clave
`oiltrack:home-layout`, `hydrated` para no pintar con defaults mientras lee.

La parte que importa es el `merge`, que reconcilia lo guardado contra el
registro con `reconcile(persisted, HOME_WIDGETS)`:

1. Descarta de `order` y `hidden` los ids que ya no están en el registro.
2. Agrega al final de `order` los ids del registro que no estaban guardados, y
   los mete en `hidden` si su `defaultVisible` es `false`.
3. Si lo guardado está corrupto o vacío, devuelve el layout por defecto.

Sin el paso 2, el día que agreguemos un widget nadie con layout guardado lo ve
nunca. Es el mismo bug que el `merge` de `notifPrefs` evita para preferencias
nuevas, pero sobre listas.

## Testing

`src/home/__tests__/layout.test.ts` — la lógica es pura, así que entra en el
Jest que ya está configurado:

- `moveWidget`: mover al medio, al principio, al final; mover el primero hacia
  arriba y el último hacia abajo no hacen nada.
- `toggleWidget`: ocultar, volver a mostrar, y que ocultar **no** altere `order`.
- `reconcile`: widget nuevo en el registro se agrega al final respetando
  `defaultVisible`; widget eliminado desaparece de `order` y de `hidden`;
  `order` vacío, `undefined` y con ids basura devuelven el default.

`src/store/__tests__/homeLayout.test.ts` — que el `merge` del `persist` llame a
`reconcile` y que `hydrated` pase a `true` al rehidratar.

El drag no se testea unitariamente: se verifica en el dispositivo.

## Riesgos

- **El rebuild bloquea.** Hasta que el development build con gesture-handler
  esté instalado no se puede probar nada del drag. Conviene instalar la
  dependencia y lanzar el build **antes** de escribir los widgets, para que
  compile mientras se trabaja en lo que no depende de él.
- **`GestureHandlerRootView` faltante** es el error clásico: los gestos no
  responden y no hay mensaje de error. Va envolviendo la app entera en
  `App.tsx`.
- **Regresión de deep-link.** Si `useNotificationResponse` no se actualiza junto
  con la mudanza de `Alerts`, la app crashea al tocar una notificación — un
  camino que no pasa por ninguna pantalla en el arranque normal y que es fácil
  no volver a probar.

## Fuera de alcance

- Tamaños de widget (chico/grande, grilla de dos columnas).
- Widgets parametrizables (elegir qué métrica muestra un KPI).
- Layouts distintos por vehículo.
- Rediseño visual de los cuatro bloques que se extraen.
- Persistir el resto del store (vehículos, cambios, perfil) — sigue en memoria.
