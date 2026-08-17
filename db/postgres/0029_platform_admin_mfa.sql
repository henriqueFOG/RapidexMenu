CREATE TABLE IF NOT EXISTS platform_admin_mfa (
  admin_id text PRIMARY KEY REFERENCES platform_admins(id) ON DELETE CASCADE,
  secret_ciphertext text NOT NULL,
  enabled_at double precision,
  last_verified_at double precision,
  created_at double precision NOT NULL,
  updated_at double precision NOT NULL
);
