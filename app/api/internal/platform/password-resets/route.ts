import { apiError, assertSameOrigin, HttpError, json, readJson } from "@/lib/http";
import { issuePasswordReset } from "@/lib/password-recovery";
import { auditPlatformAction, requirePlatformAdmin } from "@/lib/platform-admin";
import { getBindings, getDatabase } from "@/lib/runtime";
import { requiredString } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const actor = await requirePlatformAdmin("users:support");
    const body = await readJson<{ email?: unknown; reason?: unknown }>(request, 10_000);
    const email = normalizeEmail(body.email);
    const reason = requiredString(body.reason, "Motivo", 10, 500);
    const db = getDatabase();
    const user = await db.prepare(
      `SELECT u.id, u.email, u.full_name, pa.role AS platform_role
       FROM app_users u
       LEFT JOIN platform_admins pa ON pa.user_id = u.id AND pa.status = 'active'
       WHERE lower(u.email) = ? AND u.status = 'active' LIMIT 1`,
    ).bind(email).first<{ id: string; email: string; full_name: string; platform_role: string | null }>();
    if (!user) throw new HttpError(404, "Conta ativa não encontrada.", "account_not_found");
    if (user.platform_role && actor.role !== "owner") {
      throw new HttpError(403, "Somente o proprietário da plataforma pode redefinir o acesso de outro administrador.", "owner_required");
    }

    const baseUrl = getBindings().RAPIDEX_PUBLIC_URL || new URL(request.url).origin;
    const reset = await issuePasswordReset({
      db,
      user: { id: user.id, email: user.email, fullName: user.full_name },
      baseUrl,
      returnTo: user.platform_role ? "/central/entrar" : "/entrar",
    });
    await auditPlatformAction(actor, {
      action: "user.password_reset_issued",
      targetType: user.platform_role ? "platform_admin" : "app_user",
      targetId: user.id,
      reason,
      metadata: { delivery: reset.emailSent ? "email" : "manual" },
      requestId: request.headers.get("x-request-id"),
    });

    return json({
      ok: true,
      delivery: reset.emailSent ? "email" : "manual",
      resetUrl: reset.emailSent ? null : reset.resetUrl,
      expiresAt: reset.expiresAt,
    });
  } catch (error) {
    return apiError(error, request);
  }
}

function normalizeEmail(value: unknown) {
  const email = requiredString(value, "E-mail", 5, 160).trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpError(400, "E-mail inválido.", "validation_error", { field: "email" });
  }
  return email;
}
