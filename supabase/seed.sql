-- Seed local: parqueadero piloto (Alejandría), maqueta demo y admin de prueba.
-- Las coordenadas son aproximadas; el plano real se redibuja con el modo administrador.

do $$
declare
  alej_lot bigint;
  alej_zone bigint;
  maq_lot bigint;
  maq_zone bigint;
  maq_cam bigint;
  admin_id uuid := '00000000-0000-0000-0000-00000000ad01';
begin
  -- Alejandría (Cajicá): zona A con 12 puestos en 2 filas de 6.
  insert into public.parking_lot (name, address, boundary)
  values ('C.C. Alejandría', 'Cajicá, Cundinamarca',
          '[[-74.02770,4.91860],[-74.02750,4.91860],[-74.02750,4.91880],[-74.02770,4.91880],[-74.02770,4.91860]]')
  returning id into alej_lot;

  insert into public.zone (parking_lot_id, name, level, boundary)
  values (alej_lot, 'A', 'Nivel 1',
          '[[-74.02770,4.91860],[-74.02750,4.91860],[-74.02750,4.91880],[-74.02770,4.91880],[-74.02770,4.91860]]')
  returning id into alej_zone;

  insert into public.space (zone_id, code, map_polygon)
  select alej_zone,
         'A' || (r * 6 + c + 1),
         jsonb_build_array(
           jsonb_build_array(-74.02770 + c * 0.000030,               4.91862 + r * 0.000100),
           jsonb_build_array(-74.02770 + c * 0.000030 + 0.000025,    4.91862 + r * 0.000100),
           jsonb_build_array(-74.02770 + c * 0.000030 + 0.000025,    4.91862 + r * 0.000100 + 0.000045),
           jsonb_build_array(-74.02770 + c * 0.000030,               4.91862 + r * 0.000100 + 0.000045),
           jsonb_build_array(-74.02770 + c * 0.000030,               4.91862 + r * 0.000100))
  from generate_series(0, 1) r, generate_series(0, 5) c;

  -- Maqueta demo: 1 cámara y 6 puestos; image_polygon vacío hasta calibrar (cambio F).
  insert into public.parking_lot (name, address, boundary)
  values ('Maqueta demo', 'Universidad de La Sabana, Chía',
          '[[-74.03310,4.86110],[-74.03290,4.86110],[-74.03290,4.86130],[-74.03310,4.86130],[-74.03310,4.86110]]')
  returning id into maq_lot;

  insert into public.zone (parking_lot_id, name, boundary)
  values (maq_lot, 'Maqueta',
          '[[-74.03310,4.86110],[-74.03290,4.86110],[-74.03290,4.86130],[-74.03310,4.86130],[-74.03310,4.86110]]')
  returning id into maq_zone;

  insert into public.camera (parking_lot_id, name, source_url)
  values (maq_lot, 'Cámara maqueta', 'webcam:0')
  returning id into maq_cam;

  insert into public.space (zone_id, camera_id, code, map_polygon)
  select maq_zone, maq_cam,
         'M' || (r * 3 + c + 1),
         jsonb_build_array(
           jsonb_build_array(-74.03308 + c * 0.000030,               4.86112 + r * 0.000100),
           jsonb_build_array(-74.03308 + c * 0.000030 + 0.000025,    4.86112 + r * 0.000100),
           jsonb_build_array(-74.03308 + c * 0.000030 + 0.000025,    4.86112 + r * 0.000100 + 0.000045),
           jsonb_build_array(-74.03308 + c * 0.000030,               4.86112 + r * 0.000100 + 0.000045),
           jsonb_build_array(-74.03308 + c * 0.000030,               4.86112 + r * 0.000100))
  from generate_series(0, 1) r, generate_series(0, 2) c;

  -- Admin de prueba SOLO local (admin@sabanago.test / admin12345).
  -- En la nube el rol se asigna a mano; no cargar este bloque allá.
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change, email_change_token_new)
  values (
    '00000000-0000-0000-0000-000000000000', admin_id, 'authenticated', 'authenticated',
    'admin@sabanago.test', extensions.crypt('admin12345', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');

  insert into auth.identities (
    id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
  values (
    gen_random_uuid(), admin_id, admin_id::text, 'email',
    jsonb_build_object('sub', admin_id::text, 'email', 'admin@sabanago.test'),
    now(), now(), now());

  update public.profile set role = 'admin', full_name = 'Admin de prueba' where id = admin_id;
end $$;
