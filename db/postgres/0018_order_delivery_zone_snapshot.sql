ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS delivery_zone_id text;

-- statement-breakpoint

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS delivery_zone_name text;
