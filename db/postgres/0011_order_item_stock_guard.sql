BEGIN;

-- Commercial invariant: an order item must never reserve stock from another tenant
-- and two concurrent checkouts must never oversell the same controlled product.
-- The product row lock is held until the surrounding order transaction commits.
CREATE OR REPLACE FUNCTION rapidex_guard_order_item_stock()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  product_restaurant_id text;
  order_restaurant_id text;
  stock_enabled integer;
  current_stock integer;
BEGIN
  IF NEW.product_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT restaurant_id, stock_control_enabled, stock_quantity
    INTO product_restaurant_id, stock_enabled, current_stock
  FROM products
  WHERE id = NEW.product_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'rapidex_product_not_found:%', NEW.product_id
      USING ERRCODE = '23503';
  END IF;

  SELECT restaurant_id
    INTO order_restaurant_id
  FROM orders
  WHERE id = NEW.order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'rapidex_order_not_found:%', NEW.order_id
      USING ERRCODE = '23503';
  END IF;

  IF product_restaurant_id <> order_restaurant_id THEN
    RAISE EXCEPTION 'rapidex_cross_tenant_order_item:%', NEW.product_id
      USING ERRCODE = '42501';
  END IF;

  IF stock_enabled = 1 AND (current_stock IS NULL OR current_stock < NEW.quantity) THEN
    RAISE EXCEPTION 'rapidex_insufficient_stock:%', NEW.product_id
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS rapidex_order_item_stock_guard ON order_items;
CREATE TRIGGER rapidex_order_item_stock_guard
BEFORE INSERT ON order_items
FOR EACH ROW
EXECUTE FUNCTION rapidex_guard_order_item_stock();

COMMIT;
