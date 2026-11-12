-- 003: is_admin(), RLS en todas las tablas y GRANT/REVOKE (matriz de la nota 11).

-- security definer: lee profile sin pasar por su RLS (evita recursión).
create function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profile p
     where p.id = (select auth.uid()) and p.role = 'admin'
  )
$$;

revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

alter table public.profile       enable row level security;
alter table public.parking_lot   enable row level security;
alter table public.zone          enable row level security;
alter table public.camera        enable row level security;
alter table public.space         enable row level security;
alter table public.space_state   enable row level security;
alter table public.occupancy_log enable row level security;
alter table public.favorite      enable row level security;
alter table public.push_token    enable row level security;

-- Lectura pública; sin políticas de escritura (el panel escribe por RPC).
create policy parking_lot_read on public.parking_lot
  for select to anon, authenticated using (true);
create policy zone_read on public.zone
  for select to anon, authenticated using (true);
create policy space_read on public.space
  for select to anon, authenticated using (true);
create policy space_state_read on public.space_state
  for select to anon, authenticated using (true);

-- Datos propios del usuario.
create policy favorite_own on public.favorite
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy push_token_own on public.push_token
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Perfil: lectura propia o admin; edición propia (solo full_name por GRANT).
create policy profile_read on public.profile
  for select to authenticated
  using (id = (select auth.uid()) or public.is_admin());
create policy profile_update_own on public.profile
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Cámara: solo administrador. occupancy_log: sin políticas (se lee por RPC).
create policy camera_admin_read on public.camera
  for select to authenticated using (public.is_admin());
create policy camera_admin_update on public.camera
  for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Privilegios: se parte de cero para anon/authenticated (Supabase les da todo
-- por defecto) y se concede solo lo de la matriz.
revoke all on all tables in schema public from anon, authenticated;

grant select on public.parking_lot, public.zone, public.space,
                public.space_state, public.camera_status to anon, authenticated;

grant select on public.profile to authenticated;
grant update (full_name) on public.profile to authenticated;
grant select, update on public.camera to authenticated;
grant select, insert, update, delete on public.favorite, public.push_token to authenticated;
