-- 005: borrado de cuenta propia y old.status en Realtime.

-- Realtime necesita la fila anterior completa para entregar old.status
-- (el aviso de "se liberó un puesto" detecta la transición en el cliente).
alter table public.space_state replica identity full;

-- El cliente no puede borrar su usuario de auth.users; esta RPC lo hace por él.
-- La cascada elimina profile, favorite y push_token.
create function public.delete_my_account()
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
