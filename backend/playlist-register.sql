create function public.portal_playlist_register(p_mac text,p_key_hash text,p_supplied_key boolean,p_name text,p_kind text,p_credentials jsonb,p_actor uuid default null) returns jsonb
language plpgsql security invoker set search_path=pg_catalog,public as $$
declare d public.portal_managed_devices; staff public.portal_staff; created boolean:=false;
begin
 if p_mac is null or p_mac !~ '^([0-9A-F]{2}:){5}[0-9A-F]{2}$' or p_key_hash is null or p_key_hash !~ '^[0-9a-f]{64}$' or p_name is null or length(p_name) not between 1 and 100 or p_kind is null or p_kind not in ('m3u','xtream') or jsonb_typeof(p_credentials) is distinct from 'object' then raise exception 'INVALID_PLAYLIST';end if;
 if p_actor is not null then
  select * into staff from public.portal_staff where user_id=p_actor and active;
  if not found then raise exception 'PLAYLIST_FORBIDDEN';end if;
 end if;
 -- Serialize first registration and concurrent submissions for this MAC.
 perform pg_advisory_xact_lock(hashtextextended('playlist-device:'||p_mac,0));
 select * into d from public.portal_managed_devices where mac=p_mac for update;
 if not found then
  insert into public.portal_managed_devices(mac,key_hash,display_name,reseller_id)
  values(p_mac,p_key_hash,'Dispositivo '||p_mac,case when staff.role='reseller' then p_actor else null end)
  on conflict(mac) do nothing returning * into d;
  if found then created:=true;
  else select * into d from public.portal_managed_devices where mac=p_mac for update;end if;
 end if;
 if not d.active then raise exception 'PLAYLIST_DEVICE_DISABLED';end if;
 if not created and not coalesce((p_supplied_key and d.key_hash=p_key_hash) or (staff.active and (staff.role='admin' or d.reseller_id=p_actor)),false) then raise exception 'PLAYLIST_KEY_REQUIRED';end if;
 insert into public.portal_playlists(device_id,name,kind,credentials) values(d.id,p_name,p_kind,p_credentials)
 on conflict(device_id) do update set name=excluded.name,kind=excluded.kind,credentials=excluded.credentials,updated_at=now();
 return jsonb_build_object('created',created,'device_id',d.id);
end $$;
revoke execute on function public.portal_playlist_register(text,text,boolean,text,text,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.portal_playlist_register(text,text,boolean,text,text,jsonb,uuid) to service_role;
