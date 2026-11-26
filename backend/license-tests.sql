begin;
do $$
declare a uuid; first_status jsonb; result jsonb; original_start text; until_one text; n integer:=0;
begin
 select user_id into a from public.portal_staff where role='admin' and active limit 1;
 if a is null then raise exception 'Test requires configured admin'; end if;
 insert into public.portal_managed_devices(mac,key_hash,display_name) values('02:CA:FE:71:00:01','qa-only','QA trial transaction'),('02:CA:FE:71:00:02','qa-only','QA receipt transaction');
 result:=public.portal_license_status('02:CA:FE:71:00:01');
 assert result->>'status'='not_activated' and not (result->>'can_play')::boolean,'registration must not start trial'; n:=n+1;
 first_status:=public.portal_license_activate('02:CA:FE:71:00:01');
 assert first_status->>'status'='trial' and (first_status->>'can_play')::boolean,'activation grants trial'; n:=n+1;
 assert (first_status->>'trial_expires_at')::timestamptz-(first_status->>'trial_started_at')::timestamptz=interval '168 hours','exact 7 days'; n:=n+1;
 original_start:=first_status->>'trial_started_at';
 result:=public.portal_license_activate('02:CA:FE:71:00:01');
 assert result->>'trial_started_at'=original_start,'activation idempotency'; n:=n+1;
 delete from public.portal_managed_devices where mac='02:CA:FE:71:00:01';
 insert into public.portal_managed_devices(mac,key_hash,display_name) values('02:CA:FE:71:00:01','new-key','QA re-registration transaction');
 result:=public.portal_license_activate('02:CA:FE:71:00:01');
 assert result->>'trial_started_at'=original_start,'recreate must not reset trial'; n:=n+1;
 update public.portal_device_licenses set trial_started_at=now()-interval '168 hours',trial_expires_at=now() where mac='02:CA:FE:71:00:01';
 result:=public.portal_license_status('02:CA:FE:71:00:01');
 assert result->>'status'='expired' and not (result->>'can_play')::boolean and (result->>'payment_required')::boolean,'exact expiration boundary'; n:=n+1;
 result:=public.portal_license_activate('02:CA:FE:71:00:01');
 assert result->>'status'='expired','expired activation cannot restart trial'; n:=n+1;
 begin
  perform public.portal_license_confirm_payment('02:CA:FE:71:00:01','qa-no-admin',2490,gen_random_uuid());
  raise exception 'Unauthorized payment accepted';
 exception when others then if sqlerrm<>'ADMIN_REQUIRED' then raise; end if; end; n:=n+1;
 result:=public.portal_license_confirm_payment('02:CA:FE:71:00:01','qa-receipt-001',2490,a);
 assert result->>'status'='licensed' and (result->>'can_play')::boolean and not (result->>'duplicate')::boolean,'confirmed payment unlocks'; n:=n+1;
 until_one:=result->>'paid_until';
 assert (until_one)::timestamptz > now()+interval '364 days' and (until_one)::timestamptz < now()+interval '367 days','one calendar year'; n:=n+1;
 result:=public.portal_license_confirm_payment('02:CA:FE:71:00:01','qa-receipt-001',2490,a);
 assert (result->>'duplicate')::boolean and result->>'paid_until'=until_one,'duplicate payment cannot extend'; n:=n+1;
 begin
  perform public.portal_license_confirm_payment('02:CA:FE:71:00:02','qa-receipt-001',2490,a);
  raise exception 'Receipt reused';
 exception when others then if sqlerrm<>'PAYMENT_REFERENCE_CONFLICT' then raise; end if; end; n:=n+1;
 result:=public.portal_license_confirm_payment('02:CA:FE:71:00:01','qa-receipt-002',2490,a);
 assert (result->>'paid_until')::timestamptz=(until_one)::timestamptz+interval '1 year','renewal preserves remaining term'; n:=n+1;
 update public.portal_managed_devices set active=false where mac='02:CA:FE:71:00:01';
 result:=public.portal_license_status('02:CA:FE:71:00:01');
 assert result->>'status'='suspended' and not (result->>'can_play')::boolean,'suspension overrides payment'; n:=n+1;
 assert not has_function_privilege('anon','public.portal_license_activate(text)','execute') and not has_function_privilege('authenticated','public.portal_license_confirm_payment(text,text,integer,uuid)','execute'),'RPCs are private'; n:=n+1;
 assert not has_table_privilege('anon','public.portal_device_licenses','select') and not has_table_privilege('authenticated','public.portal_license_payments','insert'),'tables private'; n:=n+1;
 raise notice 'Passed % transactional licensing checks; all QA records rolled back',n;
end $$;
rollback;
select '16 licensing checks passed; QA transaction rolled back' as result;
