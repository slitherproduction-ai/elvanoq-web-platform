# ELVANOQ Play — Portal Web

Código do portal https://elvanoqplay.app, exportado da versão 102 do Sites.
Commit de origem: `431e42d02a507399f443e2919777c35ee53ab241`.

## Executar localmente

Não há etapa de compilação: `dist/` contém os arquivos editáveis publicados.

```sh
python3 -m http.server 8080 --directory dist
```

Abra http://localhost:8080. A autenticação e as operações reais dependem dos serviços de produção; use uma conta de testes autorizada. O servidor local não simula Supabase, pagamentos nem serviços de downloads.

## Estrutura

- `dist/`: páginas públicas, painéis admin/parceiro, CSS, JavaScript, imagens e vídeos.
- `tests/`: testes recentes de filtros de dispositivos e diagnóstico de reprodução.
- `backend/`: código e documentação histórica de integrações, Edge Functions e SQL. Não é um espelho garantido das versões atualmente implantadas no Supabase. Não executar migrações ou publicar funções automaticamente.
- `docs/`: referências visuais e histórico técnico.
- `.openai/hosting.json`: identidade do Site existente e diretório estático.

## Verificação

```sh
node --test tests/*.test.cjs
```

Há testes adicionais em `backend/`, com requisitos próprios e alguns dependentes de banco ou da estrutura histórica. Consulte cada arquivo antes de executá-lo.

## Publicação e colaboração

Este repositório é uma cópia de colaboração do código do Portal. Um push aqui **não publica automaticamente** em elvanoqplay.app. A produção continua no Site existente, e a sincronização com este GitHub é manual. Envie alterações em branches/PRs e revise/sincronize antes de publicar para evitar sobrescrever trabalho concorrente.

Não foram exportados dados de usuários, senhas, tokens de sessão ou segredos dos serviços. `dist/config.js` contém apenas a configuração pública usada pelo navegador; autorização é responsabilidade do backend.
