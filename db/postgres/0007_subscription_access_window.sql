ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS access_ends_at double precision;
-- statement-breakpoint
CREATE INDEX IF NOT EXISTS restaurants_access_ends_at_idx ON restaurants (access_ends_at);
