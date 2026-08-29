-- Structural product variants (size, volume, portion) keep their own price/cost
-- deltas, availability and optional stock while remaining compatible with the
-- existing modifier model.
ALTER TABLE product_option_groups
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'modifier'
  CHECK (kind IN ('modifier', 'variant'));

-- statement-breakpoint

ALTER TABLE product_options
  ADD COLUMN IF NOT EXISTS stock_control_enabled integer NOT NULL DEFAULT 0
  CHECK (stock_control_enabled IN (0, 1));

-- statement-breakpoint

ALTER TABLE product_options
  ADD COLUMN IF NOT EXISTS stock_quantity integer
  CHECK (stock_quantity IS NULL OR stock_quantity >= 0);

-- statement-breakpoint

-- A retired variant stays in the database so historical/cancelable orders can
-- still restore its inventory. It is hidden from admin/public catalog queries.
ALTER TABLE product_options
  ADD COLUMN IF NOT EXISTS retired integer NOT NULL DEFAULT 0
  CHECK (retired IN (0, 1));

-- statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS product_single_variant_group_idx
  ON product_option_groups (product_id)
  WHERE kind = 'variant' AND active = 1;

-- statement-breakpoint

CREATE INDEX IF NOT EXISTS product_variant_stock_idx
  ON product_options (group_id, retired, available, stock_control_enabled, stock_quantity);

-- statement-breakpoint

ALTER TABLE order_item_options
  ADD COLUMN IF NOT EXISTS option_kind text NOT NULL DEFAULT 'modifier'
  CHECK (option_kind IN ('modifier', 'variant'));

-- statement-breakpoint

-- The option row lock serializes concurrent purchases. The trigger also records
-- whether the historical order selection was a structural variant.
CREATE OR REPLACE FUNCTION rapidex_reserve_variant_stock()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  group_kind text;
  option_restaurant_id text;
  group_restaurant_id text;
  group_product_id text;
  item_restaurant_id text;
  item_product_id text;
  item_quantity integer;
  stock_enabled integer;
  remaining_stock integer;
BEGIN
  IF NEW.option_id IS NULL OR NEW.option_group_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT pog.kind, po.restaurant_id, pog.restaurant_id, pog.product_id,
         po.stock_control_enabled
    INTO group_kind, option_restaurant_id, group_restaurant_id, group_product_id,
         stock_enabled
  FROM product_options po
  JOIN product_option_groups pog ON pog.id = po.group_id
  WHERE po.id = NEW.option_id
    AND pog.id = NEW.option_group_id
  FOR UPDATE OF po;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'rapidex_option_not_found:%', NEW.option_id
      USING ERRCODE = '23503';
  END IF;

  NEW.option_kind := group_kind;
  IF group_kind <> 'variant' THEN
    RETURN NEW;
  END IF;

  SELECT o.restaurant_id, oi.product_id, oi.quantity
    INTO item_restaurant_id, item_product_id, item_quantity
  FROM order_items oi
  JOIN orders o ON o.id = oi.order_id
  WHERE oi.id = NEW.order_item_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'rapidex_order_item_not_found:%', NEW.order_item_id
      USING ERRCODE = '23503';
  END IF;

  IF option_restaurant_id <> item_restaurant_id
     OR group_restaurant_id <> item_restaurant_id
     OR group_product_id <> item_product_id THEN
    RAISE EXCEPTION 'rapidex_cross_tenant_variant:%', NEW.option_id
      USING ERRCODE = '42501';
  END IF;

  IF stock_enabled = 1 THEN
    UPDATE product_options
       SET stock_quantity = stock_quantity - item_quantity,
           updated_at = (extract(epoch FROM clock_timestamp()) * 1000)::bigint
     WHERE id = NEW.option_id
       AND restaurant_id = item_restaurant_id
       AND stock_quantity IS NOT NULL
       AND stock_quantity >= item_quantity
     RETURNING stock_quantity INTO remaining_stock;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'rapidex_insufficient_stock:variant:%', NEW.option_id
        USING ERRCODE = 'P0001';
    END IF;

    -- Catalog URLs are immutable by catalog_version. Any controlled stock change
    -- must invalidate the current public catalog so a sold-out/restocked choice
    -- cannot remain cached as orderable.
    UPDATE restaurants
       SET catalog_version = catalog_version + 1,
           updated_at = (extract(epoch FROM clock_timestamp()) * 1000)::bigint
     WHERE id = item_restaurant_id;
  END IF;

  RETURN NEW;
END;
$$;

-- statement-breakpoint

DROP TRIGGER IF EXISTS rapidex_variant_stock_reservation ON order_item_options;

-- statement-breakpoint

CREATE TRIGGER rapidex_variant_stock_reservation
BEFORE INSERT ON order_item_options
FOR EACH ROW
EXECUTE FUNCTION rapidex_reserve_variant_stock();

-- statement-breakpoint

-- Cancellation returns stock exactly once because the transition guard only fires
-- when the order enters canceled from a different state. Retired variant rows are
-- intentionally retained and can therefore receive this historical restoration.
CREATE OR REPLACE FUNCTION rapidex_restore_variant_stock_on_cancel()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  restored_rows integer;
BEGIN
  IF NEW.status = 'canceled' AND OLD.status <> 'canceled' THEN
    UPDATE product_options po
       SET stock_quantity = po.stock_quantity + restored.quantity,
           updated_at = NEW.updated_at
      FROM (
        SELECT oio.option_id, sum(oi.quantity)::integer AS quantity
        FROM order_items oi
        JOIN order_item_options oio ON oio.order_item_id = oi.id
        WHERE oi.order_id = NEW.id
          AND oio.option_kind = 'variant'
          AND oio.option_id IS NOT NULL
        GROUP BY oio.option_id
      ) restored
     WHERE po.id = restored.option_id
       AND po.restaurant_id = NEW.restaurant_id
       AND po.stock_control_enabled = 1
       AND po.stock_quantity IS NOT NULL;

    GET DIAGNOSTICS restored_rows = ROW_COUNT;
    IF restored_rows > 0 THEN
      UPDATE restaurants
         SET catalog_version = catalog_version + 1,
             updated_at = NEW.updated_at
       WHERE id = NEW.restaurant_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- statement-breakpoint

DROP TRIGGER IF EXISTS rapidex_restore_variant_stock_on_cancel_trigger ON orders;

-- statement-breakpoint

CREATE TRIGGER rapidex_restore_variant_stock_on_cancel_trigger
AFTER UPDATE OF status ON orders
FOR EACH ROW
WHEN (NEW.status = 'canceled' AND OLD.status <> 'canceled')
EXECUTE FUNCTION rapidex_restore_variant_stock_on_cancel();
