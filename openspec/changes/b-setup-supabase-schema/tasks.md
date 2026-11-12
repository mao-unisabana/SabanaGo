# Tasks

Hitos de Obsidian: 09, 10, 11 (ejecución) y 12 (pasos 3 y 4). Fecha objetivo: jue 12 nov 2026.

## 1. Proyecto Supabase

- [x] 1.1 Crear `feature/b-setup-supabase-schema` desde `develop`, correr `supabase init` y confirmar que `supabase start` levanta en local; verificación: `supabase status` muestra API URL y llaves
- [x] 1.2 Actualizar `.env.example` con `SUPABASE_URL`, `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` y un comentario de quién usa cada una; verificación: ninguna llave real en el diff

## 2. Esquema

- [ ] 2.1 Escribir `migrations/…_001_schema.sql` con extensiones, enums, las 9 tablas, índices y la vista `camera_status` según el diccionario del design; verificación: `supabase db reset` sin errores y `\d space_state` coincide con el diccionario
- [ ] 2.2 Escribir `…_002_rules.sql` con los 7 triggers y funciones de reglas; agregar pruebas pgTAP en `supabase/tests/rules.test.sql` (estado inicial `no_data`, histórico solo en cambios, zona apagada, cámara de otro parqueadero, perfil al registrarse, favorito duplicado); verificación: `supabase test db` pasa

## 3. Seguridad

- [ ] 3.1 Escribir `…_003_rls.sql` con `is_admin()`, RLS en todas las tablas y los `GRANT`/`REVOKE` de la matriz; verificación: `select relname from pg_class where relrowsecurity = false and relnamespace = 'public'::regnamespace and relkind = 'r'` no devuelve tablas
- [ ] 3.2 Agregar `supabase/tests/rls.test.sql` con los casos de la nota 11 (visitante, usuario A contra B, cambio de rol, escritura en `space_state`, `source_url` oculta); verificación: `supabase test db` pasa
- [ ] 3.3 Revisar 003 con `security-reviewer` y corregir lo que encuentre; verificación: hallazgos resueltos o justificados en el PR

## 4. RPC y tiempo real

- [ ] 4.1 Escribir `…_004_rpc_realtime.sql` con las 6 RPC, `mark_stale_cameras`, la tarea de `pg_cron` y la publicación Realtime; verificación: pruebas pgTAP de `get_occupancy` (5/6/1/12), umbral 0,6 → `no_data`, puesto de otra cámara ignorado y 403 de las RPC admin para rol `user`
- [ ] 4.2 Probar a mano en local que un puesto queda en `no_data` a los 10 s de dejar de llamar a la ingesta (con `curl` a `rpc/ingest_space_states` usando la llave de servicio); verificación: consulta a `space_state` antes y después

## 5. Seed y nube

- [ ] 5.1 Escribir `supabase/seed.sql` con Alejandría (zona A, 12 puestos), la Maqueta demo (1 cámara `webcam:0`, 6 puestos) y un admin de prueba solo local; verificación: `get_occupancy` del lote Alejandría devuelve total 12
- [ ] 5.2 Crear el proyecto de demo en Supabase, `supabase link` y `supabase db push`; confirmar la versión de pg_cron y que el cifrado en reposo está activo; verificación: la tarea `mark-stale-cameras` aparece en `cron.job`
- [ ] 5.3 Revisar con `code-review-graph`, abrir PR a `develop` y compartir las llaves de la demo por canal privado (nunca en el PR); verificación: PR abierto con `supabase test db` en verde

## Workflow follow-up

- Tras el merge: `openspec archive b-setup-supabase-schema` y resumen a Mao para las notas 09, 10, 11 y 12 (pasos 3 y 4 del checklist).
