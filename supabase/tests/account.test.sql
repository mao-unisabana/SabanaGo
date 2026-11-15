-- Pruebas de delete_my_account y REPLICA IDENTITY FULL (cambio E, tarea 1.1).
begin;
select plan(9);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.dev'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.dev');
insert into public.parking_lot (id, name) overriding system value values (9001, 'T lot');
insert into public.favorite (user_id, parking_lot_id) values
  ('00000000-0000-0000-0000-00000000000a', 9001),
  ('00000000-0000-0000-0000-00000000000b', 9001);
insert into public.push_token (user_id, expo_push_token) values
  ('00000000-0000-0000-0000-00000000000a', 'tok-a'),
  ('00000000-0000-0000-0000-00000000000b', 'tok-b');

select is((select relreplident::text from pg_class where oid = 'public.space_state'::regclass),
  'f', 'space_state tiene REPLICA IDENTITY FULL');
select is(has_function_privilege('anon', 'public.delete_my_account()', 'execute'), false,
  'anon sin EXECUTE en delete_my_account');
select is(has_function_privilege('authenticated', 'public.delete_my_account()', 'execute'), true,
  'authenticated con EXECUTE en delete_my_account');

-- Visitante: rechazado
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
select throws_ok($$ select public.delete_my_account() $$, '42501', null,
  'visitante no borra cuentas');

-- Usuario A borra su cuenta
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';
select lives_ok($$ select public.delete_my_account() $$, 'A borra su cuenta');

reset role;
select is((select count(*)::int from auth.users where id = '00000000-0000-0000-0000-00000000000a'), 0,
  'A ya no existe en auth.users');
select is((select count(*)::int from public.profile where id = '00000000-0000-0000-0000-00000000000a'), 0,
  'perfil de A borrado');
select is((select count(*)::int from public.favorite where user_id = '00000000-0000-0000-0000-00000000000a')
        + (select count(*)::int from public.push_token where user_id = '00000000-0000-0000-0000-00000000000a'), 0,
  'favoritos y tokens de A borrados');
select is((select count(*)::int from public.favorite where user_id = '00000000-0000-0000-0000-00000000000b')
        + (select count(*)::int from public.push_token where user_id = '00000000-0000-0000-0000-00000000000b')
        + (select count(*)::int from auth.users where id = '00000000-0000-0000-0000-00000000000b'), 3,
  'datos de B intactos');

select * from finish();
rollback;
