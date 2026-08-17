ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS platform_blocked_at double precision;
-- statement-breakpoint
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS platform_block_reason text;
-- statement-breakpoint
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS platform_previous_status text;
-- statement-breakpoint
CREATE INDEX IF NOT EXISTS restaurants_platform_blocked_idx
  ON restaurants (platform_blocked_at) WHERE platform_blocked_at IS NOT NULL;
-- statement-breakpoint
CREATE TABLE IF NOT EXISTS platform_support_notes (
  id text PRIMARY KEY,
  restaurant_id text NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  actor_user_id text REFERENCES app_users(id) ON DELETE SET NULL,
  actor_email text NOT NULL,
  note text NOT NULL,
  visibility text NOT NULL DEFAULT 'internal' CHECK (visibility IN ('internal')),
  created_at double precision NOT NULL
);
-- statement-breakpoint
CREATE INDEX IF NOT EXISTS platform_support_notes_restaurant_idx
  ON platform_support_notes (restaurant_id, created_at DESC);
