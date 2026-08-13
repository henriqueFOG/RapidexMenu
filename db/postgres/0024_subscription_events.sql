CREATE TABLE IF NOT EXISTS platform_subscription_events (
  id text PRIMARY KEY,
  subscription_id text NOT NULL REFERENCES platform_subscriptions(id) ON DELETE CASCADE,
  restaurant_id text NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  source text NOT NULL,
  status_before text,
  status_after text NOT NULL,
  plan_before text,
  plan_after text NOT NULL,
  amount_before_cents integer,
  amount_after_cents integer NOT NULL,
  occurred_at double precision NOT NULL,
  created_at double precision NOT NULL
);
-- statement-breakpoint
CREATE INDEX IF NOT EXISTS platform_subscription_events_occurred_idx
  ON platform_subscription_events (occurred_at DESC);
-- statement-breakpoint
CREATE INDEX IF NOT EXISTS platform_subscription_events_restaurant_idx
  ON platform_subscription_events (restaurant_id, occurred_at DESC);
-- statement-breakpoint
INSERT INTO platform_subscription_events
(id, subscription_id, restaurant_id, source, status_before, status_after,
 plan_before, plan_after, amount_before_cents, amount_after_cents, occurred_at, created_at)
SELECT
  'snapshot-' || id,
  id,
  restaurant_id,
  'migration_snapshot',
  NULL,
  status,
  NULL,
  plan,
  NULL,
  amount_cents,
  updated_at,
  (extract(epoch FROM clock_timestamp()) * 1000)
FROM platform_subscriptions
ON CONFLICT (id) DO NOTHING;
