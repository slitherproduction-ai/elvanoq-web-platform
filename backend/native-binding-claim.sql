-- Service-only completion of an administrator-requested reset.
-- All existing credentials, licenses, trials, status and lists are preserved except the pending key hash.
create or replace function public.portal_native_binding_claim(p_platform text,p_identity text,p_key_hash text,p_device_code text default null)
returns boolean language plpgsql security invoker set search_path=pg_catalog,public as $$
declare d public.portal_managed_devices; w public.portal_webos_devices; r public.portal_roku_devices; pending text:=repeat('0',64);
begin
 if p_key_hash is null or p_key_hash !~ '^[a-f0-9]{64}$' or p_key_hash=pending then return false;end if;
 if p_platform='webos' then
  if p_identity is null or p_identity !~ '^[a-f0-9]{64}$' then return false;end if;
  select * into w from public.portal_webos_devices where lgudid_hash=p_identity;
  if not found then return false;end if;
  -- Same lock order as reset: managed device, then native mapping.
  select * into d from public.portal_managed_devices where id=w.managed_device_id for update;
  if not found or not d.active then return false;end if;
  select * into w from public.portal_webos_devices where lgudid_hash=p_identity and managed_device_id=d.id for update;
  if not found then return false;end if;
  if w.device_key_hash=pending and d.key_hash=pending then
   update public.portal_managed_devices set key_hash=p_key_hash where id=d.id;
   update public.portal_webos_devices set device_key_hash=p_key_hash where lgudid_hash=p_identity;
   return true;
  end if;
  return w.device_key_hash=p_key_hash and d.key_hash=p_key_hash;
 elsif p_platform='roku' then
  if p_identity is null or p_identity !~ '^[a-f0-9]{64}$' or p_device_code is null or p_device_code !~ '^ROKU-[A-Z0-9]{8}-[A-Z0-9]{8}$' then return false;end if;
  select * into r from public.portal_roku_devices where client_hash=p_identity and device_code=p_device_code for update;
  if not found or not r.active then return false;end if;
  if r.key_hash=pending then update public.portal_roku_devices set key_hash=p_key_hash where id=r.id;return true;end if;
  return coalesce(r.key_hash=p_key_hash,false);
 end if;
 return false;
end $$;
revoke all on function public.portal_native_binding_claim(text,text,text,text) from public,anon,authenticated;
grant execute on function public.portal_native_binding_claim(text,text,text,text) to service_role;
