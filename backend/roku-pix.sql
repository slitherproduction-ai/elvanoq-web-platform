-- Separate native Roku payments: no legacy identifier column or conversion.
create table public.portal_roku_pix_orders (
 id uuid primary key default gen_random_uuid(),
 device_id uuid not null references public.portal_roku_devices(id) on delete cascade,
 device_code text not null, amount_cents integer not null default 2490 check(amount_cents=2490),
 transaction_id text unique, status text not null default 'creating',
 access_hash text not null check(access_hash ~ '^[0-9a-f]{64}$'),
 emv text,qrcode_base64 text,due_date text,
 created_at timestamptz not null default now(),expires_at timestamptz not null default(now()+interval '30 minutes'),
 checked_at timestamptz,applied_at timestamptz,license_until timestamptz,review_required boolean not null default false
);
create index portal_roku_pix_device_idx on public.portal_roku_pix_orders(device_id,created_at desc);
alter table public.portal_roku_pix_orders enable row level security;
revoke all on public.portal_roku_pix_orders from public,anon,authenticated;
grant select,insert,update,delete on public.portal_roku_pix_orders to service_role;

create function public.portal_roku_pix_reserve(p_id uuid,p_key_hash text,p_access_hash text) returns jsonb
language plpgsql security invoker set search_path=pg_catalog,public as $$
declare d public.portal_roku_devices;o public.portal_roku_pix_orders;c public.portal_server_codes;
begin
 if p_key_hash is null or p_key_hash !~ '^[0-9a-f]{64}$' or p_key_hash=repeat('0',64) or p_access_hash is null or p_access_hash !~ '^[0-9a-f]{64}$' then raise exception 'ROKU_IDENTITY';end if;
 select * into d from public.portal_roku_devices where id=p_id for update;
 if not found or not d.active or d.key_hash is distinct from p_key_hash then raise exception 'ROKU_IDENTITY';end if;
 if d.lifetime then raise exception 'LIFETIME_DEVICE';end if;
 select * into c from public.portal_server_codes where code=d.server_code;
 if found and c.active and not c.revoked and (c.validity='lifetime' or c.expires_at>now()) then raise exception 'CODE_ACCESS_ACTIVE';end if;
 select * into o from public.portal_roku_pix_orders where device_id=d.id and status in ('creating','pending','processing','unknown') order by created_at desc limit 1;
 if found then
  if o.access_hash<>p_access_hash then raise exception 'ROKU_PAYMENT_SESSION_CONFLICT';end if;
  return to_jsonb(o)||jsonb_build_object('new_order',false);
 end if;
 if exists(select 1 from public.portal_roku_pix_orders where device_id=d.id and created_at>now()-interval '1 minute') then raise exception 'RATE_LIMIT';end if;
 insert into public.portal_roku_pix_orders(device_id,device_code,access_hash) values(d.id,d.device_code,p_access_hash) returning * into o;
 return to_jsonb(o)||jsonb_build_object('new_order',true);
end $$;

create function public.portal_roku_pix_apply(p_id uuid,p_transaction text,p_status text,p_amount integer,p_paid integer) returns jsonb
language plpgsql security invoker set search_path=pg_catalog,public as $$
declare o public.portal_roku_pix_orders;d public.portal_roku_devices;did uuid;deadline timestamptz;t timestamptz:=clock_timestamp();
begin
 select device_id into did from public.portal_roku_pix_orders where id=p_id;
 if did is null then raise exception 'ORDER_NOT_FOUND';end if;
 select * into d from public.portal_roku_devices where id=did for update;
 if not found then raise exception 'ROKU_IDENTITY';end if;
 select * into o from public.portal_roku_pix_orders where id=p_id for update;
 if o.transaction_id is null or o.transaction_id is distinct from p_transaction or p_amount is distinct from o.amount_cents then raise exception 'PAYMENT_MISMATCH';end if;
 if p_status is null or p_status not in ('pending','processing','paid','completed','canceled','refunded') then raise exception 'INVALID_STATUS';end if;
 if p_status in ('paid','completed') then
  if p_paid is distinct from o.amount_cents then raise exception 'PAYMENT_MISMATCH';end if;
  if o.status='refunded' then return to_jsonb(o);end if;
  if o.applied_at is null then
   deadline:=greatest(t,coalesce(d.paid_until,t))+interval '1 year';
   -- Preserve active/block status and original trial dates; paid entitlement is individual.
   update public.portal_roku_devices set paid_until=deadline,paid_at=t,bound_at=coalesce(bound_at,t) where id=d.id;
   update public.portal_roku_pix_orders set applied_at=t,license_until=deadline where id=p_id;
  end if;
 end if;
 if (o.applied_at is not null or exists(select 1 from public.portal_roku_pix_orders where id=p_id and applied_at is not null)) and p_status in ('pending','processing','canceled') then return (select to_jsonb(v) from public.portal_roku_pix_orders v where id=p_id);end if;
 update public.portal_roku_pix_orders set status=case when p_status='pending' and applied_at is null and expires_at<t then 'expired' else p_status end,checked_at=t,review_required=review_required or(p_status='refunded' and applied_at is not null) where id=p_id returning * into o;
 return to_jsonb(o);
end $$;
revoke all on function public.portal_roku_pix_reserve(uuid,text,text),public.portal_roku_pix_apply(uuid,text,text,integer,integer) from public,anon,authenticated;
grant execute on function public.portal_roku_pix_reserve(uuid,text,text),public.portal_roku_pix_apply(uuid,text,text,integer,integer) to service_role;
