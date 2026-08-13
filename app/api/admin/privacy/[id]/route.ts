import { audit, requireAdminContext, requireRole } from "@/lib/admin-auth";
import { apiError, assertSameOrigin, HttpError, json, readJson } from "@/lib/http";
import { getDatabase } from "@/lib/runtime";
import { optionalString, requiredString } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);
    const context = await requireAdminContext();
    requireRole(context, ["owner", "manager"]);
    const requestId = requiredString((await params).id, "Solicitação", 2, 100);
    const body = await readJson<Record<string, unknown>>(request, 20_000);
    const status = requiredString(body.status, "Status", 3, 20);
    if (!["pending", "in_review", "completed", "rejected"].includes(status)) {
      throw new HttpError(400, "Status da solicitação inválido.", "validation_error", { field: "status" });
    }
    const note = optionalString(body.note, "Nota", 1000);
    const db = getDatabase();
    const current = await db.prepare(
      `SELECT id, customer_id, request_type, status, details_json
       FROM privacy_requests WHERE id = ? AND restaurant_id = ? LIMIT 1`,
    ).bind(requestId, context.restaurantId).first<Record<string, unknown>>();
    if (!current) throw new HttpError(404, "Solicitação não encontrada.", "privacy_request_not_found");

    if (current.request_type === "deletion" && status === "completed") {
      throw new HttpError(
        409,
        "Pedido de eliminação não pode ser marcado como concluído antes da execução/análise de retenção. Use 'em análise' ou registre rejeição fundamentada.",
        "deletion_requires_retention_review",
      );
    }

    const details = parseJson(current.details_json);
    const history = Array.isArray(details.history) ? details.history : [];
    details.history = [...history, {
      at: Date.now(),
      by: context.user.email,
      from: current.status,
      to: status,
      note,
    }].slice(-50);
    const completed = status === "completed" || status === "rejected";
    await db.prepare(
      `UPDATE privacy_requests SET status = ?, details_json = ?, completed_at = ?, completed_by = ?, updated_at = ?
       WHERE id = ? AND restaurant_id = ?`,
    ).bind(
      status,
      JSON.stringify(details),
      completed ? Date.now() : null,
      completed ? context.user.email : null,
      Date.now(),
      requestId,
      context.restaurantId,
    ).run();
    await audit(context, "privacy.request_status_changed", "privacy_request", requestId, {
      requestType: current.request_type,
      from: current.status,
      to: status,
      note: note || null,
    });
    return json({ ok: true, status });
  } catch (error) {
    return apiError(error);
  }
}

function parseJson(value: unknown): Record<string, unknown> {
  try {
    const parsed = JSON.parse(String(value || "{}")) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}
