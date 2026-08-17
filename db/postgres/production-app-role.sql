-- Execute como proprietário do banco APÓS criar a role de login rapidex_app
-- no Neon. Defina a senha exclusivamente no provedor; nunca neste arquivo.
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT CONNECT ON DATABASE neondb TO rapidex_app;
GRANT USAGE ON SCHEMA public TO rapidex_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO rapidex_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO rapidex_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO rapidex_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO rapidex_app;

-- A credencial de runtime não pode criar/alterar/apagar estrutura.
REVOKE CREATE ON SCHEMA public FROM rapidex_app;
