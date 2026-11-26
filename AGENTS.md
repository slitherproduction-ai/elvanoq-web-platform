# Orientações para colaboradores e agentes

Leia README.md antes de alterar o projeto.

- O frontend é buildless: edite os arquivos de dist/ diretamente e preserve URLs existentes.
- Não alterar contratos de API, banco, funções Supabase, pagamentos ou regras de licenciamento sem demanda explícita.
- Nunca incluir credenciais privadas, tokens ou dados reais de usuários em commits/logs.
- Preservar controle de acesso admin/parceiro e os fluxos específicos de cada plataforma; VIDAA permanece desativado.
- Código de servidor resolve o host; usuário e senha devem ser validados antes de liberar acesso. Não confundir com o fluxo de lista enviada pelo Portal.
- Validar sintaxe JavaScript e executar os testes relevantes. Documentar limitações de testes locais.
- GitHub não tem publicação automática configurada. Não criar outro Site, nem trocar domínio ou project_id para publicar alterações.
- Trabalhar em branch e apresentar diff; verificar mudanças concorrentes antes de integrar.
