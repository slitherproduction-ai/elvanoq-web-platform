# PagHiper Pix — configuração e homologação

Implementação para licença anual por dispositivo, R$ 24,90. Sem cobrança recorrente: cada ativação/renovação gera um Pix.

## Segredos no Supabase

Projeto: elvanoq-staging (xrrgjssvdqvtrqhxpask), Edge Functions → Secrets.

- `PAGHIPER_API_KEY`: apiKey da conta PagHiper.
- `PAGHIPER_TOKEN`: token individual da mesma conta.
- `PAGHIPER_ENABLED`: `true` para habilitar geração e processamento.

As credenciais ficam exclusivamente no servidor. Não usar config.js, Git ou chat. A conta PagHiper precisa estar pré-verificada ou verificada para emitir Pix.

Webhook enviado em cada emissão: `https://xrrgjssvdqvtrqhxpask.supabase.co/functions/v1/paghiper-payments/webhook`.
A função é pública para receber notificações; callbacks são verificados com API key/token no endpoint oficial fixo e confirmados por consulta de status. Nunca seguir source_api recebido como URL de destino.

## Fluxo

MAC+chave validam o aparelho; nome, e-mail e CPF/CNPJ vão para a PagHiper após consentimento no formulário. Dados pessoais do pagador não são persistidos pelo portal. Valor fixado no servidor/banco. Reserva por aparelho serializa emissões; cobrança pendente é reutilizada. Emissão ambígua permanece bloqueada para conferência, sem repetição automática que possa duplicar a cobrança. Pedidos `creating`/`unknown` exigem conferência pelo responsável na PagHiper antes de qualquer reemissão.

Webhook e consulta autenticada por MAC/chave verificam status no provedor. Aprovação integral libera 1 ano atomicamente; repetição não acrescenta prazo. Licença vitalícia não é vendida. Dispositivo suspenso permanece bloqueado mesmo se uma cobrança anterior for paga. Estorno sinaliza revisão administrativa; não remove automaticamente períodos que possam ter outras origens.

## Limites de homologação

Testes de API usam mocks; testes SQL são transacionais e revertidos. Nenhuma cobrança real é criada por esses testes. Validar emissão real, pagamento, callback e renovação após configurar os segredos. A integração do APK permanece pendente. Não ampliar visibilidade do Site.

Documentação: https://dev.paghiper.com/reference/requisicao-para-criacao-de-pix e https://dev.paghiper.com/reference/notificacoes-automatica-de-status-retorno-automatico-pix

## Pagamento pelo MAC sem chave do dispositivo

O checkout aceita MAC ainda não cadastrado e não exige chave. A chave opcional digitada não é usada como autorização e não altera chaves existentes. Uma sessão aleatória por MAC, mantida na aba do navegador, protege a emissão e consulta do pedido; o banco guarda apenas seu hash. Outra sessão não pode recuperar uma cobrança pendente pelo MAC.

A licença paga é registrada por MAC, mesmo antes de cadastrar o aparelho. Esse pagamento não cria credenciais de gerenciamento, não altera listas, não inicia teste e não vincula automaticamente a instalação do app. As operações de listas, consulta do dispositivo e gestão continuam exigindo suas autenticações próprias.
