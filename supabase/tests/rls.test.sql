-- Pruebas de RLS y permisos (tarea 3.2), casos de la nota 11.
begin;
select plan(33);

-- Datos de prueba (corre como postgres, que salta RLS).
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.dev'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.dev'),
  ('00000000-0000-0000-0000-0000000000ad', 'admin@test.dev');
update public.profile set role = 'admin' where email = 'admin@test.dev';

insert into public.parking_lot (id, name) overriding system value values (9001, 'T lot');
insert into public.zone (id, parking_lot_id, name) overriding system value values (9001, 9001, 'Z1');
insert into public.camera (id, parking_lot_id, name, source_url) overriding system value
  values (9001, 9001, 'cam', 'rtsp://secret');
insert into public.space (id, zone_id, camera_id, code, map_polygon) overriding system value
  values (9001, 9001, 9001, 'S1', '[]');
insert into public.favorite (id, user_id, parking_lot_id) overriding system value values
  (9001, '00000000-0000-0000-0000-00000000000a', 9001),
  (9002, '00000000-0000-0000-0000-00000000000b', 9001);
insert into public.push_token (user_id, expo_push_token) values
  ('00000000-0000-0000-0000-00000000000a', 'tok-a'),
  ('00000000-0000-0000-0000-00000000000b', 'tok-b');
update public.space_state set status = 'free' where space_id = 9001;

-- Ninguna tabla de public sin RLS
select is((select count(*)::int from pg_class
            where relrowsecurity = false and relnamespace = 'public'::regnamespace
              and relkind = 'r'), 0, 'todas las tablas tienen RLS');

-- ===== Visitante (anon) =====
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';

select is((select count(*)::int from public.space where zone_id = 9001), 1,
  'visitante lee puestos');
select is((select status::text from public.space_state where space_id = 9001), 'free',
  'visitante lee estados');
select is((select free from public.get_occupancy(9001)), 1, 'visitante usa get_occupancy');
select is((select count(*)::int from public.camera_status), 1, 'visitante lee camera_status');
select throws_ok($$ select * from public.favorite $$, '42501', null,
  'visitante no lee favoritos');
select throws_ok($$ select * from public.camera $$, '42501', null,
  'visitante no lee la tabla camera');
select throws_ok($$ select * from public.occupancy_log $$, '42501', null,
  'visitante no lee el histórico');
select throws_ok($$ select * from public.get_occupancy_history(9001, now(), now(), '1 hour') $$,
  '42501', null, 'visitante no ejecuta get_occupancy_history');
select throws_ok($$ select public.ingest_space_states(9001, '[]') $$, '42501', null,
  'visitante no ejecuta ingest_space_states');

-- ===== Usuario A =====
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';

select is((select count(*)::int from public.favorite), 1, 'A solo ve su favorito');
select is((select count(*)::int from public.push_token), 1, 'A solo ve su token');
select is((select count(*)::int from public.profile), 1, 'A solo ve su perfil');
select is((select count(*)::int from public.camera), 0, 'A no ve filas de camera');
select throws_ok($$ select source_url from public.camera_status $$, '42703', null,
  'camera_status no expone source_url');
select lives_ok($$ delete from public.favorite where id = 9002 $$,
  'DELETE sobre favorito de B no falla pero no afecta filas');
select throws_ok(
  $$ insert into public.favorite (user_id, parking_lot_id)
     values ('00000000-0000-0000-0000-00000000000b', 9001) $$,
  '42501', null, 'A no crea favoritos a nombre de B');
select throws_ok($$ update public.profile set role = 'admin'
                     where id = '00000000-0000-0000-0000-00000000000a' $$,
  '42501', null, 'A no puede cambiar su rol');
select lives_ok($$ update public.profile set full_name = 'Ana'
                    where id = '00000000-0000-0000-0000-00000000000a' $$,
  'A edita su full_name');
select throws_ok($$ update public.space_state set status = 'occupied' $$, '42501', null,
  'A no escribe en space_state');
select throws_ok($$ select public.ingest_space_states(9001, '[]') $$, '42501', null,
  'A no ejecuta ingest_space_states');
select throws_ok($$ select public.admin_set_zone_active(9001, false) $$, '42501', null,
  'A recibe 42501 en admin_set_zone_active');
select throws_ok($$ select * from public.get_occupancy_history(9001, now(), now(), '1 hour') $$,
  '42501', null, 'A recibe 42501 en get_occupancy_history');

-- ===== Administrador =====
set local request.jwt.claims =
  '{"sub":"00000000-0000-0000-0000-0000000000ad","role":"authenticated"}';
select is((select count(*)::int from public.camera), 1, 'admin lee camera');
select is((select count(*)::int from public.profile
            where email in ('a@test.dev', 'b@test.dev', 'admin@test.dev')), 3,
  'admin lee todos los perfiles');

-- ===== Verificación como postgres =====
reset role;
select is((select role::text from public.profile where email = 'a@test.dev'), 'user',
  'el rol de A sigue en user');
select is((select full_name from public.profile where email = 'a@test.dev'), 'Ana',
  'full_name de A se actualizó');
select is((select count(*)::int from public.favorite where id = 9002), 1,
  'favorito de B intacto');
select is((select is_active from public.zone where id = 9001), true,
  'zona sin cambios tras el intento de A');
select is((select status::text from public.space_state where space_id = 9001), 'free',
  'estado sin cambios tras el intento de A');

-- Privilegios de ejecución de la ingesta
select is(has_function_privilege('anon', 'public.ingest_space_states(bigint,jsonb)', 'execute'),
  false, 'anon sin EXECUTE en ingest_space_states');
select is(has_function_privilege('authenticated', 'public.ingest_space_states(bigint,jsonb)', 'execute'),
  false, 'authenticated sin EXECUTE en ingest_space_states');
select is(has_function_privilege('service_role', 'public.ingest_space_states(bigint,jsonb)', 'execute'),
  true, 'service_role con EXECUTE en ingest_space_states');

select * from finish();
rollback;
