-- Scheduled orders are capacity-guarded per 15-minute slot. The restaurant row
-- lock serializes concurrent reservations for the same tenant/slot, so two
-- checkouts cannot silently overbook the configured kitchen capacity.
CREATE OR REPLACE FUNCTION rapidex_guard_scheduled_order_capacity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  slot_ms constant bigint := 900000;
  slot_start bigint;
  capacity integer;
  reserved integer;
BEGIN
  IF NEW.scheduled_for IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT GREATEST(1, max_concurrent_orders)
    INTO capacity
  FROM restaurants
  WHERE id = NEW.restaurant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'rapidex_restaurant_not_found:%', NEW.restaurant_id
      USING ERRCODE = '23503';
  END IF;

  slot_start := (NEW.scheduled_for / slot_ms) * slot_ms;

  SELECT count(*)
    INTO reserved
  FROM orders
  WHERE restaurant_id = NEW.restaurant_id
    AND id <> NEW.id
    AND scheduled_for IS NOT NULL
    AND scheduled_for >= slot_start
    AND scheduled_for < slot_start + slot_ms
    AND status <> 'canceled';

  IF reserved >= capacity THEN
    RAISE EXCEPTION 'rapidex_schedule_capacity:%:%', NEW.restaurant_id, slot_start
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

-- statement-breakpoint

DROP TRIGGER IF EXISTS rapidex_scheduled_order_capacity_guard ON orders;

-- statement-breakpoint

CREATE TRIGGER rapidex_scheduled_order_capacity_guard
BEFORE INSERT OR UPDATE OF scheduled_for ON orders
FOR EACH ROW
WHEN (NEW.scheduled_for IS NOT NULL)
EXECUTE FUNCTION rapidex_guard_scheduled_order_capacity();

-- statement-breakpoint

CREATE INDEX IF NOT EXISTS orders_restaurant_schedule_idx
  ON orders (restaurant_id, scheduled_for, status)
  WHERE scheduled_for IS NOT NULL;

-- statement-breakpoint

-- Cancellation must reverse the stock reservation exactly once. This trigger
-- keeps the invariant at database level even if a future admin/API path changes
-- the order state outside today's application route.
CREATE OR REPLACE FUNCTION rapidex_restore_stock_on_order_cancel()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'canceled' AND OLD.status <> 'canceled' THEN
    UPDATE products p
       SET stock_quantity = p.stock_quantity + restored.quantity,
           updated_at = NEW.updated_at
      FROM (
        SELECT oi.product_id, sum(oi.quantity)::integer AS quantity
        FROM order_items oi
        WHERE oi.order_id = NEW.id
          AND oi.product_id IS NOT NULL
        GROUP BY oi.product_id
      ) restored
     WHERE p.id = restored.product_id
       AND p.restaurant_id = NEW.restaurant_id
       AND p.stock_control_enabled = 1
       AND p.stock_quantity IS NOT NULL;
  END IF;

  RETURN NEW;
END;
$$;

-- statement-breakpoint

DROP TRIGGER IF EXISTS rapidex_restore_stock_on_cancel ON orders;

-- statement-breakpoint

CREATE TRIGGER rapidex_restore_stock_on_cancel
AFTER UPDATE OF status ON orders
FOR EACH ROW
WHEN (NEW.status = 'canceled' AND OLD.status <> 'canceled')
EXECUTE FUNCTION rapidex_restore_stock_on_order_cancel();
