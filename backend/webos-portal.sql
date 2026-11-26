create or replace function public.portal_device_rebind_platform(p_id uuid,p_actor uuid,p_key_hash text,p_reason text,p_restore boolean default false)
returns jsonb language plpgsql set search_path=pg_catalog,public as $$
declare result jsonb;
begin
 result:=public.portal_device_rebind(p_id,p_actor,p_key_hash,p_reason,p_restore);
 update public.portal_webos_devices set device_key_hash=p_key_hash where managed_device_id=p_id;
 return jsonb_build_object('rebound',true);
end $$;
revoke all on function public.portal_device_rebind_platform(uuid,uuid,text,text,boolean) from public,anon,authenticated;
grant execute on function public.portal_device_rebind_platform(uuid,uuid,text,text,boolean) to service_role;
