# Design

## Context

Tras el cambio A, la app tiene los tres estados y el modo administrador, pero los datos viven en AsyncStorage con la forma `Lot { spots: SpotFeature[], zone, lanes }`. El cambio B expone los endpoints 1 a 4 de la nota 10 y publica `space_state` por Realtime con `zone_id`. La meta de 5 s se reparte así (nota 10): ~2 s detección, 1 s escritura, 1 s Realtime, 1 s pintar.

## Goals / Non-Goals

**Goals:**
- Una capa de datos (`lib/api.ts`) que traduzca filas de Supabase a los tipos que ya usa `Map.tsx`, para tocar lo menos posible el mapa.
- Medir la latencia real para el cambio G.

**Non-Goals:**
- Caché offline completo o sincronización bidireccional.
- Paginación: un parqueadero tiene decenas de puestos.

## Decisions

1. **Cliente**: `createClient(url, anonKey, { auth: { storage: AsyncStorage, persistSession: true, detectSessionInUrl: false } })` con `react-native-url-polyfill/auto` importado primero. Llaves desde `process.env.EXPO_PUBLIC_*`.
2. **Mapeo**: `space` → `SpotFeature` (`id`, `geometry.coordinates = [map_polygon cerrado]`, `properties.status` desde `space_state`). `parking_lot.boundary` → contorno, `lanes` → carriles. Un `Lot` de la app pasa a ser un parqueadero de la base y sus zonas.
3. **Realtime**: un canal por zona visible, `postgres_changes` `{ event: 'UPDATE', schema: 'public', table: 'space_state', filter: 'zone_id=eq.<id>' }`. Al cambiar de zona se cierra el canal anterior. Si el canal pasa a `CHANNEL_ERROR` o `TIMED_OUT`, se recarga y se vuelve a suscribir con espera creciente (1, 2, 4 s, máximo 15).
4. **Recarga**: `GET space?zone_id=eq.X&is_active=eq.true&select=id,code,map_polygon,angle,space_state(status,confidence,updated_at)` + `get_occupancy`. Se dispara al abrir, al cambiar de zona, al volver a primer plano (`AppState` `active`) y al reconectar.
5. **Ocupación**: el contador se calcula localmente con los puestos visibles (ya probado en A) para que cambie en el mismo cuadro que el mapa; `get_occupancy` se usa al recargar y para el total del parqueadero.
6. **Caché**: el último resultado de la zona se guarda en AsyncStorage con su hora (`sabanago.cache.zone.<id>`). Sin red, se pinta el caché con su antigüedad.
7. **Cámaras**: consulta a `camera_status` cada 10 s; si alguna está `is_online = false` se muestra el aviso.
8. **Modo administrador**: crear y editar puestos llama a `admin_upsert_space` y borrar a `admin_delete_space`. Al entrar al modo administrador la app pide correo y contraseña en un formulario mínimo (`signInWithPassword`); el cambio E reutiliza ese mismo inicio de sesión para el conductor. Las credenciales nunca se escriben en el código. Si no hay sesión admin, las RPC devuelven 401/403 y la app muestra el error.
9. **Medición de latencia**: en modo desarrollo, cada evento Realtime registra `Date.now() - updated_at` en consola (`[latency] ms`) para el script del cambio G.

## Risks / Trade-offs

- [Reloj del celular desfasado distorsiona la latencia] → La medición formal del cambio G usa marcas del mismo equipo (ingesta y recepción en el portátil con Expo web o un emulador), no el celular.
- [Realtime del plan gratuito con límites de conexiones] → Para la demo sobra; un canal por cliente.
- [El WebView recibe muchos `postMessage`] → Se envía a MapLibre solo el puesto que cambió (`setFeatureState` o actualización del GeoJSON con debounce de 200 ms).

## Migration Plan

1. Probar contra Supabase local con el seed y con la ingesta manual (`curl`).
2. Cambiar `.env` a la nube para la demo.
3. Rollback: revertir el PR; la app del cambio A sigue funcionando con AsyncStorage.
