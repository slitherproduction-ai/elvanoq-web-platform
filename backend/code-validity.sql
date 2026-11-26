alter table public.portal_server_codes add column validity text not null default 'lifetime' check(validity in ('annual','lifetime')),add column expires_at timestamptz,add column revoked boolean not null default false,add column restricted_at timestamptz;
update public.portal_server_codes set restricted_at=updated_at where not active;
alter table public.portal_server_code_events add column validity text,add column expires_at timestamptz,add column revoked boolean;
create table public.portal_code_device_grants (
 payment_reference text primary key,mac text not null,code text not null references public.portal_server_codes(code),
 granted_at timestamptz not null,valid_until timestamptz not null,active boolean not null default true
);
create index portal_code_device_grants_lookup on public.portal_code_device_grants(mac,code,valid_until);
alter table public.portal_code_device_grants enable row level security;
revoke all on public.portal_code_device_grants from anon,authenticated;
grant select,insert,update on public.portal_code_device_grants to service_role;
alter table public.portal_pix_orders add column recovery_code text;
create function public.portal_code_access(p_mac text,p_code text) returns jsonb
language plpgsql stable security invoker set search_path=pg_catalog,public as $$
declare c public.portal_server_codes; d public.portal_managed_devices; cutoff timestamptz; until_date timestamptz; reason text;
begin
 select * into c from public.portal_server_codes where code=p_code;
 if not found then return jsonb_build_object('can_connect',false,'reason','code_not_found','payment_required',false);end if;
 if c.revoked then reason:='code_revoked';cutoff:=c.restricted_at;
 elsif not c.active then reason:='code_blocked';cutoff:=c.restricted_at;
 elsif c.validity='annual' and c.expires_at<=now() then reason:='code_expired';cutoff:=c.expires_at;
 else reason:='active';end if;
 if c.validity='annual' and c.expires_at<=now() and reason<>'active' then cutoff:=greatest(cutoff,c.expires_at);end if;
 if p_mac is not null then
  select * into d from public.portal_managed_devices where mac=p_mac;
  if found and (not d.active or d.archived_at is not null) then return jsonb_build_object('can_connect',false,'reason','device_suspended','payment_required',false);end if;
 end if;
 if reason='active' then return jsonb_build_object('can_connect',true,'reason',reason,'individual_access',false,'payment_required',false);end if;
 select max(valid_until) into until_date from public.portal_code_device_grants where mac=p_mac and code=p_code and active and granted_at>=coalesce(cutoff,c.updated_at) and valid_until>now();
 return jsonb_build_object('can_connect',until_date is not null,'reason',reason,'individual_access',until_date is not null,'access_until',until_date,'payment_required',until_date is null,'restricted_since',cutoff);
end $$;
create function public.portal_code_payment_grant(p_mac text,p_reference text,p_until timestamptz,p_paid_at timestamptz) returns void
language plpgsql security invoker set search_path=pg_catalog,public as $$
declare code_value text; access jsonb;
begin
 if p_reference like 'pix:%' then select recovery_code into code_value from public.portal_pix_orders where id=substring(p_reference from 5)::uuid;
 else select server_code into code_value from public.portal_managed_devices where mac=p_mac;end if;
 if code_value is null then return;end if;
 access:=public.portal_code_access(p_mac,code_value);
 -- Device suspension is never bypassed, but retain the paid entitlement for eventual administrative restoration.
 if exists(select 1 from public.portal_server_codes where code=code_value and (revoked or not active or (validity='annual' and expires_at<=now()))) then
 insert into public.portal_code_device_grants(payment_reference,mac,code,granted_at,valid_until) values(p_reference,p_mac,code_value,p_paid_at,p_until) on conflict(payment_reference) do nothing;
 end if;
end $$;
create function public.portal_server_code_save_validity(p_code text,p_host text,p_active boolean,p_actor uuid,p_validity text,p_revoked boolean,p_renew boolean default false) returns jsonb
language plpgsql security invoker set search_path=pg_catalog,public as $$
declare previous public.portal_server_codes;saved public.portal_server_codes;deadline timestamptz;cutoff timestamptz;
begin
 if not exists(select 1 from public.portal_staff where user_id=p_actor and role='admin' and active and not must_change_password) then raise exception 'SERVER_CODE_FORBIDDEN';end if;
 if p_validity is null or p_validity not in ('annual','lifetime') or p_active is null or p_revoked is null or p_renew is null or p_code is null or p_code !~ '^[a-z0-9][a-z0-9_-]{2,31}$' or p_host is null or p_host !~ '^https?://[^/?#@[:space:]]+$' then raise exception 'INVALID_SERVER_CODE';end if;
 perform pg_advisory_xact_lock(hashtextextended('server-code:'||p_code,0));
 select * into previous from public.portal_server_codes where code=p_code for update;
 if p_validity='annual' then
  if previous.code is null or previous.validity<>'annual' then deadline:=now()+interval '1 year';
  elsif p_renew then deadline:=greatest(now(),previous.expires_at)+interval '1 year';else deadline:=previous.expires_at;end if;
 end if;
 cutoff:=previous.restricted_at;
 if previous.code is null and (not p_active or p_revoked) or (previous.active and not p_active) or (not previous.revoked and p_revoked) then cutoff:=clock_timestamp();end if;
 insert into public.portal_server_codes(code,host,active,updated_by,validity,expires_at,revoked,restricted_at) values(p_code,p_host,p_active,p_actor,p_validity,deadline,p_revoked,cutoff)
 on conflict(code) do update set host=excluded.host,active=excluded.active,updated_by=excluded.updated_by,validity=excluded.validity,expires_at=excluded.expires_at,revoked=excluded.revoked,restricted_at=excluded.restricted_at,updated_at=now() returning * into saved;
 insert into public.portal_server_code_events(code,actor,previous_host,host,previous_active,active,validity,expires_at,revoked) values(p_code,p_actor,previous.host,p_host,previous.active,p_active,p_validity,deadline,p_revoked);
 return to_jsonb(saved);
