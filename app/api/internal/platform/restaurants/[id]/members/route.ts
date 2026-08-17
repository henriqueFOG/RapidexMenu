import { PENDING_PASSWORD_HASH, issuePasswordReset } from "@/lib/password-recovery";
import { apiError, assertSameOrigin, HttpError, json, readJson } from "@/lib/http";
import { auditPlatformAction, requirePlatformAdmin } from "@/lib/platform-admin";
import { normalizeManagedEmail } from "@/lib/platform-central";
import { getBindings, getDatabase, getRapidexEnvironment } from "@/lib/runtime";
import { isSyntheticEmail } from "@/lib/tenant-classification";
import { requiredString } from "@/lib/validation";

export const dynamic = "force-dynamic";

type MemberRole = "owner" | "manager" | "operator" | "finance";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const actor = await requirePlatformAdmin("restaurants:manage");
    const { id: restaurantId } = await params;
    const body = await readJson<Record<string, unknown>>(request, 20_000);
    const email = normalizeManagedEmail(body.email);
    const name = requiredString(body.name, "Nome", 2, 120);
    const role = normalizeMemberRole(body.role);
    const reason = requiredString(body.reason, "Motivo", 10, 500);
    if (getRapidexEnvironment() === "production" && isSyntheticEmail(email)) {
      throw new HttpError(400, "E-mails de teste não podem ser cadastrados em produção.", "synthetic_email_forbidden");
    }

    const db = getDatabase();
    const [restaurant, duplicate, user] = await Promise.all([
      db.prepare("SELECT id, name FROM restaurants WHERE id = ? LIMIT 1").bind(restaurantId).first<{ id: string; name: string }>(),
      db.prepare("SELECT id FROM members WHERE restaurant_id = ? AND lower(email) = ? LIMIT 1").bind(restaurantId, email).first(),
      db.prepare(
        `SELECT u.id, u.status,
                EXISTS (SELECT 1 FROM platform_admins pa WHERE pa.user_id = u.id AND pa.status = 'active') AS is_platform_admin,
                EXISTS (SELECT 1 FROM members m WHERE lower(m.email) = lower(u.email) AND m.active = 1) AS has_membership
         FROM app_users u WHERE lower(u.email) = ? LIMIT 1`,
      ).bind(email).first<{ id: string; status: string; is_platform_admin: number; has_membership: number }>(),
    ]);
    if (!restaurant) throw new HttpError(404, "Estabelecimento não encontrado.", "restaurant_not_found");
    if (duplicate) throw new HttpError(409, "Esta pessoa já está vinculada ao estabelecimento.", "member_exists");
    if (user?.status && user.status !== "active") throw new HttpError(409, "A conta está bloqueada ou removida.", "account_not_active");
    if (user && (Number(user.is_platform_admin) === 1 || Number(user.has_membership) === 1)) {
      throw new HttpError(409, "Este e-mail já pertence a outro perfil. Use uma identidade exclusiva.", "identity_already_assigned");
    }

    const now = Date.now();
    const userId = user?.id || crypto.randomUUID();
    const memberId = crypto.randomUUID();
    const statements: D1PreparedStatement[] = [];
    if (!user) {
      statements.push(db.prepare(
        `INSERT INTO app_users
         (id, email, password_hash, full_name, phone, status, auth_version, created_at, updated_at)
         VALUES (?, ?, ?, ?, NULL, 'active', 1, ?, ?)`,
      ).bind(userId, email, PENDING_PASSWORD_HASH, name, now, now));
    }
    statements.push(db.prepare(
      `INSERT INTO members (id, restaurant_id, email, name, role, active, created_at)
       VALUES (?, ?, ?, ?, ?, 1, ?)`,
    ).bind(memberId, restaurantId, email, name, role, now));
    await db.batch(statements);

    await auditPlatformAction(actor, {
      action: "restaurant.member_created",
      targetType: "member",
      targetId: memberId,
      reason,
      metadata: { restaurantId, email, role },
      requestId: request.headers.get("x-request-id"),
    });

    let firstAccess: Awaited<ReturnType<typeof issuePasswordReset>> | null = null;
    if (!user) {
      firstAccess = await issuePasswordReset({
        db,
        user: { id: userId, email, fullName: name },
        baseUrl: getBindings().RAPIDEX_PUBLIC_URL || new URL(request.url).origin,
        expiresInMs: 48 * 60 * 60 * 1000,
      });
    }
    return json({
      ok: true,
      member: { id: memberId, userId, email, name, role, active: true },
      firstAccess: firstAccess ? {
        delivery: firstAccess.emailSent ? "email" : "manual",
        url: firstAccess.emailSent ? null : firstAccess.resetUrl,
        expiresAt: firstAccess.expiresAt,
      } : null,
    }, { status: 201 });
  } catch (error) {
    return apiError(error, request);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const actor = await requirePlatformAdmin("restaurants:manage");
    const { id: restaurantId } = await params;
    const body = await readJson<Record<string, unknown>>(request, 15_000);
    const memberId = requiredString(body.memberId, "Membro", 8, 160);
    const reason = requiredString(body.reason, "Motivo", 10, 500);
    const db = getDatabase();
    const member = await db.prepare(
      "SELECT id, email, role, active FROM members WHERE id = ? AND restaurant_id = ? LIMIT 1",
    ).bind(memberId, restaurantId).first<{ id: string; email: string; role: MemberRole; active: number }>();
    if (!member) throw new HttpError(404, "Membro não encontrado.", "member_not_found");

    let role = member.role;
    let active = Number(member.active);
    if (body.action === "update_role") role = normalizeMemberRole(body.role);
    else if (body.action === "activate") active = 1;
    else if (body.action === "deactivate") active = 0;
    else throw new HttpError(400, "Ação de membro inválida.", "invalid_member_action");

    const removingOwner = member.role === "owner" && (role !== "owner" || active === 0);
    if (removingOwner) {
      const owners = await db.prepare(
        "SELECT COUNT(*) AS total FROM members WHERE restaurant_id = ? AND role = 'owner' AND active = 1",
      ).bind(restaurantId).first<{ total: number }>();
      if (Number(owners?.total || 0) <= 1) {
        throw new HttpError(409, "O estabelecimento precisa manter ao menos um proprietário ativo.", "last_owner_protected");
      }
    }

    await db.prepare("UPDATE members SET role = ?, active = ? WHERE id = ? AND restaurant_id = ?")
      .bind(role, active, memberId, restaurantId).run();
    await auditPlatformAction(actor, {
      action: "restaurant.member_updated",
      targetType: "member",
      targetId: memberId,
      reason,
      metadata: { restaurantId, before: { role: member.role, active: Boolean(member.active) }, after: { role, active: Boolean(active) } },
      requestId: request.headers.get("x-request-id"),
    });
    return json({ ok: true, member: { id: memberId, email: member.email, role, active: Boolean(active) } });
  } catch (error) {
    return apiError(error, request);
  }
}

function normalizeMemberRole(value: unknown): MemberRole {
  if (value === "owner" || value === "manager" || value === "operator" || value === "finance") return value;
  throw new HttpError(400, "Perfil de membro inválido.", "validation_error", { field: "role" });
}
