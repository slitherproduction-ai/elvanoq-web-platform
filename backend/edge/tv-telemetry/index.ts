// Diagnóstico anônimo de reprodução das versões de TV do ELVANOQ Play.
// POST {action:'report', platform, app_version, device_code, events:[...]}  (apps de TV, sem login)
// POST {action:'summary', hours, platform?, server_host?} com Authorization: Bearer <sessão do Portal> (só admin)
// Nunca grava usuário, senha nem caminho da lista: só o host do servidor (sem credenciais), o código da TV
// em hash e o que aconteceu com o vídeo. Os registros são apagados depois de 7 dias (pg_cron).
const base = Deno.env.get('SUPABASE_URL')!;
const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const portalOrigins = new Set(['https://elvanoq-play-portal.slitherproduction.chatgpt.site', 'https://elvanoqplay.app', 'https://titan.elvanoqplay.app', 'http://terminal.local:4173']);
const PLATFORMS = new Set(['roku', 'lg-webos', 'lg-msx', 'samsung-msx', 'samsung-tizen', 'whale']);
const EVENTS = new Set(['open_fail', 'stall', 'recovered', 'fatal', 'format_switch', 'source_switch', 'buffering', 'session_start', 'session_playing', 'session_end', 'watch_time']);
const TYPES = new Set(['live', 'movie', 'episode', 'catchup', 'other']);
const FORMATS = new Set(['hls', 'ts', 'mp4', 'mkv', 'other']);

class ApiError extends Error { constructor(public status: number, message: string) { super(message); } }

function corsHeaders(req: Request) {
  const origin = req.headers.get('origin') || '';
  // Os apps de TV rodam em origens variadas (file://, domínios do MSX, Roku sem CORS):
  // o envio de eventos aceita qualquer origem; o resumo só responde ao Portal.
  return {
    'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Vary': 'Origin',
    'Access-Control-Allow-Origin': portalOrigins.has(origin) ? origin : '*',
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };
}

