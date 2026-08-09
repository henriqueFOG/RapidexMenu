CREATE TABLE IF NOT EXISTS media_assets (
  key text PRIMARY KEY,
  restaurant_id text NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  content_type text NOT NULL,
  data_base64 text NOT NULL,
  size_bytes bigint NOT NULL,
  created_at double precision NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_media_assets_restaurant_created
  ON media_assets (restaurant_id, created_at DESC);
