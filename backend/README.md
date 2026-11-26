# ELVANOQ Portal — recuperação e nova estrutura

Site: appgprj_6ad8be99c4388191af0425e314a0a5ff. Preservar acesso privado.

- Clientes: envio de URL M3U ou credenciais Xtream sem conta, mediante MAC e chave de 128 bits.
- Revendedores: conta autorizada em portal_staff; acesso somente aos dispositivos atribuídos.
- Administrador: conta proprietária slitherproduction@gmail.com autorizada no banco. Pode criar/suspender revendedores, cadastrar/desativar dispositivos, definir validade e consultar metadados de listas.
- Downloads: APK universal 2.17.15 verificado na API de Releases do GitHub em 21/10/2026.

## Backend

Supabase staging xrrgjssvdqvtrqhxpask, função portal-control. Código em portal-api.ts; schema em schema.sql. A função usa autenticação própria: MAC/chave no envio da lista e JWT Supabase validado em /auth/v1/user mais role ativa consultada no banco nas operações administrativas. As tabelas novas não concedem acesso direto a anon/authenticated e usam RLS com negação por padrão; apenas a função com service_role acessa credenciais. As chaves dos aparelhos são armazenadas somente como SHA-256. Não registrar corpos das requisições ou credenciais em logs.

As tabelas portal_devices e dados anteriores foram preservados. Os novos dispositivos são geridos em portal_managed_devices. Não migrar automaticamente aparelhos antigos sem um contrato de provisionamento com o app.

## Limites e próxima etapa

O app atual não contém provisionamento MAC/chave nem sincronização de listas do portal. O formulário salva a lista no backend, mas não a envia ao app. Nenhum endpoint de leitura de credenciais foi publicado: implementar o contrato autenticado com o app e validá-lo antes de afirmar sincronização funcional. O campo legado de validade é substituído pela regra de licença descrita no checkpoint abaixo; o aplicativo ainda não consome essa regra e não há cobrança automática. O servidor não baixa ou valida a disponibilidade do provedor. Criar conta de revendedor não envia e-mail automático. Incluir mudança de senha inicial antes de uso comercial.

## CP servidor — teste gratuito e licença anual (21/10/2026)

Implementado no Supabase e na função portal-control v2. Não altera o aplicativo ou a interface do portal.

- `license-status` com `mac` e `device_key`: consulta sem iniciar período. Retorna `license.status`, `can_play`, `payment_required`, `server_time`, `trial_started_at`, `trial_expires_at`, `paid_until`, `expires_at`, `remaining_seconds`.
- `license-activate` com `mac` e `device_key`: primeira ativação cria 168 horas de teste pelo relógio do banco. Cadastro e envio de lista não iniciam teste. Repetições não prolongam. Aparelhos previamente pagos não ganham teste após expirar.
- `license-confirm-payment`: JWT de administrador ativo, `mac`, `payment_reference` (8–120 caracteres) e `amount_cents` inteiro positivo. Confirmação MANUAL de recebimento, não cobrança ou comprovação automática por gateway. Gera um ano civil a partir do maior valor entre agora e o vencimento pago atual. Mesma referência/valor/dispositivo retorna o pagamento existente sem estender novamente; conflito de referência rejeitado.
- `overview`: cada dispositivo recebe `license`. Estados: `not_activated`, `trial`, `expired`, `licensed`, `suspended`. Vencimento derivado do horário do banco em cada consulta; não depende de cron ou relógio do cliente. `can_play=false` depois do vencimento. Suspensão administrativa prevalece sobre licença ativa.
- Validade livre via `device-update` foi bloqueada no servidor: usar confirmação de pagamento. O antigo campo visual de validade ainda não foi adaptado, pois este checkpoint é exclusivamente servidor.
- `portal_device_licenses` retém MAC e datas independentemente de exclusão/recadastro do registro do aparelho. Não apagar esse histórico em rotinas de manutenção. Esse mecanismo pressupõe a mesma identidade MAC validada no provisionamento futuro; não impede spoofing de identidades no app ainda não integrado.
- `portal_license_payments` registra referência, valor, operador e vencimento. Serialização transacional impede dupla extensão por reenvio e preserva saldo de prazo na renovação.
- Tabelas e funções SQL privadas: RLS ativo, acesso direto negado a anon/authenticated, funções SECURITY INVOKER executáveis somente por service_role. A função Edge valida MAC/chave ou JWT + papel ativo antes das RPCs.

