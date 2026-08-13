BEGIN;

CREATE TABLE IF NOT EXISTS legal_acceptances (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  restaurant_id text NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  document_type text NOT NULL CHECK (document_type IN ('terms', 'privacy')),
  document_version text NOT NULL,
  source text NOT NULL DEFAULT 'signup',
  accepted_at bigint NOT NULL,
  created_at bigint NOT NULL,
  UNIQUE (user_id, restaurant_id, document_type, document_version)
);

CREATE INDEX IF NOT EXISTS legal_acceptances_restaurant_idx
  ON legal_acceptances (restaurant_id, accepted_at DESC);

CREATE INDEX IF NOT EXISTS legal_acceptances_user_idx
  ON legal_acceptances (user_id, accepted_at DESC);

COMMIT;
