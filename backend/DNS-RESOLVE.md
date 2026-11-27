# dns-resolve (Edge Function)

Publicada no Supabase em 27/11/2026 (versão 1, `verify_jwt=false`). Código: `backend/dns-resolve.ts`.

- `GET https://xrrgjssvdqvtrqhxpask.supabase.co/functions/v1/dns-resolve?name=servidor.com`
  → `{ name, ips: ["203.0.113.10"], ttl, source: "google" | "cloudflare" }` (404 `{ ips: [] }` se não achar).
- Reserva do **DNS seguro** dos apps (Android 2.17.83, LG 1.2.5, Samsung 1.2.6, MSX 1.2.12, Whale 1.0.6, Vega 1.2.4, Roku 1.1.18): os apps perguntam primeiro ao Google (8.8.8.8) e à Cloudflare (1.1.1.1) e só depois a esta função.
- **Regra (pedido do dono do servidor):** a função só resolve nomes. Nunca contata o servidor IPTV (sem teste de "online", login, HEAD ou relay). O app conecta ao servidor com o IP do próprio cliente.
- Valida o nome (domínio, sem IP), descarta IPs privados/de bloqueio, envia a sub-rede /24 do cliente ao Google (`edns_client_subnet`) para o CDN devolver o IP mais próximo, cache em memória pelo TTL e limite de 300 consultas/h por IP (RPC `portal_rate_limit`, a mesma do `tv-telemetry`).
- Não altera `portal-control`, banco, licenças nem pagamentos.
