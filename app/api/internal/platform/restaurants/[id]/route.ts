import { apiError, assertSameOrigin, HttpError, json, readJson } from "@/lib/http";
import { auditPlatformAction, requirePlatformAdmin } from "@/lib/platform-admin";
import {
  normalizeManagedPlan,
  normalizeManagedStatus,
  optionalTimestamp,
  restaurantControlTransition,
  type ManagedRestaurantAction,
  type ManagedRestaurantStatus,
} from "@/lib/platform-central";
import { getDatabase } from "@/lib/runtime";
import { requiredString } from "@/lib/validation";

export const dynamic = "force-dynamic";

type RestaurantControlRow = {
  id: string;
  name: string;
  slug: string;
  owner_email: string;
  plan: "start" | "growth" | "scale";
  status: ManagedRestaurantStatus;
  trial_ends_at: number | null;
  access_ends_at: number | null;
  platform_blocked_at: number | null;
  platform_block_reason: string | null;
  platform_previous_status: string | null;
  created_at: number;
  updated_at: number;
};

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePlatformAdmin("platform:read");
    const { id } = await params;
    const db = getDatabase();
    const [restaurant, members, counts, recentOrders] = await Promise.all([
      findRestaurant(db, id),
      db.prepare(
        `SELECT m.id, m.email, m.name, m.role, m.active, m.created_at,
                u.id AS user_id, u.status AS user_status, u.last_login_at
         FROM members m
         LEFT JOIN app_users u ON lower(u.email) = lower(m.email)
         WHERE m.restaurant_id = ?
         ORDER BY CASE m.role WHEN 'owner' THEN 0 WHEN 'manager' THEN 1 WHEN 'finance' THEN 2 ELSE 3 END,
                  m.created_at ASC`,
      ).bind(id).all<Record<string, unknown>>(),
      db.prepare(
        `SELECT
           (SELECT COUNT(*) FROM products WHERE restaurant_id = ?) AS products,
           (SELECT COUNT(*) FROM orders WHERE restaurant_id = ?) AS orders,
           (SELECT COUNT(*) FROM customers WHERE restaurant_id = ?) AS customers,
           (SELECT COALESCE(SUM(total_cents), 0) FROM orders WHERE restaurant_id = ? AND status = 'delivered') AS delivered_revenue_cents`,
      ).bind(id, id, id, id).first<Record<string, number>>(),
      db.prepare(
        `SELECT id, order_number, status, payment_status, total_cents, created_at
         FROM orders WHERE restaurant_id = ? ORDER BY created_at DESC LIMIT 10`,
      ).bind(id).all<Record<string, unknown>>(),
    ]);
    if (!restaurant) throw new HttpError(404, "Estabelecimento não encontrado.", "restaurant_not_found");

    return json({
      ok: true,
      restaurant: serializeRestaurant(restaurant),
      counts: {
        products: Number(counts?.products || 0),
        orders: Number(counts?.orders || 0),
        customers: Number(counts?.customers || 0),
        deliveredRevenueCents: Number(counts?.delivered_revenue_cents || 0),
      },
      members: members.results.map((member) => ({
        id: member.id,
        userId: member.user_id,
        email: member.email,
        name: member.name,
        role: member.role,
        active: Boolean(member.active),
        userStatus: member.user_status || "invited",
        lastLoginAt: member.last_login_at,
        createdAt: member.created_at,
      })),
      recentOrders: recentOrders.results.map((order) => ({
        id: order.id,
        number: order.order_number,
        status: order.status,
        paymentStatus: order.payment_status,
        totalCents: Number(order.total_cents),
        createdAt: order.created_at,
      })),
    });
  } catch (error) {
    return apiError(error, request);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const actor = await requirePlatformAdmin("restaurants:manage");
    const { id } = await params;
    const body = await readJson<Record<string, unknown>>(request, 20_000);
    const reason = requiredString(body.reason, "Motivo", 10, 500);
    const db = getDatabase();
    const current = await findRestaurant(db, id);
    if (!current) throw new HttpError(404, "Estabelecimento não encontrado.", "restaurant_not_found");
    const now = Date.now();

    if (body.action === "update_commercial") {
      const plan = normalizeManagedPlan(body.plan);
      const status = normalizeManagedStatus(body.status);
      if (current.platform_blocked_at && status !== "paused") {
        throw new HttpError(409, "Desbloqueie o estabelecimento antes de reativá-lo.", "restaurant_blocked");
      }
      const trialEndsAt = optionalTimestamp(body.trialEndsAt, "Fim do trial");
      const accessEndsAt = optionalTimestamp(body.accessEndsAt, "Fim do acesso");
      await db.prepare(
        `UPDATE restaurants SET plan = ?, status = ?, trial_ends_at = ?, access_ends_at = ?, updated_at = ?
         WHERE id = ?`,
      ).bind(plan, status, trialEndsAt, accessEndsAt, now, id).run();
      await auditPlatformAction(actor, {
        action: "restaurant.commercial_terms_updated",
        targetType: "restaurant",
        targetId: id,
        reason,
        metadata: {
          before: { plan: current.plan, status: current.status, trialEndsAt: current.trial_ends_at, accessEndsAt: current.access_ends_at },
          after: { plan, status, trialEndsAt, accessEndsAt },
        },
        requestId: request.headers.get("x-request-id"),
      });
    } else {
      const action = normalizeAction(body.action);
      const transition = restaurantControlTransition({
        status: current.status,
        blockedAt: current.platform_blocked_at,
        previousStatus: current.platform_previous_status,
      }, action, now);
      await db.prepare(
        `UPDATE restaurants
         SET status = ?, platform_blocked_at = ?, platform_block_reason = ?, platform_previous_status = ?,
             is_open = CASE WHEN ? IN ('pause', 'block') THEN 0 ELSE is_open END, updated_at = ?
         WHERE id = ?`,
      ).bind(
        transition.status,
        transition.blockedAt,
        action === "block" ? reason : null,
        transition.previousStatus,
        action,
        now,
        id,
      ).run();
      await auditPlatformAction(actor, {
        action: `restaurant.${action}`,
        targetType: "restaurant",
        targetId: id,
        reason,
        metadata: { before: { status: current.status, blockedAt: current.platform_blocked_at }, after: transition },
        requestId: request.headers.get("x-request-id"),
      });
    }

    const updated = await findRestaurant(db, id);
    return json({ ok: true, restaurant: updated ? serializeRestaurant(updated) : null });
  } catch (error) {
    return apiError(error, request);
  }
}

function findRestaurant(db: D1Database, id: string) {
  return db.prepare(
    `SELECT id, name, slug, owner_email, plan, status, trial_ends_at, access_ends_at,
            platform_blocked_at, platform_block_reason, platform_previous_status, created_at, updated_at
     FROM restaurants WHERE id = ? LIMIT 1`,
  ).bind(id).first<RestaurantControlRow>();
}

function serializeRestaurant(restaurant: RestaurantControlRow) {
  return {
    id: restaurant.id,
    name: restaurant.name,
    slug: restaurant.slug,
    ownerEmail: restaurant.owner_email,
    plan: restaurant.plan,
    status: restaurant.status,
    trialEndsAt: restaurant.trial_ends_at,
    accessEndsAt: restaurant.access_ends_at,
    blockedAt: restaurant.platform_blocked_at,
    blockReason: restaurant.platform_block_reason,
    createdAt: restaurant.created_at,
    updatedAt: restaurant.updated_at,
  };
}

function normalizeAction(value: unknown): ManagedRestaurantAction {
  if (value === "pause" || value === "reactivate" || value === "block" || value === "unblock") return value;
  throw new HttpError(400, "Ação de estabelecimento inválida.", "invalid_restaurant_action");
}
