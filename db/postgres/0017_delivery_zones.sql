CREATE TABLE IF NOT EXISTS delivery_zones (
  id text PRIMARY KEY,
  restaurant_id text NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name text NOT NULL,
  match_type text NOT NULL CHECK (match_type IN ('postal_prefix', 'neighborhood')),
  match_value text NOT NULL,
  fee_cents integer NOT NULL DEFAULT 0 CHECK (fee_cents >= 0),
  minimum_order_cents integer NOT NULL DEFAULT 0 CHECK (minimum_order_cents >= 0),
  extra_minutes integer NOT NULL DEFAULT 0 CHECK (extra_minutes >= 0 AND extra_minutes <= 240),
  active integer NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  position integer NOT NULL DEFAULT 0,
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL,
  UNIQUE (restaurant_id, match_type, match_value)
);

-- statement-breakpoint

CREATE INDEX IF NOT EXISTS delivery_zones_restaurant_active_idx
  ON delivery_zones (restaurant_id, active, position);
