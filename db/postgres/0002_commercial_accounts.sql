CREATE TABLE IF NOT EXISTS app_users (
  id text PRIMARY KEY,
  email text NOT NULL,
  password_hash text NOT NULL,
  full_name text NOT NULL,
  phone text,
  status text NOT NULL DEFAULT 'active',
  auth_version integer NOT NULL DEFAULT 1,
  last_login_at double precision,
  created_at double precision NOT NULL DEFAULT (extract(epoch FROM clock_timestamp()) * 1000),
  updated_at double precision NOT NULL DEFAULT (extract(epoch FROM clock_timestamp()) * 1000),
  CHECK (status IN ('active', 'blocked', 'deleted'))
);
-- statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS app_users_email_unique ON app_users (lower(email));
-- statement-breakpoint
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS trial_ends_at double precision;
-- statement-breakpoint
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS onboarding_completed integer NOT NULL DEFAULT 0 CHECK (onboarding_completed IN (0, 1));
-- statement-breakpoint
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS published_at double precision;
-- statement-breakpoint
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS terms_accepted_at double precision;
-- statement-breakpoint
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS privacy_accepted_at double precision;
-- statement-breakpoint
UPDATE restaurants
SET onboarding_completed = 1,
    published_at = COALESCE(published_at, created_at),
    trial_ends_at = COALESCE(trial_ends_at, created_at + (14 * 24 * 60 * 60 * 1000))
WHERE onboarding_completed = 0;
