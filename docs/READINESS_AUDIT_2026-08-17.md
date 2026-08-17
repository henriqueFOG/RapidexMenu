# Auditoria real de prontidão — 17/08/2026

Esta evidência foi obtida em modo somente leitura. Nenhum projeto, variável, banco ou deploy foi alterado.

## Vercel

- Projeto oficial: `rapidexmenu` (`prj_qteZJoZgpPaJGhEnICDqYzkxKxZT`).
- O domínio `rapidexmenu.com.br` está associado ao projeto oficial, mas serve o commit antigo `2e52411e78bfd958c8d8fbc8c9961c72b207b90d`.
- O health dessa release declara ambiente `homologation`, banco PostgreSQL disponível e uploads indisponíveis. Portanto, o domínio oficial ainda não é uma produção isolada e aprovada.
- O projeto oficial está configurado com Node 20; deve ser alterado para Node 22.
- Projeto HMG: `rapidexmenu-hmg` (`prj_zRAZLCCi4dLXN91ZepzNXcaV2euO`).
- HMG está saudável no commit `b7a7d8b56926fc049a26d1fae2a0ce4f96dbed28`, com aplicação, PostgreSQL, autenticação e uploads operacionais.
- A configuração visual do projeto HMG ainda informa Node 24, mas `package.json` fixa Node 22 e o build publicado usou Node 22. Ajustar o painel continua recomendado para remover a divergência documental.
- CI, segurança, secret scan, E2E público e E2E completo de HMG passaram no mesmo commit. A rodada encontrou e corrigiu uma corrida real de atualização de status de pedido antes da aprovação.
- HMG não possui evidência de e-mail, cobrança, pagamentos de lojas, cron autenticado, WhatsApp ou OpenAI ativos.
- Projeto legado identificado: `rapidexmenu-v2` (`prj_oTZ9oKDzcmxlqjPBqhZw1rx58ifw`), sem domínio oficial e com deploys recentes em erro. A exclusão exige confirmação destrutiva separada.

## Neon

- Existe o projeto `rapidexmenu-hmg-db` (`shy-pine-28730393`) em São Paulo, com 30 migrations até `0031_maintenance_schedules.sql`.
- Existe um projeto genérico antigo `neon-celeste-flame` (`silent-sound-47264750`) nos Estados Unidos, com schema incompleto e Neon Auth legado.
- Não existe evidência de um projeto nomeado e isolado para produção.
- Os dois projetos observados possuem janela de histórico de 6 horas; isso não comprova o RPO/RTO de produção nem substitui o restore drill da release final.
- As branches principais observadas não estão protegidas e conexões públicas não estão bloqueadas. A arquitetura serverless pode exigir acesso público, mas credenciais, papéis e controles precisam ser validados antes da produção.
- Um restore drill isolado da release atual foi aprovado em 17/08/2026: alteração-canário, reset ao parent, comparação de fingerprint/schema/contagens e remoção da branch temporária, sem tocar a branch principal.

## Conclusão

O código está preparado para HMG, mas produção permanece bloqueada. Antes de clientes pagantes é obrigatório criar/confirmar banco exclusivo, storage, Node 22, segredos, MFA, e-mail, scheduler, pagamentos, backup, monitoramento, jurídico e suporte. O build do projeto oficial agora executa o gate e falha fechado enquanto esses requisitos não estiverem comprovados.
