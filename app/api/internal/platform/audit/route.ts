import { apiError, json } from "@/lib/http";
import { requirePlatformAdmin } from "@/lib/platform-admin";
import { getDatabase } from "@/lib/runtime";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requirePlatformAdmin("platform:read");
    const url = new URL(request.url);
    const targetId = String(url.searchParams.get("targetId") || "").trim();
    const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") || 100)));
    const query = targetId
      ? getDatabase().prepare(
        `SELECT id, actor_email, actor_role, action, target_type, target_id, reason, metadata_json, request_id, created_at
         FROM platform_audit_logs WHERE target_id = ? ORDER BY created_at DESC LIMIT ?`,
      ).bind(targetId, limit)
      : getDatabase().prepare(
        `SELECT id, actor_email, actor_role, action, target_type, target_id, reason, metadata_json, request_id, created_at
         FROM platform_audit_logs ORDER BY created_at DESC LIMIT ?`,
      ).bind(limit);
    const rows = await query.all<Record<string, unknown>>();
    return json({
      ok: true,
      events: rows.results.map((row) => ({
        id: row.id,
        actorEmail: row.actor_email,
        actorRole: row.actor_role,
        action: row.action,
        targetType: row.target_type,
        targetId: row.target_id,
        reason: row.reason,
        metadata: safeMetadata(row.metadata_json),
        requestId: row.request_id,
        createdAt: row.created_at,
      })),
    });
  } catch (error) {
    return apiError(error, request);
  }
}

function safeMetadata(value: unknown) {
  try { return JSON.parse(String(value || "{}")) as Record<string, unknown>; } catch { return {}; }
}
