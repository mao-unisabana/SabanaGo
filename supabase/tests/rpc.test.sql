-- Pruebas de RPC, ingesta y tiempo real (tarea 4.1).
begin;
select plan(39);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.dev'),
  ('00000000-0000-0000-0000-0000000000ad', 'admin@test.dev');
update public.profile set role = 'admin' where email = 'admin@test.dev';

insert into public.parking_lot (id, name) overriding system value
  values (9001, 'T lot'), (9002, 'T lot 2');
insert into public.zone (id, parking_lot_id, name) overriding system value
  values (9001, 9001, 'A'), (9002, 9001, 'B');
insert into public.camera (id, parking_lot_id, name, source_url) overriding system value
  values (9001, 9001, 'cam1', 'x'), (9002, 9001, 'cam2', 'x'), (9003, 9002, 'cam3', 'x');

-- Zona A: 12 puestos activos de la cámara 1 (ids 9101-9112) + 1 inactivo (9113).
insert into public.space (id, zone_id, camera_id, code, map_polygon, is_active) overriding system value
select 9100 + n, 9001, 9001, 'A' || n, '[]', n <= 12 from generate_series(1, 13) n;
-- Zona B: 2 puestos de la cámara 2 (9201, 9202).
insert into public.space (id, zone_id, camera_id, code, map_polygon) overriding system value
  values (9201, 9002, 9002, 'B1', '[]'), (9202, 9002, 9002, 'B2', '[]');

update public.space_state set status = 'free'     where space_id between 9101 and 9105;
update public.space_state set status = 'occupied' where space_id between 9106 and 9111 or space_id = 9113;
-- 9112 queda en no_data; 9113 (inactivo, ocupado) no debe contar.

-- ===== get_occupancy =====
select results_eq($$ select free, occupied, no_data, total from public.get_occupancy(9001, 9001) $$,
  $$ values (5, 6, 1, 12) $$, 'zona A: 5 libres, 6 ocupados, 1 sin datos, total 12');
select is((select total from public.get_occupancy(9001)), 14,
  'parqueadero completo suma las dos zonas y excluye puestos inactivos');
select is((select total from public.get_occupancy(9001, 9001)), 12,
  'el puesto inactivo no cuenta en ningún total');

-- ===== ingest_space_states (como service_role) =====
update public.camera set is_online = false, last_seen_at = now() - interval '1 hour' where id = 9001;

set local role service_role;
select is(public.ingest_space_states(9001, '[
  {"space_id":9101,"status":"occupied","confidence":0.95},
  {"space_id":9102,"status":"free","confidence":0.6}]'), 2,
  'lote con dos puestos aplica 2 estados');
reset role;
select is((select status::text from public.space_state where space_id = 9101), 'occupied',
  'estado con confianza alta se aplica');
select results_eq($$ select status::text, confidence from public.space_state where space_id = 9102 $$,
  $$ values ('no_data', 0.6::real) $$, 'confianza 0,6 queda en no_data con su confianza');
select results_eq($$ select is_online, last_seen_at = now() from public.camera where id = 9001 $$,
  $$ values (true, true) $$, 'cámara en línea con last_seen_at ahora');

-- Puesto de otra cámara
set local role service_role;
select is(public.ingest_space_states(9001, '[{"space_id":9201,"status":"occupied","confidence":0.99}]'), 0,
  'estado de puesto de otra cámara no se aplica');
reset role;
select is((select status::text from public.space_state where space_id = 9201), 'no_data',
  'puesto de la cámara 2 sigue en no_data');

-- Zona apagada y puesto inactivo: la ingesta los ignora
update public.zone set is_active = false where id = 9001;
set local role service_role;
select is(public.ingest_space_states(9001, '[{"space_id":9103,"status":"occupied","confidence":0.99}]'), 0,
  'puesto de zona apagada no cuenta en el retorno');
reset role;
select is((select status::text from public.space_state where space_id = 9103), 'no_data',
  'puesto de zona apagada sigue en no_data');
update public.zone set is_active = true where id = 9001;
update public.space_state set status = 'free' where space_id = 9103;
update public.space set is_active = false where id = 9103;
set local role service_role;
select is(public.ingest_space_states(9001, '[{"space_id":9103,"status":"occupied","confidence":0.99}]'), 0,
  'puesto inactivo no cuenta en el retorno');
reset role;
select is((select status::text from public.space_state where space_id = 9103), 'free',
  'puesto inactivo conserva su estado');
update public.space set is_active = true where id = 9103;

-- Lote vacío: solo latido
update public.camera set is_online = false, last_seen_at = now() - interval '1 hour' where id = 9001;
set local role service_role;
select is(public.ingest_space_states(9001, '[]'), 0, 'lote vacío no aplica estados');
reset role;
select results_eq($$ select is_online, last_seen_at = now() from public.camera where id = 9001 $$,
  $$ values (true, true) $$, 'lote vacío igual registra el latido');

