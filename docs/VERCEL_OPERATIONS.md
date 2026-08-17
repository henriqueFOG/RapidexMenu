# Operação da RapidexMenu na Vercel

## Projetos oficiais

- HMG: `rapidexmenu-hmg` (`prj_zRAZLCCi4dLXN91ZepzNXcaV2euO`), validação humana e E2E antes de publicar.
- Produção: `rapidexmenu` (`prj_qteZJoZgpPaJGhEnICDqYzkxKxZT`), somente branch `master` aprovada, banco, storage e segredos exclusivos.
- Legado identificado: `rapidexmenu-v2` (`prj_oTZ9oKDzcmxlqjPBqhZw1rx58ifw`), sem domínio oficial e com builds atuais bloqueados pelo fail-closed de projeto desconhecido. Retirar integrações e excluir somente depois de confirmar ausência de tráfego, banco compartilhado e cron.
- Projetos antigos adicionais: retirar domínio e integrações, marcar como arquivados e excluir somente depois de confirmar que não recebem tráfego nem cron. Não reutilizar seus bancos ou segredos.

O código bloqueia builds de projetos desconhecidos por meio de `scripts/vercel-ignore-build.mjs`.

Auditoria somente leitura de 17/08/2026: produção estava em Node 20 e servindo uma release antiga configurada como homologação; HMG estava em Node 24. Ajustar ambos para Node 22 no painel antes do próximo deploy. O build do projeto oficial agora executa o gate de prontidão e falha antes de compilar enquanto qualquer requisito obrigatório estiver pendente.

## Por que o limite de builds acabava rápido

Cada push/deploy gerava uma nova compilação, inclusive para pequenos ajustes. A rotina correta é agrupar alterações, validar localmente, fazer um único deploy de HMG e promover exatamente o artefato aprovado. Nunca usar produção como ambiente de teste.

## Requisitos de produção

- Node.js 22, conforme `package.json` e `.nvmrc`.
- Neon/PostgreSQL exclusivo, com `DATABASE_URL` limitada e `RAPIDEX_MIGRATION_DATABASE_URL` separada.
- Vercel Blob conectado ao projeto, fornecendo `BLOB_READ_WRITE_TOKEN`.
- `CRON_SECRET` aleatório com 32 ou mais caracteres.
- O manifesto mantém uma execução diária de segurança, compatível com Hobby, para não quebrar HMG. Antes de clientes pagantes, contratar um plano Vercel que aceite cron a cada 5 minutos e alterar a agenda para `*/5 * * * *`, ou configurar um agendador externo autenticado na mesma frequência.
- Logs estruturados e alertas externos para falhas de manutenção, webhooks, jobs mortos e indisponibilidade do health check.

As variáveis `RAPIDEX_*_READY` e `RAPIDEX_*_VERIFIED` do exemplo de produção são atestações. Elas só podem mudar para `true` depois que a evidência externa correspondente estiver registrada; não servem para contornar o gate.

## Publicação econômica

1. Rodar typecheck, testes, lint e build local uma vez ao fechar o lote.
2. Subir um único checkpoint em HMG.
3. Executar E2E de Central, estabelecimento e comprador.
4. Obter aprovação do Henrique.
5. Promover o mesmo commit para produção, sem reconstruções intermediárias deliberadas.
