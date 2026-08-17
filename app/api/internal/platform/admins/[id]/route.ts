import { apiError, assertSameOrigin, HttpError, json, readJson } from "@/lib/http";
import { auditPlatformAction, requirePlatformAdmin, type PlatformAdminRole } from "@/lib/platform-admin";
import { assertCanonicalOwnerNotRemoved, assertPlatformAdminEmailAllowed, assertPlatformOwnerRoleAllowed } from "@/lib/platform-identity-policy";
import { getDatabase } from "@/lib/runtime";
import { requiredString } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const actor = await requirePlatformAdmin("admins:manage");
    const { id } = await params;
    const body = await readJson<Record<string, unknown>>(request, 12_000);
    const reason = requiredString(body.reason, "Motivo", 10, 500);
    const db = getDatabase();
    const target = await db.prepare(
      `SELECT pa.id, pa.user_id, pa.role, pa.status, u.email
       FROM platform_admins pa JOIN app_users u ON u.id = pa.user_id
       WHERE pa.id = ? LIMIT 1`,
    ).bind(id).first<{ id: string; user_id: string; role: PlatformAdminRole; status: string; email: string }>();
    if (!target) throw new HttpError(404, "Superadmin não encontrado.", "platform_admin_not_found");

    let role = target.role;
    let status = target.status;
    if (body.action === "change_role") role = normalizeRole(body.role);
    else if (body.action === "revoke") status = "revoked";
    else if (body.action === "restore") status = "active";
    else throw new HttpError(400, "Ação administrativa inválida.", "invalid_admin_action");

    if (status === "active") assertPlatformAdminEmailAllowed(target.email);
    assertPlatformOwnerRoleAllowed(target.email, role);
    assertCanonicalOwnerNotRemoved(target.email, role, status);

    const removesOwner = target.role === "owner" && target.status === "active" && (role !== "owner" || status !== "active");
    if (removesOwner) {
      const owners = await db.prepare(
        "SELECT COUNT(*) AS total FROM platform_admins WHERE role = 'owner' AND status = 'active'",
      ).first<{ total: number }>();
      if (Number(owners?.total || 0) <= 1) {
        throw new HttpError(409, "O último proprietário da plataforma não pode ser removido ou rebaixado.", "last_platform_owner_protected");
      }
    }

    await db.batch([
      db.prepare("UPDATE platform_admins SET role = ?, status = ?, updated_at = ? WHERE id = ?")
        .bind(role, status, Date.now(), id),
      ...(status === "revoked"
        ? [db.prepare("UPDATE app_users SET auth_version = auth_version + 1, updated_at = ? WHERE id = ?")
          .bind(Date.now(), target.user_id)]
        : []),
    ]);
    await auditPlatformAction(actor, {
      action: "platform_admin.updated",
      targetType: "platform_admin",
      targetId: id,
      reason,
      metadata: {
        email: target.email,
        before: { role: target.role, status: target.status },
        after: { role, status },
        sessionsInvalidated: status === "revoked",
      },
      requestId: request.headers.get("x-request-id"),
    });
    return json({ ok: true, admin: { id, email: target.email, role, status } });
  } catch (error) {
    return apiError(error, request);
  }
}

function normalizeRole(value: unknown): PlatformAdminRole {
  if (value === "owner" || value === "admin" || value === "support" || value === "viewer") return value;
  throw new HttpError(400, "Perfil administrativo inválido.", "validation_error", { field: "role" });
}
