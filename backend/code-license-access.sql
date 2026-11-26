-- A valid server code authorizes the player; base device licenses remain separate.
create or replace function public.portal_effective_license(p_mac text) returns jsonb
language plpgsql stable security invoker set search_path=pg_catalog,public set timezone='UTC' as $$
declare result jsonb;d public.portal_managed_devices;c public.portal_server_codes;a jsonb;deadline timestamptz;source text;
begin
 result:=public.portal_license_status(p_mac);
 select * into d from public.portal_managed_devices where mac=p_mac;
 if d.server_code is null then return result;end if;
 a:=public.portal_code_access(p_mac,d.server_code);
 result:=result||jsonb_build_object('device_lifetime',coalesce((result->>'lifetime')::boolean,false),'server_code',d.server_code,'code_blocked',not coalesce((a->>'can_connect')::boolean,false));
 if not coalesce((a->>'can_connect')::boolean,false) then
  return result||jsonb_build_object('status',case when a->>'reason'='device_suspended' then 'suspended' else 'expired' end,'can_play',false,'payment_required',coalesce((a->>'payment_required')::boolean,false),'reason',a->>'reason','lifetime',false,'expires_at',null,'remaining_seconds',0,'access_source','code_restricted');
 end if;
 if coalesce((a->>'individual_access')::boolean,false) then deadline:=(a->>'access_until')::timestamptz;source:='individual_renewal';
 else
  select * into c from public.portal_server_codes where code=d.server_code;
  deadline:=case when c.validity='annual' then c.expires_at else null end;source:='server_code';
 end if;
 return result||jsonb_build_object('status',case when deadline is null then 'lifetime' else 'licensed' end,'can_play',true,'payment_required',false,'lifetime',deadline is null,'expires_at',deadline,'access_until',deadline,'remaining_seconds',case when deadline is null then 0 else greatest(0,floor(extract(epoch from (deadline-now())))) end,'access_source',source,'reason',a->>'reason');
end $$;
revoke all on function public.portal_effective_license(text) from public,anon,authenticated;
grant execute on function public.portal_effective_license(text) to service_role;

create or replace function public.portal_code_device_register(p_mac text,p_key_hash text,p_code text,p_name text,p_platform text,p_version text) returns jsonb
language plpgsql security invoker set search_path=pg_catalog,public as $$
declare d public.portal_managed_devices; license jsonb; access jsonb; t timestamptz:=clock_timestamp();
begin
 if p_mac is null or p_mac !~ '^([0-9A-F]{2}:){5}[0-9A-F]{2}$' or p_key_hash is null or p_key_hash !~ '^[0-9a-f]{64}$' or length(coalesce(p_name,'')) not between 1 and 100 or length(coalesce(p_platform,''))>32 or length(coalesce(p_version,''))>32 then raise exception 'INVALID_CODE_DEVICE';end if;
 perform 1 from public.portal_server_codes where code=p_code for share;
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
 access:=public.portal_code_access(p_mac,p_code);
 license:=public.portal_effective_license(p_mac);
 return jsonb_build_object('code_access',access,'device',jsonb_build_object('id',d.id,'mac',d.mac,'server_code',d.server_code,'first_code_login_at',d.first_code_login_at,'last_seen_at',d.last_seen_at),'license',license);
end $$;

create or replace function public.portal_pix_reserve_public(p_mac text,p_access_hash text) returns jsonb
language plpgsql security invoker set search_path=pg_catalog,public as $$
declare o public.portal_pix_orders; d public.portal_managed_devices;
begin
 if p_mac !~ '^([0-9A-F]{2}:){5}[0-9A-F]{2}$' or p_access_hash !~ '^[0-9a-f]{64}$' or p_mac is null or p_access_hash is null then raise exception 'INVALID_PAYMENT';end if;
 perform pg_advisory_xact_lock(hashtextextended('pix-device:'||p_mac,0));
 select * into d from public.portal_managed_devices where mac=p_mac for update;
 if found and not d.active then raise exception 'DEVICE_NOT_ACTIVE';end if;
 if d.server_code is not null and public.portal_code_access(p_mac,d.server_code)->>'reason'='active' then raise exception 'CODE_ACCESS_ACTIVE';end if;
 if exists(select 1 from public.portal_device_licenses where mac=p_mac and lifetime) and not exists(select 1 from public.portal_server_codes c where c.code=d.server_code and (c.revoked or not c.active or (c.validity='annual' and c.expires_at<=now()))) then raise exception 'LIFETIME_DEVICE';end if;
 select * into o from public.portal_pix_orders where mac=p_mac and status in ('creating','pending','processing','unknown') order by created_at desc limit 1;
 if found then
  if o.access_hash is distinct from p_access_hash then raise exception 'PAYMENT_SESSION_CONFLICT';end if;
  return to_jsonb(o)||jsonb_build_object('new_order',false);
 end if;
 if exists(select 1 from public.portal_pix_orders where mac=p_mac and created_at>now()-interval '1 minute') then raise exception 'RATE_LIMIT';end if;
 insert into public.portal_pix_orders(mac,access_hash,recovery_code) values(p_mac,p_access_hash,d.server_code) returning * into o;
 return to_jsonb(o)||jsonb_build_object('new_order',true);
end $$;
