# Roku — Portal e licenciamento

## Identidade e chave
O endpoint continua portal-control. O valor de GetChannelClientId é opaco e sensível a maiúsculas: o servidor valida tamanho e caracteres de controle, mas não o normaliza. Armazena somente SHA-256 em client_hash, com unicidade. deviceCode recebe apenas remoção de espaços e uppercase, formato ROKU-[A-Z0-9]{8}-[A-Z0-9]{8}, também único. Não há campo, derivação ou armazenamento de endereço de rede no esquema Roku.

O contrato inicial de registro sem chave é aceito, retornando awaiting_activation / requires_device_key=true. Para concluir o fluxo, o app deve gerar uma chave numérica aleatória (6 a 128 dígitos), guardá-la no Registry Roku e acrescentar device_key ao registro. Pode também usar deviceKey. A chave nunca é retornada nem gerada pela API; só seu hash é armazenado. Reenvio com chave diferente é rejeitado; identidade existente não pode trocar código. Redefinição é exclusiva do administrador. O Client ID não é um atestado de hardware: não é possível distinguir duas cópias do mesmo ID e da mesma chave; preservar a chave é essencial.

## Ações públicas
- roku-device-register: rokuClientId, deviceCode, deviceName, platform=roku; extensão device_key para estabelecer a chave no primeiro vínculo. Sem lista ou credenciais na resposta.
- roku-license-status: rokuClientId e deviceCode; resposta registered, active, bound, activation_status, activated e license. Status: awaiting_activation, active, expired, blocked. Não retorna credenciais.
- roku-playlist-sync: rokuClientId, deviceCode e device_key obrigatória. Só entrega playlist para o registro correto e license.can_play=true. Bloqueio retorna playlist=null sem apagar a lista. Respeitar HTTP 429 / Retry-After.
- roku-playlist: deviceCode + device_key, name, kind=m3u/xtream, url ou host/username/password; captcha_token com action playlist. Não aceita escolha de código de servidor pelo cliente; identifica Host/DNS normalizado no servidor. HTTP e portas dos provedores são preservados.

## Administração autenticada
roku-device-bind (código e chave); roku-device-update (id, active/name); roku-device-assign (id,reseller_id); roku-device-rebind (id,device_key,reason,restore); roku-license-renew (id,payment_reference,amount_cents); roku-license-set-lifetime (id,lifetime,reason).
Papéis conferidos em portal_staff no servidor. Parceiro gerencia apenas seus registros atribuídos. Admin pode vincular aparelho não atribuído e depois atribuir parceiro. Renovação manual, atribuição, vitalícia e redefinição são exclusivas do admin. Nenhuma mutação é autorizada por metadados de usuário.

## Licença e renovação
Primeira vinculação verificada inicia sete dias uma única vez. Salvar listas e registrar novamente não reinicia teste. Renovação manual anual soma um ano ao maior prazo entre agora e paid_until, com recibo idempotente. Vitalícia liberada apenas pelo admin. Host associado a código válido concede a validade do código; revogação/expiração bloqueia, salvo renovação individual posterior ao marco de restrição. Bloqueio explícito do dispositivo prevalece. Pix automático Roku ainda não está integrado: não encaminhar Roku ao checkout das outras plataformas.

## Migração e segurança
Migração portal_roku_identity_licensing: portal_roku_devices, portal_roku_playlists, portal_roku_events, portal_roku_payments; funções portal_roku_license e portal_roku_operation. RLS ativo, tabelas/funções inacessíveis diretamente a anon/authenticated, somente service_role no servidor. Nenhuma alteração em registros Android/LG. IDs e hashes completos não são incluídos no overview ou respostas públicas; logs da aplicação não registram corpo de requisição. Serviço do banco é chamado apenas pelo backend.

## Validação e rollback
Testes de API sintéticos e testes SQL transacionais com rollback verificam identidade, duplicação, erro de chave, vínculo, expiração, bloqueio, renovação cumulativa, recibos repetidos, vitalícia, RLS e ausência de novos registros legados. Suites Android/LG/Pix preservadas. Nenhuma cobrança real ou pacote de app gerado. App Roku ainda precisa implementar transporte, chave e sincronização e ser homologado em aparelho físico.
Rollback do Portal: versão30, commit5e782f4e478570479116c0d859cbee4726a86be2. Backend anterior: portal-control v33. A migração é aditiva e pode permanecer se a UI/API voltar à versão anterior; não excluir os novos registros em rollback.

## Login por código de servidor — `roku-server-code-resolve`

POST `https://xrrgjssvdqvtrqhxpask.supabase.co/functions/v1/portal-control`
Headers: `Content-Type: application/json`, `apikey: <chave pública já configurada>`.

```json
{
  "action": "roku-server-code-resolve",
  "rokuClientId": "valor-nativo-de-GetChannelClientId",
  "deviceCode": "ROKU-12345678-ABCDEFGH",
  "code": "meu-servidor"
}
```

