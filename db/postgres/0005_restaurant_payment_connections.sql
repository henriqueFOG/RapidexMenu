CREATE TABLE IF NOT EXISTS restaurant_payment_connections (
  id text PRIMARY KEY,
  restaurant_id text NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  provider text NOT NULL,
  provider_account_id text,
  access_token_ciphertext text NOT NULL,
  refresh_token_ciphertext text,
  token_expires_at double precision,
  status text NOT NULL DEFAULT 'active',
  scopes text,
  connected_at double precision NOT NULL,
  updated_at double precision NOT NULL,
  CHECK (provider IN ('mercado_pago')),
  CHECK (status IN ('active', 'expired', 'revoked', 'error')),
  UNIQUE (restaurant_id, provider)
);
-- statement-breakpoint
CREATE INDEX IF NOT EXISTS restaurant_payment_connections_provider_account_idx
ON restaurant_payment_connections (provider, provider_account_id);
