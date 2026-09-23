# Ruédalo 🛢️

App móvil (React Native + Expo) para llevar el control del cambio de aceite de carros y motos en Venezuela. Implementación con paleta **Navy**, fidelidad hi-fi.

> **Estado:** UI completa con data mock (sin backend aún). La integración con backend viene después.

## Correr el proyecto

```bash
npm install
npm start          # luego abrir en Expo Go / simulador
npm run ios        # simulador iOS
npm run android    # emulador Android
```

## Stack

- **Expo SDK 57** + TypeScript
- **React Navigation** — stack nativo + bottom tabs con TabBar custom (Inicio, Vehículos, Menú)
- **react-native-svg** — iconos, ilustraciones, medidor radial `OilGauge`
- **react-native-gesture-handler** + **Reanimated** — arrastre para ordenar los widgets del inicio
- **Zustand** — estado global (vehículos, cambios de aceite, perfil)
- **expo-linear-gradient** — headers oscuros y thumbnails
- **@expo-google-fonts** — Inter (UI), Space Grotesk (títulos), JetBrains Mono (km, USD, placas, cédula)
- **Tamagui (`@tamagui/core`)** — estilos, tokens, temas claro/oscuro y animaciones
- **expo-notifications** — recibe los push que manda el backend: cambio próximo, vencido y recordatorio de kilometraje
- **expo-sqlite/kv-store + zustand/persist** — preferencias de notificación persistidas

## Tamagui y temas

Todo el styling pasa por Tamagui. Dos decisiones que conviene conocer antes de tocarlo:

**No usamos `@tamagui/config`.** Sus temas por defecto pesan ~5.4 MB en el bundle y no
aportan nada, porque la app tiene su propia paleta del handoff. `tamagui.config.ts`
define tokens, temas y fuentes a mano; así Tamagui cuesta ~0.6 MB.

**No usamos `@tamagui/babel-plugin`.** Es un optimizador opcional de build; en este
proyecto no logra cargar la config y cuelga el bundle. Sin él Tamagui funciona igual
(su propia documentación lo dice: *"You may not need the compiler"*).

Archivos:

- `tamagui.config.ts` — tokens, temas `light`/`dark`, fuentes y animaciones
- `src/theme/` — paleta cruda: `light`, `dark`, radios, espaciados y sombras
- `src/ui/` — primitivas styled (`Box`, `Row`, `Col`, `Txt`, `Touchable`, `Scroll`…)

Uso — el color sale siempre de tokens de tema, nunca de literales:

```tsx
import { Box, Txt, Touchable } from '@/ui';

<Box f={1} bg="$bg" br="$lg" p="$lg">
  <Txt font="display" fos={20}>Ruédalo</Txt>
  <Txt tone="muted">$bg2, $line, $ink, $ok/$warn/$danger…</Txt>
  <Touchable fade sink transition="quick" bg="$primary" />
</Box>
```

### Modo oscuro

La app sigue el ajuste del sistema y reacciona en caliente. Tres piezas tienen que
estar alineadas o no funciona:

1. `app.json` → `userInterfaceStyle: "automatic"`. Si queda en `"light"`, el SO
   reporta siempre `'light'` y nada de lo demás importa.
2. `App.tsx` → `useColorScheme()` alimenta `<Theme name={scheme}>`.
3. `src/navigation/index.tsx` → el `NavigationContainer` lleva su propio tema; sin
   eso el fondo entre pantallas se queda blanco y se ve un flash al navegar.

Ojo con `$primary` vs `$solid`: en claro son el mismo navy, pero `$primary` es
además el color del hero (oscuro en ambos temas), mientras que `$solid` es el
relleno de los controles sólidos — botón primario, chips activos, checkbox —
y en oscuro pasa al azul acento. Si un control sólido usa `$primary`, en oscuro
queda navy sobre navy y desaparece.

Los 27 tokens semánticos existen en ambos temas con el mismo nombre, así que los
componentes no ramifican por esquema. Hay una excepción deliberada: el prop `onDark`
(en `Card`, `KPI`, `IconBtn`) marca los elementos que van sobre el hero navy, que es
oscuro en los dos temas — **no** significa "modo oscuro". Para props que no pasan por
Tamagui (`stroke`/`fill` de SVG, `colors` de LinearGradient, `placeholderTextColor`)
está el hook `useAppColors()`, que lee la misma fuente de verdad.

## Estructura

```
src/
├── theme/          # paleta cruda claro/oscuro, radios, espaciados, sombras
├── ui/             # primitivas styled de Tamagui (Box, Row, Col, Txt, Touchable…)
├── components/     # Icon, BrandMark, OilGauge, TabBar, primitivas (Btn, Input, Card…)
├── data/mock.ts    # data mock: flota, cambios, perfil, marcas/aceites VE
├── store/          # Zustand + selectors (kmLeft, pct, status) + prefs persistidas
├── notifications/  # token de push, permisos y navegación al tocar el aviso
├── utils/format.ts # formatos es-VE (78.460 km, $32,00)
├── navigation/     # stack raíz + tabs
└── screens/        # 13 pantallas
```

