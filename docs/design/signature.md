# ELVANOQ Play / Signature

Rebrand visual do Portal: 26 de novembro de 2026.
Base de rollback: branch `export/portal-v102` (commit `3dd1ccc`).

## Direção

O Portal passa a usar o mesmo sistema visual aprovado para os apps de TV
(redesign de novembro de 2026), para que site e aplicativo pareçam um só produto:

| Token | Valor | Uso |
|---|---|---|
| `--bg` | `#070B14` | fundo |
| `--rail` | `#0A101C` | campos, trilho do painel |
| `--surface` | `#0E1524` | cartões |
| `--surface-raised` | `#1A2438` | item selecionado, ícones |
| `--ink` | `#F4F8FF` | texto e botão principal |
| `--muted` | `#9AA6BD` | texto secundário |
| `--faint` | `#7B879E` | legendas (contraste ≥ 5:1) |
| `--accent` | `#00D7FF` | estado ativo, destaques |

- Fonte Inter (Google Fonts, `display=swap`), no lugar de Manrope.
- Foco = branco (anel de 2 px), como nos apps de TV. Ciano = ativo/selecionado.
- Botão principal claro em pílula; secundários translúcidos com borda fina.
- Cabeçalho fixo com vidro fosco; luz ambiente ciano/azul suave no fundo.
- Cartões com gradiente sutil, borda de 1 px e brilho interno; raio 20 px.
- Tipografia maior e mais legível (navegação 13 px, texto 15–18 px).
- Painéis: trilho lateral, item ativo com barra ciana, métricas em cartões,
  badges em pílula, paginação no botão claro.
- `prefers-reduced-motion` respeitado.

## Implementação

Tudo está em `dist/brand.css`, carregado por último em todas as 18 páginas.
É uma camada de cores, tipografia, espaçamento, raios e sombras: nenhuma
regra altera estrutura, URLs, IDs ou o comportamento dos scripts. Para voltar
ao visual anterior basta remover o `<link>` de `brand.css` e restaurar o link
da fonte Manrope.

## Verificação

- Sem rolagem horizontal em 320, 390, 768 e 1280 px (16 páginas públicas e logins).
- Painel administrador conferido com dados sintéticos (12 dispositivos) em desktop e celular.
- `node --check` em todo JS, `node --test tests/*.test.cjs` e `tools/cache-bust.py --check`.
- Capturas: `signature-home-desktop.jpg`, `signature-home-mobile.jpg`, `signature-panel-desktop.jpg`.
