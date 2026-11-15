# Design

## Context

Todo lo de este cambio sale de tres notas de Obsidian ya cerradas: 09 (DER v1.1), 10 (APIs y webhooks) y 11 (seguridad y auth). No hay backend propio: la app y la detección hablan directo con Supabase (PostgREST, RPC, Realtime). La app usa la llave `anon` y el token del usuario; la detección usa `service_role` desde su `.env`.

## Goals / Non-Goals

**Goals:**
- Una sola fuente de esquema en `supabase/migrations/`, reproducible con `supabase db reset` en local y `supabase db push` en la nube.
- Pruebas de RLS automatizadas con pgTAP (`supabase test db`).

**Non-Goals:**
- Edge Function `notify-favorites` y Database Webhook: el aviso del MVP es local en la app (cambio E). La tabla `push_token` se crea igual para no cambiar el modelo después.
- Límite de peticiones de la API (solo Auth lo trae por defecto).

## Decisions

### 1. Migraciones en cuatro archivos

| Archivo | Contenido |
|---|---|
| `…_001_schema.sql` | Extensiones (`pg_cron`), enums `space_status` (`free`, `occupied`, `no_data`) y `user_role` (`user`, `admin`), tablas, índices y vista `camera_status` |
| `…_002_rules.sql` | Funciones y triggers de reglas |
| `…_003_rls.sql` | `is_admin()`, `ENABLE ROW LEVEL SECURITY`, políticas y `GRANT` / `REVOKE` |
| `…_004_rpc_realtime.sql` | RPC, `pg_cron` y publicación Realtime |

Separarlos permite revisar seguridad (003) aparte del esquema.

### 2. Diccionario (DER v1.1, sin cambios)

| Tabla | Columnas |
|---|---|
| `profile` | `id uuid PK → auth.users ON DELETE CASCADE`, `email text NOT NULL UNIQUE`, `full_name text`, `role user_role NOT NULL DEFAULT 'user'`, `created_at` |
| `parking_lot` | `id bigint identity`, `name text NOT NULL`, `address text`, `boundary jsonb` (anillo `[lng, lat]`), `lanes jsonb NOT NULL DEFAULT '[]'`, `timezone text NOT NULL DEFAULT 'America/Bogota'`, `created_at` |
| `zone` | `id`, `parking_lot_id → parking_lot ON DELETE CASCADE`, `name` (UNIQUE con `parking_lot_id`), `level text`, `boundary jsonb`, `is_active boolean NOT NULL DEFAULT true` |
| `camera` | `id`, `parking_lot_id → parking_lot ON DELETE CASCADE`, `name text NOT NULL`, `source_url text NOT NULL`, `is_online boolean NOT NULL DEFAULT false`, `last_seen_at timestamptz` |
| `space` | `id`, `zone_id → zone ON DELETE CASCADE`, `camera_id → camera ON DELETE SET NULL`, `code` (UNIQUE con `zone_id`), `map_polygon jsonb NOT NULL`, `image_polygon jsonb`, `angle smallint NOT NULL DEFAULT 0 CHECK 0–359`, `is_active boolean NOT NULL DEFAULT true` |
| `space_state` | `space_id PK → space ON DELETE CASCADE`, `zone_id → zone NOT NULL`, `status space_status NOT NULL DEFAULT 'no_data'`, `confidence real CHECK 0–1`, `updated_at timestamptz NOT NULL DEFAULT now()` |
| `occupancy_log` | `id`, `space_id → space ON DELETE CASCADE`, `status`, `confidence`, `recorded_at` + índice `(space_id, recorded_at)` |
| `favorite` | `id`, `user_id → profile ON DELETE CASCADE`, `parking_lot_id → parking_lot ON DELETE CASCADE`, `zone_id → zone ON DELETE CASCADE NULL`, `notify boolean NOT NULL DEFAULT false`, `notify_days smallint[]` (1 = lunes … 7 = domingo), `notify_time time`, `created_at`, `UNIQUE NULLS NOT DISTINCT (user_id, parking_lot_id, zone_id)` |
| `push_token` | `id`, `user_id → profile ON DELETE CASCADE`, `expo_push_token text NOT NULL UNIQUE`, `platform text CHECK IN ('ios','android','web')`, `created_at` |

Vista `camera_status`: `id, parking_lot_id, name, is_online, last_seen_at` (sin `source_url`), con `security_invoker = false` para que el visitante la lea sin acceso a `camera`.

### 3. Reglas en la base (002)

| Regla | Implementación |
|---|---|
| Estado inicial | Trigger `AFTER INSERT ON space` crea su `space_state` en `no_data` |
| `zone_id` copiado | Trigger `BEFORE INSERT OR UPDATE ON space_state` toma `zone_id` de `space` |
| Histórico solo en cambios | Trigger `AFTER INSERT OR UPDATE ON space_state` con `WHEN (OLD.status IS DISTINCT FROM NEW.status)` inserta en `occupancy_log` |
| Zona apagada | Trigger `AFTER UPDATE OF is_active ON zone`: si pasa a false, `UPDATE space_state SET status='no_data'` de sus puestos |
| Cámara del mismo parqueadero | Trigger `BEFORE INSERT OR UPDATE OF camera_id, zone_id ON space` compara `parking_lot_id` |
| Perfil | Trigger `AFTER INSERT ON auth.users` (`security definer`) inserta `profile(id, email)`; otro en `UPDATE OF email` lo sincroniza |
| Cámara sin latido | Función `mark_stale_cameras()`: cámaras con `last_seen_at < now() - interval '5 seconds'` pasan a `is_online=false` y sus puestos a `no_data` |