Os campos `expires_at` antigos não comprovam pagamento e não são convertidos automaticamente em licenças pagas. Confirmações passam pelo novo registro auditável. O servidor somente informa permissão: bloqueio real de reprodução exige a futura integração do aplicativo. Não foi publicado endpoint de leitura de credenciais de playlists.

### Validação

`license-tests.sql`: 16 verificações no banco em transação com rollback, incluindo ativação, duração exata, expiração no limite, recadastro, pagamento, renovação, duplicidade, suspensão e privilégios.

`node --experimental-transform-types backend/license-api-tests.mjs`: validação e autorização da API com transporte simulado.

Testes HTTP em dispositivo fictício descartável: consulta sem ativar, ativação real, repetição idempotente e chave inválida. Nenhuma cobrança ou pagamento real foi realizado.

## CP portal — páginas independentes (21/10/2026)

- `/`: apresentação do player.
- `/adicionar-lista/`: formulário M3U/Xtream sem login de cliente.
- `/download/`: download do APK oficial.
- `/revendedores/`: login e painel de revendedor.
- `/administrador/`: login e painel exclusivo de administrador.

Links normais entre documentos HTML, com título e destaque de navegação por página. Scripts iniciam somente componentes presentes; restauração de sessão ocorre apenas nas páginas de painel. Administrador é direcionado da página de revendedores para a administração; revendedor não abre o painel administrativo. Autorização efetiva continua no backend.

Removido o editor livre de validade que havia sido desabilitado pelo servidor. Cards exibem o status/vencimento calculado pela licença. Confirmação de pagamento continua disponível somente na API administrativa, sem novo fluxo de cobrança.

Validação: cinco páginas e respectivos links locais, IDs sem duplicatas, um H1 por página, sintaxe JavaScript, navegação em navegador e troca M3U/Xtream. Layout móvel validado em iframe com área útil de 375 px, sem transbordamento horizontal. Nenhuma conta real usada nos testes de login.

## Contas e remoção de dispositivos

- Aplicar `account-devices.sql` antes da versão da API correspondente.
- Remoção usa `archived_at` e `active=false`; restauração mantém chaves, listas e histórico de licença. A listagem padrão omite removidos. Cada parceiro só remove/restaura os próprios dispositivos; administrador gerencia todos. Eventos são registrados em `portal_device_events`.
- `staff-save` gera senha criptograficamente aleatória para novos parceiros e retorna uma única vez como `initial_password`. Não registra a senha no banco da aplicação, logs ou armazenamento do navegador. O administrador deve entregá-la por canal privado. Contas existentes não têm senha redefinida por esse comando.
- `must_change_password` bloqueia operações de gestão até a troca da senha inicial. `overview` retorna somente o necessário para abrir Minha conta nesse estado.
- `account-update` altera somente a identidade autenticada. Nome fica em `portal_staff.display_name`; o e-mail continua sendo o login. Alterações de e-mail/senha exigem autenticação adicional com a senha atual e usam a API de usuário do Supabase, respeitando confirmação de e-mail e políticas de senha. A função não usa metadados editáveis pelo usuário para autorização.
- Testes de autenticação usam mocks; remoção/restauração foram verificadas no banco em transação revertida. Nenhuma senha ou conta real foi alterada durante a validação.

## Login Xtream por código — contrato para o aplicativo

Administrador: painel → Códigos de servidor. Código de 3 a 32 caracteres (letras, números, hífen, sublinhado), normalizado para minúsculas. Host HTTP/HTTPS com porta opcional, sem credenciais, caminhos, query ou fragmentos. Edição atualiza o mesmo código; desativação impede novas consultas. Histórico em `portal_server_code_events`. Não cadastrar `pfast` com endereço fictício em produção.

