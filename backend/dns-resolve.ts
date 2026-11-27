// Supabase Edge Function: dns-resolve
// Cópia de colaboração: backend/dns-resolve.ts (elvanoq-web-platform)
// Publicada no Supabase com verify_jwt=false (pública, sem segredo, entrada validada).
//
// REGRA (pedido do dono do servidor): esta função SÓ resolve nomes.
// Ela nunca abre conexão com o servidor IPTV — nada de teste de "online",
// HEAD, login ou relay. O app conecta ao servidor com o IP do próprio cliente.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "apikey, authorization, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const HOST_RE = /^(?=.{1,253}$)(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/;

function isPublicIPv4(ip: string): boolean {
  const p = ip.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false;
  const [a, b] = p;
  if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
  if (a === 100 && b >= 64 && b <= 127) return false; // CGNAT
  if (a === 169 && b === 254) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 168) return false;
  return true;
}

type Answer = { ips: string[]; ttl: number; source: string };

async function doh(source: string, url: string, accept?: string): Promise<Answer | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 3000);
  try {
    const r = await fetch(url, { headers: accept ? { accept } : {}, signal: ctrl.signal });
    if (!r.ok) return null;
    const j = await r.json();
    if (j.Status !== 0 || !Array.isArray(j.Answer)) return null;
    const a = j.Answer.filter((x: any) => x.type === 1 && isPublicIPv4(x.data));
    if (!a.length) return null;
    const ttl = Math.max(60, Math.min(...a.map((x: any) => x.TTL ?? 300), 3600));
    return { ips: [...new Set<string>(a.map((x: any) => x.data))], ttl, source };
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

const base = Deno.env.get("SUPABASE_URL")!;
const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function sha256(text: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Limite por aparelho/IP (mesma RPC do tv-telemetry). Se a RPC falhar, não bloqueia.
async function allowed(req: Request): Promise<boolean> {
  try {
    const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "anon";
    const r = await fetch(base + "/rest/v1/rpc/portal_rate_limit", {
      method: "POST",
      headers: { apikey: service, Authorization: "Bearer " + service, "Content-Type": "application/json" },
      body: JSON.stringify({ p_bucket: await sha256("dns-resolve:" + ip), p_limit: 300, p_seconds: 3600 }),
    });
    if (!r.ok) return true;
    return (await r.json()) === true;
  } catch {
    return true;
  }
}

// Cache em memória da instância (as instâncias vivem pouco; serve para rajadas).
const cache = new Map<string, { exp: number; ans: Answer }>();

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "GET") return json({ error: "method" }, 405);

  const name = (new URL(req.url).searchParams.get("name") ?? "").trim().toLowerCase().replace(/\.$/, "");
  if (!HOST_RE.test(name)) return json({ error: "invalid name" }, 400);

  if (!(await allowed(req))) return json({ error: "rate limit" }, 429);

  const ip0 = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim();
  const key = name + "|" + ip0.replace(/\.\d+$/, "");
  const hit = cache.get(key);
  if (hit && hit.exp > Date.now()) return json({ name, ...hit.ans, cached: true }, 200, hit.ans.ttl);

  const q = encodeURIComponent(name);
  // Google primeiro, com a sub-rede /24 do cliente (edns_client_subnet) para o CDN devolver
  // o IP mais próximo do cliente, não do Supabase. Depois Cloudflare.
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim();
  const ecs = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip) ? "&edns_client_subnet=" + ip.replace(/\.\d+$/, ".0/24") : "";
  const ans =
    (await doh("google", `https://dns.google/resolve?type=A&name=${q}${ecs}`)) ??
    (await doh("cloudflare", `https://cloudflare-dns.com/dns-query?type=A&name=${q}`, "application/dns-json"));

  if (!ans) return json({ name, ips: [], error: "not found" }, 404, 60);

  cache.set(key, { exp: Date.now() + ans.ttl * 1000, ans });
  if (cache.size > 2000) cache.clear();
  return json({ name, ...ans }, 200, ans.ttl);
});

function json(body: unknown, status = 200, maxAge = 0) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...CORS,
      "content-type": "application/json",
      "cache-control": maxAge ? `public, max-age=${maxAge}` : "no-store",
    },
  });
}