### 4. RLS (003), matriz de la nota 11

- `is_admin()`: `security definer`, `stable`, devuelve `exists(select 1 from profile where id = auth.uid() and role = 'admin')`.
- `parking_lot`, `zone`, `space`, `space_state`: `SELECT` para `anon` y `authenticated`; sin políticas de escritura (el panel escribe por RPC).
- `favorite`, `push_token`: `ALL` con `user_id = auth.uid()`.
- `profile`: `SELECT` propio o admin; `UPDATE` propio y `GRANT UPDATE (full_name)` solamente.
- `camera`: `SELECT` y `UPDATE` solo admin.
- `occupancy_log`: sin políticas; se lee por `get_occupancy_history`.
- `service_role` salta RLS (riesgo documentado en la nota 11).

### 5. RPC (004)

| Función | Firma | Seguridad | Acceso |
|---|---|---|---|
| `get_occupancy` | `(lot_id bigint, zone_id bigint default null) → table(free int, occupied int, no_data int, total int)` | invoker, stable | anon, authenticated |
| `get_occupancy_history` | `(lot_id bigint, from_ts timestamptz, to_ts timestamptz, bucket text) → table(bucket_start timestamptz, occupancy_pct numeric)` | definer + `is_admin()` | authenticated |
| `ingest_space_states` | `(camera_id bigint, states jsonb) → int` (estados aplicados) | invoker | solo service_role |
| `admin_set_zone_active` | `(zone_id bigint, active boolean) → void` | definer + `is_admin()` | authenticated |
| `admin_upsert_space` | `(payload jsonb) → bigint` | definer + `is_admin()` | authenticated |
| `admin_delete_space` | `(space_id bigint) → void` | definer + `is_admin()` | authenticated |

- Negación: si `is_admin()` es falso se lanza `raise exception using errcode = '42501'`, que PostgREST convierte en 403 con sesión. Sin `GRANT EXECUTE` a `anon`, el visitante recibe 401.
- `ingest_space_states`: por cada elemento cuyo puesto tenga `camera_id` igual al recibido, aplica `status` (o `no_data` si `confidence < 0.7`) con `updated_at = now()`, ignorando los puestos con `space.is_active = false` o de una zona con `is_active = false` (no se aplican ni cuentan en el entero devuelto); al final actualiza `camera.last_seen_at = now(), is_online = true`.
- `get_occupancy_history`: `bucket` en `'15 min'`, `'1 hour'`, `'1 day'`; para cada inicio de intervalo toma el último estado registrado de cada puesto activo y calcula `occupied / (free + occupied)`. Los `no_data` no cuentan.
- `pg_cron`: `cron.schedule('mark-stale-cameras', '5 seconds', 'select public.mark_stale_cameras()')`. Requiere pg_cron 1.5 o superior (nota 10).
- Realtime: `alter publication supabase_realtime add table public.space_state`.

### 6. Seed

- Parqueadero "C.C. Alejandría" con zona "A" y 12 puestos de ejemplo cerca de la plaza de Cajicá (coordenadas aproximadas; el plano real se redibuja con la herramienta del modo administrador).
- Parqueadero "Maqueta demo" con zona "Maqueta", una cámara `source_url = 'webcam:0'` y 6 puestos con `image_polygon` vacío (se calibra en el cambio F).
- Un usuario admin de prueba solo en local (en la nube el rol se asigna a mano).

## Risks / Trade-offs

- [pg_cron por segundos no disponible en el proyecto] → Verificarlo con `select extversion from pg_extension where extname='pg_cron'`; si es menor a 1.5, programar cada minuto y que la app marque gris los puestos de cámaras con `last_seen_at` viejo (endpoint 4).
- [Plan gratuito pausa el proyecto por inactividad] → Abrir la app o consultar la API a diario y antes de cada demo.
- [`service_role` salta RLS] → Solo vive en el `.env` de la detección; se revisa en G que no esté en la app ni en el historial de Git.
- [Política de `profile` permite cambiar el rol por PostgREST] → `REVOKE UPDATE ON profile FROM authenticated` y `GRANT UPDATE (full_name)`; prueba pgTAP dedicada.

## Migration Plan

1. Local: `supabase start`, `supabase db reset` (aplica migraciones y seed), `supabase test db`.
2. Nube: crear el proyecto de demo, `supabase link`, `supabase db push`, cargar el seed sin el admin de prueba y compartir las llaves por canal privado.
3. Rollback: en local, `supabase db reset`; en la nube, nueva migración que revierta. Nunca editar una migración ya aplicada.

## Open Questions

- Coordenadas reales del parqueadero de Alejandría: se dibujan en sitio con el modo administrador; no cambian el esquema.
