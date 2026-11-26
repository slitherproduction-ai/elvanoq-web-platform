# LG webOS — validação incremental
Base de rollback do Site: versão 28, commit 7889feb1494a1bb5ed17a46b90934e860da52b6e. Backend anterior: portal-control v31; pagamento v12 preservado.

O app calcula LG- + os primeiros 12 hexadecimais do SHA-256. O Portal resolve esse prefixo somente no servidor; rejeita colisões e chave incorreta. Nunca recebe LGUDID puro. As ações nativas webos-device-register e webos-license-status da versão 31 foram preservadas.

Checkout LG: POST portal-control com action webos-checkout, operation validate/create/status, tv_code e device_key. create/status preservam payment_access e os campos originais do pagamento. validate não registra TV nem inicia teste. create/status encaminham exclusivamente no servidor à função de pagamentos existente; ordem pública retorna tv_code, sem MAC interno. PagHiper mantém valor fixo, consentimento, webhook e idempotência originais. A API não busca URLs fornecidas pelo cliente.

Overview preserva escopo de parceiro, substitui identificação de TV por visual_code e não retorna hash. Licenciamento LG administrativo recebe UUID id; MAC Android continua aceito. Redefinição usa wrapper transacional que sincroniza os dois hashes, mantendo a função Android original e preservando licença e teste. Vitalícia e confirmação manual permanecem exclusivas do administrador.

Rollback: reimplantar a versão 28 do Site e conteúdo original da Edge v31. O wrapper adicional é inerte para a versão anterior e pode permanecer. Nenhum dado de Android é migrado e nenhuma cobrança real é emitida nos testes.

Limite da homologação: testes automatizados usam respostas sintéticas; pagamento real e controle remoto de TV LG física dependem de validação do responsável. O Site continua privado, na mesma URL; Sites não fornece uma segunda prévia pública isolada neste fluxo. Não mudar audiência.

## Listas LG
Portal-control acrescenta webos-playlist (tv_code LG- +12 hex, device_key numérica obrigatória, captcha_token playlist, name, kind, url ou host/username/password). Salva somente em TV existente com prefixo único e ambas as chaves válidas; reutiliza portal_playlist_register_host e suas regras. Não converte código LG em MAC; resolve o registro interno existente. Nenhum novo teste é iniciado.

Aplicativo LG: consultar action webos-playlist-sync com device_id SHA-256 completo e device_key. A resposta mantém registered, active, display_name, server_code, license, code_access, playlist (name/kind/credentials/updated_at). playlist=null com licença bloqueada deve interromper reprodução sem apagar dados locais. Não enviar o LGUDID puro nem usar o código visual no campo device_id. O app LG desta conversa não foi modificado: a integração dessa chamada continua no ambiente LG.

Rollback do incremento de listas: Site versão29, commit ff07268d5475588094c2ba1aa12d3724362bc3a0 e Edge versão32.
