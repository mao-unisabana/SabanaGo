# Proposal

## Why

El DER v1.1, el diseño de APIs y la seguridad están cerrados en papel (hitos 09, 10 y 11), pero no existe ni el proyecto de Supabase ni una sola migración. La app (cambio D) y la detección (cambio C) dependen de esta base para todo. Cierra el paso 3 y 4 del hito 12 y deja ejecutable lo diseñado en 09, 10 y 11.

## What Changes

- Inicializar Supabase en `supabase/` (`supabase init`) y crear el proyecto de demo en la nube.
- Primera migración con el DER v1.1: 2 enums, 9 tablas (`profile`, `parking_lot`, `zone`, `camera`, `space`, `space_state`, `occupancy_log`, `favorite`, `push_token`) y la vista `camera_status`.
- Reglas en la base: trigger del histórico, copia de `zone_id` en `space_state`, zona apagada → `no_data`, validación cámara–puesto del mismo parqueadero, sincronización de `profile` con `auth.users` y tarea de `pg_cron` cada 5 s para cámaras sin latido.
- RLS en todas las tablas según la matriz de la nota 11, con `is_admin()` y permiso de `UPDATE` de `profile` solo sobre `full_name`.
- RPC: `get_occupancy`, `get_occupancy_history`, `ingest_space_states` y las tres del panel (`admin_set_zone_active`, `admin_upsert_space`, `admin_delete_space`).
- Publicación Realtime de `space_state`.
- Seed con el parqueadero piloto (Alejandría, zona A) y el parqueadero de la maqueta para la demo.

Fuera del alcance: Edge Function `notify-favorites` y envío de push (el aviso del MVP va dentro de la app, cambio E), interfaz del panel admin.

## Capabilities

### New Capabilities
- `parking-data-model`: estructura de parqueaderos, zonas, cámaras, puestos, estado actual e histórico, y las reglas que la base mantiene sola.
- `access-control`: quién puede leer o escribir cada dato (visitante, usuario, administrador, detección) y cómo se niega el acceso.
- `occupancy-ingest`: cómo entra a la base el estado detectado y cómo se degrada a `no_data` cuando la detección falla.
- `occupancy-queries`: consultas de ocupación actual e histórica que usan la app y el panel.

### Modified Capabilities

## Impact

- Carpeta `supabase/` nueva: `config.toml`, `migrations/`, `seed.sql`, `tests/`.
- `.env.example`: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` con comentarios.
- Depende de: nada. Bloquea: C, D, E, F.
