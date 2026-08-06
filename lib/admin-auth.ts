import { getChatGPTUser, type ChatGPTUser } from "@/app/chatgpt-auth";
import { ensureDemoData, DEMO_RESTAURANT_ID, PENDING_OWNER_EMAIL } from "./demo-data";
import { HttpError } from "./http";
import { getBindings, getDatabase } from "./runtime";

export type MemberRole = "owner" | "manager" | "operator" | "finance";

export type AdminContext = {
  user: ChatGPTUser;
  restaurantId: string;
  restaurantName: string;
  restaurantSlug: string;
  role: MemberRole;
};

type MembershipRow = {
  restaurant_id: string;
  restaurant_name: string;
  restaurant_slug: string;
  role: MemberRole;
};

export async function requireAdminContext(): Promise<AdminContext> {
  const user = await getChatGPTUser();
  if (!user) throw new HttpError(401, "Entre para acessar a gestão.", "authentication_required");

  const db = getDatabase();
  await ensureDemoData(db);
  const email = user.email.trim().toLowerCase();

  let membership = await findMembership(db, email);
  if (!membership) {
    const ownedRestaurant = await db
      .prepare(
        `SELECT id AS restaurant_id, name AS restaurant_name, slug AS restaurant_slug, 'owner' AS role
         FROM restaurants WHERE lower(owner_email) = ? LIMIT 1`,
      )
      .bind(email)
      .first<MembershipRow>();
    if (ownedRestaurant) {
      await addOwnerMembership(db, ownedRestaurant.restaurant_id, email, user.fullName);
      membership = ownedRestaurant;
    }
  }

  if (!membership && canClaimDemo(email)) {
    const result = await db
      .prepare(
        "UPDATE restaurants SET owner_email = ?, updated_at = ? WHERE id = ? AND owner_email = ?",
      )
      .bind(email, Date.now(), DEMO_RESTAURANT_ID, PENDING_OWNER_EMAIL)
      .run();
    if ((result.meta.changes ?? 0) > 0) {
      await addOwnerMembership(db, DEMO_RESTAURANT_ID, email, user.fullName);
      membership = await findMembership(db, email);
    }
  }

  if (!membership) {
    throw new HttpError(
      403,
      "Sua conta ainda não está vinculada a um restaurante.",
      "membership_required",
    );
  }

  return {
    user,
    restaurantId: membership.restaurant_id,
    restaurantName: membership.restaurant_name,
    restaurantSlug: membership.restaurant_slug,
    role: membership.role,
  };
}

export function requireRole(context: AdminContext, roles: MemberRole[]) {
  if (!roles.includes(context.role)) {
    throw new HttpError(403, "Seu perfil não pode realizar esta ação.", "insufficient_role");
  }
}

export async function audit(
  context: AdminContext,
  action: string,
  entityType: string,
  entityId?: string,
  metadata: Record<string, unknown> = {},
) {
  const db = getDatabase();
  await db
    .prepare(
      `INSERT INTO audit_logs
       (id, restaurant_id, actor_email, action, entity_type, entity_id, metadata_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      crypto.randomUUID(),
      context.restaurantId,
      context.user.email,
      action,
      entityType,
      entityId ?? null,
      JSON.stringify(metadata),
      Date.now(),
    )
    .run();
}

async function findMembership(db: D1Database, email: string) {
  return db
    .prepare(
      `SELECT m.restaurant_id, r.name AS restaurant_name, r.slug AS restaurant_slug, m.role
       FROM members m
       JOIN restaurants r ON r.id = m.restaurant_id
       WHERE lower(m.email) = ? AND m.active = 1 AND r.status != 'canceled'
       ORDER BY CASE m.role WHEN 'owner' THEN 0 WHEN 'manager' THEN 1 ELSE 2 END
       LIMIT 1`,
    )
    .bind(email)
    .first<MembershipRow>();
}

async function addOwnerMembership(
  db: D1Database,
  restaurantId: string,
  email: string,
  fullName: string | null,
) {
  await db
    .prepare(
      `INSERT OR IGNORE INTO members (id, restaurant_id, email, name, role, active, created_at)
       VALUES (?, ?, ?, ?, 'owner', 1, ?)`,
    )
    .bind(crypto.randomUUID(), restaurantId, email, fullName, Date.now())
    .run();
}

function canClaimDemo(email: string) {
  const configuredOwner = getBindings().RAPIDEX_OWNER_EMAIL?.trim().toLowerCase();
  return !configuredOwner || configuredOwner === email;
}
