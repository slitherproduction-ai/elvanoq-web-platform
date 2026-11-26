-- Roku identities are independent of the legacy device/identity tables.
create table public.portal_roku_devices (
 id uuid primary key default gen_random_uuid(),
 client_hash text not null unique check(client_hash ~ '^[a-f0-9]{64}$'),
 device_code text not null unique check(device_code ~ '^ROKU-[A-Z0-9]{8}-[A-Z0-9]{8}$'),
 key_hash text check(key_hash ~ '^[a-f0-9]{64}$'),
 platform text not null default 'roku' check(platform='roku'),
 display_name text not null check(length(display_name) between 1 and 100),
 reseller_id uuid references auth.users(id),active boolean not null default true,
 bound_at timestamptz, trial_started_at timestamptz, trial_expires_at timestamptz,
 paid_until timestamptz, paid_at timestamptz,lifetime boolean not null default false,
 server_code text references public.portal_server_codes(code),
 created_at timestamptz not null default now(),last_seen_at timestamptz not null default now()
);
create index portal_roku_reseller_idx on public.portal_roku_devices(reseller_id);
create table public.portal_roku_playlists (
 device_id uuid primary key references public.portal_roku_devices(id) on delete cascade,
 name text not null,kind text not null check(kind in ('m3u','xtream')),credentials jsonb not null,
 host_origin text not null,updated_at timestamptz not null default now()
);
create table public.portal_roku_events (
 id uuid primary key default gen_random_uuid(),device_id uuid not null references public.portal_roku_devices(id),
 actor uuid references auth.users(id),action text not null,reason text,created_at timestamptz not null default now()
);
create table public.portal_roku_payments (
 id uuid primary key default gen_random_uuid(),device_id uuid not null references public.portal_roku_devices(id),
 payment_reference text not null unique check(length(payment_reference) between 8 and 120),
 amount_cents integer not null check(amount_cents>0),confirmed_by uuid not null references auth.users(id),
 confirmed_at timestamptz not null default now(),license_until timestamptz not null
);
alter table public.portal_roku_devices enable row level security;
alter table public.portal_roku_playlists enable row level security;
alter table public.portal_roku_events enable row level security;
alter table public.portal_roku_payments enable row level security;
revoke all on public.portal_roku_devices,public.portal_roku_playlists,public.portal_roku_events,public.portal_roku_payments from public,anon,authenticated;
grant all on public.portal_roku_devices,public.portal_roku_playlists,public.portal_roku_events,public.portal_roku_payments to service_role;

create function public.portal_roku_license(p_id uuid) returns jsonb
language plpgsql stable security invoker set search_path=pg_catalog,public as $$
declare d public.portal_roku_devices;c public.portal_server_codes;s text;deadline timestamptz;source text:='individual';t timestamptz:=now();
begin
 select * into d from public.portal_roku_devices where id=p_id;
 if not found then raise exception 'ROKU_NOT_FOUND';end if;
 if not d.active then s:='blocked';
 elsif d.bound_at is null then s:='awaiting_activation';
 elsif d.server_code is not null then
  select * into c from public.portal_server_codes where code=d.server_code;
  if c.active and not c.revoked and (c.validity='lifetime' or c.expires_at>t) then
   source:='server_code';deadline:=case when c.validity='annual' then c.expires_at else null end;s:='active';
  elsif d.paid_until>t and d.paid_at>=coalesce(c.restricted_at,'-infinity'::timestamptz) then
   s:='active';deadline:=d.paid_until;source:='individual_renewal';
  else s:='expired';end if;
 elsif d.lifetime then s:='active';source:='lifetime';
 elsif d.paid_until>t then s:='active';deadline:=d.paid_until;
 elsif d.trial_expires_at>t then s:='active';deadline:=d.trial_expires_at;source:='trial';
 else s:='expired';deadline:=greatest(d.paid_until,d.trial_expires_at);end if;
 return jsonb_build_object('status',s,'can_play',s='active','payment_required',s='expired','expires_at',deadline,
 'lifetime',s='active' and deadline is null,'device_lifetime',d.lifetime,'access_source',source,
 'server_code',d.server_code,'trial_started_at',d.trial_started_at,'trial_expires_at',d.trial_expires_at,
 'paid_until',d.paid_until,'server_time',t,'remaining_seconds',case when deadline>t then floor(extract(epoch from deadline-t)) else 0 end);
end $$;

create function public.portal_roku_operation(p_operation text,p_client_hash text default null,p_code text default null,p_key_hash text default null,p_actor uuid default null,p_data jsonb default '{}'::jsonb) returns jsonb
language plpgsql security invoker set search_path=pg_catalog,public as $$
declare d public.portal_roku_devices; staff public.portal_staff; ref public.portal_roku_payments;
 lic jsonb;outcome jsonb;chosen text;n int;is_admin boolean:=false;deadline timestamptz;t timestamptz:=now();
