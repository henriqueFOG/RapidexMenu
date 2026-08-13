ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS catalog_version bigint NOT NULL DEFAULT 1;
-- statement-breakpoint
CREATE OR REPLACE FUNCTION rapidex_bump_catalog_version()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  target_restaurant_id text;
  changed boolean := true;
BEGIN
  target_restaurant_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.restaurant_id ELSE NEW.restaurant_id END;

  IF TG_OP = 'UPDATE' THEN
    IF TG_TABLE_NAME = 'products' THEN
      changed := (
        OLD.category_id IS DISTINCT FROM NEW.category_id OR
        OLD.name IS DISTINCT FROM NEW.name OR
        OLD.description IS DISTINCT FROM NEW.description OR
        OLD.price_cents IS DISTINCT FROM NEW.price_cents OR
        OLD.emoji IS DISTINCT FROM NEW.emoji OR
        OLD.tag IS DISTINCT FROM NEW.tag OR
        OLD.image_key IS DISTINCT FROM NEW.image_key OR
        OLD.active IS DISTINCT FROM NEW.active OR
        OLD.available IS DISTINCT FROM NEW.available OR
        OLD.prep_minutes IS DISTINCT FROM NEW.prep_minutes OR
        OLD.position IS DISTINCT FROM NEW.position
      );
    ELSIF TG_TABLE_NAME = 'categories' THEN
      changed := (
        OLD.name IS DISTINCT FROM NEW.name OR
        OLD.position IS DISTINCT FROM NEW.position OR
        OLD.active IS DISTINCT FROM NEW.active
      );
    ELSIF TG_TABLE_NAME = 'product_option_groups' THEN
      changed := (
        OLD.product_id IS DISTINCT FROM NEW.product_id OR
        OLD.name IS DISTINCT FROM NEW.name OR
        OLD.min_select IS DISTINCT FROM NEW.min_select OR
        OLD.max_select IS DISTINCT FROM NEW.max_select OR
        OLD.pricing_strategy IS DISTINCT FROM NEW.pricing_strategy OR
        OLD.position IS DISTINCT FROM NEW.position OR
        OLD.active IS DISTINCT FROM NEW.active
      );
    ELSIF TG_TABLE_NAME = 'product_options' THEN
      changed := (
        OLD.group_id IS DISTINCT FROM NEW.group_id OR
        OLD.name IS DISTINCT FROM NEW.name OR
        OLD.price_delta_cents IS DISTINCT FROM NEW.price_delta_cents OR
        OLD.available IS DISTINCT FROM NEW.available OR
        OLD.position IS DISTINCT FROM NEW.position
      );
    END IF;
  END IF;

  IF changed AND target_restaurant_id IS NOT NULL THEN
    UPDATE restaurants
    SET catalog_version = catalog_version + 1
    WHERE id = target_restaurant_id;
  END IF;
  RETURN NULL;
END;
$$;
-- statement-breakpoint
DROP TRIGGER IF EXISTS rapidex_products_catalog_version ON products;
-- statement-breakpoint
CREATE TRIGGER rapidex_products_catalog_version
AFTER INSERT OR UPDATE OR DELETE ON products
FOR EACH ROW EXECUTE FUNCTION rapidex_bump_catalog_version();
-- statement-breakpoint
DROP TRIGGER IF EXISTS rapidex_categories_catalog_version ON categories;
-- statement-breakpoint
CREATE TRIGGER rapidex_categories_catalog_version
AFTER INSERT OR UPDATE OR DELETE ON categories
FOR EACH ROW EXECUTE FUNCTION rapidex_bump_catalog_version();
-- statement-breakpoint
DROP TRIGGER IF EXISTS rapidex_option_groups_catalog_version ON product_option_groups;
-- statement-breakpoint
CREATE TRIGGER rapidex_option_groups_catalog_version
AFTER INSERT OR UPDATE OR DELETE ON product_option_groups
FOR EACH ROW EXECUTE FUNCTION rapidex_bump_catalog_version();
-- statement-breakpoint
DROP TRIGGER IF EXISTS rapidex_options_catalog_version ON product_options;
-- statement-breakpoint
CREATE TRIGGER rapidex_options_catalog_version
AFTER INSERT OR UPDATE OR DELETE ON product_options
FOR EACH ROW EXECUTE FUNCTION rapidex_bump_catalog_version();
