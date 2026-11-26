alter table public.portal_managed_devices add column server_code text references public.portal_server_codes(code),add column first_code_login_at timestamptz,add column last_seen_at timestamptz,add column platform text,add column app_version text;
create table public.portal_device_assignments(id uuid primary key default gen_random_uuid(),device_id uuid not null,mac text not null,previous_reseller uuid,reseller_id uuid,actor uuid not null references auth.users(id),created_at timestamptz not null default now());
alter table public.portal_device_assignments enable row level security;
revoke all on public.portal_device_assignments from anon,authenticated;
grant select,insert on public.portal_device_assignments to service_role;
create function public.portal_code_device_register(p_mac text,p_key_hash text,p_code text,p_name text,p_platform text,p_version text) returns jsonb
language plpgsql security invoker set search_path=pg_catalog,public as $$
declare d public.portal_managed_devices; license jsonb; t timestamptz:=clock_timestamp();
begin
 if p_mac is null or p_mac !~ '^([0-9A-F]{2}:){5}[0-9A-F]{2}$' or p_key_hash is null or p_key_hash !~ '^[0-9a-f]{64}$' or length(coalesce(p_name,'')) not between 1 and 100 or length(coalesce(p_platform,''))>32 or length(coalesce(p_version,''))>32 then raise exception 'INVALID_CODE_DEVICE';end if;
 perform 1 from public.portal_server_codes where code=p_code and active for share;
 if not found then raise exception 'SERVER_CODE_UNAVAILABLE';end if;
 perform pg_advisory_xact_lock(hashtextextended('playlist-device:'||p_mac,0));
 select * into d from public.portal_managed_devices where mac=p_mac for update;
 if not found then
  insert into public.portal_managed_devices(mac,key_hash,display_name) values(p_mac,p_key_hash,p_name) on conflict(mac) do nothing returning * into d;
  if not found then select * into d from public.portal_managed_devices where mac=p_mac for update;end if;
 end if;
 if d.key_hash<>p_key_hash then raise exception 'DEVICE_BINDING_REQUIRED';end if;
 if not d.active or d.archived_at is not null then raise exception 'DEVICE_NOT_ACTIVE';end if;
 update public.portal_managed_devices set server_code=p_code,first_code_login_at=coalesce(first_code_login_at,t),last_seen_at=t,platform=nullif(p_platform,''),app_version=nullif(p_version,'') where id=d.id returning * into d;
 if exists(select 1 from public.portal_device_licenses where mac=p_mac and lifetime) then license:=public.portal_license_status(p_mac);
 else license:=public.portal_license_activate(p_mac);end if;
 return jsonb_build_object('device',jsonb_build_object('id',d.id,'mac',d.mac,'server_code',d.server_code,'first_code_login_at',d.first_code_login_at,'last_seen_at',d.last_seen_at),'license',license);
end $$;
create function public.portal_device_assign(p_id uuid,p_reseller uuid,p_actor uuid) returns jsonb
language plpgsql security invoker set search_path=pg_catalog,public as $$
declare d public.portal_managed_devices;
begin
 if not exists(select 1 from public.portal_staff where user_id=p_actor and role='admin' and active and not must_change_password) then raise exception 'DEVICE_ASSIGN_FORBIDDEN';end if;
 if p_reseller is not null and not exists(select 1 from public.portal_staff where user_id=p_reseller and role='reseller' and active) then raise exception 'RESELLER_UNAVAILABLE';end if;
 select * into d from public.portal_managed_devices where id=p_id for update;
 if not found then raise exception 'DEVICE_NOT_FOUND';end if;
 if d.reseller_id is distinct from p_reseller then
  update public.portal_managed_devices set reseller_id=p_reseller where id=p_id;
  insert into public.portal_device_assignments(device_id,mac,previous_reseller,reseller_id,actor) values(d.id,d.mac,d.reseller_id,p_reseller,p_actor);
 end if;
 return jsonb_build_object('assigned',true);
end $$;
revoke execute on function public.portal_code_device_register(text,text,text,text,text,text),public.portal_device_assign(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.portal_code_device_register(text,text,text,text,text,text),public.portal_device_assign(uuid,uuid,uuid) to service_role;