Consulta: `POST https://xrrgjssvdqvtrqhxpask.supabase.co/functions/v1/portal-control`, headers `Content-Type: application/json` e `apikey` com a chave publicável já usada no app. Body: `{"action":"server-code-resolve","code":"pfast"}`. Sem conta do portal, JWT ou chave de aparelho. Resposta 200: `{"server":{"code":"pfast","host":"https://servidor.exemplo.com","updated_at":"..."}}`. HTTP 400 para formato inválido; 404 para código ausente/desativado. `Cache-Control: no-store`. Não há listagem pública e a resposta não contém credenciais de listas. A consulta não testa a disponibilidade do servidor Xtream e não autentica o assinante.

O app deve resolver novamente no login explícito e ao reconectar uma lista salva desta modalidade, sem enviar usuário/senha da lista para o endpoint de resolução. Login Xtream segue diretamente ao Host/DNS retornado. Salvar o código junto da lista para resolver mudanças de DNS; não duplicar a lista quando o host mudar. Não alterar conexões Xtream/M3U legadas nem iniciar reprodução automaticamente. O Host/DNS retornado ao cliente não deve ser tratado como segredo oculto do assinante.

## Registro de aparelhos que entram por código

Endpoint: `POST /functions/v1/portal-control`, action `code-device-register`. Enviar `mac`, `device_key` (identidade persistente do app, nunca a senha IPTV), `code` e, opcionalmente, `name`, `platform`, `app_version`. Sem JWT do parceiro. Retorna `{device:{id,mac,server_code,first_code_login_at,last_seen_at},license:{status,can_play,payment_required,expires_at,...}}`.

O aplicativo chama depois de autenticar com sucesso no servidor Xtream e repete em contatos periódicos durante a utilização (intervalo recomendado de 5 minutos) e ao reconectar. A API não recebe nem valida usuário/senha IPTV; primeiro/último acesso representam contatos reportados pelo app, não uma autenticação Xtream verificada no portal. O endpoint valida MAC+chave, código ativo e estado do aparelho. Não aceita datas, licença, role ou responsável enviados pelo cliente. A primeira chamada inicia o teste de 168 horas; as seguintes não reiniciam o prazo. Licenças anuais/vitalícias e suspensão seguem as regras existentes. `can_play=false` precisa ser aplicado pelo app: o servidor sozinho não interrompe reprodução no APK.

HTTP 409 `DEVICE_BINDING_REQUIRED` traduzido em mensagem exige um fluxo explícito para resolver chave diferente entre app/portal, nunca sobrescrita silenciosa. MAC removido/desativado e código desativado não podem ser reativados pelo cliente. Dispositivos novos entram sem parceiro. Administrador usa `device-assign` (`id`, `reseller_id` UUID ou null) e o servidor valida o responsável. Parceiros só veem seus dispositivos. O painel mostra o último código reportado pelo aparelho, primeiro acesso por código, último contato, plataforma e versão.

Aplicar `code-devices.sql` antes de implantar o endpoint. A integração cliente deve ser realizada no ambiente de desenvolvimento do app; nenhum APK foi gerado aqui.

## Validade de códigos e desbloqueio individual por pagamento

Aplicar `code-validity.sql`. Códigos têm `validity=annual|lifetime`, prazo `expires_at`, bloqueio (`active=false`) e revogação (`revoked=true`). Códigos anteriores à migração são preservados como vitalícios. Novo cadastro no painel oferece 1 ano; editar sem marcar renovação preserva o vencimento. Renovação anual acrescenta um ano ao prazo restante. Bloqueios/revogações têm data de corte; expiração usa o vencimento como corte.

`code-device-register` agora retorna `code_access` além de `license`. Para código conhecido mas restrito, pode registrar/identificar o MAC para cobrança e retorna `can_play=false,payment_required=true`, sem iniciar um teste. Uma chave divergente nunca é trocada. O pagamento aceito após a restrição cria autorização específica para MAC+código, válida até o prazo pago. Não reativa o código nem autoriza outros MACs. Reprocessar um pagamento antigo após nova restrição não cria autorização nova. Estorno Pix desativa a autorização daquele pagamento. Suspensão/remoção individual do aparelho continua prevalecendo sobre pagamentos.

