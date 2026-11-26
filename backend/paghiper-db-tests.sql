begin;
do $test$
declare m text:='02:FE:DC:98:76:50'; o jsonb; order_uuid uuid; first_deadline timestamptz; n int;
begin
 if exists(select 1 from public.portal_managed_devices where mac=m) then raise exception 'test MAC collision'; end if;
 insert into public.portal_managed_devices(mac,key_hash,display_name) values(m,'test-only','TEMP Pix rollback');
 o:=public.portal_pix_reserve(m);order_uuid:=(o->>'id')::uuid;
 if (o->>'new_order')::boolean is not true then raise exception 'reserve failed';end if;
 o:=public.portal_pix_reserve(m);if (o->>'new_order')::boolean then raise exception 'duplicate invoice';end if;
 update public.portal_pix_orders set transaction_id='db-test-only' where portal_pix_orders.id=order_uuid;
 begin
  perform public.portal_pix_apply(order_uuid,'db-test-only','paid',1,1);raise exception 'MISMATCH_ACCEPTED';
 exception when others then if sqlerrm<>'PAYMENT_MISMATCH' then raise;end if;end;
 o:=public.portal_pix_apply(order_uuid,'db-test-only','pending',2490,0);
 if o->>'applied_at' is not null then raise exception 'unpaid activated';end if;
 o:=public.portal_pix_apply(order_uuid,'db-test-only','paid',2490,2490);first_deadline:=(o->>'license_until')::timestamptz;
 if first_deadline is null then raise exception 'paid not applied';end if;
 o:=public.portal_pix_apply(order_uuid,'db-test-only','completed',2490,2490);
 if (o->>'license_until')::timestamptz<>first_deadline then raise exception 'double extension';end if;
 o:=public.portal_pix_apply(order_uuid,'db-test-only','pending',2490,0);
 if o->>'status' not in ('paid','completed') then raise exception 'regression';end if;
 o:=public.portal_pix_apply(order_uuid,'db-test-only','refunded',2490,0);
 if (o->>'review_required')::boolean is not true then raise exception 'refund missing review';end if;
 o:=public.portal_pix_apply(order_uuid,'db-test-only','paid',2490,2490);
 if o->>'status'<>'refunded' then raise exception 'refund regressed';end if;
 update public.portal_device_licenses set lifetime=true where mac=m;
 begin perform public.portal_pix_reserve(m);raise exception 'LIFETIME_CHARGED';
 exception when others then if sqlerrm<>'LIFETIME_DEVICE' then raise;end if;end;
 if has_function_privilege('anon','public.portal_pix_apply(uuid,text,text,integer,integer)','EXECUTE') or has_function_privilege('authenticated','public.portal_pix_apply(uuid,text,text,integer,integer)','EXECUTE') then raise exception 'public payment function';end if;
end $test$;
rollback;
