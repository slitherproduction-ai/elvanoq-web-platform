begin;
insert into public.tv_playback_events(platform,device_hash,server_host,event,event_id,session_id,incident_id,occurred_at,duration_ms)
values
('samsung-msx','diagnostic-test-only','diagnostic-test.invalid','session_start','test-start','test-session',null,now()-interval '1 minute',0),
('samsung-msx','diagnostic-test-only','diagnostic-test.invalid','session_playing','test-play','test-session',null,now()-interval '50 seconds',0),
('samsung-msx','diagnostic-test-only','diagnostic-test.invalid','stall','test-stall','test-session','test-incident',now()-interval '40 seconds',20000),
('samsung-msx','diagnostic-test-only','diagnostic-test.invalid','open_fail','test-retry','test-session','test-incident',now()-interval '35 seconds',1000),
('samsung-msx','diagnostic-test-only','diagnostic-test.invalid','recovered','test-recover','test-session','test-incident',now()-interval '30 seconds',30000),
('samsung-msx','diagnostic-test-only','diagnostic-test.invalid','watch_time','test-watch','test-session',null,now()-interval '20 seconds',60000),
('samsung-msx','diagnostic-test-only','diagnostic-test.invalid','buffering',null,null,null,now()-interval '10 seconds',3000);
insert into public.tv_playback_events(platform,device_hash,server_host,event,event_id,session_id,duration_ms)
values ('samsung-msx','diagnostic-test-only','diagnostic-test.invalid','watch_time','test-watch','test-session',60000)
on conflict(device_hash,event_id) do nothing;
do $$
declare s jsonb;
begin
s:=public.tv_playback_summary(24,null,'diagnostic-test.invalid');
if s#>>'{quality,incidents}' <> '1' or s#>>'{quality,recovered_incidents}' <> '1' or s#>>'{quality,sessions}' <> '1' or s#>>'{quality,playing_sessions}' <> '1' or s#>>'{quality,watched_ms}' <> '60000' or s#>>'{quality,legacy_events}' <> '1' then raise exception 'Invalid metrics %',s->'quality'; end if;
if has_function_privilege('anon','public.tv_playback_summary(integer,text,text)','execute') or has_function_privilege('authenticated','public.tv_playback_summary(integer,text,text)','execute') then raise exception 'Summary permissions'; end if;
end $$;
rollback;
select 'Correlation, deduplication, watch time, legacy separation and ACL tests passed; test rows rolled back' as result;