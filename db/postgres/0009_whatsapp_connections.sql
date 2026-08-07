CREATE TABLE IF NOT EXISTS restaurant_whatsapp_connections (
  id text PRIMARY KEY,
  restaurant_id text NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  waba_id text NOT NULL,
  business_id text,
  phone_number_id text NOT NULL,
  display_phone_number text,
  verified_name text,
  access_token_ciphertext text NOT NULL,
  two_factor_pin_ciphertext text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  connected_at double precision NOT NULL,
  updated_at double precision NOT NULL,
  CHECK (status IN ('active', 'revoked', 'error')),
  UNIQUE (restaurant_id),
  UNIQUE (phone_number_id)
);
-- statement-breakpoint
CREATE INDEX IF NOT EXISTS restaurant_whatsapp_connections_waba_idx
ON restaurant_whatsapp_connections (waba_id);
