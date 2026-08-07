CREATE TABLE IF NOT EXISTS growth_events (
  id text PRIMARY KEY,
  restaurant_id text NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  client_order_id text NOT NULL,
  order_id text REFERENCES orders(id) ON DELETE SET NULL,
  product_id text REFERENCES products(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  value_cents integer NOT NULL DEFAULT 0,
  contribution_cents integer NOT NULL DEFAULT 0,
  metadata_json text NOT NULL DEFAULT '{}',
  created_at double precision NOT NULL DEFAULT (extract(epoch FROM clock_timestamp()) * 1000),
  updated_at double precision NOT NULL DEFAULT (extract(epoch FROM clock_timestamp()) * 1000),
  CHECK (event_type IN ('upsell_shown', 'upsell_accepted', 'reorder_suggested', 'reorder_converted'))
);
-- statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS growth_events_unique_upsell
  ON growth_events (restaurant_id, client_order_id, event_type, product_id);
-- statement-breakpoint
CREATE INDEX IF NOT EXISTS growth_events_restaurant_created_idx
  ON growth_events (restaurant_id, created_at);
-- statement-breakpoint
CREATE INDEX IF NOT EXISTS growth_events_order_idx
  ON growth_events (order_id);
