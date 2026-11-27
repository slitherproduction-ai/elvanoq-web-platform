-- Diagnóstico de reprodução: tempo assistido (watched_ms) por plataforma, servidor e versão,
-- para o Portal mostrar "problemas por hora assistida". Só acrescenta campos ao JSON.
-- Aplica a troca na definição atual da função (sem reescrevê-la) e falha se algum trecho não for achado.
do $mig$
declare
  d text := pg_get_functiondef('public.tv_playback_summary(integer,text,text)'::regprocedure);
  w constant text := ', coalesce(sum(duration_ms) filter (where event in (''watch_time'',''session_end'')),0)::bigint watched_ms';
  before text;
begin
  if position(w in d) > 0 then return; end if; -- já aplicada
  before := d;
  d := replace(d, E'count(distinct nullif(device_hash,\'\')) devices\n        from e group by platform', E'count(distinct nullif(device_hash,\'\')) devices' || w || E'\n        from e group by platform');
  if d = before then raise exception 'by_platform não encontrado'; end if;
  before := d;
  d := replace(d, E'::int avg_recover_ms\n        from e group by server_host', E'::int avg_recover_ms' || w || E'\n        from e group by server_host');
  if d = before then raise exception 'by_server não encontrado'; end if;
  before := d;
  d := replace(d, E'count(distinct nullif(device_hash,\'\')) devices\n        from e group by 1, 2) t)', E'count(distinct nullif(device_hash,\'\')) devices' || w || E'\n        from e group by 1, 2) t)');
  if d = before then raise exception 'by_version não encontrado'; end if;
  execute d;
end
$mig$;
