ALTER TABLE order_item_options
  ADD COLUMN IF NOT EXISTS pricing_strategy text NOT NULL DEFAULT 'sum';

-- statement-breakpoint

ALTER TABLE order_item_options
  ADD COLUMN IF NOT EXISTS charged_delta_cents integer NOT NULL DEFAULT 0;

-- statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'order_item_options_pricing_strategy_check'
  ) THEN
    ALTER TABLE order_item_options
      ADD CONSTRAINT order_item_options_pricing_strategy_check
      CHECK (pricing_strategy IN ('sum', 'highest', 'average', 'included'));
  END IF;
END;
$$;
