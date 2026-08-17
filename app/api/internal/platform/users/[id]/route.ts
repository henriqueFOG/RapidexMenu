import { apiError, assertSameOrigin, HttpError, json, readJson } from "@/lib/http";
import { auditPlatformAction, requirePlatformAdmin } from "@/lib/platform-admin";
import { CANONICAL_PLATFORM_OWNER_EMAIL } from "@/lib/platform-identity-policy";
import { getDatabase } from "@/lib/runtime";
import { requiredString } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const actor = await requirePlatformAdmin("users:support");
    const { id } = await params;
    const body = await readJson<Record<string, unknown>>(request, 12_000);
    const reason = requiredString(body.reason, "Motivo", 10, 500);
    const action = body.action;
    if (action !== "block" && action !== "unblock") throw new HttpError(400, "Ação de usuário inválida.", "invalid_user_action");

    const db = getDatabase();
    const user = await db.prepare(
      `SELECT u.id, u.email, u.status, pa.id AS admin_id, pa.role AS admin_role, pa.status AS admin_status
       FROM app_users u LEFT JOIN platform_admins pa ON pa.user_id = u.id
       WHERE u.id = ? LIMIT 1`,
    ).bind(id).first<{ id: string; email: string; status: string; admin_id: string | null; admin_role: string | null; admin_status: string | null }>();
    if (!user) throw new HttpError(404, "Usuário não encontrado.", "user_not_found");
    if (user.admin_id && actor.role !== "owner") {
      throw new HttpError(403, "Somente um proprietário pode alterar o acesso de outro superadmin.", "owner_required");
    }
    if (action === "block" && user.id === actor.userId) {
      throw new HttpError(409, "Você não pode bloquear sua própria conta durante a sessão.", "self_block_forbidden");
    }
    if (action === "block" && user.email.trim().toLowerCase() === CANONICAL_PLATFORM_OWNER_EMAIL) {
      throw new HttpError(409, "O proprietário canônico não pode ser bloqueado pela Central.", "canonical_platform_owner_protected");
    }
    if (action === "block" && user.admin_role === "owner" && user.admin_status === "active") {
      const owners = await db.prepare(
        "SELECT COUNT(*) AS total FROM platform_admins WHERE role = 'owner' AND status = 'active'",
      ).first<{ total: number }>();
      if (Number(owners?.total || 0) <= 1) {
        throw new HttpError(409, "O último proprietário da plataforma não pode ser bloqueado.", "last_platform_owner_protected");
      }
    }

    const status = action === "block" ? "blocked" : "active";
    await db.prepare(
      "UPDATE app_users SET status = ?, auth_version = auth_version + 1, updated_at = ? WHERE id = ?",
    ).bind(status, Date.now(), id).run();
    await auditPlatformAction(actor, {
      action: `user.${action}`,
      targetType: user.admin_id ? "platform_admin_user" : "app_user",
      targetId: id,
      reason,
      metadata: { email: user.email, before: user.status, after: status, sessionsInvalidated: true },
      requestId: request.headers.get("x-request-id"),
    });
    return json({ ok: true, user: { id, email: user.email, status }, sessionsInvalidated: true });
  } catch (error) {
    return apiError(error, request);
  }
}
