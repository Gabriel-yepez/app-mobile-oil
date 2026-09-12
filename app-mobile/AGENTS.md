# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

# Iconos SVG: importar SIEMPRE por sub-ruta

Nunca importes iconos desde la raíz de una librería de iconos (el "barrel"):

```ts
// ❌ NO — Metro no hace tree-shaking del barrel y empaqueta los ~1600 iconos
import { Car, Droplet } from 'lucide-react-native';

// ✅ SÍ — un módulo por icono, solo entra al bundle lo que se usa
import Car from 'lucide-react-native/icons/car';
import Droplet from 'lucide-react-native/icons/droplet';
```

Medido en este proyecto (bundle iOS hbc, `npx expo export --platform ios`):
barrel = **+1.9 MB**; sub-ruta = **+21 KB**.

El nombre del módulo es el del icono en kebab-case (`ChevronRight` → `chevron-right`).
Los tipos (`LucideIcon`) sí pueden venir de la raíz con `import type`, porque se
borran en compilación y no llegan al bundle.

El set de la app vive en `src/components/Icon.tsx`: si el icono ya está ahí, úsalo
con `<Icon name="..." />` en vez de importar uno nuevo.