`server-code-resolve`: para código ativo e válido preserva a consulta pública anterior. Para código restrito, enviar também `mac` e `device_key`; o servidor exige identidade correspondente e autorização individual paga para retornar Host/DNS. Sem autorização retorna HTTP 403 com `code_access`, `payment` (checkout_url, amount_cents, mac), sem Host/DNS. Código inexistente retorna 404. A identificação por código é necessária antes da cobrança de recuperação, para associar o MAC ao código correto; registrar durante um bloqueio não inicia o teste. Evitar executar essa associação ao trocar de código enquanto há cobrança pendente.

O APK deve tratar o 403 estruturado, registrar o MAC quando necessário, mostrar aviso e coletar os dados exigidos pelo Pix PagHiper para gerar o QR Code e Copia e Cola usando `paghiper-payments`. Não criar cobrança por um 403 de suspensão individual (`payment_required=false`). Após confirmação, consultar novamente com MAC+chave e verificar `license.can_play` junto de `code_access.can_connect`. Verificar periodicamente durante reprodução: o bloqueio no servidor não interrompe sozinho o player de um APK sem essa integração.

## Exclusão definitiva por MAC
A ação device-remove apaga cadastro, chave, lista, atribuições, vínculos, licença, pedidos Pix locais, pagamentos locais e histórico de teste. O MAC poderá ser cadastrado novamente com nova chave e novo teste. Administradores excluem qualquer dispositivo; parceiros apenas os próprios. A confirmação no painel é irreversível. Não cancela cobranças nem apaga registros mantidos pela PagHiper. Pedidos locais excluídos não podem aplicar notificações antigas a um novo cadastro.

## Proteção contra automação e Turnstile
Limites ativos no servidor, persistidos em portal_request_limits (apenas service_role): 60 solicitações a APIs de dispositivo por MAC em 15 minutos, 300 consultas públicas por código/minuto, 3 tentativas de emissão Pix por MAC/10 minutos e 90 consultas de Pix por MAC/15 minutos. Contadores são hashes, expiram automaticamente, não dependem de Origin/IP fornecido pelo cliente. Respostas 429 incluem Retry-After. Não há proteção por IP nesta implementação; distribuir chamadas entre MACs/códigos continua sendo uma limitação. Webhook PagHiper mantém verificação própria e não recebe CAPTCHA.

Turnstile preparado para login do administrador/parceiro e formulário Adicionar lista. Ainda requer chaves reais/configuração externa:
1. Cloudflare Turnstile: criar widget Managed, hostname elvanoq-play-portal.slitherproduction.chatgpt.site.
2. Supabase Edge Functions Secrets: TURNSTILE_SITE_KEY (pública), TURNSTILE_SECRET_KEY (privada) e TURNSTILE_ENABLED=true. Não colocar a chave privada em arquivos/frontend.
3. Supabase Authentication > Bot and Abuse Protection: ativar CAPTCHA, provedor Turnstile, usando a mesma Secret Key. A proteção nativa do Auth é obrigatória: somente exibir o widget no login não protege chamadas diretas ao Auth.
4. Testar login humano e rejeição pelo Auth de tentativa sem captcha_token. O cliente envia gotrue_meta_security.captcha_token. Testar alterações de senha/e-mail, que usam reautenticação.
O formulário de lista valida success, hostname e action=playlist no servidor via Siteverify; token expirado/duplicado é rejeitado pelo provedor. O app nativo mantém validação por MAC/chave e limites, sem desafio visual. Pix mantém limites e validação do provedor; CAPTCHA de emissão no app/checkout é uma integração futura.
Não considerar CAPTCHA ativo antes de concluir etapas 2–4. Nunca usar chaves de teste como proteção real. Status público: action=security-config retorna apenas enabled/site_key, nunca Secret Key.

