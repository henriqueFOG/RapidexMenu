CREATE TABLE IF NOT EXISTS product_option_groups (
  id text PRIMARY KEY,
  restaurant_id text NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  product_id text NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name text NOT NULL,
  min_select integer NOT NULL DEFAULT 0 CHECK (min_select >= 0),
  max_select integer NOT NULL DEFAULT 1 CHECK (max_select >= 1 AND max_select <= 20),
  pricing_strategy text NOT NULL DEFAULT 'sum' CHECK (pricing_strategy IN ('sum', 'highest', 'average', 'included')),
  position integer NOT NULL DEFAULT 0,
  active integer NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL,
  CHECK (min_select <= max_select)
);

-- statement-breakpoint

CREATE INDEX IF NOT EXISTS product_option_groups_product_idx
  ON product_option_groups (product_id, active, position);

-- statement-breakpoint

CREATE INDEX IF NOT EXISTS product_option_groups_restaurant_idx
  ON product_option_groups (restaurant_id, product_id);

-- statement-breakpoint

CREATE TABLE IF NOT EXISTS product_options (
  id text PRIMARY KEY,
  restaurant_id text NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  group_id text NOT NULL REFERENCES product_option_groups(id) ON DELETE CASCADE,
  name text NOT NULL,
  price_delta_cents integer NOT NULL DEFAULT 0 CHECK (price_delta_cents >= 0),
  cost_delta_cents integer NOT NULL DEFAULT 0 CHECK (cost_delta_cents >= 0),
  available integer NOT NULL DEFAULT 1 CHECK (available IN (0, 1)),
  position integer NOT NULL DEFAULT 0,
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL
);

-- statement-breakpoint

CREATE INDEX IF NOT EXISTS product_options_group_idx
  ON product_options (group_id, available, position);

-- statement-breakpoint

CREATE INDEX IF NOT EXISTS product_options_restaurant_idx
  ON product_options (restaurant_id, group_id);

-- statement-breakpoint

CREATE TABLE IF NOT EXISTS order_item_options (
  id text PRIMARY KEY,
  order_item_id text NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  option_group_id text,
  option_id text,
  option_group_name text NOT NULL,
  option_name text NOT NULL,
  price_delta_cents integer NOT NULL DEFAULT 0,
  cost_delta_cents integer NOT NULL DEFAULT 0,
  created_at bigint NOT NULL
);

-- statement-breakpoint

CREATE INDEX IF NOT EXISTS order_item_options_item_idx
  ON order_item_options (order_item_id, created_at);
