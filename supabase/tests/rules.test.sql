-- Pruebas de reglas en la base (tarea 2.2). Todo corre dentro de una transacción.
begin;
select plan(18);

-- Datos de prueba: dos parqueaderos, zonas, cámaras y puestos.
insert into public.parking_lot (id, name) overriding system value
  values (9001, 'T lot 1'), (9002, 'T lot 2');
insert into public.zone (id, parking_lot_id, name) overriding system value
  values (9001, 9001, 'Z1'), (9002, 9002, 'Z2');
insert into public.camera (id, parking_lot_id, name, source_url) overriding system value
  values (9001, 9001, 'cam1', 'x'), (9002, 9002, 'cam2', 'x');
insert into public.space (id, zone_id, camera_id, code, map_polygon) overriding system value
  values (9001, 9001, 9001, 'S1', '[]'), (9002, 9001, 9001, 'S2', '[]');

-- Estado inicial
select is((select status::text from public.space_state where space_id = 9001),
  'no_data', 'puesto nuevo nace en no_data');
select is((select count(*)::int from public.space_state where space_id in (9001, 9002)),
  2, 'cada puesto tiene exactamente un estado');

-- zone_id copiado aunque el cliente envíe otro
select is((select zone_id from public.space_state where space_id = 9001),
  9001::bigint, 'zone_id copiado al crear el estado');
update public.space_state set zone_id = 9002 where space_id = 9001;
select is((select zone_id from public.space_state where space_id = 9001),
  9001::bigint, 'zone_id forzado al valor del puesto en UPDATE');

-- Histórico solo en cambios
select is((select count(*)::int from public.occupancy_log where space_id = 9001),
  0, 'sin histórico para el estado inicial');
update public.space_state set status = 'free', confidence = 0.9 where space_id = 9001;
select is((select count(*)::int from public.occupancy_log where space_id = 9001),
  1, 'cambio de estado agrega una fila');
update public.space_state set status = 'free', confidence = 0.95 where space_id = 9001;
select is((select count(*)::int from public.occupancy_log where space_id = 9001),
  1, 'mismo estado repetido no agrega fila');
update public.space_state set status = 'occupied', confidence = 0.8 where space_id = 9001;
select results_eq(
  $$ select status::text from public.occupancy_log where space_id = 9001 order by id $$,
  $$ values ('free'), ('occupied') $$,
  'histórico guarda los estados nuevos en orden');

-- Zona apagada
update public.space_state set status = 'free' where space_id = 9002;
update public.zone set is_active = false where id = 9001;
select is((select count(*)::int from public.space_state
            where zone_id = 9001 and status <> 'no_data'),
  0, 'zona apagada deja sus puestos en no_data');
update public.zone set is_active = true where id = 9001;

-- Cámara de otro parqueadero
select throws_ok(
  $$ update public.space set camera_id = 9002 where id = 9001 $$,
  '23514', null, 'UPDATE con cámara de otro parqueadero falla');
select throws_ok(
  $$ insert into public.space (zone_id, camera_id, code, map_polygon)
     values (9001, 9002, 'S3', '[]') $$,
  '23514', null, 'INSERT con cámara de otro parqueadero falla');
select lives_ok(
  $$ update public.space set camera_id = 9001 where id = 9001 $$,
  'cámara del mismo parqueadero se acepta');

-- Cámara sin latido (mark_stale_cameras)
update public.camera set is_online = true, last_seen_at = now() - interval '10 seconds'
 where id = 9001;
update public.space_state set status = 'occupied' where space_id = 9001;
select public.mark_stale_cameras();
select is((select is_online from public.camera where id = 9001),
  false, 'cámara sin latido queda fuera de línea');
select is((select status::text from public.space_state where space_id = 9001),
  'no_data', 'puestos de la cámara sin latido quedan en no_data');

-- Perfil al registrarse y al cambiar el correo
insert into auth.users (id, email)
  values ('00000000-0000-0000-0000-0000000000a1', 'nuevo@test.dev');
select results_eq(
  $$ select email, role::text from public.profile
      where id = '00000000-0000-0000-0000-0000000000a1' $$,
  $$ values ('nuevo@test.dev', 'user') $$,
  'registro crea perfil con correo y rol user');
update auth.users set email = 'otro@test.dev'
 where id = '00000000-0000-0000-0000-0000000000a1';
select is((select email from public.profile
            where id = '00000000-0000-0000-0000-0000000000a1'),
  'otro@test.dev', 'cambio de correo se sincroniza al perfil');

-- Favorito único, incluida zona vacía
insert into public.favorite (user_id, parking_lot_id)
  values ('00000000-0000-0000-0000-0000000000a1', 9001);
select throws_ok(
  $$ insert into public.favorite (user_id, parking_lot_id)
     values ('00000000-0000-0000-0000-0000000000a1', 9001) $$,
  '23505', null, 'favorito de parqueadero completo repetido falla');

-- Sin imágenes almacenadas
select is((select count(*)::int from information_schema.columns
            where table_schema = 'public' and data_type = 'bytea'),
  0, 'ninguna columna bytea en public');

select * from finish();
rollback;