## Acesso integral pela validade do código
Atualização de regra aprovada em 23/10/2026: código ativo e não vencido autoriza o player para todos os MACs vinculados e ativos. O teste individual vencido não bloqueia esse acesso. Códigos anuais usam a data de vencimento do código; vitalícios não têm vencimento enquanto ativos. Registrar ou consultar acesso por código não inicia um teste gratuito.
`portal_effective_license` combina o estado do código e do dispositivo e é utilizado no cadastro por código, resolução autenticada, consulta/ativação de licença e painel. Preserva os status compatíveis `licensed`/`lifetime` e acrescenta `access_source=server_code|individual_renewal|code_restricted`, `server_code` e `device_lifetime`. Os registros antigos de teste/pagamento não são apagados nem convertidos em licença vitalícia individual. O painel distingue a origem da liberação.
Expiração, bloqueio ou revogação do código negam acesso. Pagamento confirmado cria a autorização individual anual do MAC, sem renovar/liberar o código para outros aparelhos. Suspensão individual continua prevalecendo. Novas restrições continuam seguindo o corte temporal existente. Sem código associado, permanecem as regras individuais de teste/licença. Reservar um novo Pix para um MAC com código ativo retorna CODE_ACCESS_ACTIVE; não há necessidade de pagar pela liberação já coberta pelo código.
Testes transacionais: `backend/code-license-access-tests.sql` (rollback ao final). Conferir também testes do portal, servidor de códigos, pagamentos e interface. O app deve reconsultar o servidor para atualizar uma tela que já estava aberta.

## Licenciamento de listas pelo Host/DNS
A ação `playlist` calcula `new URL(url).origin` (ou origin do Host Xtream), sem credenciais/caminho/query e sem chamadas de rede ao endereço fornecido. `portal_playlist_register_host` salva lista e associação numa única transação, mantendo validação MAC/chave/responsável. Compara exatamente protocolo, hostname normalizado e porta; portas padrão são normalizadas pelo parser URL. Hosts alternativos são autorizados exclusivamente pelo administrador em Códigos de servidor. `server-host-save` usa `{code,host,remove?}`. Conflitos entre códigos e correspondências ambíguas são rejeitados. Remover alias impede novas associações por esse endereço; não revoga o código nem as autorizações de dispositivos já vinculados. Use bloqueio/revogação do código ou suspensão do dispositivo para isso.
Uma URL reconhecida associa o dispositivo ao código mesmo quando este estiver restrito: código vencido/revogado não recebe teste como alternativa. Sem correspondência, a nova lista passa a usar a licença individual existente, sem apagar datas/pagamentos; uma autorização de código de outro servidor não é transportada para a lista substituta. Cadastrar/salvar lista não inicia teste. Excluir apenas uma lista no app não chama exclusão do MAC nem remove sua autorização no portal.
A resposta de `playlist` acrescenta `host_match`, `server_code`, `license`, `code_access`. `playlist-sync` retorna os mesmos dados de licença/código; para código restrito sem liberação individual, retorna `playlist:null` e não envia credenciais. O app precisa tratar esse resultado como bloqueio, preservando a lista local, e não como ausência/exclusão da lista. A API não pode impedir um player antigo de usar credenciais previamente salvas. O app deve revalidar também listas M3U/Xtream sincronizadas usando `license-status` com MAC/chave e aplicar o gate a elas; não limitar o gate a `sourceType=xtream-code` nem chamar o registro de código indiscriminadamente, pois o servidor já determinou o vínculo pelo Host.
Testes: `playlist-host-api-tests.mjs`, `playlist-host-license-tests.sql` (rollback). Não são executados downloads de playlists nem pagamentos reais. A classificação valida associação/licença do player; não comprova autorização ou disponibilidade do conteúdo IPTV.

### Extensão Roku por código de servidor
A fonte implantável atual de `portal-control` está em `edge/portal-control/` (base v40 preservada e resolver Roku isolado). Contrato e testes: [ROKU-INTEGRATION.md](ROKU-INTEGRATION.md). Não reimplantar o arquivo histórico `portal-api.ts` sobre a versão atual.
