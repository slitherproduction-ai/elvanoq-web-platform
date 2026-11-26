create table if not exists public.portal_device_binding_events(id uuid primary key default gen_random_uuid(),device_id uuid not null references public.portal_managed_devices(id),mac text not null,actor uuid not null references auth.users(id),reason text not null,restored boolean not null,created_at timestamptz not null default now());
alter table public.portal_device_binding_events enable row level security;
revoke all on public.portal_device_binding_events from public,anon,authenticated;
grant all on public.portal_device_binding_events to service_role;
create or replace function public.portal_device_rebind(p_id uuid,p_actor uuid,p_key_hash text,p_reason text,p_restore boolean default false) returns jsonb language plpgsql security invoker set search_path=pg_catalog,public as $$
declare d public.portal_managed_devices;
begin
 if not exists(select 1 from public.portal_staff where user_id=p_actor and role='admin' and active and not must_change_password) then raise exception 'ADMIN_REQUIRED';end if;
 if p_key_hash is null or p_key_hash !~ '^[0-9a-f]{64}$' or length(coalesce(trim(p_reason),'')) not between 5 and 500 or p_restore is null then raise exception 'INVALID_CODE_DEVICE';end if;
 select * into d from public.portal_managed_devices where id=p_id;
 if not found then raise exception 'DEVICE_NOT_FOUND';end if;
 perform pg_advisory_xact_lock(hashtextextended('playlist-device:'||d.mac,0));
 select * into d from public.portal_managed_devices where id=p_id for update;
 update public.portal_managed_devices set key_hash=p_key_hash,active=case when p_restore then true else active end,archived_at=case when p_restore then null else archived_at end where id=p_id;
 insert into public.portal_device_binding_events(device_id,mac,actor,reason,restored) values(p_id,d.mac,p_actor,trim(p_reason),p_restore);
 return jsonb_build_object('rebound',true,'mac',d.mac);
end $$;
revoke all on function public.portal_device_rebind(uuid,uuid,text,text,boolean) from public,anon,authenticated;
grant execute on function public.portal_device_rebind(uuid,uuid,text,text,boolean) to service_role;
