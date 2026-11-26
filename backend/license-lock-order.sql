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
 return public.portal_license_status(p_mac)||jsonb_build_object('payment_id',previous.id,'duplicate',false);
end $$;