## Pantallas

1. **Onboarding** (3 slides con pager) → 2. **Login** → 3. **Signup**
4. **Home** — hero con el vehículo activo + widgets que el usuario ordena y oculta
5. **Garaje** — lista multi-vehículo con filtros y progreso
6–7. **Agregar vehículo** — tipo (carro/moto) → datos → aceite (3 pasos)
8. **Detalle del vehículo** — hero oscuro + card de aceite + timeline
9. **Registrar cambio** — aceite, kilometraje con intervalo, costo USD
10. **Historial** — inversión anual USD/Bs.S + lista completa
11. **Alertas** — vencido / próximo / resueltas (derivadas del estado)
12. **Perfil** — datos personales (cédula V-, estado VE) + preferencias
13. **Notificaciones** — switch maestro, tipos de aviso y día del recordatorio (contra el API)
14. **Menú** — índice de todo lo que dejó de ser un tab
15. **Personalizar inicio** — orden y visibilidad de los widgets, arrastrando

## Pendiente (próximas iteraciones)

- Integración con backend (reemplazar `src/data/mock.ts` y el store)
- Persistencia local de vehículos y cambios — offline-first (hoy solo se persisten
  las preferencias de notificación)
- Animaciones con `react-native-reanimated`

## Notificaciones push

Los avisos los **decide y los manda el backend**, no la app. El teléfono solo
registra su token y recibe. La app ya no programa notificaciones locales: al
arrancar cancela una vez las que dejó programadas la versión anterior, porque
viven en el sistema operativo y sobrevivirían a la actualización.

Las preferencias (switch maestro, tipos de aviso, umbral, día del recordatorio)
viven en el backend, porque es quien decide a quién avisar. Sobreviven a
reinstalar la app. La hora no se elige: el barrido corre a las 9:00 de
Venezuela para todos.

### Qué hace falta para que un push llegue de verdad

Esto **no** está configurado todavía. Sin ello, todo lo demás funciona pero
ninguna notificación llega al teléfono.

1. **FCM v1 (Android).** Crear el proyecto en Firebase, descargar la Service
   Account JSON y subirla a EAS con `eas credentials` (plataforma Android).
2. **APNs (iOS).** Generar la key en el portal de Apple Developer y subirla con
   `eas credentials`.
3. Confirmar que las dos quedaron asociadas al `projectId` que está en
   `app.json` → `extra.eas.projectId`.
4. **Development build.** Expo Go **no sirve** para push remoto en Android
   desde el SDK 53:

   ```bash
   npx expo run:android   # o run:ios
   ```

   Si el build de Android falla con un error de CMake, revisa que el JDK sea el
   17 y no el JBR 25 de Android Studio. Si el de iOS falla con un error de
   Unicode en CocoaPods, es el locale del shell: `export LANG=en_US.UTF-8`.

### Cómo comprobar que quedó

1. Inicia sesión en la app y confirma que apareció la fila en `DeviceToken`
   (`pnpm db:studio` en el backend).
2. Con un vehículo vencido, corre el barrido a mano. Debe llegar la
   notificación, y tocarla debe abrir el detalle de ese vehículo.
3. Vuelve a correr el barrido: **no** debe llegar nada. Ese silencio es el
   dedupe funcionando de punta a punta.
4. A los 30 minutos, la fila de `NotificationLog` debe tener `receiptAt` puesto
   y `receiptError` en null.

La etapa previa —el camino completo contra los servidores de Expo, sin teléfono
y sin credenciales— ya está verificada y documentada en
`../backend-oil-app/test/manual/push-humo.md`.

## Backend

La app necesita el backend corriendo (`../backend-oil-app`):

```bash
cd ../backend-oil-app
docker compose up -d     # PostgreSQL (publica el 5433, no el 5432)
pnpm start:dev
```

La URL sale de `app.json` → `expo.extra.apiUrl`.

En **dispositivo físico** `localhost` es el propio teléfono, no tu Mac: hay que
poner la IP de la red local (`ipconfig getifaddr en0`), por ejemplo
`http://192.168.0.107:3000/api/v1`. En el simulador de iOS `localhost` sí
funciona.

### Sesión

Los tokens viven en Keychain/Keystore vía `expo-secure-store` — un módulo
nativo, así que tras instalarlo hace falta **rebuild del development build**
(`npx expo run:ios` / `npx expo run:android`); no basta con recargar.

`src/store/auth.ts` es la sesión real; `src/store/session.ts` sigue siendo solo
el correo recordado del "Recordarme", nunca una credencial.
