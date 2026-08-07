CREATE TABLE IF NOT EXISTS whatsapp_order_drafts (
  id text PRIMARY KEY,
  restaurant_id text NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  customer_id text NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  conversation_id text NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  client_order_id text NOT NULL UNIQUE,
  items_json text NOT NULL DEFAULT '[]',
  address_json text NOT NULL DEFAULT '{}',
  payment_method text,
  stage text NOT NULL DEFAULT 'collecting',
  completed_order_id text REFERENCES orders(id) ON DELETE SET NULL,
  created_at double precision NOT NULL DEFAULT (extract(epoch FROM clock_timestamp()) * 1000),
  updated_at double precision NOT NULL DEFAULT (extract(epoch FROM clock_timestamp()) * 1000),
  UNIQUE (conversation_id),
  CHECK (payment_method IS NULL OR payment_method IN ('cash', 'card_on_delivery')),
  CHECK (stage IN ('collecting', 'awaiting_address', 'awaiting_payment', 'awaiting_confirmation', 'completed'))
);
-- statement-breakpoint
CREATE INDEX IF NOT EXISTS whatsapp_drafts_restaurant_updated_idx
ON whatsapp_order_drafts (restaurant_id, updated_at);
