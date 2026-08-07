CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at double precision NOT NULL,
  used_at double precision,
  created_at double precision NOT NULL DEFAULT (extract(epoch FROM clock_timestamp()) * 1000)
);
-- statement-breakpoint
CREATE INDEX IF NOT EXISTS password_reset_tokens_user_idx
ON password_reset_tokens (user_id, expires_at);
