alter table public.portal_staff add column if not exists plan_name text not null default 'Plano atual';
alter table public.portal_staff add column if not exists plan_type text not null default 'custom' check(plan_type in ('annual','lifetime','custom'));
alter table public.portal_staff add column if not exists plan_expires_at timestamptz;
alter table public.portal_staff add column if not exists device_limit integer check(device_limit between 1 and 1000000);
alter table public.portal_staff add column if not exists device_count integer not null default 0 check(device_count>=0);
alter table public.portal_managed_devices add column if not exists created_by uuid references auth.users(id) on delete set null;
alter table public.portal_roku_devices add column if not exists created_by uuid references auth.users(id) on delete set null;
create index if not exists portal_managed_reseller_idx on public.portal_managed_devices(reseller_id);
create index if not exists portal_roku_reseller_idx on public.portal_roku_devices(reseller_id);
create table public.portal_staff_device_actions(id uuid primary key default gen_random_uuid(), actor uuid not null references auth.users(id), device_id uuid not null, platform text not null check(platform in ('managed','roku')), action text not null, reason text, request_id uuid unique, license_until timestamptz, created_at timestamptz not null default now());
alter table public.portal_staff_device_actions enable row level security;
revoke all on public.portal_staff_device_actions from anon,authenticated;
grant all on public.portal_staff_device_actions to service_role;
update public.portal_staff s set device_count=(select count(*) from public.portal_managed_devices d where d.reseller_id=s.user_id)+(select count(*) from public.portal_roku_devices d where d.reseller_id=s.user_id);
create function public.portal_reseller_capacity_track() returns trigger language plpgsql set search_path=pg_catalog,public as $$
declare prev uuid; next_owner uuid; n integer;
begin
 if tg_op<>'INSERT' then prev:=old.reseller_id;end if;if tg_op<>'DELETE' then next_owner:=new.reseller_id;end if;
 if prev is not distinct from next_owner then return null;end if;
 perform 1 from public.portal_staff where user_id in(prev,next_owner) order by user_id for update;
 if next_owner is not null then
  update public.portal_staff set device_count=device_count+1 where user_id=next_owner and role='reseller' and active and (plan_expires_at is null or plan_expires_at>now()) and (device_limit is null or device_count<device_limit);
  get diagnostics n=row_count;if n<>1 then raise exception 'RESELLER_CAPACITY_OR_PLAN';end if;
 end if;
 if prev is not null then update public.portal_staff set device_count=greatest(0,device_count-1) where user_id=prev;end if;
 return null;
end $$;
create trigger portal_managed_reseller_capacity after insert or delete or update of reseller_id on public.portal_managed_devices for each row execute function public.portal_reseller_capacity_track();
create trigger portal_roku_reseller_capacity after insert or delete or update of reseller_id on public.portal_roku_devices for each row execute function public.portal_reseller_capacity_track();
create function public.portal_partner_plan_save(p_actor uuid,p_partner uuid,p_name text,p_type text,p_expires timestamptz,p_limit integer) returns void language plpgsql set search_path=pg_catalog,public as $$
begin
 if not exists(select 1 from public.portal_staff where user_id=p_actor and role='admin' and active and not must_change_password) then raise exception 'ADMIN_REQUIRED';end if;
 if length(trim(coalesce(p_name,''))) not between 1 and 80 or p_type not in('annual','lifetime','custom') or (p_type='annual' and p_expires is null) or (p_limit is not null and p_limit not between 1 and 1000000) then raise exception 'PARTNER_PLAN_INVALID';end if;
 update public.portal_staff set plan_name=trim(p_name),plan_type=p_type,plan_expires_at=case when p_type='annual' then p_expires else null end,device_limit=p_limit where user_id=p_partner and role='reseller';
 if not found then raise exception 'RESELLER_UNAVAILABLE';end if;
 insert into public.portal_staff_device_actions(actor,device_id,platform,action,reason) values(p_actor,p_partner,'managed','partner-plan',p_name);