-- Detección detenida: mark_stale_cameras
update public.camera set last_seen_at = now() - interval '10 seconds' where id = 9001;
select public.mark_stale_cameras();
select is((select count(*)::int from public.space_state
            where space_id between 9101 and 9113 and status <> 'no_data'), 0,
  'tras 10 s sin latido todos los puestos de la cámara quedan en no_data');
select is((select is_online from public.camera where id = 9001), false,
  'la cámara queda fuera de línea');

-- ===== RPC admin con rol user: 42501 y sin efecto =====
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';
select throws_ok($$ select public.admin_set_zone_active(9001, false) $$, '42501', null,
  'user: admin_set_zone_active -> 42501');
select throws_ok($$ select public.admin_upsert_space('{"zone_id":9001,"code":"X","map_polygon":[]}') $$,
  '42501', null, 'user: admin_upsert_space -> 42501');
select throws_ok($$ select public.admin_delete_space(9101) $$, '42501', null,
  'user: admin_delete_space -> 42501');
select throws_ok($$ select * from public.get_occupancy_history(9001, now(), now(), '1 hour') $$,
  '42501', null, 'user: get_occupancy_history -> 42501');
reset role;
select is((select is_active from public.zone where id = 9001), true, 'la zona no cambió');
select is((select count(*)::int from public.space where id = 9101), 1, 'el puesto no se borró');

-- ===== RPC admin con rol admin =====
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"00000000-0000-0000-0000-0000000000ad","role":"authenticated"}';

select lives_ok($$ select public.admin_set_zone_active(9002, false) $$, 'admin apaga la zona B');
select throws_ok($$ select public.admin_set_zone_active(0, false) $$, 'P0002', null,
  'zona inexistente falla');

create temp table new_space (id bigint);
grant all on new_space to authenticated;
insert into new_space
  select public.admin_upsert_space('{"zone_id":9001,"camera_id":9001,"code":"N1","map_polygon":[[0,0]],"angle":90}');
select ok((select id from new_space) is not null, 'admin_upsert_space inserta y devuelve id');
select lives_ok(
  $$ select public.admin_upsert_space(
       jsonb_build_object('id', (select id from new_space), 'angle', 180, 'camera_id', null)) $$,
  'admin_upsert_space actualiza solo las llaves enviadas');
select throws_ok(
  $$ select public.admin_upsert_space(
       jsonb_build_object('id', (select id from new_space), 'camera_id', 9003)) $$,
  '23514', null, 'admin_upsert_space respeta la regla cámara-parqueadero');
select lives_ok($$ select public.admin_delete_space((select id from new_space)) $$,
  'admin borra el puesto');

-- ===== get_occupancy_history (admin) =====
reset role;
delete from public.occupancy_log;
insert into public.occupancy_log (space_id, status, recorded_at) values
  (9101, 'occupied', '2026-01-01 10:00:00-05'),
  (9102, 'free',     '2026-01-01 10:00:00-05'),
  (9102, 'occupied', '2026-01-01 11:00:00-05');
set local role authenticated;
select results_eq(
  $$ select bucket_start, occupancy_pct from public.get_occupancy_history(
       9001, '2026-01-01 10:00:00-05', '2026-01-01 12:00:00-05', '1 hour') $$,
  $$ values ('2026-01-01 10:00:00-05'::timestamptz, 50.0::numeric),
            ('2026-01-01 11:00:00-05'::timestamptz, 100.0::numeric) $$,
  'histórico por hora: una fila por hora con su porcentaje');
select is((select count(*)::int from public.get_occupancy_history(
       9001, '2026-01-01 10:00:00-05', '2026-01-01 11:00:00-05', '15 min')), 4,
  'histórico por 15 min: cuatro filas en una hora');
select is((select count(*)::int from public.get_occupancy_history(
       9001, '2026-01-01 00:00:00-05', '2026-01-03 00:00:00-05', '1 day')), 2,
  'histórico por día: una fila por día');
select throws_ok(
  $$ select * from public.get_occupancy_history(9001, now(), now(), '5 min') $$,
  '22023', null, 'intervalo inválido falla con error de parámetro');
reset role;

-- ===== Realtime y cron =====
select is((select count(*)::int from pg_publication_tables
            where pubname = 'supabase_realtime' and schemaname = 'public'
              and tablename = 'space_state'), 1, 'space_state está en la publicación Realtime');
select is((select schedule from cron.job where jobname = 'mark-stale-cameras'), '5 seconds',
  'tarea mark-stale-cameras programada cada 5 s');

-- ===== Permisos de ejecución =====
select is(has_function_privilege('anon', 'public.get_occupancy(bigint,bigint)', 'execute'), true,
  'anon puede ejecutar get_occupancy');
select is(has_function_privilege('anon', 'public.admin_set_zone_active(bigint,boolean)', 'execute'), false,
  'anon sin EXECUTE en admin_set_zone_active');
select is(has_function_privilege('anon', 'public.get_occupancy_history(bigint,timestamptz,timestamptz,text)', 'execute'), false,
  'anon sin EXECUTE en get_occupancy_history');
select is(has_function_privilege('anon', 'public.mark_stale_cameras()', 'execute'), false,
  'anon sin EXECUTE en mark_stale_cameras');

select * from finish();
rollback;
