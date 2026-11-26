begin;
do $$
declare d uuid:=gen_random_uuid();o jsonb;o2 jsonb;t timestamptz:=now()+interval '30 days';x record;k text:=repeat('a',64);a text:=repeat('b',64);trial timestamptz:=now()-interval '2 days';
begin
 insert into public.portal_roku_devices(id,client_hash,device_code,key_hash,display_name,trial_started_at,trial_expires_at,paid_until)
 values(d,encode(sha256(convert_to(d::text,'UTF8')),'hex'),'ROKU-QATEST01-QATEST02',k,'Synthetic rollback Pix',trial-interval '7 days',trial,t);
 o:=public.portal_roku_pix_reserve(d,k,a);
 if (o->>'new_order')::boolean is not true then raise exception 'Reserve failed';end if;
 o2:=public.portal_roku_pix_reserve(d,k,a);
 if (o2->>'new_order')::boolean or o2->>'id'<>o->>'id' then raise exception 'Duplicate order';end if;
 begin perform public.portal_roku_pix_reserve(d,k,repeat('c',64));raise exception 'Expected session rejection';exception when others then if sqlerrm<>'ROKU_PAYMENT_SESSION_CONFLICT' then raise;end if;end;
 update public.portal_roku_pix_orders set transaction_id='test-only-'||d::text where id=(o->>'id')::uuid;
 begin perform public.portal_roku_pix_apply((o->>'id')::uuid,'test-only-'||d::text,'paid',1,1);raise exception 'Expected amount rejection';exception when others then if sqlerrm<>'PAYMENT_MISMATCH' then raise;end if;end;
 update public.portal_roku_devices set active=false where id=d;
 o2:=public.portal_roku_pix_apply((o->>'id')::uuid,'test-only-'||d::text,'paid',2490,2490);
 select * into x from public.portal_roku_devices where id=d;
 if x.active or x.trial_expires_at<>trial or x.paid_until<>t+interval '1 year' or x.bound_at is null then raise exception 'Entitlement preservation failed';end if;
 perform public.portal_roku_pix_apply((o->>'id')::uuid,'test-only-'||d::text,'completed',2490,2490);
 if (select paid_until from public.portal_roku_devices where id=d)<>t+interval '1 year' then raise exception 'Duplicate extension';end if;
 if public.portal_roku_license(d)->>'status'<>'blocked' then raise exception 'Blocked device unlocked';end if;
 update public.portal_roku_devices set active=true where id=d;
 if public.portal_roku_license(d)->>'status'<>'active' then raise exception 'License not active';end if;
 o2:=public.portal_roku_pix_apply((o->>'id')::uuid,'test-only-'||d::text,'pending',2490,0);
 if o2->>'status'<>'completed' then raise exception 'Status regressed';end if;
 o2:=public.portal_roku_pix_apply((o->>'id')::uuid,'test-only-'||d::text,'refunded',2490,0);
 if not (o2->>'review_required')::boolean then raise exception 'Refund review missing';end if;
 update public.portal_roku_devices set lifetime=true where id=d;
 begin perform public.portal_roku_pix_reserve(d,k,a);raise exception 'Expected lifetime rejection';exception when others then if sqlerrm<>'LIFETIME_DEVICE' then raise;end if;end;
 if has_table_privilege('anon','public.portal_roku_pix_orders','SELECT') or has_table_privilege('authenticated','public.portal_roku_pix_orders','UPDATE') or has_function_privilege('anon','public.portal_roku_pix_reserve(uuid,text,text)','EXECUTE') or has_function_privilege('authenticated','public.portal_roku_pix_apply(uuid,text,text,integer,integer)','EXECUTE') then raise exception 'Public access leaked';end if;
end $$;
select 'PASS: native reservation, duplicate/session protection, amount validation, annual accumulation, idempotent payment, blocked/trial preservation, refund review and service-only permissions; all synthetic records rolled back' as result;
rollback;