`rokuClientId` é obrigatório, sensível a maiúsculas e espaços e nunca é normalizado. É convertido em SHA-256 no servidor, igual ao registro existente. Não envie o hash no lugar do valor nativo. O código visual é opcional; quando enviado, é normalizado removendo espaços e convertendo para maiúsculas e precisa corresponder ao mesmo dispositivo. Nunca identifica o aparelho sozinho.

`code` é obrigatório, normalizado com trim e minúsculas. Regra idêntica à atual do Android: `^[a-z0-9][a-z0-9_-]{2,31}$` (3 a 32 caracteres, primeiro alfanumérico). Somente os quatro campos do exemplo são aceitos. Campos extras, inclusive identificadores de outras plataformas ou credenciais, são rejeitados com 400. Identificadores com formato de endereço físico também são rejeitados. Não envie chave do dispositivo ou credenciais IPTV nesta ação.

Pré-condições: aparelho já registrado em `portal_roku_devices` e licença efetiva `status = active` e `can_play = true`, calculada pela função existente `portal_roku_license`. A regra mantém as fontes de licença existentes, incluindo teste ainda válido quando a função o classifica como active. A consulta não registra, vincula, ativa, renova ou reinicia teste, nem atribui o código consultado ao aparelho. Pendência, expiração e bloqueio impedem a resolução. O código consultado deve existir, estar ativo, não revogado e ter validade anual vigente ou vitalícia.

Sucesso HTTP 200:

```json
{
  "ok": true,
  "action": "roku-server-code-resolve",
  "state": "active",
  "payload": {
    "server": {
      "code": "meu-servidor",
      "host": "http://provider.example:8080",
      "updated_at": "2026-10-26T12:00:00.000Z"
    }
  }
}
```

O host retornado é somente a origem cadastrada, com HTTP ou HTTPS e porta quando houver. Não contém caminho, query, fragmento ou credenciais embutidas. O hostname é validado e protocolos diferentes são rejeitados. HTTP é preservado; o resolver não acessa o servidor IPTV nem segue redirecionamentos. Cadastro de host inválido ou data de atualização inválida falha fechado com 503.

Erro segue o envelope já usado pelo endpoint: `{"message":"mensagem segura"}`. Não inclui o identificador nativo, dados internos, credenciais ou valores recebidos.

| HTTP | Situação |
| --- | --- |
| 400 | Código, identidade, código visual ou campos inválidos |
| 403 | Aparelho não registrado, código visual divergente ou licença sem acesso ativo |
| 404 | Código inexistente, desativado, revogado ou vencido |
| 429 | Mais de 60 tentativas por identidade em 900 segundos; `Retry-After: 900` |
| 503 | Falha temporária de banco, rede, quota ou configuração do servidor |

A quota usa SHA-256 de um namespace e do hash da identidade. Não usa código visual ou código de servidor para a chave do limite; alterná-los não cria nova quota. O corpo e os identificadores completos não são registrados pelo código. As consultas desta ação têm timeout de 10 segundos por chamada. O endpoint mantém `Cache-Control: no-store`, CORS e autenticação anteriores. Nenhuma credencial de serviço é enviada ao cliente.

### Fonte e verificação

`backend/edge/portal-control/` contém a fonte implantável atual: snapshot da versão 40 mais a extensão isolada. O `backend/portal-api.ts` anterior permanece como referência histórica e não deve substituir a função implantada; sempre recupere a versão atual antes de outra implantação.

Teste: `node --experimental-transform-types backend/roku-server-code-tests.mjs` (Node 24). Exercita o entrypoint real com HTTP/banco simulados, 46 cenários de contrato e segurança. Não altera registros de produção. Testes de regressão existentes foram também executados apontando seu import para `backend/edge/portal-control/index.ts`: Roku, códigos Android, webOS (portal/listas), contas/dispositivos, antiabuso e cadastro por código.

Migrações: nenhuma. Reutiliza tabelas, RLS e funções existentes. Escrita apenas no contador de tentativas; nenhuma escrita em identidade, licença ou lista. O rollback é reimplantar os arquivos exatos da versão anterior, preservando configuração e segredos.

## Redefinição administrativa somente com motivo

`roku-device-rebind` aceita `{id, reason}` sem `device_key`/`deviceKey`. Reutiliza a operação administrativa existente de redefinição, atribuindo o marcador interno pendente, preservando lista, licença, pagamentos, teste e estado ativo. A próxima chamada nativa com identidade persistente, código visual e chave interna registra o novo hash apenas se o vínculo estiver pendente e ativo. A função service-only `portal_native_binding_claim` realiza essa associação sob lock, sem permitir sobrescrever um vínculo já concluído. Não retorna chave ao painel. Chamadas antigas com chave explícita continuam compatíveis.

Formulário administrativo: somente motivo (5–500 caracteres), sem chave e sem reativação implícita. O motivo continua no histórico existente. Quem primeiro consultar com a identidade nativa válida e chave interna após a redefinição conclui o vínculo; o usuário deve abrir a instalação desejada após o reset.
