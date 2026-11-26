# Distribuição e atualização do APK

## Serviço isolado
Site de distribuição: appgprj_6adf675dec5c81919740087716ec7b4a, https://elvanoq-downloads.slitherproduction.chatgpt.site. Armazena arquivos no R2 provisionado por Sites. Público apenas para leitura da versão ativa e seu APK; rotas /admin/* exigem JWT válido do Supabase e papel admin ativo em portal_staff, sem senha inicial pendente. Verificação por apk-admin-auth v1, separada do licenciamento. A função portal-control v40 não foi substituída.

Portal administrativo permanece owner-private. Nenhum segredo de servidor no frontend; sua sessão atual é usada no upload. O endpoint retorna metadados públicos mínimos; identificadores de operador e registros privados não são publicados. Não há acesso público às chaves dos objetos nem à lista de envios.

## Fluxo
Aplicativo / APK → versão, arquivo APK (até 200 MiB), notas opcionais → Enviar e disponibilizar APK → validar estrutura/tamanho/SHA-256 no servidor → substituir automaticamente o download ativo. Upload em partes de 8 MiB; envio incompleto não tem rota de download. Tamanho, ZIP/AndroidManifest.xml e SHA-256 são conferidos no servidor. Isso não valida criptograficamente a assinatura Android, package ID, versionCode ou malware. Envie somente o APK assinado da aplicação, mantendo a assinatura; o número da versão é informado pelo administrador.

A troca da versão ativa usa um objeto JSON atômico do R2. Arquivos são imutáveis por ID, sem sobregravar versões antigas. Confirmar uma versão anterior restaura o download. Uploads e restaurações administrativas concorrentes usam a última ativação concluída; atualizar a lista mostra o estado corrente. Multipart incompleto segue o lifecycle padrão R2; arquivos validados e versões anteriores não são apagados automaticamente. Envios interrompidos devem ser reiniciados; a retomada após fechar o navegador não está implementada.

GET/HEAD /ELVANOQ-Play.apk entrega a versão ativa com Content-Disposition e suporte a Range. /release.json retorna versão/tamanho/SHA-256 e URL. Sem versão publicada, retorna release:null e o portal mantém o download anterior do GitHub. Quando o primeiro APK for disponibilizado, o botão passa a usar o serviço automaticamente. O código Downloader 6585830 não é alterado automaticamente no AFTVnews.

## Domínio próprio
CNAME downloads → custom-domains.chatgpt.site.
TXT _openai-site-verification.downloads → openai-site-verification=Qw3495X2oXw-40qWlH9QwT2E77Sa5sWdzqOzJPlmwgg
TXT _cf-custom-hostname.downloads → fbe6c6cd-b6be-49e3-8cbf-41532c22277c
DNS validado e SSL ativo em 26/10/2026. ELVANOQ_CONFIG.downloadService atualizado para https://downloads.elvanoqplay.app. Não alterar a raiz do portal ou registros de e-mail. O endereço gerado já permite upload e download até a validação do domínio.

## Validação
Testes sintéticos do serviço verificam bloqueio anon/parceiro, upload em partes, comprimento, estrutura do APK, SHA-256, rascunho não público, publicação explícita, retorno de versão anterior, GET/HEAD/Range e rejeição de arquivos inválidos sem trocar a versão ativa. Testes não substituem upload e instalação de um APK real em TV. Nenhum APK foi gerado ou disponibilizado automaticamente.

As notas de qualquer versão validada podem ser alteradas em Editar notas / novidades, sem reenviar o APK. Somente administrador autenticado pode salvar até 2000 caracteres. O release.json consulta as notas atualizadas do registro ativo sem reativar versões do histórico. Um novo upload válido substitui automaticamente o arquivo ativo; arquivos anteriores permanecem para restauração.

A página /download/ usa diretamente o endereço fixo do portal, sem fallback para um APK antigo do GitHub. Consulta release.json sem cache para exibir versão, tamanho, data e notas da versão ativa. Atualiza ao retornar à aba, pelo botão Atualizar informações e a cada minuto enquanto visível. Falhas removem os metadados desatualizados e mostram orientação para tentar novamente, preservando o endereço oficial. O código externo do Downloader permanece independente.
Validação: node backend/apk-download-tests.mjs; prévia local com metadados simulados confirma versão, tamanho, notas e expansão das novidades. O teste não envia ou publica um APK real.
