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

# Capa de API: `src/api/`

```
src/api/
├── base.ts                      clase ApiClient + ApiError. NO tocar por endpoint.
├── tokens.ts                    los tokens, en Keychain/Keystore
└── controllers/
    ├── auth.controller.ts       ← la nomenclatura: <recurso>.controller.ts
    └── vehiculos.controller.ts  (cuando toque)
```

## La regla

**Un archivo por recurso en `controllers/`, nombrado `<recurso>.controller.ts`,
con una clase que extiende `ApiClient` y se exporta como instancia única.**
Ninguna pantalla ni store llama a `fetch` directamente.

```ts
// src/api/controllers/vehiculos.controller.ts
import { ApiClient } from '../base';

class VehiculosController extends ApiClient {
  constructor() {
    super('/vehiculos'); // prefijo del recurso
  }

  listar(query?: { estado?: string; pagina?: number }) {
    return this.get<Vehiculo[]>('', { query, auth: true });
  }

  crear(body: NuevoVehiculo) {
    return this.post<Vehiculo>('', { body, auth: true });
  }

  detalle(id: string) {
    return this.get<Vehiculo>(`/${id}`, { auth: true });
  }
}

export const vehiculosController = new VehiculosController();
```

`get` / `post` / `put` / `patch` / `del` aceptan `{ query, body, headers, auth }`.
Los tipos de la respuesta viven en el mismo archivo del controlador.

## Lo que `base.ts` ya resuelve — no lo repitas en un controlador

- **URL base** desde `EXPO_PUBLIC_API_URL`.
- **Bearer** cuando pasas `auth: true`.
- **Query params** codificados con `URLSearchParams`; los `undefined`/`null` se
  omiten. No construyas la query a mano: un `+` en un correo rompe la URL.
- **Errores**: todo fallo sale como `ApiError` con `status`, `code` y `message`.
  Ramifica por `code` (contrato estable del backend), nunca por el texto.
- **Refresco del token** ante un `401`, con reintento automático.

## Dos cosas que no se tocan

**La cola de refresco es estática en `ApiClient`, compartida por todos los
controladores.** No la muevas a una instancia ni la dupliques: el backend rota
los refresh tokens, así que dos refrescos en paralelo presentarían tokens ya
rotados uno contra otro, el servidor lo leería como robo y cerraría *todas* las
sesiones del usuario. Hay tests que cubren el caso con dos controladores
distintos a la vez.

**`EXPO_PUBLIC_*` no es secreto.** Esas variables quedan incrustadas en el
binario al compilar. Sirven para una URL; una clave de API jamás va ahí.

## Configuración

`.env` (ignorado por git) a partir de `.env.example`:

```
EXPO_PUBLIC_API_URL=http://localhost:3000/api/v1
```

En dispositivo físico `localhost` es el propio teléfono: usa la IP de la red
local (`ipconfig getifaddr en0`).
