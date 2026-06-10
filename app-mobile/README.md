# OilTrack VE 🛢️

App móvil (React Native + Expo) para llevar el control del cambio de aceite de carros y motos en Venezuela. Implementación del design handoff `design_handoff_oiltrack_ve` — paleta **Navy**, fidelidad hi-fi.

> **Estado:** UI completa con data mock (sin backend aún). La integración con backend viene después.

## Correr el proyecto

```bash
npm install
npm start          # luego abrir en Expo Go / simulador
npm run ios        # simulador iOS
npm run android    # emulador Android
```

## Stack

- **Expo SDK 56** + TypeScript
- **React Navigation** — stack nativo + bottom tabs con TabBar custom (FAB central)
- **react-native-svg** — iconos, ilustraciones, medidor radial `OilGauge`
- **Zustand** — estado global (vehículos, cambios de aceite, perfil)
- **expo-linear-gradient** — headers oscuros y thumbnails
- **@expo-google-fonts** — Inter (UI), Space Grotesk (títulos), JetBrains Mono (km, USD, placas, cédula)
- **Tailwind CSS v4 + NativeWind v5 + react-native-css** — styling con `className`

## Tailwind

Configurado según la skill `expo-tailwind-setup` (`../.agents/skills/`, compartidas a nivel del monorepo):

- `metro.config.js` — `withNativewind` (sin babel config; todo es CSS-first)
- `postcss.config.mjs` — plugin `@tailwindcss/postcss`
- `src/global.css` — imports de Tailwind v4 + **tokens del handoff registrados en `@theme`**
- `src/tw/` — wrappers con `useCssElement` (`View`, `Text`, `Pressable`, `ScrollView`, `TextInput`…)
- `package.json` — `lightningcss` fijado a `1.30.1` (overrides) por compatibilidad con react-native-css

Uso — los tokens de OilTrack están disponibles como clases:

```tsx
import { View, Text } from '@/tw';

<View className="flex-1 bg-primary rounded-lg p-4">
  <Text className="text-accent2 font-display text-xl">OilTrack VE</Text>
  <Text className="text-muted font-sans">bg-bg2, border-line, text-ink, text-ok/warn/danger…</Text>
</View>
```

> Nota: las pantallas actuales usan StyleSheet/estilos inline (fieles al handoff). Tailwind queda disponible para nuevas pantallas o migración gradual — ambos sistemas conviven sin conflicto.

## Estructura

```
src/
├── theme/          # tokens de diseño (paleta navy, semánticos, radios, sombras)
├── components/     # Icon, BrandMark, OilGauge, TabBar, primitivas (Btn, Input, Card…)
├── data/mock.ts    # data mock: flota, cambios, perfil, marcas/aceites VE
├── store/          # Zustand + selectors (kmLeft, pct, status)
├── utils/format.ts # formatos es-VE (78.460 km, $32,00)
├── navigation/     # stack raíz + tabs
└── screens/        # 12 pantallas
```

## Pantallas

1. **Onboarding** (3 slides con pager) → 2. **Login** → 3. **Signup**
4. **Home** — tablero con OilGauge radial animado, KPIs, historial reciente
5. **Garaje** — lista multi-vehículo con filtros y progreso
6–7. **Agregar vehículo** — tipo (carro/moto) → datos → aceite (3 pasos)
8. **Detalle del vehículo** — hero oscuro + card de aceite + timeline
9. **Registrar cambio** — aceite, kilometraje con intervalo, costo USD
10. **Historial** — inversión anual USD/Bs.S + lista completa
11. **Alertas** — vencido / próximo / resueltas (derivadas del estado)
12. **Perfil** — datos personales (cédula V-, estado VE) + preferencias

## Pendiente (próximas iteraciones)

- Integración con backend (reemplazar `src/data/mock.ts` y el store)
- Persistencia local (MMKV / AsyncStorage) — offline-first
- Notificaciones locales (`expo-notifications`) cuando `kmLeft < 500`
- Animaciones con `react-native-reanimated`
