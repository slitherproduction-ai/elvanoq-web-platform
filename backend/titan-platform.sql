alter table public.portal_webos_devices drop constraint portal_webos_devices_platform_check;
alter table public.portal_webos_devices add constraint portal_webos_devices_platform_check check (platform in ('webos','samsung-msx','ios-msx','titan'));
create or replace function public.portal_titan_device_register(p_lgudid_hash text,p_key_hash text,p_app_version text)
returns jsonb language plpgsql security invoker set search_path=pg_catalog,public as $$
declare result jsonb; existing text;
begin
 if p_lgudid_hash is null or p_key_hash is null or p_lgudid_hash !~ '^[a-f0-9]{64}$' or p_key_hash !~ '^[a-f0-9]{64}$' then raise exception 'INVALID_CODE_DEVICE'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_lgudid_hash,0));
 select platform into existing from public.portal_webos_devices where lgudid_hash=p_lgudid_hash for update;
 if found and existing<>'titan' then raise exception 'DEVICE_BINDING_REQUIRED'; end if;
 select public.portal_webos_device_register(p_lgudid_hash,p_key_hash,p_app_version) into result;
 update public.portal_webos_devices set platform='titan' where lgudid_hash=p_lgudid_hash;
 update public.portal_managed_devices set platform='titan',display_name=case when display_name='LG webOS TV' then 'Titan OS TV' else display_name end where id=(result->>'device_id')::uuid;
 return result;
end $$;
revoke all on function public.portal_titan_device_register(text,text,text) from public,anon,authenticated;
grant execute on function public.portal_titan_device_register(text,text,text) to service_role;
