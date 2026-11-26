# ELVANOQ Play / Observatory

Atualização visual: 18 de novembro de 2026.
Base de rollback: versão 92, commit cc8da7aba2cfa58dbdd147ad94ae9a8f40545b6c.

## Escopo

Sistema visual comum em 18 páginas: início, adicionar lista, ativação,
compatibilidade, download, tutoriais, segurança, suporte, documentos legais,
login de administrador/revendedor e os dois painéis de gerenciamento.

- Azul profundo, ciano pontual, bordas discretas e tipografia Manrope.
- Controles compactos em desktop e alvos de toque de 44 px em celular.
- Composição original do player na página inicial, identificada como ilustração.
- Rodapé organizado por tarefa e navegação comum nos documentos.
- Busca de páginas/funções com diálogo acessível e atalho Ctrl/Cmd+K.
- Busca local na Compatibilidade, contador e estado vazio.
- Menu recolhível do painel em celular; indicadores recolhidos nas outras seções.
- Índice navegável na política de privacidade e botão voltar ao topo.
- Compartilhamento com imagem local de 1200x630, breadcrumbs estruturados,
  descrição de envio de lista corrigida e sitemap com URLs públicas indexáveis.
- Painéis/login continuam noindex; documentos em revisão continuam noindex.

Os contratos de API, autenticação, permissões, listas, pagamento e licenciamento
não foram alterados. Nenhum código de app ou backend foi modificado.

## Verificação

- HTML: 18 páginas, referências locais existentes, sem IDs duplicados e JSON-LD válido.
- JavaScript novo: node --check.
- Navegação rápida: busca por “ativ” retorna Ativação.
- Compatibilidade: busca por “roku” retorna 1 de 8 plataformas.
- QR Roku: preenchimento de ROKU-4F7A2C91-B03E58D6 preservado, editável.
- Dados sintéticos: 12 dispositivos, paginação 1–10 e 11–12,
  filtro Roku com 3 registros, seleção 3 de 3 e limpeza da seleção.
- Rotas do painel de parceiro e administrador, abertura de detalhes e cadastro.
- Layout em iframes de 320/390/768/1280 px, sem transbordamento horizontal
  nas páginas principais. Também revisados Pix, download, tutoriais e privacidade em 390 px.
- Testes visuais não substituem transação Pix nem integração em TV física.
  Chamadas de API do preview podem ser recusadas por CORS; origem oficial preservada.
- Fixtures temporários removidos antes do empacotamento; nenhuma ação destrutiva executada.

## Referências consultadas

- https://linear.app/now/behind-the-latest-design-refresh
- https://www.raycast.com/
- https://developers.google.com/search/docs/fundamentals/get-started-developers
- https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls

A referência é de hierarquia, consistência e densidade; a composição e marca são ELVANOQ.
