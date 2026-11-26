alter table public.portal_device_licenses add column lifetime boolean not null default false;
create table public.portal_license_audit (
 id uuid primary key default gen_random_uuid(), mac text not null,
 actor uuid not null references auth.users(id), action text not null check(action in ('grant_lifetime','revoke_lifetime')),
 reason text not null check(length(reason) between 5 and 500), created_at timestamptz not null default now()
);
create index portal_license_audit_mac_idx on public.portal_license_audit(mac,created_at desc);
alter table public.portal_license_audit enable row level security;
revoke all on public.portal_license_audit from anon,authenticated;
grant select,insert on public.portal_license_audit to service_role;
create or replace function public.portal_license_status(p_mac text) returns jsonb
language plpgsql stable security invoker set search_path=pg_catalog,public set timezone='UTC' as $$
declare l public.portal_device_licenses; d public.portal_managed_devices; t timestamptz:=now(); s text; deadline timestamptz;
begin
 select * into d from public.portal_managed_devices where mac=p_mac;
 if not found then raise exception 'DEVICE_NOT_FOUND'; end if;
 select * into l from public.portal_device_licenses where mac=p_mac;
 if not d.active then s:='suspended';
 elsif l.lifetime then s:='lifetime';
 elsif l.paid_until > t then s:='licensed'; deadline:=l.paid_until;
 elsif l.trial_expires_at > t then s:='trial'; deadline:=l.trial_expires_at;
 elsif l.trial_started_at is not null or l.paid_until is not null then s:='expired'; deadline:=greatest(l.trial_expires_at,l.paid_until);
 else s:='not_activated'; end if;
 return jsonb_build_object('status',s,'can_play',s in ('trial','licensed','lifetime'),'payment_required',s='expired','server_time',t,
 'lifetime',coalesce(l.lifetime,false),'trial_started_at',l.trial_started_at,'trial_expires_at',l.trial_expires_at,'paid_until',l.paid_until,
 'expires_at',deadline,'remaining_seconds',case when s in ('trial','licensed') then greatest(0,floor(extract(epoch from (deadline-t)))) else 0 end);
end $$;

create or replace function public.portal_license_set_lifetime(p_mac text,p_lifetime boolean,p_actor uuid,p_reason text) returns jsonb
language plpgsql security invoker set search_path=pg_catalog,public as $$
declare current_lifetime boolean;
begin
 if not exists(select 1 from public.portal_staff where user_id=p_actor and role='admin' and active) then raise exception 'ADMIN_REQUIRED'; end if;
 if p_lifetime is null or p_reason is null or length(trim(p_reason)) not between 5 and 500 then raise exception 'INVALID_LIFETIME'; end if;
 perform 1 from public.portal_managed_devices where mac=p_mac for update;
 if not found then raise exception 'DEVICE_NOT_FOUND'; end if;
 insert into public.portal_device_licenses(mac) values(p_mac) on conflict do nothing;
 select lifetime into current_lifetime from public.portal_device_licenses where mac=p_mac for update;
 if current_lifetime is distinct from p_lifetime then
  update public.portal_device_licenses set lifetime=p_lifetime where mac=p_mac;
  insert into public.portal_license_audit(mac,actor,action,reason) values(p_mac,p_actor,case when p_lifetime then 'grant_lifetime' else 'revoke_lifetime' end,trim(p_reason));
 end if;
 return public.portal_license_status(p_mac);
end $$;
revoke execute on function public.portal_license_set_lifetime(text,boolean,uuid,text) from public,anon,authenticated;
grant execute on function public.portal_license_set_lifetime(text,boolean,uuid,text) to service_role;
