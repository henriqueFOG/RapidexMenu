import { apiError, assertSameOrigin, HttpError, json, readJson } from "@/lib/http";
import { PENDING_PASSWORD_HASH, issuePasswordReset } from "@/lib/password-recovery";
import {
  auditPlatformAction,
  requirePlatformAdmin,
  type PlatformAdminRole,
} from "@/lib/platform-admin";
import { getBindings, getDatabase } from "@/lib/runtime";
import { requiredString } from "@/lib/validation";

export const dynamic = "force-dynamic";

type CreateAdminBody = {
  email?: unknown;
  fullName?: unknown;
  role?: unknown;
  reason?: unknown;
};

export async function GET(request: Request) {
  try {
    await requirePlatformAdmin("platform:read");
    const rows = await getDatabase().prepare(
      `SELECT pa.id, pa.role, pa.status, pa.last_access_at, pa.created_at,
              u.id AS user_id, u.email, u.full_name, u.status AS user_status
       FROM platform_admins pa
       JOIN app_users u ON u.id = pa.user_id
       ORDER BY CASE pa.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 WHEN 'support' THEN 2 ELSE 3 END,
                pa.created_at ASC`,
    ).all<Record<string, unknown>>();
    return json({
      ok: true,
      admins: rows.results.map((row) => ({
        id: row.id,
        userId: row.user_id,
        email: row.email,
        fullName: row.full_name,
        role: row.role,
        status: row.status,
        userStatus: row.user_status,
        lastAccessAt: row.last_access_at,
        createdAt: row.created_at,
      })),
    });
  } catch (error) {
    return apiError(error, request);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const actor = await requirePlatformAdmin("admins:manage");
    const body = await readJson<CreateAdminBody>(request, 20_000);
    const email = normalizeEmail(body.email);
    const fullName = requiredString(body.fullName, "Nome", 2, 120);
    const role = normalizeRole(body.role);
    const reason = requiredString(body.reason, "Motivo", 10, 500);
    const db = getDatabase();
    const existingUser = await db.prepare(
      "SELECT id, email, full_name, status FROM app_users WHERE lower(email) = ? LIMIT 1",
    ).bind(email).first<{ id: string; email: string; full_name: string; status: string }>();
    if (existingUser?.status !== undefined && existingUser.status !== "active") {
      throw new HttpError(409, "A conta existe, mas está bloqueada ou removida.", "account_not_active");
    }
    if (existingUser) {
      const alreadyAdmin = await db.prepare(
        "SELECT id FROM platform_admins WHERE user_id = ? LIMIT 1",
      ).bind(existingUser.id).first();
      if (alreadyAdmin) throw new HttpError(409, "Esta conta já possui um perfil administrativo.", "platform_admin_exists");
    }

    const now = Date.now();
    const userId = existingUser?.id ?? crypto.randomUUID();
    const adminId = crypto.randomUUID();
    const statements: D1PreparedStatement[] = [];
    if (!existingUser) {
      statements.push(db.prepare(
        `INSERT INTO app_users
         (id, email, password_hash, full_name, phone, status, auth_version, created_at, updated_at)
         VALUES (?, ?, ?, ?, NULL, 'active', 1, ?, ?)`,
      ).bind(userId, email, PENDING_PASSWORD_HASH, fullName, now, now));
    }
    statements.push(db.prepare(
      `INSERT INTO platform_admins
       (id, user_id, role, status, created_by_user_id, created_at, updated_at)
       VALUES (?, ?, ?, 'active', ?, ?, ?)`,
    ).bind(adminId, userId, role, actor.userId, now, now));
    await db.batch(statements);

    await auditPlatformAction(actor, {
      action: "platform_admin.created",
      targetType: "platform_admin",
      targetId: adminId,
      reason,
      metadata: { email, role, newIdentity: !existingUser },
      requestId: request.headers.get("x-request-id"),
    });

    let firstAccess: Awaited<ReturnType<typeof issuePasswordReset>> | null = null;
    if (!existingUser) {
      const baseUrl = getBindings().RAPIDEX_PUBLIC_URL || new URL(request.url).origin;
      firstAccess = await issuePasswordReset({
        db,
        user: { id: userId, email, fullName },
        baseUrl,
        returnTo: "/central/entrar",
        expiresInMs: 2 * 60 * 60 * 1000,
      });
    }

    return json({
      ok: true,
      admin: { id: adminId, userId, email, fullName, role, status: "active" },
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

function normalizeEmail(value: unknown) {
  const email = requiredString(value, "E-mail", 5, 160).trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpError(400, "E-mail inválido.", "validation_error", { field: "email" });
  }
  return email;
}

function normalizeRole(value: unknown): PlatformAdminRole {
  if (value === "owner" || value === "admin" || value === "support" || value === "viewer") return value;
  throw new HttpError(400, "Perfil administrativo inválido.", "validation_error", { field: "role" });
}
