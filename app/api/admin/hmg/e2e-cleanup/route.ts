import { requireAdminContext, requireRole } from "@/lib/admin-auth";
import { apiError, assertSameOrigin, HttpError, json } from "@/lib/http";
import { getDatabase, getRapidexEnvironment } from "@/lib/runtime";

export const dynamic = "force-dynamic";

export async function DELETE(request: Request) {
  try {
    assertSameOrigin(request);
    if (getRapidexEnvironment() !== "hmg") {
      throw new HttpError(404, "Recurso indisponível.", "not_found");
    }

    const context = await requireAdminContext();
    requireRole(context, ["owner"]);

    const email = context.user.email.trim().toLowerCase();
    const isAutomatedTenant =
      context.restaurantName.startsWith("Rapidex E2E ") &&
      context.restaurantSlug.startsWith("rapidex-e2e-") &&
      /^e2e\.\d+@rapidex-hmg\.test$/.test(email);

    if (!isAutomatedTenant) {
      throw new HttpError(403, "Somente tenants automatizados de HMG podem usar esta limpeza.", "e2e_cleanup_forbidden");
    }

    const result = await getDatabase()
      .prepare("DELETE FROM restaurants WHERE id = ? AND slug = ? AND lower(owner_email) = ?")
      .bind(context.restaurantId, context.restaurantSlug, email)
      .run();

    if ((result.meta.changes ?? 0) !== 1) {
      throw new HttpError(409, "Tenant E2E não foi removido.", "e2e_cleanup_failed");
    }

    return json({ ok: true, deleted: true });
  } catch (error) {
    return apiError(error, request);
  }
}
