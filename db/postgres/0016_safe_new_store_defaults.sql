-- New stores must never charge an arbitrary delivery fee or enforce an arbitrary
-- minimum order before the owner has configured the operation. Existing rows are
-- intentionally untouched; this changes defaults for future signups only.
ALTER TABLE restaurants
  ALTER COLUMN delivery_fee_cents SET DEFAULT 0;

-- statement-breakpoint

ALTER TABLE restaurants
  ALTER COLUMN minimum_order_cents SET DEFAULT 0;
