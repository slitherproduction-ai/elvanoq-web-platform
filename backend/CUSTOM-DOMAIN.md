# Domínio próprio — elvanoqplay.app

Vinculado em 23/10/2026 ao projeto appgprj_6ad8be99c4388191af0425e314a0a5ff.
Domínio ID: appgdom_6adb91db4f0c8191bbd57c7d34ae6b02.
Estado verificado: active; SSL active. Audience continua owner-private. O domínio não torna o site público.

## Registros fornecidos por Sites
Na zona DNS autoritativa da Hostinger, configurar:

| Tipo | Nome | Valor |
| --- | --- | --- |
| A | @ | 162.159.143.30 |
| A | @ | 172.66.3.26 |
| TXT | _openai-site-verification | openai-site-verification=U_wgJJPM1mFDdV5atE17HsIpXXzxkYdfxXX_OZ4-nGY |
| TXT | _cf-custom-hostname | 940ba207-65a9-4bf3-839d-7593f0ea323a |

Nomes TXT completos: _openai-site-verification.elvanoqplay.app e _cf-custom-hostname.elvanoqplay.app. Não duplicar o sufixo do domínio quando a interface o acrescentar automaticamente. TTL padrão do painel.
O destino CNAME informado por Sites é custom-domains.chatgpt.site. Para a raiz desta configuração, usar os dois A acima, não um CNAME adicional em @. www ainda não foi cadastrado nem configurado.

Substituir apenas registros de site conflitantes na raiz (A/AAAA/ALIAS/CNAME anteriores de @) após conferir a configuração atual. Preservar MX e TXT/CNAME de e-mail (SPF, DKIM e DMARC), NS e demais serviços. Não trocar nameservers por iniciativa própria. Se o DNS estiver delegado a outro provedor, editar no provedor autoritativo, não numa zona inativa da Hostinger.

## Compatibilidade preparada
CORS das APIs portal-control e paghiper-payments aceita o domínio antigo e https://elvanoqplay.app. A verificação server-side de hostname do Turnstile aceita os dois hostnames exatos. URLs de Supabase e webhook PagHiper permanecem inalteradas, assim como links antigos do app. Os links internos do portal são relativos. Sem redirecionamento forçado para o domínio novo durante validação.

## Pendências externas e validação
1. DNS e HTTPS confirmados ativos por Sites em 23/10/2026.
2. Cloudflare Turnstile: acrescentar elvanoqplay.app ao widget existente, mantendo o hostname antigo. Não é necessário trocar chaves do widget.
3. Atualizar/verificar Site URL e Redirect URLs do Supabase para fluxos de confirmação de e-mail/recuperação quando o HTTPS novo estiver ativo. Preservar URLs antigas durante a transição. Não há configuração automática do Auth por este conector.
4. Consultar refresh_custom_domain_status, verificar domínio ativo e SSL pronto. Testar a proteção de acesso do site, autenticação própria, CAPTCHA, cadastro de listas e consultas de licença. Não emitir Pix real durante testes sem solicitação.
5. Atualizar o app e URLs legais apenas depois desses testes. Links de retorno de pagamento enviados pela API permanecem no domínio antigo até a transição final. A política de visibilidade do portal será decidida separadamente; não presumir autorização para torná-lo público.
