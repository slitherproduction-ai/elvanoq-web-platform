-- Resolver association: native identity only; active license remains mandatory.
create function public.portal_roku_server_code_link(p_id uuid,p_client_hash text,p_code text) returns boolean
language plpgsql security invoker set search_path=pg_catalog,public as $$
declare d public.portal_roku_devices;lic jsonb;
begin
 select * into d from public.portal_roku_devices where id=p_id and client_hash=p_client_hash for update;
 if not found then raise exception 'ROKU_IDENTITY';end if;
 lic:=public.portal_roku_license(d.id);
 if lic->>'status'<>'active' or not coalesce((lic->>'can_play')::boolean,false) then raise exception 'ROKU_IDENTITY';end if;
 perform 1 from public.portal_server_codes where code=p_code and active and not revoked
  and (validity='lifetime' or (validity='annual' and expires_at>now())) for share;
 if not found then raise exception 'SERVER_CODE_UNAVAILABLE';end if;
 update public.portal_roku_devices set server_code=p_code where id=d.id;
 return true;
end $$;
revoke all on function public.portal_roku_server_code_link(uuid,text,text) from public,anon,authenticated;
grant execute on function public.portal_roku_server_code_link(uuid,text,text) to service_role;
