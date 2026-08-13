CREATE TABLE IF NOT EXISTS ai_usage_daily (
  restaurant_id text NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  usage_day text NOT NULL,
  response_requests integer NOT NULL DEFAULT 0,
  transcription_requests integer NOT NULL DEFAULT 0,
  input_tokens bigint NOT NULL DEFAULT 0,
  output_tokens bigint NOT NULL DEFAULT 0,
  created_at double precision NOT NULL,
  updated_at double precision NOT NULL,
  PRIMARY KEY (restaurant_id, usage_day)
);
-- statement-breakpoint
CREATE INDEX IF NOT EXISTS ai_usage_daily_day_idx
  ON ai_usage_daily (usage_day, updated_at DESC);
-- statement-breakpoint
CREATE TABLE IF NOT EXISTS ai_provider_circuits (
  restaurant_id text NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  provider text NOT NULL,
  failure_count integer NOT NULL DEFAULT 0,
  window_started_at double precision NOT NULL,
  open_until double precision,
  last_error_code text,
  updated_at double precision NOT NULL,
  PRIMARY KEY (restaurant_id, provider)
);
-- statement-breakpoint
CREATE INDEX IF NOT EXISTS ai_provider_circuits_open_idx
  ON ai_provider_circuits (provider, open_until);
