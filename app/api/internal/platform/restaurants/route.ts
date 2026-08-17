import { PENDING_PASSWORD_HASH, issuePasswordReset } from "@/lib/password-recovery";
import { apiError, assertSameOrigin, HttpError, json, readJson } from "@/lib/http";
import { auditPlatformAction, requirePlatformAdmin } from "@/lib/platform-admin";
import { normalizeManagedEmail, normalizeManagedPlan, slugifyManagedRestaurant } from "@/lib/platform-central";
import { getBindings, getDatabase, getRapidexEnvironment } from "@/lib/runtime";
import { isSyntheticEmail } from "@/lib/tenant-classification";
import { normalizePhone, optionalString, requiredString } from "@/lib/validation";

export const dynamic = "force-dynamic";

type CreateRestaurantBody = {
  ownerName?: unknown;
  ownerEmail?: unknown;
  restaurantName?: unknown;
  slug?: unknown;
  phone?: unknown;
  city?: unknown;
  state?: unknown;
  plan?: unknown;
  reason?: unknown;
};

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const actor = await requirePlatformAdmin("restaurants:manage");
    const body = await readJson<CreateRestaurantBody>(request, 30_000);
    const ownerName = requiredString(body.ownerName, "Nome do proprietário", 2, 120);
    const ownerEmail = normalizeManagedEmail(body.ownerEmail);
    const restaurantName = requiredString(body.restaurantName, "Nome do estabelecimento", 2, 120);
    const phone = normalizePhone(body.phone);
    const city = requiredString(body.city, "Cidade", 2, 100);
    const state = normalizeState(body.state);
    const plan = normalizeManagedPlan(body.plan);
    const reason = requiredString(body.reason, "Motivo", 10, 500);
    if (getRapidexEnvironment() === "production" && isSyntheticEmail(ownerEmail)) {
      throw new HttpError(400, "E-mails de teste não podem ser cadastrados em produção.", "synthetic_email_forbidden");
    }

    const db = getDatabase();
    const existingUser = await db.prepare(
      `SELECT u.id, u.status,
              EXISTS (SELECT 1 FROM platform_admins pa WHERE pa.user_id = u.id AND pa.status = 'active') AS is_platform_admin,
              EXISTS (SELECT 1 FROM members m WHERE lower(m.email) = lower(u.email) AND m.active = 1) AS has_membership
       FROM app_users u WHERE lower(u.email) = ? LIMIT 1`,
    ).bind(ownerEmail).first<{ id: string; status: string; is_platform_admin: number; has_membership: number }>();
    if (existingUser?.status && existingUser.status !== "active") {
      throw new HttpError(409, "A conta do titular está bloqueada ou removida.", "account_not_active");
    }
    if (existingUser && (Number(existingUser.is_platform_admin) === 1 || Number(existingUser.has_membership) === 1)) {
      throw new HttpError(409, "Este e-mail já pertence a outro perfil. Use uma identidade exclusiva para o estabelecimento.", "identity_already_assigned");
    }

    const requestedSlug = optionalString(body.slug, "Endereço da loja", 80);
    const slug = await uniqueSlug(db, slugifyManagedRestaurant(requestedSlug || restaurantName));
    const now = Date.now();
    const trialEndsAt = now + 14 * 24 * 60 * 60 * 1000;
    const userId = existingUser?.id || crypto.randomUUID();
    const restaurantId = crypto.randomUUID();
    const statements: D1PreparedStatement[] = [];
    if (!existingUser) {
      statements.push(db.prepare(
        `INSERT INTO app_users
         (id, email, password_hash, full_name, phone, status, auth_version, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'active', 1, ?, ?)`,
      ).bind(userId, ownerEmail, PENDING_PASSWORD_HASH, ownerName, phone, now, now));
    }
    statements.push(
      db.prepare(
        `INSERT INTO restaurants
         (id, slug, name, owner_email, plan, status, phone, whatsapp, city, state, is_open,
          settings_json, trial_ends_at, onboarding_completed, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'trial', ?, ?, ?, ?, 0, ?, ?, 0, ?, ?)`,
      ).bind(restaurantId, slug, restaurantName, ownerEmail, plan, phone, phone, city, state,
        JSON.stringify({ cuisine: "Restaurante", brandColor: "#ff650b" }), trialEndsAt, now, now),
      db.prepare(
        `INSERT INTO members (id, restaurant_id, email, name, role, active, created_at)
         VALUES (?, ?, ?, ?, 'owner', 1, ?)`,
      ).bind(crypto.randomUUID(), restaurantId, ownerEmail, ownerName, now),
      db.prepare(
        `INSERT INTO categories (id, restaurant_id, name, position, active, created_at, updated_at)
         VALUES (?, ?, 'Principais', 0, 1, ?, ?)`,
      ).bind(crypto.randomUUID(), restaurantId, now, now),
    );
    await db.batch(statements);

    await auditPlatformAction(actor, {
      action: "restaurant.created",
      targetType: "restaurant",
      targetId: restaurantId,
      reason,
      metadata: { ownerEmail, plan, source: "platform_central" },
      requestId: request.headers.get("x-request-id"),
    });

    const baseUrl = getBindings().RAPIDEX_PUBLIC_URL || new URL(request.url).origin;
    const firstAccess = await issuePasswordReset({
      db,
      user: { id: userId, email: ownerEmail, fullName: ownerName },
      baseUrl,
      expiresInMs: 48 * 60 * 60 * 1000,
    });
    return json({
      ok: true,
      restaurant: { id: restaurantId, name: restaurantName, slug, ownerEmail, plan, status: "trial", trialEndsAt },
      firstAccess: {
        delivery: firstAccess.emailSent ? "email" : "manual",
        url: firstAccess.emailSent ? null : firstAccess.resetUrl,
        expiresAt: firstAccess.expiresAt,
      },
    }, { status: 201 });
  } catch (error) {
    return apiError(error, request);
  }
}

function normalizeState(value: unknown) {
  const state = requiredString(value, "Estado", 2, 2).toUpperCase();
  if (!/^[A-Z]{2}$/.test(state)) throw new HttpError(400, "Use a sigla do estado com 2 letras.", "validation_error", { field: "state" });
  return state;
}

async function uniqueSlug(db: D1Database, base: string) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`;
    const row = await db.prepare("SELECT id FROM restaurants WHERE slug = ? LIMIT 1").bind(candidate).first();
    if (!row) return candidate;
  }
  return `${base}-${crypto.randomUUID().slice(0, 8)}`;
}
