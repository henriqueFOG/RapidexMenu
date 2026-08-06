CREATE TABLE IF NOT EXISTS restaurants (
  id text PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  legal_name text,
  owner_email text NOT NULL,
  plan text NOT NULL DEFAULT 'growth',
  status text NOT NULL DEFAULT 'trial',
  phone text,
  whatsapp text,
  city text,
  state text,
  timezone text NOT NULL DEFAULT 'America/Sao_Paulo',
  currency text NOT NULL DEFAULT 'BRL',
  delivery_fee_cents integer NOT NULL DEFAULT 690,
  minimum_order_cents integer NOT NULL DEFAULT 2000,
  average_prep_minutes integer NOT NULL DEFAULT 18,
  delivery_minutes integer NOT NULL DEFAULT 24,
  max_concurrent_orders integer NOT NULL DEFAULT 12,
  next_order_number integer NOT NULL DEFAULT 1280,
  is_open integer NOT NULL DEFAULT 1 CHECK (is_open IN (0, 1)),
  settings_json text NOT NULL DEFAULT '{}',
  created_at double precision NOT NULL DEFAULT (extract(epoch FROM clock_timestamp()) * 1000),
  updated_at double precision NOT NULL DEFAULT (extract(epoch FROM clock_timestamp()) * 1000),
  CHECK (plan IN ('start', 'growth', 'scale')),
  CHECK (status IN ('trial', 'active', 'paused', 'canceled'))
);
-- statement-breakpoint
CREATE INDEX IF NOT EXISTS restaurants_owner_email_idx ON restaurants (owner_email);
-- statement-breakpoint
CREATE TABLE IF NOT EXISTS members (
  id text PRIMARY KEY,
  restaurant_id text NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  email text NOT NULL,
  name text,
  role text NOT NULL DEFAULT 'operator',
  active integer NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at double precision NOT NULL DEFAULT (extract(epoch FROM clock_timestamp()) * 1000),
  UNIQUE (restaurant_id, email),
  CHECK (role IN ('owner', 'manager', 'operator', 'finance'))
);
-- statement-breakpoint
CREATE INDEX IF NOT EXISTS members_email_idx ON members (email);
-- statement-breakpoint
CREATE TABLE IF NOT EXISTS categories (
  id text PRIMARY KEY,
  restaurant_id text NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  active integer NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at double precision NOT NULL DEFAULT (extract(epoch FROM clock_timestamp()) * 1000),
  updated_at double precision NOT NULL DEFAULT (extract(epoch FROM clock_timestamp()) * 1000)
);
-- statement-breakpoint
CREATE INDEX IF NOT EXISTS categories_restaurant_position_idx ON categories (restaurant_id, position);
-- statement-breakpoint
CREATE TABLE IF NOT EXISTS products (
  id text PRIMARY KEY,
  restaurant_id text NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  category_id text REFERENCES categories(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  price_cents integer NOT NULL CHECK (price_cents >= 0),
  cost_cents integer NOT NULL DEFAULT 0 CHECK (cost_cents >= 0),
  emoji text NOT NULL DEFAULT '🍽️',
  tag text,
  image_key text,
  active integer NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  available integer NOT NULL DEFAULT 1 CHECK (available IN (0, 1)),
  stock_control_enabled integer NOT NULL DEFAULT 0 CHECK (stock_control_enabled IN (0, 1)),
  stock_quantity integer,
  minimum_stock integer,
  prep_minutes integer NOT NULL DEFAULT 10,
  position integer NOT NULL DEFAULT 0,
  created_at double precision NOT NULL DEFAULT (extract(epoch FROM clock_timestamp()) * 1000),
  updated_at double precision NOT NULL DEFAULT (extract(epoch FROM clock_timestamp()) * 1000)
);
-- statement-breakpoint
CREATE INDEX IF NOT EXISTS products_restaurant_active_idx ON products (restaurant_id, active, available);
-- statement-breakpoint
CREATE INDEX IF NOT EXISTS products_category_position_idx ON products (category_id, position);
-- statement-breakpoint
CREATE TABLE IF NOT EXISTS customers (
  id text PRIMARY KEY,
  restaurant_id text NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text NOT NULL,
  email text,
  default_address_json text,
  order_count integer NOT NULL DEFAULT 0,
  lifetime_value_cents integer NOT NULL DEFAULT 0,
  last_order_at double precision,
  whatsapp_consent integer NOT NULL DEFAULT 0 CHECK (whatsapp_consent IN (0, 1)),
  consent_at double precision,
  created_at double precision NOT NULL DEFAULT (extract(epoch FROM clock_timestamp()) * 1000),
  updated_at double precision NOT NULL DEFAULT (extract(epoch FROM clock_timestamp()) * 1000),
  UNIQUE (restaurant_id, phone)
);
-- statement-breakpoint
CREATE INDEX IF NOT EXISTS customers_restaurant_last_order_idx ON customers (restaurant_id, last_order_at);
-- statement-breakpoint
CREATE TABLE IF NOT EXISTS customer_preferences (
  id text PRIMARY KEY,
  customer_id text NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  kind text NOT NULL,
  value text NOT NULL,
  confidence integer NOT NULL DEFAULT 100,
  source text NOT NULL DEFAULT 'order',
  created_at double precision NOT NULL DEFAULT (extract(epoch FROM clock_timestamp()) * 1000),
  updated_at double precision NOT NULL DEFAULT (extract(epoch FROM clock_timestamp()) * 1000),
  UNIQUE (customer_id, kind, value),
  CHECK (kind IN ('ingredient', 'product', 'delivery', 'payment', 'note'))
);
-- statement-breakpoint
CREATE TABLE IF NOT EXISTS orders (
  id text PRIMARY KEY,
  restaurant_id text NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  customer_id text REFERENCES customers(id) ON DELETE SET NULL,
  order_number integer NOT NULL,
  client_order_id text NOT NULL,
  tracking_token text NOT NULL UNIQUE,
  source text NOT NULL DEFAULT 'menu',
  status text NOT NULL DEFAULT 'received',
  payment_status text NOT NULL DEFAULT 'pending',
  payment_method text NOT NULL DEFAULT 'pix',
  subtotal_cents integer NOT NULL,
  delivery_fee_cents integer NOT NULL DEFAULT 0,
  discount_cents integer NOT NULL DEFAULT 0,
  total_cents integer NOT NULL,
  cost_cents integer NOT NULL DEFAULT 0,
  contribution_margin_cents integer NOT NULL DEFAULT 0,
  address_json text,
  notes text,
  promised_from_minutes integer,
  promised_to_minutes integer,
  created_at double precision NOT NULL DEFAULT (extract(epoch FROM clock_timestamp()) * 1000),
  updated_at double precision NOT NULL DEFAULT (extract(epoch FROM clock_timestamp()) * 1000),
  confirmed_at double precision,
  delivered_at double precision,
  canceled_at double precision,
  UNIQUE (restaurant_id, order_number),
  UNIQUE (restaurant_id, client_order_id),
  CHECK (source IN ('menu', 'whatsapp', 'counter', 'link', 'admin')),
  CHECK (status IN ('received', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'canceled')),
  CHECK (payment_status IN ('pending', 'authorized', 'paid', 'failed', 'refunded', 'canceled')),
  CHECK (payment_method IN ('pix', 'cash', 'card_on_delivery'))
);
-- statement-breakpoint
CREATE INDEX IF NOT EXISTS orders_restaurant_status_created_idx ON orders (restaurant_id, status, created_at);
-- statement-breakpoint
CREATE INDEX IF NOT EXISTS orders_customer_created_idx ON orders (customer_id, created_at);
-- statement-breakpoint
CREATE TABLE IF NOT EXISTS order_items (
  id text PRIMARY KEY,
  order_id text NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id text REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_price_cents integer NOT NULL,
  unit_cost_cents integer NOT NULL DEFAULT 0,
  notes text,
  created_at double precision NOT NULL DEFAULT (extract(epoch FROM clock_timestamp()) * 1000)
);
-- statement-breakpoint
CREATE INDEX IF NOT EXISTS order_items_order_idx ON order_items (order_id);
-- statement-breakpoint
CREATE TABLE IF NOT EXISTS payments (
  id text PRIMARY KEY,
  restaurant_id text NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  order_id text NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'mercado_pago',
  provider_payment_id text,
  idempotency_key text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending',
  amount_cents integer NOT NULL,
  pix_code text,
  ticket_url text,
  expires_at double precision,
  provider_data_json text NOT NULL DEFAULT '{}',
  created_at double precision NOT NULL DEFAULT (extract(epoch FROM clock_timestamp()) * 1000),
  updated_at double precision NOT NULL DEFAULT (extract(epoch FROM clock_timestamp()) * 1000),
  UNIQUE (provider, provider_payment_id)
);
-- statement-breakpoint
CREATE INDEX IF NOT EXISTS payments_order_idx ON payments (order_id);
-- statement-breakpoint
CREATE TABLE IF NOT EXISTS conversations (
  id text PRIMARY KEY,
  restaurant_id text NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  customer_id text REFERENCES customers(id) ON DELETE SET NULL,
  channel text NOT NULL DEFAULT 'whatsapp',
  external_contact_id text NOT NULL,
  status text NOT NULL DEFAULT 'bot',
  last_message_at double precision,
  created_at double precision NOT NULL DEFAULT (extract(epoch FROM clock_timestamp()) * 1000),
  updated_at double precision NOT NULL DEFAULT (extract(epoch FROM clock_timestamp()) * 1000),
  UNIQUE (restaurant_id, channel, external_contact_id),
  CHECK (status IN ('bot', 'human', 'closed'))
);
-- statement-breakpoint
CREATE TABLE IF NOT EXISTS messages (
  id text PRIMARY KEY,
  conversation_id text NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  provider_message_id text UNIQUE,
  direction text NOT NULL,
  type text NOT NULL DEFAULT 'text',
  body text,
  status text NOT NULL DEFAULT 'received',
  metadata_json text NOT NULL DEFAULT '{}',
  created_at double precision NOT NULL DEFAULT (extract(epoch FROM clock_timestamp()) * 1000),
  CHECK (direction IN ('inbound', 'outbound')),
  CHECK (type IN ('text', 'audio', 'image', 'interactive', 'system'))
);
-- statement-breakpoint
CREATE INDEX IF NOT EXISTS messages_conversation_created_idx ON messages (conversation_id, created_at);
-- statement-breakpoint
CREATE TABLE IF NOT EXISTS automation_events (
  id text PRIMARY KEY,
  restaurant_id text NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  customer_id text REFERENCES customers(id) ON DELETE SET NULL,
  order_id text REFERENCES orders(id) ON DELETE SET NULL,
  kind text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  reason text,
  expected_revenue_cents integer NOT NULL DEFAULT 0,
  recovered_revenue_cents integer NOT NULL DEFAULT 0,
  margin_percent integer,
  metadata_json text NOT NULL DEFAULT '{}',
  created_at double precision NOT NULL DEFAULT (extract(epoch FROM clock_timestamp()) * 1000),
  updated_at double precision NOT NULL DEFAULT (extract(epoch FROM clock_timestamp()) * 1000),
  CHECK (status IN ('draft', 'approved', 'sent', 'converted', 'failed'))
);
-- statement-breakpoint
CREATE INDEX IF NOT EXISTS automation_restaurant_status_idx ON automation_events (restaurant_id, status);
-- statement-breakpoint
CREATE TABLE IF NOT EXISTS webhook_events (
  id text PRIMARY KEY,
  provider text NOT NULL,
  provider_event_id text NOT NULL,
  event_type text NOT NULL,
  signature_valid integer NOT NULL DEFAULT 0 CHECK (signature_valid IN (0, 1)),
  status text NOT NULL DEFAULT 'received',
  payload_hash text NOT NULL,
  error text,
  received_at double precision NOT NULL DEFAULT (extract(epoch FROM clock_timestamp()) * 1000),
  processed_at double precision,
  UNIQUE (provider, provider_event_id),
  CHECK (status IN ('received', 'processed', 'ignored', 'failed'))
);
-- statement-breakpoint
CREATE TABLE IF NOT EXISTS rate_limit_buckets (
  key text PRIMARY KEY,
  count integer NOT NULL DEFAULT 1,
  expires_at double precision NOT NULL,
  updated_at double precision NOT NULL DEFAULT (extract(epoch FROM clock_timestamp()) * 1000)
);
-- statement-breakpoint
CREATE INDEX IF NOT EXISTS rate_limits_expires_idx ON rate_limit_buckets (expires_at);
-- statement-breakpoint
CREATE TABLE IF NOT EXISTS leads (
  id text PRIMARY KEY,
  name text NOT NULL,
  restaurant_name text NOT NULL,
  whatsapp text NOT NULL,
  monthly_orders_range text,
  source text NOT NULL DEFAULT 'landing',
  status text NOT NULL DEFAULT 'new',
  created_at double precision NOT NULL DEFAULT (extract(epoch FROM clock_timestamp()) * 1000),
  updated_at double precision NOT NULL DEFAULT (extract(epoch FROM clock_timestamp()) * 1000),
  CHECK (status IN ('new', 'contacted', 'trial', 'won', 'lost'))
);
-- statement-breakpoint
CREATE INDEX IF NOT EXISTS leads_status_created_idx ON leads (status, created_at);
-- statement-breakpoint
CREATE TABLE IF NOT EXISTS subscriptions (
  id text PRIMARY KEY,
  restaurant_id text NOT NULL UNIQUE REFERENCES restaurants(id) ON DELETE CASCADE,
  plan text NOT NULL,
  status text NOT NULL DEFAULT 'trialing',
  provider text,
  provider_customer_id text,
  provider_subscription_id text,
  trial_ends_at double precision,
  current_period_ends_at double precision,
  created_at double precision NOT NULL DEFAULT (extract(epoch FROM clock_timestamp()) * 1000),
  updated_at double precision NOT NULL DEFAULT (extract(epoch FROM clock_timestamp()) * 1000)
);
-- statement-breakpoint
CREATE TABLE IF NOT EXISTS integrations (
  id text PRIMARY KEY,
  restaurant_id text NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  provider text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  external_account_id text,
  external_phone_id text,
  secret_ref text,
  settings_json text NOT NULL DEFAULT '{}',
  last_error text,
  connected_at double precision,
  created_at double precision NOT NULL DEFAULT (extract(epoch FROM clock_timestamp()) * 1000),
  updated_at double precision NOT NULL DEFAULT (extract(epoch FROM clock_timestamp()) * 1000),
  UNIQUE (restaurant_id, provider),
  CHECK (provider IN ('whatsapp', 'mercado_pago', 'openai')),
  CHECK (status IN ('pending', 'connected', 'error', 'disabled'))
);
-- statement-breakpoint
CREATE INDEX IF NOT EXISTS integrations_phone_idx ON integrations (provider, external_phone_id);
-- statement-breakpoint
CREATE TABLE IF NOT EXISTS audit_logs (
  id text PRIMARY KEY,
  restaurant_id text REFERENCES restaurants(id) ON DELETE SET NULL,
  actor_email text NOT NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  metadata_json text NOT NULL DEFAULT '{}',
  created_at double precision NOT NULL DEFAULT (extract(epoch FROM clock_timestamp()) * 1000)
);
-- statement-breakpoint
CREATE INDEX IF NOT EXISTS audit_restaurant_created_idx ON audit_logs (restaurant_id, created_at);