async function db(path: string, method = 'GET', body?: unknown) {
  const r = await fetch(base + '/rest/v1/' + path, {
    method,
    headers: { apikey: service, Authorization: 'Bearer ' + service, 'Content-Type': 'application/json', Prefer: 'return=minimal,resolution=ignore-duplicates' },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  if (!r.ok) throw new ApiError(502, 'Falha no banco: ' + (await r.text()).slice(0, 200));
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}

async function sha256(text: string) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function clip(v: unknown, max: number) { return String(v ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max); }

// Só o host[:porta] do servidor, nunca usuário/senha nem caminho.
function hostOnly(v: unknown) {
  const raw = clip(v, 300);
  if (!raw) return '';
  try { const u = new URL(/^[a-z]+:\/\//i.test(raw) ? raw : 'http://' + raw); return u.host.toLowerCase().slice(0, 120); }
  catch { return ''; }
}

function int(v: unknown, min: number, max: number) {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : 0;
}

// Only structured diagnostics: no raw browser messages, URLs or credentials.
function identifier(v: unknown) { const s = String(v ?? ''); return /^[a-zA-Z0-9_-]{8,80}$/.test(s) ? s : null; }
function nullableInt(v: unknown, max: number) { return v == null || !Number.isFinite(Number(v)) ? null : int(v, 0, max); }
function occurredAt(v: unknown) {
  const now = Date.now(), at = Date.parse(String(v ?? ''));
  return Number.isFinite(at) && at >= now - 7 * 86400000 && at <= now + 300000 ? new Date(at).toISOString() : null;
}
function safeDetail(v: unknown) {
  return clip(v, 500).replace(/https?:\/\/[^\s]+/gi, '[url removida]').replace(/(?:password|passwd|token|username|authorization|senha)\s*[=:]\s*[^\s,;]+/gi, '[credencial removida]').slice(0,120);
}

async function report(b: any) {
  const platform = clip(b.platform, 20);
  if (!PLATFORMS.has(platform)) throw new ApiError(400, 'Plataforma inválida.');
  const code = clip(b.device_code, 80);
  const device = code ? (await sha256('elvanoq-tv-diagnostico:' + code.toUpperCase())).slice(0, 32) : '';
  const allowed = await db('rpc/portal_rate_limit', 'POST', { p_bucket: await sha256('tv-telemetry:' + (device || platform)), p_limit: 60, p_seconds: 3600 });
  if (allowed !== true) return { ok: true, stored: 0, throttled: true };
  const version = clip(b.app_version, 20);
  const list = Array.isArray(b.events) ? b.events.slice(0, 25) : [];
  const rows = [];
  for (const e of list) {
    const event = clip(e?.event, 20);
    if (!EVENTS.has(event)) continue;
    const type = clip(e.content_type, 10);
    const format = clip(e.stream_format, 10).toLowerCase();
    rows.push({
      platform, app_version: version, device_hash: device,
      server_host: hostOnly(e.server_host),
      channel_id: clip(e.channel_id, 60), channel_name: clip(e.channel_name, 80),
      content_type: TYPES.has(type) ? type : 'other',
      stream_format: format === '' ? '' : FORMATS.has(format) ? format : 'other',
      event, duration_ms: int(e.duration_ms, 0, 86400000), attempt: int(e.attempt, 0, 50),
      detail: safeDetail(e.detail),
      event_id: identifier(e.event_id), session_id: identifier(e.session_id), incident_id: identifier(e.incident_id),
      occurred_at: occurredAt(e.occurred_at),
      phase: ['opening','playback','recovery'].includes(e.phase) ? e.phase : null,
      media_error: nullableInt(e.media_error, 4), buffer_ms: nullableInt(e.buffer_ms, 86400000),
      ready_state: nullableInt(e.ready_state, 4), network_state: nullableInt(e.network_state, 3),
      engine: ['html5-native','avplay','roku','hlsjs'].includes(e.engine) ? e.engine : null,
      device_model: /^[a-zA-Z0-9 ._-]{1,60}$/.test(String(e.device_model || '')) ? e.device_model : null
    });
  }
  if (rows.length) await db('tv_playback_events?on_conflict=device_hash,event_id', 'POST', rows);
  return { ok: true, stored: rows.length };
}

async function summary(req: Request, b: any) {
  const bearer = req.headers.get('authorization');
  if (!bearer?.startsWith('Bearer ')) throw new ApiError(401, 'Entre para continuar.');
  const r = await fetch(base + '/auth/v1/user', { headers: { apikey: service, Authorization: bearer } });
  if (!r.ok) throw new ApiError(401, 'Sessão expirada. Entre novamente.');
  const user = await r.json();
  const roles = await fetch(base + '/rest/v1/portal_staff?user_id=eq.' + encodeURIComponent(user.id) + '&select=role,active', { headers: { apikey: service, Authorization: 'Bearer ' + service } }).then((x) => x.json());
  if (!roles?.[0]?.active || roles[0].role !== 'admin') throw new ApiError(403, 'Acesso exclusivo do administrador.');
  const platform = PLATFORMS.has(clip(b.platform, 20)) ? clip(b.platform, 20) : null;
  const host = hostOnly(b.server_host) || null;
  const data = await fetch(base + '/rest/v1/rpc/tv_playback_summary', {
    method: 'POST',
    headers: { apikey: service, Authorization: 'Bearer ' + service, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_hours: int(b.hours || 24, 1, 168), p_platform: platform, p_host: host })
  });
  if (!data.ok) throw new ApiError(502, 'Falha ao montar o resumo.');
  return await data.json();
}

Deno.serve(async (req) => {
  const headers = corsHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Use POST.' }), { status: 405, headers });
  try {
    const text = await req.text();
    if (text.length > 20000) throw new ApiError(413, 'Envio grande demais.');
    let b: any = {};
    try { b = text ? JSON.parse(text) : {}; } catch { throw new ApiError(400, 'JSON inválido.'); }
    const out = b.action === 'summary' ? await summary(req, b) : b.action === 'report' ? await report(b) : (() => { throw new ApiError(400, 'Ação desconhecida.'); })();
    return new Response(JSON.stringify(out), { status: 200, headers });
  } catch (e) {
    const status = e instanceof ApiError ? e.status : 500;
    return new Response(JSON.stringify({ error: e instanceof ApiError ? e.message : 'Erro interno.' }), { status, headers });
  }
});
