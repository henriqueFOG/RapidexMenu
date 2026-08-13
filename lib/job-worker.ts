import { completeJob, failJob, parseJobPayload, type QueueJob } from "./job-queue";
import { structuredLog } from "./observability";
import { getDatabase } from "./runtime";
import { sendTransactionalEmail } from "./transactional-email";

type TransactionalEmailPayload = {
  to?: unknown;
  subject?: unknown;
  html?: unknown;
  dunningEventId?: unknown;
};

export async function processClaimedJob(job: QueueJob) {
  try {
    if (job.job_type === "transactional_email") {
      await processTransactionalEmail(job);
      await completeJob(job.id);
      structuredLog("info", "jobs.completed", {
        jobId: job.id,
        jobType: job.job_type,
        restaurantId: job.restaurant_id,
        attempt: job.attempt_count,
      });
      return { ok: true as const, dead: false };
    }
    throw new Error("unsupported_job_type");
  } catch (error) {
    const errorCode = error instanceof Error ? normalizeErrorCode(error.message) : "job_failed";
    const result = await failJob(job, errorCode);
    if (result.dead) await markLinkedFailure(job, errorCode);
    return { ok: false as const, dead: result.dead, errorCode };
  }
}

async function processTransactionalEmail(job: QueueJob) {
  const payload = parseJobPayload<TransactionalEmailPayload & Record<string, unknown>>(job);
  const to = requiredText(payload.to, "invalid_email_job_recipient", 320);
  const subject = requiredText(payload.subject, "invalid_email_job_subject", 240);
  const html = requiredText(payload.html, "invalid_email_job_html", 100_000);
  const sent = await sendTransactionalEmail({ to, subject, html });
  if (!sent) throw new Error("transactional_email_failed");

  const dunningEventId = optionalId(payload.dunningEventId);
  if (dunningEventId) {
    const now = Date.now();
    await getDatabase().prepare(
      `UPDATE billing_dunning_events SET status = 'sent', sent_at = ?, last_error = NULL,
       last_attempt_at = ? WHERE id = ?`,
    ).bind(now, now, dunningEventId).run();
  }
}

async function markLinkedFailure(job: QueueJob, errorCode: string) {
  if (job.job_type !== "transactional_email") return;
  let payload: TransactionalEmailPayload;
  try {
    payload = parseJobPayload<TransactionalEmailPayload & Record<string, unknown>>(job);
  } catch {
    return;
  }
  const dunningEventId = optionalId(payload.dunningEventId);
  if (!dunningEventId) return;
  await getDatabase().prepare(
    `UPDATE billing_dunning_events SET status = 'failed', last_error = ?, last_attempt_at = ?
     WHERE id = ?`,
  ).bind(errorCode.slice(0, 120), Date.now(), dunningEventId).run();
}

function requiredText(value: unknown, code: string, max: number) {
  if (typeof value !== "string" || !value.trim() || value.length > max) throw new Error(code);
  return value.trim();
}

function optionalId(value: unknown) {
  if (typeof value !== "string") return null;
  const id = value.trim();
  return /^[A-Za-z0-9._:-]{8,160}$/.test(id) ? id : null;
}

function normalizeErrorCode(value: string) {
  return value.replace(/[^a-zA-Z0-9._:-]/g, "_").slice(0, 120) || "job_failed";
}
