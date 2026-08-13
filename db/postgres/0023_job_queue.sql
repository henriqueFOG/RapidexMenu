CREATE TABLE IF NOT EXISTS job_queue (
  id text PRIMARY KEY,
  restaurant_id text REFERENCES restaurants(id) ON DELETE CASCADE,
  job_type text NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  payload_json text NOT NULL,
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'running', 'retry', 'completed', 'dead')),
  attempt_count integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 5 CHECK (max_attempts BETWEEN 1 AND 20),
  available_at double precision NOT NULL,
  locked_at double precision,
  locked_by text,
  last_error_code text,
  completed_at double precision,
  created_at double precision NOT NULL,
  updated_at double precision NOT NULL
);
-- statement-breakpoint
CREATE INDEX IF NOT EXISTS job_queue_claim_idx
  ON job_queue (status, available_at, created_at);
-- statement-breakpoint
CREATE INDEX IF NOT EXISTS job_queue_restaurant_created_idx
  ON job_queue (restaurant_id, created_at DESC);
-- statement-breakpoint
CREATE INDEX IF NOT EXISTS job_queue_dead_idx
  ON job_queue (job_type, updated_at DESC)
  WHERE status = 'dead';
