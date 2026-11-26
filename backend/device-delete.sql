create or replace function public.portal_device_archive(p_id uuid,p_actor uuid,p_remove boolean) returns jsonb language plpgsql security invoker set search_path=pg_catalog,public as $$
declare d public.portal_managed_devices;s public.portal_staff;
begin
 select * into s from public.portal_staff where user_id=p_actor and active and not must_change_password;
 if not found or p_remove is null then raise exception 'DEVICE_FORBIDDEN';end if;
 select * into d from public.portal_managed_devices where id=p_id;
 if not found or (s.role<>'admin' and d.reseller_id is distinct from p_actor) then raise exception 'DEVICE_FORBIDDEN';end if;
 perform pg_advisory_xact_lock(hashtextextended('playlist-device:'||d.mac,0));
 perform pg_advisory_xact_lock(hashtextextended('pix-device:'||d.mac,0));
 select * into d from public.portal_managed_devices where id=p_id for update;
 if not found or (s.role<>'admin' and d.reseller_id is distinct from p_actor) then raise exception 'DEVICE_FORBIDDEN';end if;
 if p_remove then
  delete from public.portal_code_device_grants where mac=d.mac;
  delete from public.portal_pix_orders where mac=d.mac;
  delete from public.portal_license_payments where mac=d.mac;
  delete from public.portal_license_audit where mac=d.mac;
  delete from public.portal_device_licenses where mac=d.mac;
  delete from public.portal_playlists where device_id=p_id;
  delete from public.portal_device_assignments where device_id=p_id or mac=d.mac;
  delete from public.portal_device_binding_events where device_id=p_id or mac=d.mac;
  delete from public.portal_device_events where device_id=p_id or mac=d.mac;
  delete from public.portal_managed_devices where id=p_id;
 else
  update public.portal_managed_devices set archived_at=null,active=true where id=p_id;
 end if;
 return jsonb_build_object('removed',p_remove,'permanent',p_remove);
end $$;
revoke all on function public.portal_device_archive(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.portal_device_archive(uuid,uuid,boolean) to service_role;
