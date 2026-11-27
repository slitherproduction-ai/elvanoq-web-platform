-- Additive diagnostics v2. Legacy TV clients remain accepted; no licensing changes.
alter table public.tv_playback_events
  add column if not exists event_id text,
  add column if not exists session_id text,
  add column if not exists incident_id text,
  add column if not exists occurred_at timestamptz,
  add column if not exists phase text,
  add column if not exists media_error integer,
  add column if not exists buffer_ms integer,
  add column if not exists ready_state integer,
  add column if not exists network_state integer,
  add column if not exists engine text,
  add column if not exists device_model text;
alter table public.tv_playback_events drop constraint tv_playback_events_event_check;
alter table public.tv_playback_events add constraint tv_playback_events_event_check check
  (event in ('open_fail','stall','recovered','fatal','format_switch','source_switch','buffering','session_start','session_playing','session_end','watch_time'));
create unique index if not exists tv_playback_events_event_dedupe_idx on public.tv_playback_events(device_hash,event_id);
create index if not exists tv_playback_events_occurred_idx on public.tv_playback_events((coalesce(occurred_at,created_at)) desc);
CREATE OR REPLACE FUNCTION public.tv_playback_summary(p_hours integer DEFAULT 24, p_platform text DEFAULT NULL::text, p_host text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with e as (
    select id, coalesce(occurred_at, created_at) as created_at, created_at as received_at,
      platform, app_version, device_hash, server_host, channel_id, channel_name, content_type, stream_format,
      event, duration_ms, attempt, detail, session_id, incident_id, event_id, phase, media_error, buffer_ms,
      ready_state, network_state, engine, device_model from public.tv_playback_events
    where coalesce(occurred_at, created_at) >= now() - make_interval(hours => greatest(1, least(coalesce(p_hours, 24), 168)))
      and (p_platform is null or platform = p_platform)
      and (p_host is null or server_host = p_host)
  ), incidents as (
    select platform, device_hash, session_id, incident_id,
      min(created_at) filter (where event in ('stall','open_fail','fatal')) as failed_at,
      min(created_at) filter (where event='recovered') as recovered_at,
      bool_or(event='fatal') as fatal
    from e where session_id is not null and incident_id is not null and device_hash <> ''
    group by 1,2,3,4
  )
  select jsonb_build_object(
    'quality', jsonb_build_object(
      'incidents', (select count(*) from incidents where failed_at is not null),
      'recovered_incidents', (select count(*) from incidents where failed_at is not null and recovered_at >= failed_at and not fatal),
      'sessions', (select count(distinct (platform,device_hash,session_id)) from e where event='session_start' and session_id is not null and device_hash <> ''),
      'playing_sessions', (select count(distinct (platform,device_hash,session_id)) from e where event='session_playing' and session_id is not null and device_hash <> ''),
      'watched_ms', (select coalesce(sum(duration_ms),0) from e where event in ('watch_time','session_end') and session_id is not null),
      'legacy_events', (select count(*) from e where session_id is null),
      'affected_devices', (select count(distinct nullif(device_hash,'')) from e where event in ('stall','open_fail','fatal','buffering'))
    ),
    'hours', greatest(1, least(coalesce(p_hours, 24), 168)),
    'totals', coalesce((select jsonb_object_agg(event, n) from (select event, count(*) n from e group by event) t), '{}'::jsonb),
    'devices', (select count(distinct nullif(device_hash,'')) from e),
    'by_platform', coalesce((select jsonb_agg(t order by t.problems desc) from (
        select platform, count(*) filter (where event in ('stall','open_fail','fatal')) problems,
               count(*) filter (where event = 'buffering') buffering, round(avg(duration_ms) filter (where event = 'buffering'))::int avg_buffering_ms,
               count(*) filter (where event = 'stall') stalls, count(*) filter (where event = 'open_fail') open_fails,
               count(*) filter (where event = 'fatal') fatals, count(distinct nullif(device_hash,'')) devices
        from e group by platform) t), '[]'::jsonb),
    'by_server', coalesce((select jsonb_agg(t order by t.problems desc, t.buffering desc) from (
        select server_host, count(*) filter (where event in ('stall','open_fail','fatal')) problems,
               count(*) filter (where event = 'buffering') buffering, round(avg(duration_ms) filter (where event = 'buffering'))::int avg_buffering_ms,
               count(*) filter (where event = 'stall') stalls, count(*) filter (where event = 'open_fail') open_fails,
               count(*) filter (where event = 'fatal') fatals, count(*) filter (where event = 'recovered') recovered,
               count(distinct nullif(device_hash,'')) devices, round(avg(duration_ms) filter (where event = 'recovered'))::int avg_recover_ms
        from e group by server_host order by 2 desc, 3 desc limit 30) t), '[]'::jsonb),
    'by_hour', coalesce((select jsonb_agg(t order by t.hour) from (
        select date_trunc('hour', created_at) as hour, count(*) filter (where event in ('stall','open_fail','fatal')) problems,
               count(*) filter (where event = 'buffering') buffering, count(distinct nullif(device_hash,'')) devices
        from e group by 1) t), '[]'::jsonb),
    'by_version', coalesce((select jsonb_agg(t order by t.problems desc) from (
        select platform, app_version, count(*) filter (where event in ('stall','open_fail','fatal')) problems,
               count(*) filter (where event = 'buffering') buffering, count(distinct nullif(device_hash,'')) devices
        from e group by 1, 2) t), '[]'::jsonb),
    'by_format', coalesce((select jsonb_agg(t order by t.problems desc) from (
        select stream_format, count(*) filter (where event in ('stall','open_fail','fatal')) problems,
               count(*) filter (where event = 'buffering') buffering from e group by 1) t), '[]'::jsonb),
    'top_channels', coalesce((select jsonb_agg(t order by t.problems desc) from (
        select server_host, channel_name, count(*) problems, count(distinct nullif(device_hash,'')) devices
        from e where event in ('stall','open_fail','fatal','buffering') and channel_name <> ''
        group by 1, 2 order by 3 desc limit 20) t), '[]'::jsonb),
    'recent', coalesce((select jsonb_agg(t) from (
        select created_at, received_at, platform, app_version, server_host, channel_name, content_type, stream_format, event, duration_ms, attempt, detail, session_id, incident_id, phase, media_error, buffer_ms, ready_state, network_state, engine, device_model,
               left(device_hash, 8) as device
        from e where event not in ('session_start','session_playing','session_end','watch_time') order by created_at desc, id desc limit 200) t), '[]'::jsonb)
  );
$function$;

revoke all on function public.tv_playback_summary(integer,text,text) from public,anon,authenticated;
grant execute on function public.tv_playback_summary(integer,text,text) to service_role;
