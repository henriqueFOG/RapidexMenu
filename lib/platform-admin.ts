import { getChatGPTUser, type ChatGPTUser } from "@/app/chatgpt-auth";
import { HttpError } from "./http";
import { hasValidPlatformMfaSession, platformMfaRequired } from "./platform-mfa";
import {
  hasPlatformPermission,
  type PlatformAdminRole,
  type PlatformPermission,
} from "./platform-permissions";
import { getBindings, getDatabase } from "./runtime";
import { configuredPlatformOwnerIsCanonical } from "./platform-identity-policy";

export type { PlatformAdminRole, PlatformPermission } from "./platform-permissions";

export type PlatformAdminContext = ChatGPTUser & {
  userId: string;
  adminId: string;
  role: PlatformAdminRole;
};

type PlatformAdminRow = {
  admin_id: string;
  user_id: string;
  role: PlatformAdminRole;
};

export async function getPlatformAdmin(user?: ChatGPTUser | null): Promise<PlatformAdminContext | null> {
  const authenticated = user === undefined ? await getChatGPTUser() : user;
  if (!authenticated) return null;

  const db = getDatabase();
  const email = authenticated.email.trim().toLowerCase();
  let row = await db.prepare(
    `SELECT pa.id AS admin_id, pa.user_id, pa.role
     FROM platform_admins pa
     JOIN app_users u ON u.id = pa.user_id
     WHERE pa.status = 'active' AND u.status = 'active' AND lower(u.email) = ?
     LIMIT 1`,
  ).bind(email).first<PlatformAdminRow>();

  if (!row) row = await bootstrapConfiguredOwner(db, authenticated, email);
  if (!row) return null;

  await db.prepare("UPDATE platform_admins SET last_access_at = ?, updated_at = ? WHERE id = ?")
    .bind(Date.now(), Date.now(), row.admin_id).run();

  return { ...authenticated, userId: row.user_id, adminId: row.admin_id, role: row.role };
}

export async function requirePlatformAdmin(permission: PlatformPermission = "platform:read"): Promise<PlatformAdminContext> {
  const user = await getChatGPTUser();
  if (!user) throw new HttpError(401, "Entre para acessar a plataforma.", "authentication_required");
  const admin = await getPlatformAdmin(user);
  if (!admin) {
    throw new HttpError(403, "Acesso restrito à administração da plataforma.", "platform_admin_required");
  }
  if (platformMfaRequired() && !(await hasValidPlatformMfaSession(admin))) {
    throw new HttpError(401, "Confirme o segundo fator para acessar a Central.", "platform_mfa_required");
  }
  if (!hasPlatformPermission(admin.role, permission)) {
    throw new HttpError(403, "Seu perfil administrativo não pode realizar esta ação.", "platform_permission_required");
  }
  return admin;
}

export async function auditPlatformAction(
  admin: PlatformAdminContext,
  input: {
    action: string;
    targetType: string;
    targetId?: string | null;
    reason?: string | null;
    metadata?: Record<string, unknown>;
    requestId?: string | null;
  },
) {
  await getDatabase().prepare(
    `INSERT INTO platform_audit_logs
     (id, actor_user_id, actor_email, actor_role, action, target_type, target_id,
      reason, metadata_json, request_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    crypto.randomUUID(),
    admin.userId,
    admin.email,
    admin.role,
    input.action,
    input.targetType,
    input.targetId ?? null,
    input.reason ?? null,
    JSON.stringify(input.metadata ?? {}),
    input.requestId ?? null,
    Date.now(),
  ).run();
}

async function bootstrapConfiguredOwner(db: D1Database, user: ChatGPTUser, email: string) {
  const configuredOwner = getBindings().RAPIDEX_OWNER_EMAIL?.trim().toLowerCase();
  if (!configuredOwner || !configuredPlatformOwnerIsCanonical(configuredOwner) || configuredOwner !== email) return null;

  const existing = await db.prepare(
    "SELECT COUNT(*) AS total FROM platform_admins WHERE status = 'active'",
  ).first<{ total: number }>();
  if (Number(existing?.total || 0) > 0) return null;

  const account = await db.prepare(
    "SELECT id FROM app_users WHERE lower(email) = ? AND status = 'active' LIMIT 1",
  ).bind(email).first<{ id: string }>();
  if (!account) return null;

  const adminId = crypto.randomUUID();
  const now = Date.now();
  const created = await db.prepare(
    `INSERT OR IGNORE INTO platform_admins
     (id, user_id, role, status, created_by_user_id, created_at, updated_at)
     VALUES (?, ?, 'owner', 'active', ?, ?, ?)`,
  ).bind(adminId, account.id, account.id, now, now).run();
  const actual = await db.prepare(
    `SELECT id AS admin_id, user_id, role FROM platform_admins
     WHERE user_id = ? AND status = 'active' LIMIT 1`,
  ).bind(account.id).first<PlatformAdminRow>();
  if (!actual) return null;

  if (Number(created.meta.changes || 0) === 1) {
    await db.prepare(
      `INSERT INTO platform_audit_logs
       (id, actor_user_id, actor_email, actor_role, action, target_type, target_id,
        reason, metadata_json, created_at)
       VALUES (?, ?, ?, 'owner', 'platform_admin.bootstrap', 'platform_admin', ?,
        'Bootstrap seguro do primeiro proprietário configurado', ?, ?)`,
    ).bind(
      crypto.randomUUID(), account.id, user.email, actual.admin_id,
      JSON.stringify({ source: "RAPIDEX_OWNER_EMAIL" }), now,
    ).run();
  }

  return actual;
}
