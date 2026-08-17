import { apiError, assertSameOrigin, HttpError, json, readJson } from "@/lib/http";
import { auditPlatformAction, requirePlatformAdmin } from "@/lib/platform-admin";
import { getDatabase } from "@/lib/runtime";
import { requiredString } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requirePlatformAdmin("platform:read");
    const restaurantId = requiredString(new URL(request.url).searchParams.get("restaurantId"), "Estabelecimento", 8, 160);
    const rows = await getDatabase().prepare(
      `SELECT id, actor_email, note, visibility, created_at
       FROM platform_support_notes WHERE restaurant_id = ? ORDER BY created_at DESC LIMIT 100`,
    ).bind(restaurantId).all<Record<string, unknown>>();
    return json({ ok: true, notes: rows.results.map((row) => ({
      id: row.id,
      actorEmail: row.actor_email,
      note: row.note,
      visibility: row.visibility,
      createdAt: row.created_at,
    })) });
  } catch (error) {
    return apiError(error, request);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const actor = await requirePlatformAdmin("users:support");
    const body = await readJson<Record<string, unknown>>(request, 12_000);
    const restaurantId = requiredString(body.restaurantId, "Estabelecimento", 8, 160);
    const note = requiredString(body.note, "Nota", 3, 2_000);
    const db = getDatabase();
    const id = crypto.randomUUID();
    const now = Date.now();
    const result = await db.prepare(
      `INSERT INTO platform_support_notes
       (id, restaurant_id, actor_user_id, actor_email, note, visibility, created_at)
       SELECT ?, id, ?, ?, ?, 'internal', ? FROM restaurants WHERE id = ?`,
    ).bind(id, actor.userId, actor.email, note, now, restaurantId).run();
    if (Number(result.meta.changes || 0) !== 1) {
      throw new HttpError(404, "Estabelecimento não encontrado.", "restaurant_not_found");
    }
    await auditPlatformAction(actor, {
      action: "support.note_created",
      targetType: "restaurant",
      targetId: restaurantId,
      reason: "Registro interno de atendimento",
      metadata: { noteId: id },
      requestId: request.headers.get("x-request-id"),
    });
    return json({ ok: true, note: { id, actorEmail: actor.email, note, visibility: "internal", createdAt: now } }, { status: 201 });
  } catch (error) {
    return apiError(error, request);
  }
}
