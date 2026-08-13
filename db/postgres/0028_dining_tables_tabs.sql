CREATE TABLE IF NOT EXISTS dining_tables (
  id text PRIMARY KEY,
  restaurant_id text NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  code text NOT NULL,
  label text NOT NULL,
  public_token text NOT NULL UNIQUE,
  active integer NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL,
  UNIQUE (restaurant_id, code)
);

-- statement-breakpoint

CREATE INDEX IF NOT EXISTS dining_tables_restaurant_active_idx
  ON dining_tables (restaurant_id, active, code);

-- statement-breakpoint

CREATE TABLE IF NOT EXISTS dining_tabs (
  id text PRIMARY KEY,
  restaurant_id text NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  table_id text NOT NULL REFERENCES dining_tables(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  opened_at bigint NOT NULL,
  closed_at bigint,
  closed_by_user_id text REFERENCES users(id) ON DELETE SET NULL,
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL
);

-- statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS dining_tabs_one_open_per_table_idx
  ON dining_tabs (restaurant_id, table_id)
  WHERE status = 'open';

-- statement-breakpoint

CREATE INDEX IF NOT EXISTS dining_tabs_restaurant_status_idx
  ON dining_tabs (restaurant_id, status, opened_at DESC);

-- statement-breakpoint

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS dining_table_id text REFERENCES dining_tables(id) ON DELETE SET NULL;

-- statement-breakpoint

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS dining_tab_id text REFERENCES dining_tabs(id) ON DELETE SET NULL;

-- statement-breakpoint

CREATE INDEX IF NOT EXISTS orders_restaurant_dining_tab_idx
  ON orders (restaurant_id, dining_tab_id, created_at)
  WHERE dining_tab_id IS NOT NULL;
