# Prueba de humo del push contra la Expo Push API

Fecha: 2026-09-22
Etapa 2 del plan `docs/superpowers/plans/2026-09-20-push-notifications.md`:
verificar el camino completo contra los servidores de Expo **sin teléfono y
sin credenciales de FCM/APNs**.

La Expo Push API acepta envíos a un token con formato válido aunque no exista,
y responde con un ticket de error bien formado. Eso alcanza para probar el
chunking, la traducción de tickets y el apagado de tokens muertos.

## Qué se probó

### 1. El adaptador contra la red real

Envío a dos tokens inventados con formato válido:

```
ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]
ExponentPushToken[yyyyyyyyyyyyyyyyyyyyyy]
```

Resultado: dos tickets, en el mismo orden que la lista de entrada, traducidos
al tipo del dominio:

```json
[
  { "ok": false, "code": "DeviceNotRegistered", "message": "\"ExponentPushToken[xxx…]\" is not a registered push notification recipient…" },
  { "ok": false, "code": "DeviceNotRegistered", "message": "\"ExponentPushToken[yyy…]\" is not a registered push notification recipient…" }
]
```

Una lista vacía devuelve `[]` sin llamar a la red.

### 2. El barrido completo

Cuenta de prueba bajo `@e2e.local` con un vehículo vencido por los dos ejes
—8 meses y ~12.000 km de más— y un token inventado registrado. Se corrió
`PushSweepService.run()` con `PUSH_ENABLED=true`.

| Qué | Esperado | Obtenido |
|---|---|---|
| El barrido llega a enviar | sí | sí (`usuarios: 2`) |
| Envíos exitosos | 0 | 0 |
| El token queda apagado | sí | sí, `disabledAt` puesto |
| Filas en `NotificationLog` | **0** | 0 |

La última fila es la que más importa y no es obvia: el envío falló, así que la
firma **no** se anotó. Si se hubiera anotado, ese aviso quedaría "gastado" y el
usuario nunca se enteraría de que su aceite está vencido. Al no anotarse, el
barrido del día siguiente lo vuelve a intentar.

## Qué NO se probó acá

Que una notificación llegue a un teléfono. Eso es la Etapa 3 y necesita
credenciales de FCM v1 y APNs en EAS, más un development build instalado —
Expo Go no sirve para push remoto en Android desde el SDK 53.

## Cómo repetirla

El script vive en el scratchpad de la sesión, no en el repo: crea datos de
prueba, corre el barrido y limpia detrás. Lo esencial es esto —

1. `pnpm db:up && pnpm build`
2. Crear usuario `@e2e.local` con un vehículo cuyo `OilChange` tenga
   `changedAt` de hace 8 meses e `intervalMonths: 6`.
3. Registrar un `DeviceToken` con formato válido e inventado.
4. Levantar el contexto de Nest con `PUSH_ENABLED=true` y llamar a
   `PushSweepService.run()`.
5. Comprobar `disabledAt` en el token y `count` en `NotificationLog`.
6. Borrar las cuentas `@e2e.local`.