end $$;
create function public.portal_staff_device_operation(p_actor uuid,p_operation text,p_platform text,p_id uuid default null,p_data jsonb default '{}') returns jsonb language plpgsql set search_path=pg_catalog,public as $$
declare s public.portal_staff;d public.portal_managed_devices;r public.portal_roku_devices;target uuid;owner uuid;creator uuid;destination uuid;k text;mid uuid;until_date timestamptz;req uuid;prior public.portal_staff_device_actions;t timestamptz:=clock_timestamp();outcome jsonb;reason text;
begin
 select * into s from public.portal_staff where user_id=p_actor and active and not must_change_password;
 if not found or p_platform not in('managed','roku') then raise exception 'STAFF_DEVICE_FORBIDDEN';end if;
 if p_operation='bind' then
  k:=p_data->>'key_hash';if k is null or k !~ '^[a-f0-9]{64}$' then raise exception 'INVALID_CODE_DEVICE';end if;
  destination:=case when s.role='admin' then nullif(p_data->>'reseller_id','')::uuid else p_actor end;
  if s.role<>'admin' and nullif(p_data->>'reseller_id','') is not null and (p_data->>'reseller_id')::uuid<>p_actor then raise exception 'STAFF_DEVICE_FORBIDDEN';end if;
  if length(trim(coalesce(p_data->>'name',''))) not between 1 and 100 then raise exception 'INVALID_CODE_DEVICE';end if;
  if p_platform='managed' then
   if p_id is null then
    if coalesce(p_data->>'mac','') !~ '^([0-9A-F]{2}:){5}[0-9A-F]{2}$' then raise exception 'INVALID_CODE_DEVICE';end if;
    perform pg_advisory_xact_lock(hashtextextended('playlist-device:'||(p_data->>'mac'),0));
    select * into d from public.portal_managed_devices where mac=p_data->>'mac' for update;
    if not found then insert into public.portal_managed_devices(mac,key_hash,display_name,reseller_id,created_by) values(p_data->>'mac',k,trim(p_data->>'name'),destination,p_actor) returning * into d;end if;
   else select * into d from public.portal_managed_devices where id=p_id for update;end if;
   if d.id is null or d.key_hash<>k then raise exception 'DEVICE_BINDING_REQUIRED';end if;
   if not d.active or d.archived_at is not null then raise exception 'DEVICE_NOT_ACTIVE';end if;
   if s.role<>'admin' and d.reseller_id is not null and d.reseller_id<>p_actor then raise exception 'STAFF_DEVICE_FORBIDDEN';end if;
   update public.portal_managed_devices set reseller_id=destination,created_by=case when created_by is null and reseller_id is null then p_actor else created_by end,display_name=trim(p_data->>'name') where id=d.id;target:=d.id;
  else
   select * into r from public.portal_roku_devices where device_code=p_data->>'device_code' for update;
   if r.id is null or r.key_hash is distinct from k or not r.active then raise exception 'ROKU_IDENTITY';end if;
   if s.role<>'admin' and r.reseller_id is not null and r.reseller_id<>p_actor then raise exception 'STAFF_DEVICE_FORBIDDEN';end if;
   update public.portal_roku_devices set reseller_id=destination,created_by=case when created_by is null and reseller_id is null then p_actor else created_by end,display_name=trim(p_data->>'name'),bound_at=coalesce(bound_at,t),trial_started_at=coalesce(trial_started_at,t),trial_expires_at=coalesce(trial_expires_at,t+interval '7 days') where id=r.id;target:=r.id;
  end if;
  insert into public.portal_staff_device_actions(actor,device_id,platform,action) values(p_actor,target,p_platform,'bind');return jsonb_build_object('linked',true);
 end if;
 if p_platform='managed' then select * into d from public.portal_managed_devices where id=p_id for update;target:=d.id;owner:=d.reseller_id;
 else select * into r from public.portal_roku_devices where id=p_id for update;target:=r.id;owner:=r.reseller_id;end if;
 if target is null or (s.role<>'admin' and owner is distinct from p_actor) then raise exception 'STAFF_DEVICE_FORBIDDEN';end if;
 if p_operation='playlist' then
  if (p_platform='managed' and (not d.active or d.archived_at is not null)) or (p_platform='roku' and not r.active) then raise exception 'DEVICE_NOT_ACTIVE';end if;
  if p_platform='managed' then outcome:=public.portal_playlist_register_host(d.mac,d.key_hash,true,p_data->>'name',p_data->>'kind',p_data->'credentials',p_data->>'origin',p_actor);
  else outcome:=public.portal_roku_operation('playlist',null,r.device_code,r.key_hash,p_actor,p_data);end if;
  insert into public.portal_staff_device_actions(actor,device_id,platform,action) values(p_actor,target,p_platform,'playlist');return jsonb_build_object('saved',true,'license',outcome->'license');
 elsif p_operation='renew' then
  if s.role<>'admin' and s.plan_expires_at is not null and s.plan_expires_at<=t then raise exception 'PARTNER_PLAN_EXPIRED';end if;
  reason:=trim(coalesce(p_data->>'reason',''));req:=(p_data->>'request_id')::uuid;
  if length(reason) not between 5 and 500 or req is null then raise exception 'STAFF_RENEW_INVALID';end if;
  perform pg_advisory_xact_lock(hashtextextended('staff-renew:'||req,0));select * into prior from public.portal_staff_device_actions where request_id=req;
  if found then if prior.actor<>p_actor or prior.device_id<>target or prior.platform<>p_platform then raise exception 'STAFF_DEVICE_FORBIDDEN';end if;return jsonb_build_object('duplicate',true,'license_until',prior.license_until);end if;
  if p_platform='managed' then
   if d.archived_at is not null then raise exception 'DEVICE_NOT_ACTIVE';end if;
   insert into public.portal_device_licenses(mac) values(d.mac) on conflict do nothing;
   if exists(select 1 from public.portal_device_licenses where mac=d.mac and lifetime) then raise exception 'STAFF_DEVICE_LIFETIME';end if;
   select greatest(t,coalesce(paid_until,t))+interval '1 year' into until_date from public.portal_device_licenses where mac=d.mac for update;
   update public.portal_device_licenses set paid_until=until_date where mac=d.mac;update public.portal_managed_devices set expires_at=until_date where id=d.id;
   perform public.portal_code_payment_grant(d.mac,'staff-renew:'||req,until_date,t);
  else
   if r.lifetime then raise exception 'STAFF_DEVICE_LIFETIME';end if;
   until_date:=greatest(t,coalesce(r.paid_until,t))+interval '1 year';update public.portal_roku_devices set paid_until=until_date,paid_at=t,bound_at=coalesce(bound_at,t) where id=r.id;
  end if;
  insert into public.portal_staff_device_actions(actor,device_id,platform,action,reason,request_id,license_until) values(p_actor,target,p_platform,'renew',reason,req,until_date);
  return jsonb_build_object('license_until',until_date,'duplicate',false);
 elsif p_operation='delete' then
  if p_platform='managed' then perform public.portal_device_archive(target,p_actor,true);
  else delete from public.portal_roku_events where device_id=target;delete from public.portal_roku_payments where device_id=target;delete from public.portal_roku_devices where id=target;end if;
  insert into public.portal_staff_device_actions(actor,device_id,platform,action) values(p_actor,target,p_platform,'delete');return jsonb_build_object('removed',true);
 end if;
 raise exception 'STAFF_DEVICE_FORBIDDEN';
end $$;
revoke all on function public.portal_reseller_capacity_track(),public.portal_partner_plan_save(uuid,uuid,text,text,timestamptz,integer),public.portal_staff_device_operation(uuid,text,text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.portal_partner_plan_save(uuid,uuid,text,text,timestamptz,integer),public.portal_staff_device_operation(uuid,text,text,uuid,jsonb) to service_role;
