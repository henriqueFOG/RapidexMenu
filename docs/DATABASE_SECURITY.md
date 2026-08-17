# Segurança e isolamento do banco

## Papéis separados

Produção usa duas credenciais diferentes:

- `RAPIDEX_MIGRATION_DATABASE_URL`: proprietário/DDL, usado somente no procedimento controlado de migração;
- `DATABASE_URL`: role `rapidex_app`, usada pela aplicação, sem `CREATE`, `ALTER`, `DROP`, gestão de roles ou superuser.

O arquivo `db/postgres/production-app-role.sql` contém os grants mínimos. A senha da role é criada e armazenada apenas no Neon/Vercel. Produção não executa migrations durante o build, salvo se `RAPIDEX_RUN_MIGRATIONS_DURING_BUILD=true` for deliberadamente habilitado para uma janela controlada.

## Isolamento entre estabelecimentos

As rotas públicas resolvem o estabelecimento pelo slug e as rotas administrativas obtêm `restaurantId` da associação autenticada; consultas de tenant sempre incluem esse identificador. A Central é o único contexto global e exige RBAC, MFA em produção, motivo e auditoria.

RLS não será ativado de forma decorativa com uma conexão global: isso daria falsa segurança e quebraria a Central. A etapa segura para RLS é criar duas roles/conexões (tenant e plataforma), propagar `restaurant_id` dentro de uma transação e só então habilitar políticas `USING`/`WITH CHECK`. Até essa migração, o gate exige role de privilégio mínimo, testes E2E de isolamento e revisão automatizada das consultas sensíveis.

## Verificações obrigatórias

1. `SELECT current_user` retorna `rapidex_app` no runtime.
2. `CREATE TABLE` e `ALTER TABLE` falham usando `DATABASE_URL`.
3. Migrations passam usando somente `RAPIDEX_MIGRATION_DATABASE_URL`.
4. O E2E cria duas lojas e prova que uma não lê/altera dados da outra.
5. Backups e restore são testados antes de clientes pagantes.
