begin;
do $$
declare a uuid;c text:='qa_'||substr(md5(gen_random_uuid()::text),1,20);did uuid;rid uuid;lgid uuid;result jsonb;k text:=repeat('a',64);ident text:=md5(gen_random_uuid()::text)||md5(gen_random_uuid()::text);m text;cnt bigint;
begin
 select user_id into a from public.portal_staff where role='admin' and active and not must_change_password limit 1;
 if a is null then raise exception 'Test needs existing admin (read-only actor)';end if;
 result:=public.portal_server_code_save_capacity(c,'https://'||c||'.invalid',true,a,'lifetime',false,false,2,true);
 assert (result->>'device_limit')::integer=2;
 assert (result->>'device_count')::integer=0;
 m:='02:'||upper(substr(ident,1,2)||':'||substr(ident,3,2)||':'||substr(ident,5,2)||':'||substr(ident,7,2)||':'||substr(ident,9,2));
 result:=public.portal_code_device_register(m,k,c,'Synthetic capacity Android','android','test');
 select id into did from public.portal_managed_devices where mac=m;
 -- Repeated login uses the same slot, including a full code.
 perform public.portal_code_device_register(m,k,c,'Synthetic capacity Android','android','test');
 perform public.portal_roku_operation('register',ident,'ROKU-'||upper(substr(ident,1,8))||'-'||upper(substr(ident,9,8)),k,null,'{"name":"Synthetic capacity Roku"}');
 select id into rid from public.portal_roku_devices where client_hash=ident;
 -- Exercise the actual Roku playlist path (matching registered host).
 perform public.portal_roku_operation('playlist',ident,'ROKU-'||upper(substr(ident,1,8))||'-'||upper(substr(ident,9,8)),k,null,jsonb_build_object('name','Synthetic playlist','kind','xtream','origin','https://'||c||'.invalid','credentials',jsonb_build_object('host','https://'||c||'.invalid','username','synthetic','password','synthetic')));
 assert (select device_count from public.portal_server_code_usage where code=c)=2;
 perform public.portal_code_device_register(m,k,c,'Synthetic capacity Android','android','test');
 assert public.portal_roku_server_code_link(rid,ident,c);
 assert (select device_count from public.portal_server_code_usage where code=c)=2;
 begin
  perform public.portal_roku_server_code_link(rid,repeat('f',64),c);
  raise exception 'Expected identity failure';
 exception when raise_exception then if SQLERRM<>'ROKU_IDENTITY' then raise;end if;end;
 update public.portal_roku_devices set active=false where id=rid;
 begin
  perform public.portal_roku_server_code_link(rid,ident,c);
  raise exception 'Expected blocked license failure';
 exception when raise_exception then if SQLERRM<>'ROKU_IDENTITY' then raise;end if;end;
 assert (select device_count from public.portal_server_code_usage where code=c)=2;
 insert into public.portal_managed_devices(mac,key_hash,display_name,platform) values('02:FF:'||upper(substr(ident,11,2)||':'||substr(ident,13,2)||':'||substr(ident,15,2)||':'||substr(ident,17,2)),k,'Synthetic capacity LG','webos') returning id into lgid;
 insert into public.portal_webos_devices(lgudid_hash,managed_device_id,device_key_hash) values(ident,lgid,k);
 begin
  update public.portal_managed_devices set server_code=c where id=lgid;
  raise exception 'Expected capacity failure';
 exception when raise_exception then if SQLERRM<>'SERVER_CODE_CAPACITY_REACHED' then raise;end if;end;
 assert (select server_code is null from public.portal_managed_devices where id=lgid);
 assert (select device_count from public.portal_server_code_usage where code=c)=2;
 -- Decrease below existing usage preserves existing links; old clients don't clear limit.
 perform public.portal_server_code_save_capacity(c,'https://'||c||'.invalid',true,a,'lifetime',false,false,1,true);
 perform public.portal_server_code_save_capacity(c,'https://'||c||'.invalid',true,a,'lifetime',false,false);
 assert (select device_limit from public.portal_server_codes where code=c)=1;
 perform public.portal_code_device_register(m,k,c,'Synthetic capacity Android','android','test');
 -- Detaching and permanent deletion release slots, then LG takes one shared slot.
 update public.portal_roku_devices set server_code=null where id=rid;
 delete from public.portal_managed_devices where id=did;
 assert (select device_count from public.portal_server_code_usage where code=c)=0;
 update public.portal_managed_devices set server_code=c where id=lgid;
 assert (select device_count from public.portal_server_code_usage where code=c)=1;
 update public.portal_managed_devices set archived_at=now() where id=lgid;
 assert (select device_count from public.portal_server_code_usage where code=c)=0;
 update public.portal_managed_devices set archived_at=null where id=lgid;
 assert (select device_count from public.portal_server_code_usage where code=c)=1;
 -- Unlimited explicitly configured by admin.
 perform public.portal_server_code_save_capacity(c,'https://'||c||'.invalid',true,a,'lifetime',false,false,null,true);
 update public.portal_roku_devices set server_code=c where id=rid;
 assert (select device_count from public.portal_server_code_usage where code=c)=2;
 begin
  perform public.portal_server_code_save_capacity(c,'https://'||c||'.invalid',true,a,'lifetime',false,false,0,true);
  raise exception 'Expected invalid limit';
 exception when raise_exception then if SQLERRM<>'INVALID_DEVICE_LIMIT' then raise;end if;end;
 begin
  perform public.portal_server_code_save_capacity(c,'https://'||c||'.invalid',true,gen_random_uuid(),'lifetime',false,false,500,true);
  raise exception 'Expected admin-only';
 exception when raise_exception then if SQLERRM<>'ADMIN_REQUIRED' then raise;end if;end;
 assert not has_table_privilege('anon','public.portal_server_code_usage','select');
 assert not has_table_privilege('authenticated','public.portal_server_code_usage','update');
 assert not has_function_privilege('authenticated','public.portal_server_code_save_capacity(text,text,boolean,uuid,text,boolean,boolean,integer,boolean)','execute');
end $$;
rollback;
