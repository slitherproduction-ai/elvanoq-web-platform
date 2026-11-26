Implemente a área Legal e Privacidade do ELVANOQ Play, preservando as alterações atuais. Não gere APK nem execute workflows de compilação.

As páginas de revisão estão em https://elvanoq-play-portal.slitherproduction.chatgpt.site, nos caminhos:
/legal/
/politica-de-privacidade/
/termos-de-uso/
/licenca-e-reembolsos/
/exclusao-de-dados/
/suporte/

Essas páginas ainda estão privadas e em revisão. Faltam identificação do responsável, e-mail público, canal operacional de exclusão e publicação sem login. Implemente a estrutura, mas não trate rascunhos como termos vigentes, não exija aceite deles e não declare o app pronto para submissão. Centralize as URLs para trocar pela hospedagem pública definitiva depois. Nunca incorpore token de acesso ao site nem credenciais ChatGPT no app.

1. Em Configurações > Legal e Privacidade, criar entradas para os cinco documentos e avisos/licenças de terceiros. Disponibilizar Termos e Privacidade também antes do login. Garantir navegação, foco, rolagem e botão Voltar em smartphone, tablet, Android TV e Fire TV; não depender exclusivamente de um navegador que pode faltar na TV.
2. Preparar leitura interna e cópia local versionada dos textos finais para uso offline. Usar somente conteúdo e domínios aprovados, sem WebView com navegação arbitrária ou JavaScript desnecessário. Não enviar MAC, senha, chave ou URL da lista nos links legais. Exibir data/versão e falha de rede sem bloquear usuários existentes.
3. Quando os Termos finais forem aprovados, implementar aceite explícito e versionado antes de uma nova adesão, sem caixa pré-marcada; manter os documentos consultáveis e planejar mudanças materiais para usuários existentes sem apagar listas. Não confundir ciência da Política de Privacidade com consentimento genérico; consentimentos específicos devem ser separados e necessários ao fluxo correspondente. Enquanto os documentos forem rascunhos, deixar a cobrança de aceite desativada.
4. Exibir avisos claros: o app é apenas player, não fornece conteúdo e a licença não inclui listas/canais. Antes de sincronizar dados, explicar que uma lista cadastrada no portal pode incluir credenciais/URL privada armazenadas no servidor. Não afirmar que todas as credenciais ficam somente no aparelho, que o MAC é necessariamente físico ou que HTTP oferece criptografia.
5. Diferenciar apagar dados locais, excluir cadastro no portal, encerrar conta ELVANOQ e solicitar cancelamento/reembolso. Integrar somente mecanismos reais e autenticados de solicitação; se faltar endpoint, informar o contrato necessário. Não simular envio, exclusão nem cancelamento. Não incluir a API administrativa de exclusão no app nem permitir exclusão apenas conhecendo um MAC. Preservar a confirmação explícita para ações irreversíveis.
6. Auditar dependências e manifesto mesclado; gerar inventário real de LICENSE/NOTICE e atribuições, incluindo TMDB quando usado. Preparar relatório factual para Data safety, público-alvo, classificação e App access, sem inventar respostas ou declarar conformidade automaticamente.
7. Preparar a separação entre distribuição externa e versão Google Play: revisar Play Billing/alternativas efetivamente permitidas para a licença digital; não transportar automaticamente o Pix/QR/links de compra externos. Remover do build Play a autoatualização por APK e REQUEST_INSTALL_PACKAGES, preservando o canal externo em variante adequada. Não implementar faturamento novo nem mudar regras comerciais sem identificar o escopo e as dependências.
8. Testar acesso antes/depois do login, leitura offline, foco e Voltar na TV, persistência de versão dos documentos e ausência de dados sensíveis nos links. Não alterar licenças, identidade ou dados de usuários durante a integração.

Atualize README/changelog, salve checkpoint e informe versão, branch, commit, sincronização GitHub, testes e pendências. Não gere APK. Não submeta à loja nem apresente esta etapa como aprovação jurídica ou da Google Play.
