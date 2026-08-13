ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS fulfillment_type text NOT NULL DEFAULT 'delivery';

-- statement-breakpoint

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS table_code text;

-- statement-breakpoint

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS scheduled_for bigint;

-- statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_fulfillment_type_check'
  ) THEN
    ALTER TABLE orders
      ADD CONSTRAINT orders_fulfillment_type_check
      CHECK (fulfillment_type IN ('delivery', 'pickup', 'dine_in'));
  END IF;
END;
$$;

-- statement-breakpoint

CREATE INDEX IF NOT EXISTS orders_restaurant_fulfillment_status_idx
  ON orders (restaurant_id, fulfillment_type, status, created_at DESC);
