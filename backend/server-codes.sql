create table public.portal_server_codes (
 code text primary key check(code ~ '^[a-z0-9][a-z0-9_-]{2,31}$'),
 host text not null,active boolean not null default true,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 updated_by uuid not null references auth.users(id)
);
create table public.portal_server_code_events (
 id uuid primary key default gen_random_uuid(),code text not null,actor uuid not null references auth.users(id),
 previous_host text,host text not null,previous_active boolean,active boolean not null,created_at timestamptz not null default now()
);
alter table public.portal_server_codes enable row level security;
alter table public.portal_server_code_events enable row level security;
revoke all on public.portal_server_codes,public.portal_server_code_events from anon,authenticated;
grant select,insert,update on public.portal_server_codes to service_role;
grant select,insert on public.portal_server_code_events to service_role;
create function public.portal_server_code_save(p_code text,p_host text,p_active boolean,p_actor uuid) returns jsonb
language plpgsql security invoker set search_path=pg_catalog,public as $$
declare previous public.portal_server_codes; saved public.portal_server_codes;
begin
 if not exists(select 1 from public.portal_staff where user_id=p_actor and role='admin' and active and not must_change_password) then raise exception 'SERVER_CODE_FORBIDDEN';end if;
 if p_code is null or p_code !~ '^[a-z0-9][a-z0-9_-]{2,31}$' or p_host is null or p_host !~ '^https?://[^/?#@[:space:]]+$' or length(p_host)>2048 or p_active is null then raise exception 'INVALID_SERVER_CODE';end if;
 perform pg_advisory_xact_lock(hashtextextended('server-code:'||p_code,0));
 select * into previous from public.portal_server_codes where code=p_code for update;
 insert into public.portal_server_codes(code,host,active,updated_by) values(p_code,p_host,p_active,p_actor)
 on conflict(code) do update set host=excluded.host,active=excluded.active,updated_by=excluded.updated_by,updated_at=now() returning * into saved;
 if previous.code is null or previous.host is distinct from p_host or previous.active is distinct from p_active then
 insert into public.portal_server_code_events(code,actor,previous_host,host,previous_active,active) values(p_code,p_actor,previous.host,p_host,previous.active,p_active);
 end if;
 return to_jsonb(saved);
end $$;
revoke execute on function public.portal_server_code_save(text,text,boolean,uuid) from public,anon,authenticated;
grant execute on function public.portal_server_code_save(text,text,boolean,uuid) to service_role;
