CREATE TABLE IF NOT EXISTS platform_admins (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'support',
  status text NOT NULL DEFAULT 'active',
  created_by_user_id text REFERENCES app_users(id) ON DELETE SET NULL,
  last_access_at double precision,
  created_at double precision NOT NULL DEFAULT (extract(epoch FROM clock_timestamp()) * 1000),
  updated_at double precision NOT NULL DEFAULT (extract(epoch FROM clock_timestamp()) * 1000),
  UNIQUE (user_id),
  CHECK (role IN ('owner', 'admin', 'support', 'viewer')),
  CHECK (status IN ('active', 'blocked', 'revoked'))
);
-- statement-breakpoint
CREATE INDEX IF NOT EXISTS platform_admins_status_role_idx
  ON platform_admins (status, role);
-- statement-breakpoint
CREATE TABLE IF NOT EXISTS platform_audit_logs (
  id text PRIMARY KEY,
  actor_user_id text REFERENCES app_users(id) ON DELETE SET NULL,
  actor_email text NOT NULL,
  actor_role text NOT NULL,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id text,
  reason text,
  metadata_json text NOT NULL DEFAULT '{}',
  request_id text,
  created_at double precision NOT NULL DEFAULT (extract(epoch FROM clock_timestamp()) * 1000)
);
-- statement-breakpoint
CREATE INDEX IF NOT EXISTS platform_audit_logs_created_idx
  ON platform_audit_logs (created_at DESC);
-- statement-breakpoint
CREATE INDEX IF NOT EXISTS platform_audit_logs_target_idx
  ON platform_audit_logs (target_type, target_id, created_at DESC);
