# Limite de dispositivos por código

Administrador → Códigos de servidor → Editar código → Limite de dispositivos vinculados → Salvar.
O cartão mostra `20/500 dispositivos`; Atualizar contadores consulta os números atuais.
Campo vazio significa sem limite. Novos formulários sugerem 500; não é um limite imposto aos códigos antigos.

`server-code-save` aceita `device_limit`: inteiro 1..1000000 ou null para ilimitado.
Somente administrador ativo que concluiu a troca da senha inicial pode editar. O ator vem da sessão validada.
Omitir o campo mantém o limite atual (compatibilidade com clientes antigos).
`overview.server_codes[]` retorna `device_limit` e `device_count` somente ao administrador.

Contagem compartilhada: dispositivos Android e LG na tabela gerenciada (LG conta uma vez, sem contar sua tabela de identidade novamente), mais dispositivos Roku.
Conta vínculos atuais, incluindo aparelhos desativados; exclui gerenciados arquivados. Excluir ou desvincular libera vaga. Login repetido, edição da lista, reset de chave e renovação não ocupam vagas adicionais.
Reduzir abaixo do total existente preserva vínculos e licenças; somente novas associações ficam impedidas.

Migrações aplicadas:
- `portal_server_code_device_capacity` (`server-code-capacity.sql`): coluna nullable, contador por código, RLS service-only, gatilhos transacionais, RPC administrativa.
- `portal_roku_server_code_capacity_link` (`roku-code-capacity-link.sql`): registra associação na resolução Roku, mantendo identidade nativa e exigência de licença ativa.

O contador usa incremento condicional sob bloqueio de linha; transferências bloqueiam contadores em ordem por código. Erros revertem toda a operação, inclusive lista ou aparelho que ainda estava sendo criado.
Limite cheio retorna HTTP 409 com mensagem legível. Não expõe chaves, credenciais nem identificadores nativos.
Roku conserva o JSON de sucesso anterior; passa a registrar o vínculo após validar host, identidade e licença. O resolvedor continua sem editar credenciais, identidade nativa ou datas de licença.

Validação:
- `node --experimental-transform-types backend/server-code-capacity-tests.mjs`: permissões, limites, nulo, compatibilidade e HTTP409.
- `server-code-capacity-tests.sql`: BEGIN/ROLLBACK com registros sintéticos; Android pelo cadastro real, Roku pelo upload real, LG, duplicidade, vagas, bloqueio, redução, RLS, RPC do resolvedor e integridade.
- Duas transações independentes concorrentes contra limite 1: exatamente um vínculo aprovado. Registros sintéticos removidos; contador real comparado com vínculos: zero divergências.
- Regressões no entrypoint atual: contas, CAPTCHA/quota, Android/códigos, LG, Roku, hosts, reset, M3U/Xtream e uploads sem chave. Testes históricos foram adaptados temporariamente para importar o entrypoint atual.
- UI local com dados sintéticos: 20/500, editar para600, salvar, cartão20/600 e mensagem de sucesso. Nenhum registro de cliente alterado. Validação física em aplicativos não executada.

Rollback: fonte anterior Site46 / commit a9f8795086ffbc17f547265e08f55eebb2e64669 e backend44 preservados no histórico. Para retirar uma restrição comercial, administrador limpa o limite e salva; não é necessário apagar dados ou contadores.
