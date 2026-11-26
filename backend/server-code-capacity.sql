-- Existing codes remain unlimited. No device, license or playlist is rewritten.
lock table public.portal_managed_devices, public.portal_roku_devices, public.portal_server_codes in share row exclusive mode;
alter table public.portal_server_codes add column device_limit integer check (device_limit between 1 and 1000000);
create table public.portal_server_code_usage (
 code text primary key references public.portal_server_codes(code) on delete cascade,
 device_count bigint not null default 0 check (device_count >= 0),
 device_limit integer check (device_limit between 1 and 1000000)
);
alter table public.portal_server_code_usage enable row level security;
revoke all on public.portal_server_code_usage from public, anon, authenticated;
grant all on public.portal_server_code_usage to service_role;
insert into public.portal_server_code_usage(code,device_count,device_limit)
 select c.code,(select count(*) from public.portal_managed_devices d where d.server_code=c.code and d.archived_at is null)
 +(select count(*) from public.portal_roku_devices r where r.server_code=c.code),c.device_limit
 from public.portal_server_codes c;

create function public.portal_server_code_capacity_sync() returns trigger
language plpgsql security invoker set search_path=pg_catalog,public as $$
begin
 insert into public.portal_server_code_usage(code,device_limit) values(new.code,new.device_limit)
 on conflict(code) do update set device_limit=excluded.device_limit;
 return new;
end $$;
create trigger portal_server_code_capacity_sync after insert or update of device_limit on public.portal_server_codes
 for each row execute function public.portal_server_code_capacity_sync();

create function public.portal_device_capacity_track() returns trigger
language plpgsql security invoker set search_path=pg_catalog,public as $$
declare previous_code text;next_code text;
begin
 if TG_OP <> 'INSERT' then
  previous_code:=old.server_code;
  if TG_TABLE_NAME='portal_managed_devices' and to_jsonb(old)->>'archived_at' is not null then previous_code:=null;end if;
 end if;
 if TG_OP <> 'DELETE' then
  next_code:=new.server_code;
  if TG_TABLE_NAME='portal_managed_devices' and to_jsonb(new)->>'archived_at' is not null then next_code:=null;end if;
 end if;
 if previous_code is not distinct from next_code then return null;end if;
 -- Lock counters in a deterministic order for transfers between codes.
 perform 1 from public.portal_server_code_usage where code in (previous_code,next_code) order by code for update;
 if next_code is not null then
  -- Atomic conditional increment: concurrent enrollments cannot take the same slot.
  update public.portal_server_code_usage set device_count=device_count+1
   where code=next_code and (device_limit is null or device_count<device_limit);
  if not found then raise exception 'SERVER_CODE_CAPACITY_REACHED';end if;
 end if;
 if previous_code is not null then
  update public.portal_server_code_usage set device_count=device_count-1 where code=previous_code;
 end if;
 return null;
end $$;
create trigger portal_managed_capacity after insert or update of server_code,archived_at or delete on public.portal_managed_devices
 for each row execute function public.portal_device_capacity_track();
create trigger portal_roku_capacity after insert or update of server_code or delete on public.portal_roku_devices
 for each row execute function public.portal_device_capacity_track();

create function public.portal_server_code_save_capacity(p_code text,p_host text,p_active boolean,p_actor uuid,p_validity text,p_revoked boolean,p_renew boolean default false,p_device_limit integer default null,p_update_limit boolean default false)
 returns jsonb language plpgsql security invoker set search_path=pg_catalog,public as $$
declare result jsonb;
begin
 if not exists(select 1 from public.portal_staff where user_id=p_actor and role='admin' and active and not must_change_password) then raise exception 'ADMIN_REQUIRED';end if;
 if p_update_limit is null or (p_device_limit is not null and p_device_limit not between 1 and 1000000) then raise exception 'INVALID_DEVICE_LIMIT';end if;
 result:=public.portal_server_code_save_hosts(p_code,p_host,p_active,p_actor,p_validity,p_revoked,p_renew);
 if p_update_limit then
  update public.portal_server_codes set device_limit=p_device_limit where code=p_code;
 end if;
 return result||jsonb_build_object('device_limit',(select device_limit from public.portal_server_codes where code=p_code),'device_count',(select device_count from public.portal_server_code_usage where code=p_code));
end $$;
revoke all on function public.portal_server_code_capacity_sync(),public.portal_device_capacity_track(),public.portal_server_code_save_capacity(text,text,boolean,uuid,text,boolean,boolean,integer,boolean) from public,anon,authenticated;
grant execute on function public.portal_server_code_capacity_sync(),public.portal_device_capacity_track(),public.portal_server_code_save_capacity(text,text,boolean,uuid,text,boolean,boolean,integer,boolean) to service_role;
