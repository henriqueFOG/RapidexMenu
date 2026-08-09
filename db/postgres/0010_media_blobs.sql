CREATE TABLE IF NOT EXISTS media_blobs (
  key TEXT PRIMARY KEY,
  restaurant_id TEXT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL,
  data_base64 TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  created_at BIGINT NOT NULL
);

-- statement-breakpoint

CREATE INDEX IF NOT EXISTS idx_media_blobs_restaurant
  ON media_blobs (restaurant_id, created_at);
