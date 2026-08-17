-- A identidade abaixo nunca pode operar a Central da plataforma. Esta revogação
-- atua somente em platform_admins; conta de usuário e vínculos com lojas permanecem intactos.
UPDATE platform_admins
SET status = 'revoked', updated_at = extract(epoch FROM clock_timestamp()) * 1000
WHERE user_id IN (
  SELECT id FROM app_users WHERE lower(email) = 'heloisa.gall@gmail.com'
)
  AND status <> 'revoked';

-- statement-breakpoint

-- Invalida sessões existentes somente se a identidade tinha perfil de plataforma.
UPDATE app_users
SET auth_version = auth_version + 1,
    updated_at = extract(epoch FROM clock_timestamp()) * 1000
WHERE lower(email) = 'heloisa.gall@gmail.com'
  AND EXISTS (
    SELECT 1 FROM platform_admins WHERE platform_admins.user_id = app_users.id
  );
