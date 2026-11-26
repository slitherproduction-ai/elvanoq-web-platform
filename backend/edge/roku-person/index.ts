// Busca por ator para o app Roku: filmografia do TMDB, usada para achar os titulos na lista do usuario.
// A validacao do aparelho e da licenca e feita pelo portal-control (acao roku-metadata), sem duplicar regras.
const base = Deno.env.get('SUPABASE_URL');
const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers });

Deno.serve(async (req: Request) => {
  try {
    if (req.method !== 'POST') return reply({ message: 'Método não permitido.' }, 405);
    if (req.headers.get('origin')) return reply({ message: 'Origem não autorizada.' }, 403);
    const raw = await req.text();
    if (raw.length > 4096) return reply({ message: 'Dados muito extensos.' }, 413);
    let b: any;
    try { b = JSON.parse(raw); } catch { return reply({ message: 'Solicitação inválida.' }, 400); }
    if (!b || typeof b !== 'object' || Array.isArray(b)) return reply({ message: 'Solicitação inválida.' }, 400);
    const query = String(b.query || '').trim();
    if (!query || query.length > 160) return reply({ message: 'Confira os campos informados.' }, 400);
    const mediaType = b.media_type === 'tv' ? 'tv' : 'movie';

    // Mesmo aparelho, chave e licenca exigidos pelos metadados do Portal.
    const check = await fetch(base + '/functions/v1/portal-control', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: req.headers.get('apikey') || '', Authorization: req.headers.get('authorization') || '' },
      body: JSON.stringify({ action: 'roku-metadata', rokuClientId: b.rokuClientId, deviceCode: b.deviceCode, device_key: b.device_key, media_type: mediaType, mode: 'search', query }),
      signal: AbortSignal.timeout(10000),
    });
    if (!check.ok) {
      const error = await check.json().catch(() => ({}));
      return reply({ message: error?.message || 'Não foi possível validar este aparelho.' }, check.status);
    }

    const token = Deno.env.get('TMDB_ACCESS_TOKEN');
    if (!token) return reply({ message: 'Metadados indisponíveis no momento.' }, 503);
    const tmdb = (path: string) => fetch('https://api.themoviedb.org/3' + path, { headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' }, signal: AbortSignal.timeout(8000) });

    const peopleResponse = await tmdb('/search/person?language=pt-BR&include_adult=false&query=' + encodeURIComponent(query));
    if (!peopleResponse.ok) return reply({ message: 'Não foi possível consultar o ator agora.' }, 503);
    const people = (await peopleResponse.json())?.results || [];
    const person = people.find((entry: any) => entry?.known_for_department === 'Acting') || people[0];
    if (!person?.id) return reply({ found: false, titles: [] });

    const creditsResponse = await tmdb('/person/' + person.id + '/combined_credits?language=pt-BR');
    if (!creditsResponse.ok) return reply({ message: 'Não foi possível consultar o ator agora.' }, 503);
    const seen = new Set<number>();
    const titles = ((await creditsResponse.json())?.cast || [])
      .filter((credit: any) => credit?.media_type === mediaType && credit?.id && !seen.has(credit.id) && seen.add(credit.id))
      .sort((a: any, c: any) => (c.popularity || 0) - (a.popularity || 0))
      .slice(0, 40)
      .map((credit: any) => ({
        title: credit.title || credit.name || '',
        original_title: credit.original_title || credit.original_name || '',
        year: String(credit.release_date || credit.first_air_date || '').slice(0, 4),
      }))
      .filter((credit: any) => credit.title !== '');
    return reply({ found: titles.length > 0, media_type: mediaType, person: { id: person.id, name: person.name || '', profile_path: person.profile_path || null }, titles });
  } catch {
    return reply({ message: 'Não foi possível concluir a busca agora.' }, 500);
  }
});
