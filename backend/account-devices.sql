alter table public.portal_staff add column display_name text not null default '', add column must_change_password boolean not null default false;
alter table public.portal_managed_devices add column archived_at timestamptz;
create table public.portal_device_events(id uuid primary key default gen_random_uuid(),device_id uuid not null,mac text not null,actor uuid not null references auth.users(id),action text not null check(action in('remove','restore')),created_at timestamptz not null default now());
alter table public.portal_device_events enable row level security;
revoke all on public.portal_device_events from anon,authenticated;
grant select,insert on public.portal_device_events to service_role;
create function public.portal_device_archive(p_id uuid,p_actor uuid,p_remove boolean) returns jsonb
language plpgsql security invoker set search_path=pg_catalog,public as $$
declare d public.portal_managed_devices; s public.portal_staff;
begin
 select * into s from public.portal_staff where user_id=p_actor and active and not must_change_password;
 if not found then raise exception 'DEVICE_FORBIDDEN';end if;
 select * into d from public.portal_managed_devices where id=p_id for update;
 if not found or (s.role<>'admin' and d.reseller_id is distinct from p_actor) then raise exception 'DEVICE_FORBIDDEN';end if;
 if p_remove is null then raise exception 'DEVICE_FORBIDDEN';end if;
 if (p_remove and d.archived_at is null) or (not p_remove and d.archived_at is not null) then
  update public.portal_managed_devices set archived_at=case when p_remove then now() else null end,active=not p_remove where id=p_id;
  insert into public.portal_device_events(device_id,mac,actor,action) values(p_id,d.mac,p_actor,case when p_remove then 'remove' else 'restore' end);
 end if;
 return jsonb_build_object('removed',p_remove);
end $$;
revoke execute on function public.portal_device_archive(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.portal_device_archive(uuid,uuid,boolean) to service_role;
