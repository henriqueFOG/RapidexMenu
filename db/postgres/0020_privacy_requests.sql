ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS marketing_opt_out_at bigint;

-- statement-breakpoint

CREATE TABLE IF NOT EXISTS privacy_requests (
  id text PRIMARY KEY,
  restaurant_id text NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  customer_id text REFERENCES customers(id) ON DELETE SET NULL,
  request_type text NOT NULL CHECK (request_type IN ('access', 'correction', 'opt_out', 'deletion', 'portability')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_review', 'completed', 'rejected')),
  requester_reference text,
  details_json text NOT NULL DEFAULT '{}',
  requested_at bigint NOT NULL,
  completed_at bigint,
  completed_by text,
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL
);

-- statement-breakpoint

CREATE INDEX IF NOT EXISTS privacy_requests_restaurant_status_idx
  ON privacy_requests (restaurant_id, status, requested_at DESC);

-- statement-breakpoint

CREATE INDEX IF NOT EXISTS privacy_requests_customer_idx
  ON privacy_requests (customer_id, requested_at DESC);
