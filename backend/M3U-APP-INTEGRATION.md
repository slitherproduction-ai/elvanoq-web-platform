Integre o licenciamento por Host/DNS em listas M3U/Xtream sincronizadas do portal. Não gere APK.

O portal já valida o origin da URL, associa o código e calcula a licença. A resposta de playlist-sync agora inclui server_code, license e code_access, além da playlist quando autorizada.

1. Preservar sourceType=m3u/xtream e a identidade da lista; não converter M3U em Xtream para obter licença. Armazenar a origem portalManaged e a associação server_code devolvida pelo servidor, sem recalcular ou confiar em licença local.
2. Antes de reproduzir e nas revalidações periódicas, consultar license-status com MAC/device_key. Este endpoint retorna a licença efetiva e code_access quando houver código. Código válido libera sem teste; restrito exige liberação anual individual. Sem código, seguir licença individual/teste elegível. Não chamar code-device-register indiscriminadamente para M3U: isso pode reatribuir vínculo já resolvido pelo portal.
3. Ampliar o gate que hoje filtra sourceType=xtream-code para cobrir M3U/Xtream portalManaged e suas permissões reais. Atualizar estado de licença pela resposta do servidor. Respeitar 429, falhas de rede e a política offline existente sem converter falha temporária em expiração ou autorização.
4. playlist=null com license.can_play=false e code_access restrito significa bloqueio; não apagar a lista nem interpretá-lo como cadastro ausente. Interromper playback em negação explícita. Pagamento continua por MAC e requer confirmação do servidor.
5. Apagar uma lista local não deve excluir MAC, chave ou licença. Reimportar pelo portal deve atualizar/upsert da lista sem duplicar favoritos ou perder a identidade. Não enviar credenciais a consultas de licença nem exibi-las em logs.
6. Testar host anual/vitalício, alias autorizado, código expirado/revogado, renovação de um MAC, outro MAC bloqueado, host sem cadastro e licença individual existente. Atualizar README/changelog, checkpoint, commit e testes. Não gerar APK nem submeter à loja.

## Normalização automática de M3U para Xtream

No envio pelas ações `playlist`, `webos-playlist` e `roku-playlist`, URLs do tipo `http(s)://host[:porta]/get.php?username=...&password=...` passam a ser armazenadas como `kind: "xtream"`, com `credentials: {host, username, password}`. O host é a origem exata normalizada da URL; HTTP/HTTPS e porta são preservados. As credenciais são decodificadas pelo parser de URL, preservando capitalização e conteúdo; não são incluídas na resposta de salvamento. O app recebe o contrato Xtream já existente ao sincronizar.

Somente parâmetros username/password e, opcionalmente, type=m3u ou m3u_plus e output=ts ou m3u8 são reconhecidos. Parâmetros desconhecidos/duplicados, caminho diferente de /get.php, fragmentos, credenciais ausentes/vazias ou acima dos limites mantêm a conexão M3U original. Links M3U estáticos/genéricos não podem ser convertidos em credenciais Xtream. O parâmetro output descreve a lista exportada; o player continua escolhendo o formato de reprodução pelo fluxo Xtream existente.

Não são realizadas requisições externas ao provedor, download de listas ou seguimento de redirects nesta normalização. A conversão é estrutural: não confirma disponibilidade ou autenticação do serviço Xtream do provedor. Não muda licenças, identidade, códigos, domínio, CAPTCHA, RLS ou permissões; nenhuma migração ou conversão em massa foi aplicada. Para listas já armazenadas, reenviar pelo portal e sincronizar no aplicativo.

As respostas de salvamento acrescentam `playlist_kind` e `converted_to_xtream` (boolean), preservando campos existentes. Na interface, a conversão é confirmada sem mostrar credenciais. Android/Fire TV, LG e Roku mantêm seus identificadores atuais.

Teste: `node --experimental-transform-types backend/m3u-xtream-tests.mjs`. Exercita conversão HTTP/HTTPS, porta, caracteres escapados, links genéricos/incompletos/ambíguos, salvamento nas três plataformas, sincronização Xtream e bloqueio de dispositivo sem expor a lista. Testes usam exclusivamente identidades e banco simulados.

## Envio somente com MAC/código (27/10/2026)

O formulário Adicionar lista não solicita chave. As ações playlist/webos-playlist/roku-playlist, quando não recebem chave, usam a identificação visual para substituir a lista. O proprietário autorizou esse modelo: conhecer o MAC/código é suficiente para o envio, sem prova adicional de posse. CAPTCHA e quotas continuam obrigatórios conforme a configuração existente. Essa opção não autoriza acesso anônimo às credenciais salvas: consultas nativas de sincronização continuam validando as chaves internas do app.

Android: um registro já existente mantém o hash da chave atual. Um novo envio usa um marcador reservado de 64 zeros (não é chave gerada nem digest utilizável). Na primeira consulta nativa com uma chave válida do app, uma atualização condicional compara o marcador e registra o hash dessa chave. Apenas registros ativos e ainda não vinculados podem ser reivindicados; a operação não substitui chaves existentes, não ativa dispositivos, não renova licenças e não reinicia teste. A partir daí a sincronização exige a mesma chave interna. Requisições concorrentes são protegidas por compare-and-set; uma chave diferente não substitui a primeira.

LG: o código deve resolver um único aparelho já registrado; vínculos ambíguos, divergentes ou desativados são recusados. Roku: exige registro nativo ativo com chave interna existente, para preservar o contrato de sincronização do app. Em ambos os casos a chave é consultada somente no servidor; nunca é enviada ao formulário, aos logs ou à resposta de salvamento.

O salvamento continua utilizando as funções existentes de lista e licença por origem; acesso ao conteúdo depende da licença efetiva. Não altera os fluxos de checkout, renovação, vinculação administrativa ou outros clientes que ainda enviam chave. Não altera chaves de aparelhos previamente cadastrados e não realiza migração em massa. Se um cadastro antigo já estiver vinculado a uma chave que não corresponde ao app, é necessário usar o procedimento administrativo de redefinição de vínculo; este fluxo não o faz silenciosamente.

Arquivos: edge/portal-control/visual-playlist.ts, extensão restrita em index.ts, formulário e app.js. Migrações: nenhuma.
Teste: node --experimental-transform-types backend/visual-playlist-tests.mjs. Valida cadastro novo sem chave, associação nativa, repetição de envio preservando chave, rejeição de outra chave, Android/LG/Roku, dispositivos desativados, CAPTCHA/limites e conversão M3U. Banco e identidades simulados; nenhum registro de cliente real alterado durante os testes.

## Redefinição sem chave no painel (27/10/2026)

Administrador pode chamar `device-rebind` com id e reason, sem device_key. O RPC existente registra motivo/ator e troca somente o hash pelo marcador pendente; no webOS, as duas tabelas de identidade são atualizadas juntas. A associação posterior do hash LG usa `portal_native_binding_claim`, invoker, restrita ao service_role, com lock de dispositivo seguido do vínculo nativo. Android reutiliza o compare-and-set do fluxo de primeira sincronização. Nenhuma chave é gerada ou exibida pelo painel. O estado ativo não é alterado pelo formulário. Aparelhos desativados não podem concluir nova associação até reativação explícita.

Migração aplicada: portal_native_binding_claim_no_manual_key; fonte em native-binding-claim.sql. Testes: reset-reason-tests.mjs e reset-reason-db-tests.sql (BEGIN/ROLLBACK; somente fixtures temporárias), mais regressões de Android/LG/Roku. Motivo obrigatório entre 5 e 500 caracteres; ação continua exclusiva de administrador ativo que concluiu troca de senha inicial.