end $$;
revoke execute on function public.portal_code_access(text,text),public.portal_code_payment_grant(text,text,timestamptz,timestamptz),public.portal_server_code_save_validity(text,text,boolean,uuid,text,boolean,boolean) from public,anon,authenticated;
grant execute on function public.portal_code_access(text,text),public.portal_code_payment_grant(text,text,timestamptz,timestamptz),public.portal_server_code_save_validity(text,text,boolean,uuid,text,boolean,boolean) to service_role;

create or replace function public.portal_pix_apply(p_id uuid,p_transaction text,p_status text,p_amount integer,p_paid integer) returns jsonb
language plpgsql security invoker set search_path=pg_catalog,public as $$
declare o public.portal_pix_orders; m text; deadline timestamptz; t timestamptz:=clock_timestamp();
begin
 select mac into m from public.portal_pix_orders where id=p_id;
 if m is null then raise exception 'ORDER_NOT_FOUND'; end if;
 -- Same lock order as manual payment and lifetime operations.
 perform pg_advisory_xact_lock(hashtextextended('pix-device:'||m,0));
 perform 1 from public.portal_managed_devices where mac=m for update;
 select * into o from public.portal_pix_orders where id=p_id for update;
 if o.transaction_id is distinct from p_transaction or p_amount is distinct from o.amount_cents then raise exception 'PAYMENT_MISMATCH'; end if;
 if p_status not in ('pending','processing','paid','completed','canceled','refunded') then raise exception 'INVALID_STATUS'; end if;
 if p_status in ('paid','completed') then
  if p_paid is distinct from o.amount_cents then raise exception 'PAYMENT_MISMATCH'; end if;
  if o.status='refunded' then return to_jsonb(o); end if;
  if o.applied_at is null then
   insert into public.portal_device_licenses(mac) values(m) on conflict do nothing;
   select greatest(t,coalesce(paid_until,t))+interval '1 year' into deadline from public.portal_device_licenses where mac=m for update;
   update public.portal_device_licenses set paid_until=deadline where mac=m;
   update public.portal_managed_devices set expires_at=deadline where mac=m;
   update public.portal_pix_orders set applied_at=t,license_until=deadline where id=p_id;
   perform public.portal_code_payment_grant(m,'pix:'||p_id::text,deadline,t);
  end if;
 end if;
 if p_status='refunded' then update public.portal_code_device_grants set active=false where payment_reference='pix:'||p_id::text;end if;
 -- Never regress a settled order because of an older pending notification.
 if o.applied_at is not null and p_status in ('pending','processing','canceled') then return to_jsonb(o); end if;
 update public.portal_pix_orders set status=case when p_status='pending' and applied_at is null and expires_at<t then 'expired' else p_status end,checked_at=t,
 review_required=review_required or (p_status='refunded' and applied_at is not null) where id=p_id returning * into o;
 return to_jsonb(o);
end $$;

create or replace function public.portal_license_confirm_payment(p_mac text,p_reference text,p_amount_cents integer,p_actor uuid) returns jsonb
language plpgsql security invoker set search_path=pg_catalog,public set timezone='UTC' as $$
declare previous public.portal_license_payments; until_date timestamptz; t timestamptz:=clock_timestamp();
begin
 if not exists(select 1 from public.portal_staff where user_id=p_actor and role='admin' and active) then raise exception 'ADMIN_REQUIRED'; end if;
 if p_reference is null or length(trim(p_reference)) not between 8 and 120 or p_amount_cents is null or p_amount_cents<=0 then raise exception 'INVALID_PAYMENT'; end if;
 perform 1 from public.portal_managed_devices where mac=p_mac for update;
 if not found then raise exception 'DEVICE_NOT_FOUND'; end if;
 -- Serialize same receipt even across different devices.
 perform pg_advisory_xact_lock(hashtextextended(p_reference,0));
 select * into previous from public.portal_license_payments where payment_reference=p_reference;
 if found then
  if previous.mac<>p_mac or previous.amount_cents<>p_amount_cents then raise exception 'PAYMENT_REFERENCE_CONFLICT'; end if;
  return public.portal_license_status(p_mac)||jsonb_build_object('payment_id',previous.id,'duplicate',true);
 end if;
 insert into public.portal_device_licenses(mac) values(p_mac) on conflict do nothing;
 select greatest(t,coalesce(paid_until,t))+interval '1 year' into until_date from public.portal_device_licenses where mac=p_mac for update;
 update public.portal_device_licenses set paid_until=until_date where mac=p_mac;
 insert into public.portal_license_payments(payment_reference,mac,amount_cents,confirmed_by,license_until)
 values(p_reference,p_mac,p_amount_cents,p_actor,until_date) returning * into previous;
 update public.portal_managed_devices set expires_at=until_date where mac=p_mac;
 perform public.portal_code_payment_grant(p_mac,'manual:'||previous.id::text,until_date,t);
 return public.portal_license_status(p_mac)||jsonb_build_object('payment_id',previous.id,'duplicate',false);
end $$;

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
 if not (access->>'can_connect')::boolean then license:=public.portal_license_status(p_mac);
 elsif exists(select 1 from public.portal_device_licenses where mac=p_mac and lifetime) then license:=public.portal_license_status(p_mac);
 else license:=public.portal_license_activate(p_mac);end if;
 if not (access->>'can_connect')::boolean then license:=license||jsonb_build_object('can_play',false,'payment_required',(access->>'payment_required')::boolean,'code_blocked',true);end if;
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
