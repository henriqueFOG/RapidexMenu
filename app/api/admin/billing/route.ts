import { requireAdminContext, requireRole } from "@/lib/admin-auth";
import { apiError, assertSameOrigin, HttpError, json, readJson } from "@/lib/http";
import { billingConfigured, cancelProviderSubscription, createBillingCheckout, fetchProviderSubscription, PLAN_PRICES, syncProviderSubscription, type RapidexPlan } from "@/lib/platform-billing";
import { getDatabase } from "@/lib/runtime";
import { subscriptionEventStatement } from "@/lib/subscription-events";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const context = await requireAdminContext();
    const db = getDatabase();
    const restaurant = await db.prepare(
      `SELECT plan, status, trial_ends_at, access_ends_at FROM restaurants WHERE id = ? LIMIT 1`,
    ).bind(context.restaurantId).first<{ plan: RapidexPlan; status: string; trial_ends_at: number | null; access_ends_at: number | null }>();
    let subscription = await db.prepare(
      `SELECT provider_subscription_id, plan, amount_cents, status, checkout_url, next_payment_at, updated_at
       FROM platform_subscriptions WHERE restaurant_id = ? ORDER BY updated_at DESC LIMIT 1`,
    ).bind(context.restaurantId).first<Record<string, unknown>>();

    const shouldSync = new URL(request.url).searchParams.get("sync") === "1";
    if (shouldSync && billingConfigured() && subscription?.provider_subscription_id && subscription.status !== "cancelled") {
      const provider = await fetchProviderSubscription(String(subscription.provider_subscription_id));
      await syncProviderSubscription(provider);
      subscription = await db.prepare(
        `SELECT provider_subscription_id, plan, amount_cents, status, checkout_url, next_payment_at, updated_at
         FROM platform_subscriptions WHERE restaurant_id = ? ORDER BY updated_at DESC LIMIT 1`,
      ).bind(context.restaurantId).first<Record<string, unknown>>();
    }

    const trialEndsAt = Number(restaurant?.trial_ends_at || 0) || null;
    const accessEndsAt = Number(restaurant?.access_ends_at || 0) || null;
    return json({
      ok: true,
      configured: billingConfigured(),
      restaurant: {
        plan: restaurant?.plan || "start",
        status: restaurant?.status || "trial",
        trialEndsAt,
        accessEndsAt,
        trialActive: Boolean(restaurant?.status === "trial" && (!trialEndsAt || trialEndsAt > Date.now())),
      },
      subscription,
      prices: PLAN_PRICES,
    });
  } catch (error) {
    return apiError(error, request);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const context = await requireAdminContext();
    requireRole(context, ["owner"]);
    const body = await readJson<{ plan?: unknown }>(request, 10_000);
    const plan = normalizePlan(body.plan);
    const db = getDatabase();
    const authorized = await db.prepare(
      `SELECT provider_subscription_id FROM platform_subscriptions
       WHERE restaurant_id = ? AND status = 'authorized' ORDER BY updated_at DESC LIMIT 1`,
    ).bind(context.restaurantId).first();
    if (authorized) throw new HttpError(409, "Sua assinatura já está ativa.", "subscription_already_active");

    const pending = await db.prepare(
      `SELECT checkout_url FROM platform_subscriptions
       WHERE restaurant_id = ? AND plan = ? AND status = 'pending' AND checkout_url IS NOT NULL
       ORDER BY updated_at DESC LIMIT 1`,
    ).bind(context.restaurantId, plan).first<{ checkout_url: string }>();
    if (pending?.checkout_url) return json({ ok: true, checkoutUrl: pending.checkout_url, reused: true });

    const checkout = await createBillingCheckout({
      restaurantId: context.restaurantId,
      plan,
      payerEmail: context.user.email,
      origin: new URL(request.url).origin,
    });
    return json({ ok: true, checkoutUrl: checkout.checkoutUrl, subscriptionId: checkout.id }, { status: 201 });
  } catch (error) {
    return apiError(error, request);
  }
}

export async function DELETE(request: Request) {
  try {
    assertSameOrigin(request);
    const context = await requireAdminContext();
    requireRole(context, ["owner"]);
    const db = getDatabase();
    const local = await db.prepare(
      `SELECT id, provider_subscription_id, plan, amount_cents, status, next_payment_at
       FROM platform_subscriptions
       WHERE restaurant_id = ? ORDER BY updated_at DESC LIMIT 1`,
    ).bind(context.restaurantId).first<{
      id: string;
      provider_subscription_id: string | null;
      plan: RapidexPlan;
      amount_cents: number;
      status: string;
      next_payment_at: number | null;
    }>();
    if (!local?.provider_subscription_id) {
      throw new HttpError(404, "Nenhuma assinatura recorrente encontrada.", "subscription_not_found");
    }

    const restaurant = await db.prepare(
      `SELECT access_ends_at FROM restaurants WHERE id = ? LIMIT 1`,
    ).bind(context.restaurantId).first<{ access_ends_at: number | null }>();
    if (local.status === "cancelled") {
      return json({ ok: true, cancelled: true, accessEndsAt: Number(restaurant?.access_ends_at || 0) || null, reused: true });
    }

    const provider = await cancelProviderSubscription(local.provider_subscription_id);
    const now = Date.now();
    const accessEndsAt = local.status === "authorized" && Number(local.next_payment_at || 0) > now
      ? Number(local.next_payment_at)
      : now;
    await db.batch([
      db.prepare(
        `UPDATE platform_subscriptions
         SET status = 'cancelled', provider_data_json = ?, updated_at = ? WHERE id = ?`,
      ).bind(JSON.stringify(provider), now, local.id),
      db.prepare(
        `UPDATE restaurants SET access_ends_at = ?, updated_at = ? WHERE id = ?`,
      ).bind(accessEndsAt, now, context.restaurantId),
      subscriptionEventStatement(db, {
        subscriptionId: local.id,
        restaurantId: context.restaurantId,
        source: "manual_cancel",
        before: { status: local.status, plan: local.plan, amountCents: Number(local.amount_cents) },
        after: { status: "cancelled", plan: local.plan, amountCents: Number(local.amount_cents) },
        occurredAt: now,
      }),
    ]);
    return json({ ok: true, cancelled: true, accessEndsAt });
  } catch (error) {
    return apiError(error, request);
  }
}

function normalizePlan(value: unknown): RapidexPlan {
  if (value === "start" || value === "growth" || value === "scale") return value;
  throw new HttpError(400, "Plano inválido.", "validation_error", { field: "plan" });
}
