CREATE TABLE IF NOT EXISTS platform_subscriptions (
  id text PRIMARY KEY,
  restaurant_id text NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'mercado_pago',
  provider_subscription_id text,
  plan text NOT NULL,
  amount_cents integer NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  checkout_url text,
  next_payment_at double precision,
  provider_data_json text NOT NULL DEFAULT '{}',
  created_at double precision NOT NULL DEFAULT (extract(epoch FROM clock_timestamp()) * 1000),
  updated_at double precision NOT NULL DEFAULT (extract(epoch FROM clock_timestamp()) * 1000),
  CHECK (provider IN ('mercado_pago')),
  CHECK (plan IN ('start', 'growth', 'scale')),
  CHECK (status IN ('pending', 'authorized', 'paused', 'cancelled', 'unknown'))
);
-- statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS platform_subscriptions_provider_id_unique
ON platform_subscriptions (provider, provider_subscription_id)
WHERE provider_subscription_id IS NOT NULL;
-- statement-breakpoint
CREATE INDEX IF NOT EXISTS platform_subscriptions_restaurant_idx
ON platform_subscriptions (restaurant_id, updated_at);
