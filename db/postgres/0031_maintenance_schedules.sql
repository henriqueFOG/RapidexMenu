CREATE TABLE IF NOT EXISTS maintenance_schedules (
  task text PRIMARY KEY,
  next_run_at double precision NOT NULL,
  last_started_at double precision,
  last_completed_at double precision,
  status text NOT NULL DEFAULT 'idle' CHECK (status IN ('idle', 'running', 'failed')),
  detail text
);
-- statement-breakpoint
INSERT INTO maintenance_schedules (task, next_run_at, status)
VALUES ('orphan_media', 0, 'idle')
ON CONFLICT (task) DO NOTHING;
