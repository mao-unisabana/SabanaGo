-- 002: funciones y triggers de reglas.
-- Todas las funciones usan search_path vacío y nombres calificados.

-- 1. Estado inicial: cada puesto nuevo nace con su estado en no_data.
create function public.create_initial_space_state() returns trigger
language plpgsql set search_path = '' as $$
begin
  insert into public.space_state (space_id, zone_id) values (new.id, new.zone_id);
  return new;
end $$;

create trigger space_create_state
  after insert on public.space
  for each row execute function public.create_initial_space_state();

-- 2. zone_id de space_state siempre copiado desde su puesto.
create function public.copy_space_zone_id() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.zone_id := (select s.zone_id from public.space s where s.id = new.space_id);
  return new;
end $$;

create trigger space_state_copy_zone
  before insert or update on public.space_state
  for each row execute function public.copy_space_zone_id();

-- Si un puesto cambia de zona, su estado se refresca (reutiliza el trigger 2).
create function public.refresh_space_state_zone() returns trigger
language plpgsql set search_path = '' as $$
begin
  update public.space_state set space_id = space_id where space_id = new.id;
  return new;
end $$;

create trigger space_refresh_state_zone
  after update of zone_id on public.space
  for each row when (old.zone_id is distinct from new.zone_id)
  execute function public.refresh_space_state_zone();

-- 3. Histórico solo en cambios de status. El estado inicial (INSERT) no es un
-- cambio, por eso el trigger es solo de UPDATE (OLD no existe en INSERT).
create function public.log_space_state_change() returns trigger
language plpgsql set search_path = '' as $$
begin
  insert into public.occupancy_log (space_id, status, confidence, recorded_at)
  values (new.space_id, new.status, new.confidence, now());
  return new;
end $$;

create trigger space_state_log_change
  after update on public.space_state
  for each row when (old.status is distinct from new.status)
  execute function public.log_space_state_change();

-- 4. Zona apagada: sus puestos pasan a no_data.
create function public.zone_off_to_no_data() returns trigger
language plpgsql set search_path = '' as $$
begin
  update public.space_state
     set status = 'no_data', updated_at = now()
   where zone_id = new.id and status <> 'no_data';
  return new;
end $$;

create trigger zone_deactivated
  after update of is_active on public.zone
  for each row when (old.is_active and not new.is_active)
  execute function public.zone_off_to_no_data();

-- 5. La cámara de un puesto debe ser del mismo parqueadero que su zona.
create function public.check_space_camera_lot() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.camera_id is not null and
     (select c.parking_lot_id from public.camera c where c.id = new.camera_id)
     is distinct from
     (select z.parking_lot_id from public.zone z where z.id = new.zone_id) then
    raise exception 'camera % belongs to a different parking lot than zone %',
      new.camera_id, new.zone_id using errcode = '23514';
  end if;
  return new;
end $$;

create trigger space_check_camera_lot
  before insert or update of camera_id, zone_id on public.space
  for each row execute function public.check_space_camera_lot();

-- 6. Perfil sincronizado con auth.users.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profile (id, email) values (new.id, new.email);
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create function public.handle_user_email_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.profile set email = new.email where id = new.id;
  return new;
end $$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row when (old.email is distinct from new.email)
  execute function public.handle_user_email_change();

-- 7. Cámara sin latido por más de 5 s: fuera de línea y sus puestos a no_data.
-- La ejecuta pg_cron (004); no se expone a la API.
create function public.mark_stale_cameras() returns void
language plpgsql set search_path = '' as $$
declare
  stale_ids bigint[];
begin
  select coalesce(array_agg(c.id), '{}') into stale_ids
    from public.camera c
   where c.last_seen_at < now() - interval '5 seconds';

  update public.camera set is_online = false
   where id = any (stale_ids) and is_online;

  update public.space_state ss
     set status = 'no_data', updated_at = now()
    from public.space s
   where s.id = ss.space_id
     and s.camera_id = any (stale_ids)
     and ss.status <> 'no_data';
end $$;

-- Ninguna función de reglas se llama desde la API.
revoke execute on all functions in schema public from public, anon, authenticated;
