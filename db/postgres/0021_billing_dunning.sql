CREATE TABLE IF NOT EXISTS billing_dunning_events (
  id text PRIMARY KEY,
  subscription_id text NOT NULL REFERENCES platform_subscriptions(id) ON DELETE CASCADE,
  restaurant_id text NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  stage text NOT NULL CHECK (stage IN ('grace_started', 'grace_24h', 'suspended')),
  cycle_key text NOT NULL,
  recipient_email text NOT NULL,
  status text NOT NULL DEFAULT 'sending' CHECK (status IN ('sending', 'sent', 'failed')),
  attempt_count integer NOT NULL DEFAULT 1,
  last_error text,
  last_attempt_at double precision NOT NULL,
  sent_at double precision,
  created_at double precision NOT NULL,
  UNIQUE (subscription_id, stage, cycle_key)
);
-- statement-breakpoint
CREATE INDEX IF NOT EXISTS billing_dunning_restaurant_created_idx
  ON billing_dunning_events (restaurant_id, created_at DESC);
-- statement-breakpoint
CREATE INDEX IF NOT EXISTS billing_dunning_status_attempt_idx
  ON billing_dunning_events (status, last_attempt_at);
