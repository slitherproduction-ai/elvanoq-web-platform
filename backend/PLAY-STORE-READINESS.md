# Documentação e preparação para a Google Play

Revisão em 23/10/2026. Documentos de trabalho, não certificação de conformidade nem garantia de aprovação.

## Páginas criadas
- /legal/: central de documentos.
- /politica-de-privacidade/: política, dados locais/remotos, terceiros, retenção, direitos e contato.
- /termos-de-uso/: player independente, uso autorizado, licença e limites.
- /licenca-e-reembolsos/: compra, renovação e atendimento conforme o canal.
- /exclusao-de-dados/: escopos de exclusão e solicitação pelo titular.
- /suporte/: orientações de atendimento.

## Pendências antes de chamar os textos de versão final
1. Confirmar nome do responsável/controlador ou empresa e e-mail público de suporte/privacidade. Compatibilizar a identificação com a ficha do desenvolvedor.
2. Tornar SOMENTE os documentos necessários acessíveis em HTTPS sem autenticação, em hospedagem pública própria ou separada. O portal atual continua privado. Não usar seus links privados no Play Console; não tornar o painel público para resolver isso.
3. Concluir o canal efetivo de exclusão por solicitação e o encerramento de conta onde aplicável. Hoje a exclusão do dispositivo é administrativa; uma página com instruções pendentes não satisfaz sozinha o requisito. Separar conta do app, conta do portal e credenciais do provedor IPTV. Não simular sucesso de solicitação.
4. Confirmar retenção de dados, logs, backups, transferências internacionais, contratos dos operadores e rotinas de atendimento LGPD. Não inventar prazos ou garantias.
5. Definir público-alvo/classificação indicativa e verificar obrigações relacionadas a menores; o PIN parental não substitui essa revisão.
6. Revisar o artefato final e todos os SDKs, incluindo dependências transitivas, antes de afirmar ausência de coleta, compartilhamento, publicidade ou telemetria.

## Constatações técnicas a conferir na versão destinada à loja
- O identificador apresentado como MAC pode ser gerado pela instalação. Não é necessariamente MAC físico.
- Cadastro por código resolve Host sem enviar a senha IPTV ao resolvedor; listas cadastradas no portal podem armazenar credenciais/URL e sincronizá-las com o app.
- Há comunicação com Supabase, Cloudflare, provedor IPTV, TMDB e, nas funções utilizadas, PagHiper, GitHub e trailers externos.
- O manifesto lido contém REQUEST_INSTALL_PACKAGES, READ_EXTERNAL_STORAGE/WRITE_EXTERNAL_STORAGE com maxSdkVersion 32 e serviços de reprodução. Auditar o manifesto mesclado do AAB final e remover permissões sem uso justificável.
- A versão da Play não deve usar REQUEST_INSTALL_PACKAGES para autoatualizar por APK do GitHub. Preservar o canal externo em variante apropriada; a variante Play deve atualizar pela loja.
- A licença do player é funcionalidade digital paga. Pix/QR Code e links para pagamento externo não devem ser levados automaticamente para o build Play. Verificar Play Billing ou programa/exceção aplicável e efetivamente habilitado; não presumir elegibilidade.
- Servidores IPTV HTTP não permitem afirmar que todas as transmissões do app são criptografadas. Revisar os fluxos antes de responder ao Data safety.

## Segurança dos dados (Data safety)
O formulário do Play Console não é substituído por uma página legal. Preparar respostas a partir dos fluxos efetivos do AAB e dos SDKs:
- IDs de dispositivo/instalação, contatos/nome quando usados no cadastro/suporte, compras e pedidos, registros técnicos e interações com os serviços.
- Credenciais e URLs privadas de listas transmitidas ao provedor; sincronização opcional pelo portal.
- Títulos e parâmetros consultados para metadados, processamento efêmero e exceções de compartilhamento avaliados segundo as definições do Google.
- Distinguir armazenamento apenas local de transmissão para fora do aparelho. Não marcar “nenhum dado coletado” sem concluir a auditoria.
- Confirmar coleta obrigatória/opcional, finalidades, destinatários, proteção em trânsito e exclusão. Não marcar respostas definitivas neste rascunho.

## Outras entregas necessárias
Preparar App access com acesso de revisão válido e conteúdo de demonstração autorizado, declarações de anúncios/permissões, classificação IARC, faixa etária e ficha da loja. Gerar inventário de licenças de dependências a partir do lockfile e arquivos LICENSE/NOTICE; não inventar um inventário de código aberto. Validar atribuição TMDB conforme a utilização efetiva e os termos do fornecedor. Isso exige revisão do app, não só das páginas.

## Referências oficiais consultadas
- https://support.google.com/googleplay/android-developer/answer/10144311
- https://support.google.com/googleplay/android-developer/answer/13327111
- https://support.google.com/googleplay/android-developer/answer/10787469
- https://support.google.com/googleplay/android-developer/answer/9858738
- https://support.google.com/googleplay/android-developer/answer/12085295
- https://support.google.com/googleplay/android-developer/answer/9859455
- https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm
