-- Samsung via Media Station X reuses the webOS identity contract, but keeps
-- its platform explicit so the Portal can display SM- rather than LG- codes.
alter table public.portal_webos_devices
  add column if not exists platform text not null default 'webos';

alter table public.portal_webos_devices
  drop constraint if exists portal_webos_devices_platform_check;

alter table public.portal_webos_devices
  add constraint portal_webos_devices_platform_check
  check (platform in ('webos','samsung-msx'));

-- Preserve the existing three-argument RPC for LG callers. The four-argument
-- overload delegates all registration/licensing work to it, then records the
-- requested display platform in the same database transaction.
create or replace function public.portal_webos_device_register(
  p_lgudid_hash text,
  p_key_hash text,
  p_app_version text,
  p_platform text
)
returns jsonb language plpgsql security definer set search_path=public as $$
declare result jsonb;
begin
  select public.portal_webos_device_register(p_lgudid_hash,p_key_hash,p_app_version) into result;
  update public.portal_webos_devices
     set platform=case when p_platform='samsung-msx' then 'samsung-msx' else 'webos' end
   where lgudid_hash=p_lgudid_hash;
  return result;
end $$;

revoke all on function public.portal_webos_device_register(text,text,text,text) from public;
revoke all on function public.portal_webos_device_register(text,text,text,text) from anon;
revoke all on function public.portal_webos_device_register(text,text,text,text) from authenticated;
grant execute on function public.portal_webos_device_register(text,text,text,text) to service_role;
