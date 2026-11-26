create table if not exists public.portal_server_hosts(origin text primary key,code text not null references public.portal_server_codes(code) on delete cascade,created_at timestamptz not null default now());
alter table public.portal_server_hosts enable row level security;
revoke all on public.portal_server_hosts from public,anon,authenticated;
grant all on public.portal_server_hosts to service_role;
alter table public.portal_playlists add column if not exists host_origin text;
create or replace function public.portal_server_alias_save(p_code text,p_origin text,p_actor uuid,p_remove boolean default false) returns jsonb language plpgsql security invoker set search_path=pg_catalog,public as $$
begin
 if not exists(select 1 from public.portal_staff where user_id=p_actor and role='admin' and active and not must_change_password) then raise exception 'ADMIN_REQUIRED';end if;
 if p_origin is null or p_origin !~ '^https?://[^/?#@[:space:]]+$' or not exists(select 1 from public.portal_server_codes where code=p_code) or p_remove is null then raise exception 'INVALID_SERVER_CODE';end if;
 perform pg_advisory_xact_lock(hashtextextended('portal-host-registry',0));
 if p_remove then delete from public.portal_server_hosts where origin=p_origin and code=p_code;
 else
  if exists(select 1 from public.portal_server_codes where host=p_origin and code<>p_code) or exists(select 1 from public.portal_server_hosts where origin=p_origin and code<>p_code) then raise exception 'HOST_IN_USE';end if;
  insert into public.portal_server_hosts(origin,code) values(p_origin,p_code) on conflict(origin) do nothing;
 end if;
 return jsonb_build_object('saved',true);
end $$;
create or replace function public.portal_server_code_save_hosts(p_code text,p_host text,p_active boolean,p_actor uuid,p_validity text,p_revoked boolean,p_renew boolean default false) returns jsonb language plpgsql security invoker set search_path=pg_catalog,public as $$
begin
 if not exists(select 1 from public.portal_staff where user_id=p_actor and role='admin' and active and not must_change_password) then raise exception 'ADMIN_REQUIRED';end if;
 perform pg_advisory_xact_lock(hashtextextended('portal-host-registry',0));
 if exists(select 1 from public.portal_server_hosts where origin=p_host and code<>p_code) or exists(select 1 from public.portal_server_codes where host=p_host and code<>p_code) then raise exception 'HOST_IN_USE';end if;
 return public.portal_server_code_save_validity(p_code,p_host,p_active,p_actor,p_validity,p_revoked,p_renew);
end $$;
create or replace function public.portal_playlist_register_host(p_mac text,p_key_hash text,p_supplied_key boolean,p_name text,p_kind text,p_credentials jsonb,p_origin text,p_actor uuid default null) returns jsonb language plpgsql security invoker set search_path=pg_catalog,public as $$
declare result jsonb;chosen text;n integer;lic jsonb;access jsonb;
begin
 if p_origin is null or p_origin !~ '^https?://[^/?#@[:space:]]+$' then raise exception 'INVALID_PLAYLIST';end if;
 result:=public.portal_playlist_register(p_mac,p_key_hash,p_supplied_key,p_name,p_kind,p_credentials,p_actor);
 -- Compare normalized origins only. No DNS lookup, substring comparison or redirect.
 select count(*),min(code) into n,chosen from (select code from public.portal_server_codes where host=p_origin union select code from public.portal_server_hosts where origin=p_origin) candidates;
 if n>1 then raise exception 'HOST_AMBIGUOUS';end if;
 update public.portal_playlists set host_origin=p_origin where device_id=(result->>'device_id')::uuid;
 update public.portal_managed_devices set server_code=chosen where id=(result->>'device_id')::uuid;
 lic:=public.portal_effective_license(p_mac);
 if chosen is not null then access:=public.portal_code_access(p_mac,chosen);end if;
 return result||jsonb_build_object('host_match',case when chosen is null then 'unregistered' else 'matched' end,'server_code',chosen,'license',lic,'code_access',access);
end $$;
revoke all on function public.portal_server_alias_save(text,text,uuid,boolean),public.portal_server_code_save_hosts(text,text,boolean,uuid,text,boolean,boolean),public.portal_playlist_register_host(text,text,boolean,text,text,jsonb,text,uuid) from public,anon,authenticated;
grant execute on function public.portal_server_alias_save(text,text,uuid,boolean),public.portal_server_code_save_hosts(text,text,boolean,uuid,text,boolean,boolean),public.portal_playlist_register_host(text,text,boolean,text,text,jsonb,text,uuid) to service_role;
