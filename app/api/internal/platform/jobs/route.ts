import { apiError, assertSameOrigin, HttpError, json, readJson } from "@/lib/http";
import { auditPlatformAction, requirePlatformAdmin } from "@/lib/platform-admin";
import { getDatabase } from "@/lib/runtime";
import { requiredString } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requirePlatformAdmin();
    const rows = await getDatabase().prepare(
      `SELECT j.id, j.restaurant_id, r.name AS restaurant_name, j.job_type, j.status,
              j.attempt_count, j.max_attempts, j.available_at, j.locked_at,
              j.last_error_code, j.created_at, j.updated_at
       FROM job_queue j
       LEFT JOIN restaurants r ON r.id = j.restaurant_id
       WHERE j.status IN ('retry', 'running', 'dead')
       ORDER BY CASE j.status WHEN 'dead' THEN 0 WHEN 'retry' THEN 1 ELSE 2 END,
                j.updated_at DESC
       LIMIT 200`,
    ).all<Record<string, unknown>>();
    return json({
      ok: true,
      jobs: rows.results.map((row) => ({
        id: row.id,
        restaurantId: row.restaurant_id,
        restaurantName: row.restaurant_name,
        type: row.job_type,
        status: row.status,
        attemptCount: row.attempt_count,
        maxAttempts: row.max_attempts,
        availableAt: row.available_at,
        lockedAt: row.locked_at,
        errorCode: row.last_error_code,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })),
    });
  } catch (error) {
    return apiError(error, request);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const admin = await requirePlatformAdmin("platform:operate");
    const body = await readJson<Record<string, unknown>>(request, 10_000);
    const id = requiredString(body.id, "Job", 8, 160);
    const reason = requiredString(body.reason, "Motivo", 10, 500);
    if (body.action !== "requeue") {
      throw new HttpError(400, "Ação de job inválida.", "invalid_job_action");
    }
    const now = Date.now();
    const row = await getDatabase().prepare(
      `UPDATE job_queue SET status = 'queued', attempt_count = 0, available_at = ?,
       locked_at = NULL, locked_by = NULL, last_error_code = NULL,
       completed_at = NULL, updated_at = ?
       WHERE id = ? AND status IN ('dead', 'retry')
       RETURNING id, restaurant_id, job_type`,
    ).bind(now, now, id).first<{ id: string; restaurant_id: string | null; job_type: string }>();
    if (!row) {
      throw new HttpError(409, "Este job não pode ser reenfileirado no estado atual.", "job_not_requeueable");
    }
    await auditPlatformAction(admin, {
      action: "platform.job_requeued",
      targetType: "job",
      targetId: row.id,
      reason,
      metadata: { restaurantId: row.restaurant_id, jobType: row.job_type },
      requestId: request.headers.get("x-request-id"),
    });
    return json({ ok: true, id: row.id, status: "queued" });
  } catch (error) {
    return apiError(error, request);
  }
}
