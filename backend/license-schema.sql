-- Retained by MAC independently of device registration: no reset on delete/recreate.
create table public.portal_device_licenses (
 mac text primary key check (mac ~ '^([0-9A-F]{2}:){5}[0-9A-F]{2}$'),
 trial_started_at timestamptz,
 trial_expires_at timestamptz,
 paid_until timestamptz,
 created_at timestamptz not null default now(),
 check ((trial_started_at is null and trial_expires_at is null) or
 (trial_started_at is not null and trial_expires_at is not null and trial_expires_at = trial_started_at + interval '168 hours'))
);
create table public.portal_license_payments (
 id uuid primary key default gen_random_uuid(),
 payment_reference text not null unique check(length(payment_reference) between 8 and 120),
 mac text not null references public.portal_device_licenses(mac),
 amount_cents integer not null check(amount_cents > 0),
 confirmed_by uuid not null references auth.users(id),
 confirmed_at timestamptz not null default now(),
 license_until timestamptz not null
);
create index portal_license_payments_mac_idx on public.portal_license_payments(mac);
create index portal_license_payments_actor_idx on public.portal_license_payments(confirmed_by);
alter table public.portal_device_licenses enable row level security;
alter table public.portal_license_payments enable row level security;
revoke all on public.portal_device_licenses, public.portal_license_payments from anon,authenticated;
grant all on public.portal_device_licenses, public.portal_license_payments to service_role;

create function public.portal_license_status(p_mac text) returns jsonb
language plpgsql stable security invoker set search_path=pg_catalog,public set timezone='UTC' as $$
declare l public.portal_device_licenses; d public.portal_managed_devices; t timestamptz:=now(); s text; deadline timestamptz;
begin
 select * into d from public.portal_managed_devices where mac=p_mac;
 if not found then raise exception 'DEVICE_NOT_FOUND'; end if;
 select * into l from public.portal_device_licenses where mac=p_mac;
 if not d.active then s:='suspended';
 elsif l.paid_until > t then s:='licensed'; deadline:=l.paid_until;
 elsif l.trial_expires_at > t then s:='trial'; deadline:=l.trial_expires_at;
 elsif l.trial_started_at is not null or l.paid_until is not null then s:='expired'; deadline:=greatest(l.trial_expires_at,l.paid_until);
 else s:='not_activated'; end if;
 return jsonb_build_object('status',s,'can_play',s in ('trial','licensed'),'payment_required',s='expired','server_time',t,
 'trial_started_at',l.trial_started_at,'trial_expires_at',l.trial_expires_at,'paid_until',l.paid_until,
 'expires_at',deadline,'remaining_seconds',case when s in ('trial','licensed') then greatest(0,floor(extract(epoch from (deadline-t)))) else 0 end);
end $$;

create function public.portal_license_activate(p_mac text) returns jsonb
language plpgsql security invoker set search_path=pg_catalog,public set timezone='UTC' as $$
declare d public.portal_managed_devices; t timestamptz:=clock_timestamp();
begin
 select * into d from public.portal_managed_devices where mac=p_mac for update;
 if not found or not d.active then raise exception 'DEVICE_NOT_ACTIVE'; end if;
 insert into public.portal_device_licenses(mac) values(p_mac) on conflict do nothing;
 -- Atomic first activation; repeats and concurrent requests retain the original date.
 update public.portal_device_licenses set trial_started_at=t,trial_expires_at=t+interval '168 hours'
 where mac=p_mac and trial_started_at is null and paid_until is null;
 return public.portal_license_status(p_mac);
end $$;

create function public.portal_license_confirm_payment(p_mac text,p_reference text,p_amount_cents integer,p_actor uuid) returns jsonb
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
 return public.portal_license_status(p_mac)||jsonb_build_object('payment_id',previous.id,'duplicate',false);
end $$;
revoke execute on function public.portal_license_status(text),public.portal_license_activate(text),public.portal_license_confirm_payment(text,text,integer,uuid) from public,anon,authenticated;
grant execute on function public.portal_license_status(text),public.portal_license_activate(text),public.portal_license_confirm_payment(text,text,integer,uuid) to service_role;
