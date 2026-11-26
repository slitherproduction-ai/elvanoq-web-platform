begin;
do $$
declare actor uuid;m text:='02:FE:ED:DA:00:91';r jsonb;denied boolean:=false;old_url text;
begin
 select user_id into actor from public.portal_staff where role='admin' and active and not must_change_password limit 1;
 insert into public.portal_server_codes(code,host,active,updated_by,validity,expires_at) values('qa-m3u-a','http://qa-m3u.invalid:8080',true,actor,'annual',now()+interval '1 year'),('qa-m3u-b','http://qa-blocked.invalid',true,actor,'annual',now()-interval '1 day');
 r:=public.portal_playlist_register_host(m,repeat('a',64),true,'QA list','m3u',jsonb_build_object('url','http://qa-m3u.invalid:8080/get.php?username=test&password=test'),'http://qa-m3u.invalid:8080',null);
 if r->>'server_code'<>'qa-m3u-a' or not (r->'license'->>'can_play')::boolean or r->'license'->>'status'<>'licensed' or exists(select 1 from public.portal_device_licenses where mac=m) then raise exception 'annual matching started trial or denied';end if;
 update public.portal_server_codes set validity='lifetime',expires_at=null where code='qa-m3u-a';
 r:=public.portal_effective_license(m);if r->>'status'<>'lifetime' then raise exception 'lifetime mismatch';end if;
 perform public.portal_server_alias_save('qa-m3u-a','https://qa-alias.invalid',actor,false);
 r:=public.portal_playlist_register_host(m,repeat('a',64),true,'QA alias','m3u',jsonb_build_object('url','https://qa-alias.invalid/list.m3u'),'https://qa-alias.invalid',null);
 if r->>'server_code'<>'qa-m3u-a' or not (r->'license'->>'can_play')::boolean then raise exception 'alias did not match';end if;
 begin perform public.portal_server_alias_save('qa-m3u-a','http://qa-blocked.invalid',actor,false);exception when others then if sqlerrm='HOST_IN_USE' then denied:=true;else raise;end if;end;
 if not denied then raise exception 'cross-code alias accepted';end if;denied:=false;
 begin perform public.portal_server_alias_save('qa-m3u-a','https://qa-noauth.invalid',null,false);exception when others then if sqlerrm='ADMIN_REQUIRED' then denied:=true;else raise;end if;end;
 if not denied then raise exception 'unauthorized alias';end if;denied:=false;
 begin perform public.portal_playlist_register_host(m,repeat('b',64),true,'QA attack','m3u',jsonb_build_object('url','https://qa-alias.invalid/list.m3u'),'https://qa-alias.invalid',null);exception when others then if sqlerrm='PLAYLIST_KEY_REQUIRED' then denied:=true;else raise;end if;end;
 if not denied then raise exception 'wrong key accepted';end if;
 r:=public.portal_playlist_register_host(m,repeat('a',64),true,'QA expired','m3u',jsonb_build_object('url','http://qa-blocked.invalid/list'),'http://qa-blocked.invalid',null);
 if r->>'server_code'<>'qa-m3u-b' or (r->'license'->>'can_play')::boolean or not (r->'license'->>'payment_required')::boolean then raise exception 'expired host escaped restriction';end if;
 r:=public.portal_playlist_register_host(m,repeat('a',64),true,'QA unregistered','m3u',jsonb_build_object('url','http://qa-m3u.invalid.evil:8080/list'),'http://qa-m3u.invalid.evil:8080',null);
 if r->>'server_code' is not null or r->>'host_match'<>'unregistered' or r->'license'->>'status'<>'not_activated' then raise exception 'similar host matched';end if;
 perform public.portal_license_confirm_payment(m,'qa-m3u-base-license-reference',2490,actor);
 r:=public.portal_playlist_register_host(m,repeat('a',64),true,'QA paid','m3u',jsonb_build_object('url','https://qa-other.invalid/list'),'https://qa-other.invalid',null);
 if not (r->'license'->>'can_play')::boolean or r->'license'->>'status'<>'licensed' then raise exception 'individual paid license lost';end if;
 -- Corrupt/legacy duplicate configuration must not pick an arbitrary code.
 insert into public.portal_server_codes(code,host,active,updated_by,validity) values('qa-m3u-duplicate','http://qa-m3u.invalid:8080',true,actor,'lifetime');
 denied:=false;
 begin perform public.portal_playlist_register_host(m,repeat('a',64),true,'QA ambiguous','m3u',jsonb_build_object('url','http://qa-m3u.invalid:8080/list'),'http://qa-m3u.invalid:8080',null);exception when others then if sqlerrm='HOST_AMBIGUOUS' then denied:=true;else raise;end if;end;
 if not denied then raise exception 'ambiguous host accepted';end if;
 if (select credentials->>'url' from public.portal_playlists where device_id=(select id from public.portal_managed_devices where mac=m))<>'https://qa-other.invalid/list' then raise exception 'failed operation changed saved playlist';end if;
end $$;
rollback;
