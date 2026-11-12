-- 004: RPC, tarea de pg_cron y publicación Realtime.

-- Ocupación actual de un parqueadero o zona (solo puestos activos).
create function public.get_occupancy(lot_id bigint, zone_id bigint default null)
returns table (free int, occupied int, no_data int, total int)
language sql stable set search_path = '' as $$
  select
    (count(*) filter (where st.status = 'free'))::int,
    (count(*) filter (where st.status = 'occupied'))::int,
    (count(*) filter (where st.status is null or st.status = 'no_data'))::int,
    count(*)::int
  from public.space sp
  join public.zone z on z.id = sp.zone_id
  left join public.space_state st on st.space_id = sp.id
  where sp.is_active
    and z.parking_lot_id = get_occupancy.lot_id
    and (get_occupancy.zone_id is null or sp.zone_id = get_occupancy.zone_id)
$$;

-- Histórico agregado: solo admin. Toma, al inicio de cada intervalo, el último
-- estado registrado de cada puesto activo; los no_data no cuentan.
create function public.get_occupancy_history(
  lot_id bigint, from_ts timestamptz, to_ts timestamptz, bucket text)
returns table (bucket_start timestamptz, occupancy_pct numeric)
language plpgsql stable security definer set search_path = '' as $$
declare
  step interval;
  tz text;
  first_start timestamptz;
begin
  if not public.is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;

  step := case bucket
    when '15 min' then interval '15 minutes'
    when '1 hour' then interval '1 hour'
    when '1 day'  then interval '1 day'
  end;
  if step is null then
    raise exception 'invalid bucket: %', bucket using errcode = '22023';
  end if;

  select p.timezone into tz from public.parking_lot p where p.id = lot_id;
  tz := coalesce(tz, 'America/Bogota');

  first_start := case
    when bucket = '1 day'
      then date_trunc('day', from_ts at time zone tz) at time zone tz
    else date_bin(step, from_ts, timestamptz '2000-01-01 00:00:00+00')
  end;

  return query
  select b.start_ts,
         round(100.0 * count(*) filter (where lastlog.status = 'occupied')
               / nullif(count(*) filter (where lastlog.status in ('free', 'occupied')), 0), 1)
  from generate_series(first_start, to_ts, step) as b(start_ts)
  cross join (
    select sp.id as space_id
      from public.space sp
      join public.zone z on z.id = sp.zone_id
     where sp.is_active and z.parking_lot_id = lot_id
  ) as act
  left join lateral (
    select l.status
      from public.occupancy_log l
     where l.space_id = act.space_id and l.recorded_at <= b.start_ts
     order by l.recorded_at desc, l.id desc
     limit 1
  ) as lastlog on true
  where b.start_ts < to_ts
  group by b.start_ts
  order by b.start_ts;
end $$;

-- Ingesta por lote desde la detección (service_role). Siempre registra latido.
create function public.ingest_space_states(camera_id bigint, states jsonb)
returns int
language plpgsql set search_path = '' as $$
declare
  applied int;
begin
  with incoming as (
    select (e ->> 'space_id')::bigint        as space_id,
           (e ->> 'status')::public.space_status as status,
           (e ->> 'confidence')::real        as confidence
      from jsonb_array_elements(coalesce(states, '[]'::jsonb)) as e
  ), upd as (
    update public.space_state ss
       set status     = case when i.confidence < 0.7 then 'no_data'::public.space_status
                             else i.status end,
           confidence = i.confidence,
           updated_at = now()
      from incoming i
      join public.space sp on sp.id = i.space_id
     where ss.space_id = sp.id
       and sp.camera_id = ingest_space_states.camera_id
    returning 1
  )
  select count(*) into applied from upd;

  update public.camera c
     set last_seen_at = now(), is_online = true
   where c.id = ingest_space_states.camera_id;

  return applied;
end $$;

-- Panel de administración.
create function public.admin_set_zone_active(zone_id bigint, active boolean)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;
  update public.zone z set is_active = active where z.id = admin_set_zone_active.zone_id;
  if not found then
    raise exception 'zone not found' using errcode = 'P0002';
  end if;
end $$;

-- payload: {id?, zone_id, camera_id?, code, map_polygon, image_polygon?, angle?, is_active?}
-- Con id actualiza solo las llaves presentes; sin id inserta.
create function public.admin_upsert_space(payload jsonb) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  space_id bigint;
begin
  if not public.is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;

  if payload ? 'id' then
    update public.space sp set
      zone_id       = case when payload ? 'zone_id' then (payload ->> 'zone_id')::bigint else sp.zone_id end,
      camera_id     = case when payload ? 'camera_id' then (payload ->> 'camera_id')::bigint else sp.camera_id end,
      code          = case when payload ? 'code' then payload ->> 'code' else sp.code end,
      map_polygon   = case when payload ? 'map_polygon' then payload -> 'map_polygon' else sp.map_polygon end,
      image_polygon = case when payload ? 'image_polygon' then payload -> 'image_polygon' else sp.image_polygon end,
      angle         = case when payload ? 'angle' then (payload ->> 'angle')::smallint else sp.angle end,
      is_active     = case when payload ? 'is_active' then (payload ->> 'is_active')::boolean else sp.is_active end
    where sp.id = (payload ->> 'id')::bigint
    returning sp.id into space_id;
    if space_id is null then
      raise exception 'space not found' using errcode = 'P0002';
    end if;
  else
    insert into public.space (zone_id, camera_id, code, map_polygon, image_polygon, angle, is_active)
    values ((payload ->> 'zone_id')::bigint,
            (payload ->> 'camera_id')::bigint,
            payload ->> 'code',
            payload -> 'map_polygon',
            payload -> 'image_polygon',
            coalesce((payload ->> 'angle')::smallint, 0),
            coalesce((payload ->> 'is_active')::boolean, true))
    returning id into space_id;
  end if;
  return space_id;
end $$;

create function public.admin_delete_space(space_id bigint) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;
  delete from public.space sp where sp.id = admin_delete_space.space_id;
end $$;

-- Permisos de ejecución: se revoca todo y se concede solo lo de la matriz.
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.get_occupancy(bigint, bigint) to anon, authenticated;
grant execute on function public.get_occupancy_history(bigint, timestamptz, timestamptz, text) to authenticated;
grant execute on function public.admin_set_zone_active(bigint, boolean) to authenticated;
grant execute on function public.admin_upsert_space(jsonb) to authenticated;
grant execute on function public.admin_delete_space(bigint) to authenticated;
grant execute on function public.ingest_space_states(bigint, jsonb) to service_role;

-- Cámaras sin latido cada 5 s (requiere pg_cron >= 1.5).
select cron.schedule('mark-stale-cameras', '5 seconds', 'select public.mark_stale_cameras()');

-- Realtime: cambios de estado visibles a los clientes (con zone_id para filtrar).
alter publication supabase_realtime add table public.space_state;
