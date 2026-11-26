create table public.portal_pix_orders (
 id uuid primary key default gen_random_uuid(), mac text not null,
 amount_cents integer not null default 2490 check(amount_cents=2490),
 transaction_id text unique, status text not null default 'creating',
 emv text, qrcode_base64 text, due_date text,
 created_at timestamptz not null default now(), expires_at timestamptz not null default (now()+interval '30 minutes'), checked_at timestamptz,
 applied_at timestamptz, license_until timestamptz, review_required boolean not null default false
);
create index portal_pix_orders_mac_idx on public.portal_pix_orders(mac,created_at desc);
alter table public.portal_pix_orders enable row level security;
revoke all on public.portal_pix_orders from anon,authenticated;
grant select,insert,update on public.portal_pix_orders to service_role;

create function public.portal_pix_reserve(p_mac text) returns jsonb
language plpgsql security invoker set search_path=pg_catalog,public as $$
declare o public.portal_pix_orders; d public.portal_managed_devices;
begin
 select * into d from public.portal_managed_devices where mac=p_mac for update;
 if not found or not d.active then raise exception 'DEVICE_NOT_ACTIVE'; end if;
 if exists(select 1 from public.portal_device_licenses where mac=p_mac and lifetime) then raise exception 'LIFETIME_DEVICE'; end if;
 select * into o from public.portal_pix_orders where mac=p_mac and status in ('creating','pending','processing','unknown') order by created_at desc limit 1;
 if found then return to_jsonb(o)||jsonb_build_object('new_order',false); end if;
 if exists(select 1 from public.portal_pix_orders where mac=p_mac and created_at>now()-interval '1 minute') then raise exception 'RATE_LIMIT'; end if;
 insert into public.portal_pix_orders(mac) values(p_mac) returning * into o;
 return to_jsonb(o)||jsonb_build_object('new_order',true);
end $$;

create function public.portal_pix_apply(p_id uuid,p_transaction text,p_status text,p_amount integer,p_paid integer) returns jsonb
language plpgsql security invoker set search_path=pg_catalog,public as $$
declare o public.portal_pix_orders; m text; deadline timestamptz; t timestamptz:=clock_timestamp();
begin
 select mac into m from public.portal_pix_orders where id=p_id;
 if m is null then raise exception 'ORDER_NOT_FOUND'; end if;
 -- Same lock order as manual payment and lifetime operations.
 perform 1 from public.portal_managed_devices where mac=m for update;
 if not found then raise exception 'DEVICE_NOT_FOUND'; end if;
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
  end if;
 end if;
 -- Never regress a settled order because of an older pending notification.
 if o.applied_at is not null and p_status in ('pending','processing','canceled') then return to_jsonb(o); end if;
 update public.portal_pix_orders set status=case when p_status='pending' and applied_at is null and expires_at<t then 'expired' else p_status end,checked_at=t,
 review_required=review_required or (p_status='refunded' and applied_at is not null) where id=p_id returning * into o;
 return to_jsonb(o);
end $$;
revoke execute on function public.portal_pix_reserve(text), public.portal_pix_apply(uuid,text,text,integer,integer) from public,anon,authenticated;
grant execute on function public.portal_pix_reserve(text), public.portal_pix_apply(uuid,text,text,integer,integer) to service_role;
