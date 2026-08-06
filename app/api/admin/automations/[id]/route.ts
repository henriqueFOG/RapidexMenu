import { audit, requireAdminContext, requireRole } from "@/lib/admin-auth";
import { apiError, assertSameOrigin, HttpError, json, readJson } from "@/lib/http";
import { getDatabase } from "@/lib/runtime";
import { requiredString } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);
    const context = await requireAdminContext();
    requireRole(context, ["owner", "manager"]);
    const id = requiredString((await params).id, "Automação", 2, 100);
    const body = await readJson<Record<string, unknown>>(request, 10_000);
    const action = requiredString(body.action, "Ação", 2, 20);
    if (!["approve", "dismiss"].includes(action)) {
      throw new HttpError(400, "Ação inválida.", "validation_error");
    }
    const status = action === "approve" ? "approved" : "failed";
    const result = await getDatabase()
      .prepare(
        `UPDATE automation_events SET status = ?, updated_at = ?
         WHERE id = ? AND restaurant_id = ? AND status = 'draft'`,
      )
      .bind(status, Date.now(), id, context.restaurantId)
      .run();
    if (!(result.meta.changes ?? 0)) {
      throw new HttpError(409, "Automação já revisada ou inexistente.", "automation_not_editable");
    }
    await audit(context, `automation.${action}`, "automation", id);
    return json({
      ok: true,
      status,
      message:
        action === "approve"
          ? "Aprovada. O envio ocorrerá apenas para clientes com consentimento e template válido."
          : "Sugestão descartada.",
    });
  } catch (error) {
    return apiError(error);
  }
}
