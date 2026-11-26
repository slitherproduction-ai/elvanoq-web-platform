create table if not exists public.portal_request_limits(bucket text primary key,window_started timestamptz not null,attempts integer not null);
alter table public.portal_request_limits enable row level security;
revoke all on public.portal_request_limits from public,anon,authenticated;
grant all on public.portal_request_limits to service_role;
create or replace function public.portal_rate_limit(p_bucket text,p_limit integer,p_seconds integer) returns boolean language plpgsql security invoker set search_path=pg_catalog,public as $$
declare n integer;t timestamptz:=clock_timestamp();
begin
 if p_bucket is null or length(p_bucket)<>64 or p_bucket !~ '^[0-9a-f]{64}$' or p_limit not between 1 and 10000 or p_seconds not between 1 and 86400 then raise exception 'INVALID_RATE_LIMIT';end if;
 insert into public.portal_request_limits(bucket,window_started,attempts) values(p_bucket,t,1)
 on conflict(bucket) do update set attempts=case when portal_request_limits.window_started<=t-make_interval(secs=>p_seconds) then 1 else least(portal_request_limits.attempts+1,p_limit+1) end,window_started=case when portal_request_limits.window_started<=t-make_interval(secs=>p_seconds) then t else portal_request_limits.window_started end returning attempts into n;
 delete from public.portal_request_limits where window_started<t-interval '1 day';
 return n<=p_limit;
end $$;
revoke all on function public.portal_rate_limit(text,integer,integer) from public,anon,authenticated;
grant execute on function public.portal_rate_limit(text,integer,integer) to service_role;