begin
 if p_key_hash is not null and p_key_hash !~ '^[a-f0-9]{64}$' then raise exception 'ROKU_INVALID';end if;
 if p_actor is not null then
  select * into staff from public.portal_staff where user_id=p_actor and active and not must_change_password;
  if not found then raise exception 'ROKU_FORBIDDEN';end if;is_admin:=staff.role='admin';
 end if;
 if p_operation='register' then
  if p_client_hash is null or p_client_hash !~ '^[a-f0-9]{64}$' or p_code is null or p_code !~ '^ROKU-[A-Z0-9]{8}-[A-Z0-9]{8}$' or length(coalesce(p_data->>'name','')) not between 1 and 100 then raise exception 'ROKU_INVALID';end if;
  perform pg_advisory_xact_lock(hashtextextended('roku-client:'||p_client_hash,0));
  perform pg_advisory_xact_lock(hashtextextended('roku-code:'||p_code,0));
  select * into d from public.portal_roku_devices where client_hash=p_client_hash for update;
  if found then
   if d.device_code<>p_code then raise exception 'ROKU_CONFLICT';end if;
   if p_key_hash is not null and d.key_hash is not null and d.key_hash<>p_key_hash then raise exception 'ROKU_IDENTITY';end if;
   -- No blind overwrite of keys or device metadata. Matching ownership proof is required.
   if d.key_hash is null and p_key_hash is not null then
    update public.portal_roku_devices set key_hash=p_key_hash,display_name=p_data->>'name',last_seen_at=t where id=d.id;
   elsif p_key_hash=d.key_hash then
    update public.portal_roku_devices set display_name=p_data->>'name',last_seen_at=t where id=d.id;
   end if;
  else
   if exists(select 1 from public.portal_roku_devices where device_code=p_code) then raise exception 'ROKU_CONFLICT';end if;
   insert into public.portal_roku_devices(client_hash,device_code,key_hash,display_name) values(p_client_hash,p_code,p_key_hash,p_data->>'name') returning * into d;
  end if;
  return jsonb_build_object('registered',true,'deviceCode',p_code,'platform','roku','license',public.portal_roku_license(d.id),'requires_device_key',p_key_hash is null,'link_url','https://elvanoqplay.app/adicionar-lista/','message','Abra o Portal, selecione Roku e informe o código e a chave exibidos na TV.');
 end if;
 if p_client_hash is not null then
  select * into d from public.portal_roku_devices where client_hash=p_client_hash and device_code=p_code for update;
 elsif p_actor is not null and p_data ? 'id' then
  select * into d from public.portal_roku_devices where id=(p_data->>'id')::uuid for update;
 else select * into d from public.portal_roku_devices where device_code=p_code for update;end if;
 if not found then raise exception 'ROKU_IDENTITY';end if;
 if p_actor is not null and not is_admin and d.reseller_id is distinct from p_actor then raise exception 'ROKU_FORBIDDEN';end if;
 if p_operation not in ('status','admin') and p_actor is null and (p_key_hash is null or d.key_hash is distinct from p_key_hash) then raise exception 'ROKU_IDENTITY';end if;
 if p_operation='status' then
  if p_client_hash is null then raise exception 'ROKU_IDENTITY';end if;
  return jsonb_build_object('registered',true,'deviceCode',d.device_code,'platform','roku','active',d.active,'bound',d.bound_at is not null,'license',public.portal_roku_license(d.id),'sync_available',d.bound_at is not null and d.key_hash is not null,'message',case when d.bound_at is null then 'Aguardando vinculação no Portal.' else 'Consulte a licença para continuar.' end);
 elsif p_operation='sync' then
  if p_client_hash is null then raise exception 'ROKU_IDENTITY';end if;
  lic:=public.portal_roku_license(d.id);
  if (lic->>'can_play')::boolean then select jsonb_build_object('name',name,'kind',kind,'credentials',credentials,'updated_at',updated_at) into outcome from public.portal_roku_playlists where device_id=d.id;end if;
  update public.portal_roku_devices set last_seen_at=t where id=d.id;
  return jsonb_build_object('registered',true,'active',d.active,'deviceCode',d.device_code,'platform','roku','license',lic,'server_code',d.server_code,'playlist',outcome);
 elsif p_operation in ('bind','playlist') then
  if not d.active or d.key_hash is null or d.key_hash is distinct from p_key_hash then raise exception 'ROKU_IDENTITY';end if;
  if p_operation='playlist' then
   if p_data->>'kind' not in ('m3u','xtream') or length(coalesce(p_data->>'name','')) not between 1 and 100 or coalesce(p_data->>'origin','') !~ '^https?://[^/?#@[:space:]]+$' then raise exception 'ROKU_INVALID';end if;
   perform pg_advisory_xact_lock(hashtextextended('portal-host-registry',0));
   select count(*),min(code) into n,chosen from (select code from public.portal_server_codes where host=p_data->>'origin' union select code from public.portal_server_hosts where origin=p_data->>'origin') candidates;
   if n>1 then raise exception 'HOST_AMBIGUOUS';end if;
   insert into public.portal_roku_playlists(device_id,name,kind,credentials,host_origin) values(d.id,p_data->>'name',p_data->>'kind',p_data->'credentials',p_data->>'origin') on conflict(device_id) do update set name=excluded.name,kind=excluded.kind,credentials=excluded.credentials,host_origin=excluded.host_origin,updated_at=t;
   update public.portal_roku_devices set server_code=chosen where id=d.id;
  end if;
  -- First verified link starts the same seven-day trial once; subsequent saves never reset it.
  update public.portal_roku_devices set bound_at=coalesce(bound_at,t),trial_started_at=coalesce(trial_started_at,t),trial_expires_at=coalesce(trial_expires_at,t+interval '7 days') where id=d.id;
  return jsonb_build_object('linked',true,'deviceCode',d.device_code,'license',public.portal_roku_license(d.id),'message','Dispositivo Roku vinculado. Sincronize a lista no aplicativo.');
 elsif p_operation='admin' then
  if p_actor is null then raise exception 'ROKU_FORBIDDEN';end if;
  case p_data->>'operation'
  when 'update' then
   update public.portal_roku_devices set active=case when p_data ? 'active' then (p_data->>'active')::boolean else active end,display_name=coalesce(p_data->>'name',display_name) where id=d.id;
  when 'assign' then
   if not is_admin then raise exception 'ROKU_FORBIDDEN';end if;
   if p_data->>'reseller_id' is not null and not exists(select 1 from public.portal_staff where user_id=(p_data->>'reseller_id')::uuid and active and role='reseller') then raise exception 'ROKU_FORBIDDEN';end if;
   update public.portal_roku_devices set reseller_id=(p_data->>'reseller_id')::uuid where id=d.id;
  when 'rebind' then
   if not is_admin or p_key_hash is null or length(coalesce(p_data->>'reason','')) not between 5 and 500 then raise exception 'ROKU_FORBIDDEN';end if;
   update public.portal_roku_devices set key_hash=p_key_hash,active=case when p_data->>'restore'='true' then true else active end where id=d.id;
  when 'lifetime' then
   if not is_admin or jsonb_typeof(p_data->'lifetime')<>'boolean' or length(coalesce(p_data->>'reason','')) not between 5 and 500 then raise exception 'ROKU_FORBIDDEN';end if;
   update public.portal_roku_devices set lifetime=(p_data->>'lifetime')::boolean,bound_at=coalesce(bound_at,t) where id=d.id;
  when 'renew' then
   if not is_admin or length(coalesce(p_data->>'payment_reference','')) not between 8 and 120 or coalesce((p_data->>'amount_cents')::int,0)<=0 then raise exception 'ROKU_FORBIDDEN';end if;
   perform pg_advisory_xact_lock(hashtextextended('roku-receipt:'||(p_data->>'payment_reference'),0));
   select * into ref from public.portal_roku_payments where payment_reference=p_data->>'payment_reference';
   if found then
    if ref.device_id<>d.id or ref.amount_cents<>(p_data->>'amount_cents')::int then raise exception 'ROKU_CONFLICT';end if;
    return jsonb_build_object('duplicate',true,'license',public.portal_roku_license(d.id));
   end if;
   deadline:=greatest(t,coalesce(d.paid_until,t))+interval '1 year';
   insert into public.portal_roku_payments(device_id,payment_reference,amount_cents,confirmed_by,license_until) values(d.id,p_data->>'payment_reference',(p_data->>'amount_cents')::int,p_actor,deadline);
   update public.portal_roku_devices set paid_until=deadline,paid_at=t,bound_at=coalesce(bound_at,t) where id=d.id;
  else raise exception 'ROKU_INVALID';end case;
  insert into public.portal_roku_events(device_id,actor,action,reason) values(d.id,p_actor,p_data->>'operation',left(p_data->>'reason',500));
  return jsonb_build_object('message','Dispositivo Roku atualizado.','license',public.portal_roku_license(d.id));
 end if;
 raise exception 'ROKU_INVALID';
end $$;
revoke all on function public.portal_roku_license(uuid),public.portal_roku_operation(text,text,text,text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.portal_roku_license(uuid),public.portal_roku_operation(text,text,text,text,uuid,jsonb) to service_role;
