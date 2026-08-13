import { getDatabase } from "./runtime";
import { structuredLog } from "./observability";

export type JobStatus = "queued" | "running" | "retry" | "completed" | "dead";
export type JobType = "transactional_email";

export type QueueJob = {
  id: string;
  restaurant_id: string | null;
  job_type: JobType;
  idempotency_key: string;
  payload_json: string;
  status: JobStatus;
  attempt_count: number;
  max_attempts: number;
  available_at: number;
  locked_at: number | null;
  locked_by: string | null;
};

export async function enqueueJob(input: {
  restaurantId?: string | null;
  type: JobType;
  idempotencyKey: string;
  payload: Record<string, unknown>;
  maxAttempts?: number;
  availableAt?: number;
}) {
  const db = getDatabase();
  const now = Date.now();
  const id = crypto.randomUUID();
  const row = await db.prepare(
    `INSERT INTO job_queue
     (id, restaurant_id, job_type, idempotency_key, payload_json, status,
      attempt_count, max_attempts, available_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'queued', 0, ?, ?, ?, ?)
     ON CONFLICT (idempotency_key) DO UPDATE SET
       updated_at = job_queue.updated_at
     RETURNING id, status, attempt_count`,
  ).bind(
    id,
    input.restaurantId ?? null,
    input.type,
    input.idempotencyKey.slice(0, 180),
    JSON.stringify(input.payload),
    Math.max(1, Math.min(20, input.maxAttempts ?? 5)),
    input.availableAt ?? now,
    now,
    now,
  ).first<{ id: string; status: JobStatus; attempt_count: number }>();
  if (!row) throw new Error("job_enqueue_failed");
  return { id: row.id, status: row.status, existing: row.id !== id };
}

export async function recoverStaleJobs(now = Date.now(), staleAfterMs = 15 * 60_000) {
  const cutoff = now - staleAfterMs;
  const result = await getDatabase().prepare(
    `UPDATE job_queue
     SET status = 'retry', available_at = ?, locked_at = NULL, locked_by = NULL,
         last_error_code = 'worker_lock_timeout', updated_at = ?
     WHERE status = 'running' AND locked_at IS NOT NULL AND locked_at <= ?`,
  ).bind(now, now, cutoff).run();
  const recovered = Number(result.meta.changes ?? 0);
  if (recovered) structuredLog("warn", "jobs.stale_recovered", { recovered });
  return recovered;
}

export async function claimJob(workerId: string, now = Date.now()): Promise<QueueJob | null> {
  // A single PostgreSQL statement provides an atomic queue claim. SKIP LOCKED
  // allows multiple workers to process different jobs without duplicate work.
  return getDatabase().prepare(
    `WITH candidate AS (
       SELECT id FROM job_queue
       WHERE status IN ('queued', 'retry') AND available_at <= ?
       ORDER BY available_at ASC, created_at ASC
       FOR UPDATE SKIP LOCKED
       LIMIT 1
     )
     UPDATE job_queue AS j
     SET status = 'running', attempt_count = j.attempt_count + 1,
         locked_at = ?, locked_by = ?, updated_at = ?
     FROM candidate
     WHERE j.id = candidate.id
     RETURNING j.id, j.restaurant_id, j.job_type, j.idempotency_key, j.payload_json,
               j.status, j.attempt_count, j.max_attempts, j.available_at,
               j.locked_at, j.locked_by`,
  ).bind(now, now, workerId.slice(0, 100), now).first<QueueJob>();
}

export async function completeJob(jobId: string, now = Date.now()) {
  await getDatabase().prepare(
    `UPDATE job_queue SET status = 'completed', completed_at = ?, locked_at = NULL,
     locked_by = NULL, last_error_code = NULL, updated_at = ? WHERE id = ? AND status = 'running'`,
  ).bind(now, now, jobId).run();
}

export async function failJob(
  job: Pick<QueueJob, "id" | "attempt_count" | "max_attempts">,
  errorCode: string,
  now = Date.now(),
) {
  const dead = job.attempt_count >= job.max_attempts;
  const availableAt = dead ? now : now + retryDelayMs(job.attempt_count);
  await getDatabase().prepare(
    `UPDATE job_queue SET status = ?, available_at = ?, locked_at = NULL, locked_by = NULL,
     last_error_code = ?, updated_at = ? WHERE id = ? AND status = 'running'`,
  ).bind(dead ? "dead" : "retry", availableAt, errorCode.slice(0, 120), now, job.id).run();
  structuredLog(dead ? "error" : "warn", dead ? "jobs.dead_letter" : "jobs.retry_scheduled", {
    jobId: job.id,
    attempt: job.attempt_count,
    maxAttempts: job.max_attempts,
    errorCode,
    availableAt,
  });
  return { dead, availableAt };
}

export function retryDelayMs(attempt: number) {
  const safeAttempt = Math.max(1, Math.min(10, Math.floor(attempt)));
  const base = 30_000 * (2 ** (safeAttempt - 1));
  return Math.min(6 * 60 * 60_000, base);
}

export function parseJobPayload<T extends Record<string, unknown>>(job: QueueJob): T {
  const value = JSON.parse(job.payload_json) as unknown;
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid_job_payload");
  return value as T;
}
