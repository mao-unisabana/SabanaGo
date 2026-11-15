# Proposal

## Why

Después del cambio A, la app guarda los parqueaderos en el celular y los estados no cambian solos. La escena 5b del pitch ("lo que Felipe acaba de hacer ya llegó al celular") necesita que la app lea de Supabase y se repinte en 5 segundos o menos (RF-02). Cierra la parte de la app del hito 13 (RF-02, RF-03, RF-04, RF-10).

## What Changes

- Cliente de Supabase en la app con la llave `anon` (sin cuenta, RF-06).
- Cargar parqueaderos, zonas y puestos desde la base (endpoints 1 y 3 de la nota 10) en lugar de AsyncStorage.
- Suscripción Realtime a `space_state` filtrada por la zona visible; al abrir o reconectar, recarga completa antes de escuchar.
- Ocupación total desde `get_occupancy` y filtro por zona (RF-04).
- Indicador "En vivo · hace N s" y aviso de "cámara sin señal" a partir de `camera_status`.
- Nunca mapa vacío: si se pierde la conexión, se muestra el último estado conocido con su antigüedad.
- Las herramientas de dibujo del modo administrador guardan en la base por las RPC del panel, en lugar de AsyncStorage.

Fuera del alcance: cuenta, favoritos y avisos (cambio E); línea guía a cupo (Should, solo si sobra tiempo).

## Capabilities

### New Capabilities
- `live-occupancy-view`: cómo la app obtiene y mantiene al día el estado de los puestos y la ocupación del parqueadero que el conductor está mirando.

### Modified Capabilities

## Impact

- `apps/mobile/`: nuevo `lib/supabase.ts`, `lib/api.ts` y hooks `useLotData` y `useLiveSpaces`; cambios en `App.tsx` y `Map.tsx`.
- Dependencias: `@supabase/supabase-js`, `react-native-url-polyfill`; `@react-native-async-storage/async-storage` se queda para la sesión de Auth (cambio E) y el caché del último estado.
- Variables: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` en `apps/mobile/.env`.
- Depende de: A (estados y paleta) y B (esquema, RLS, Realtime).
