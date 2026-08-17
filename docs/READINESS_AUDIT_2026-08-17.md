# Auditoria real de prontidão — 17/08/2026

Esta evidência foi obtida em modo somente leitura. Nenhum projeto, variável, banco ou deploy foi alterado.

## Vercel

- Projeto oficial: `rapidexmenu` (`prj_qteZJoZgpPaJGhEnICDqYzkxKxZT`).
- O domínio `rapidexmenu.com.br` está associado ao projeto oficial, mas serve o commit antigo `2e52411e78bfd958c8d8fbc8c9961c72b207b90d`.
- O health dessa release declara ambiente `homologation`, banco PostgreSQL disponível e uploads indisponíveis. Portanto, o domínio oficial ainda não é uma produção isolada e aprovada.
- O projeto oficial está configurado com Node 20; deve ser alterado para Node 22.
- Projeto HMG: `rapidexmenu-hmg` (`prj_zRAZLCCi4dLXN91ZepzNXcaV2euO`).
- HMG está saudável no commit `d3214ec0d603ef091b4f823c9f26fa0b90aec8a7`, com aplicação, PostgreSQL e autenticação operacionais.
- HMG está em Node 24; deve ser alterado para Node 22 antes do próximo deploy.
- HMG não possui evidência de e-mail, cobrança, pagamentos de lojas, cron autenticado, WhatsApp ou OpenAI ativos.
- Projeto legado identificado: `rapidexmenu-v2` (`prj_oTZ9oKDzcmxlqjPBqhZw1rx58ifw`), sem domínio oficial e com deploys recentes em erro. A exclusão exige confirmação destrutiva separada.

## Neon

- Existe o projeto `rapidexmenu-hmg-db` (`shy-pine-28730393`) em São Paulo, com o schema de HMG atual até a Central anterior a esta rodada.
- Existe um projeto genérico antigo `neon-celeste-flame` (`silent-sound-47264750`) nos Estados Unidos, com schema incompleto e Neon Auth legado.
- Não existe evidência de um projeto nomeado e isolado para produção.
- Os dois projetos observados possuem janela de histórico de 6 horas; isso não comprova o RPO/RTO de produção nem substitui o restore drill da release final.
- As branches principais observadas não estão protegidas e conexões públicas não estão bloqueadas. A arquitetura serverless pode exigir acesso público, mas credenciais, papéis e controles precisam ser validados antes da produção.

## Conclusão

O código está preparado para HMG, mas produção permanece bloqueada. Antes de clientes pagantes é obrigatório criar/confirmar banco exclusivo, storage, Node 22, segredos, MFA, e-mail, scheduler, pagamentos, backup, monitoramento, jurídico e suporte. O build do projeto oficial agora executa o gate e falha fechado enquanto esses requisitos não estiverem comprovados.
