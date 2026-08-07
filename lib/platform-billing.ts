import { HttpError } from "./http";
import { getBindings, getDatabase } from "./runtime";

export const PLAN_PRICES = { start: 9700, growth: 29700, scale: 59700 } as const;
export type RapidexPlan = keyof typeof PLAN_PRICES;

type ProviderSubscription = {
  id?: string;
  status?: string;
  init_point?: string;
  external_reference?: string;
  next_payment_date?: string;
  auto_recurring?: { transaction_amount?: number; currency_id?: string };
};

export function billingConfigured() {
  return Boolean(getBindings().RAPIDEX_BILLING_MP_ACCESS_TOKEN);
}

export async function createBillingCheckout(input: {
  restaurantId: string;
  plan: RapidexPlan;
  payerEmail: string;
  origin: string;
}) {
  const token = getBindings().RAPIDEX_BILLING_MP_ACCESS_TOKEN;
  if (!token) throw new HttpError(503, "A cobrança recorrente ainda não foi ativada.", "billing_not_configured");
  const amountCents = PLAN_PRICES[input.plan];
  const backUrl = `${getBindings().RAPIDEX_PUBLIC_URL || input.origin}/assinatura?retorno=1`;
  const response = await fetch("https://api.mercadopago.com/preapproval", {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({
      reason: `RapidexMenu · ${planName(input.plan)}`,
      external_reference: input.restaurantId,
      payer_email: input.payerEmail,
      auto_recurring: {
        frequency: 1,
        frequency_type: "months",
        transaction_amount: amountCents / 100,
        currency_id: "BRL",
      },
      back_url: backUrl,
      status: "pending",
    }),
  });
  const provider = await response.json().catch(() => ({})) as ProviderSubscription & { message?: string };
  if (!response.ok || !provider.id || !provider.init_point) {
    console.error("Rapidex billing checkout failed", response.status, provider.message || "unknown");
    throw new HttpError(502, "Não foi possível abrir a assinatura agora.", "billing_provider_error");
  }

  const now = Date.now();
  const db = getDatabase();
  await db.prepare(
    `INSERT INTO platform_subscriptions
     (id, restaurant_id, provider, provider_subscription_id, plan, amount_cents, status, checkout_url,
      next_payment_at, provider_data_json, created_at, updated_at)
     VALUES (?, ?, 'mercado_pago', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    crypto.randomUUID(), input.restaurantId, provider.id, input.plan, amountCents,
    normalizeStatus(provider.status), provider.init_point, parseDate(provider.next_payment_date),
    JSON.stringify(provider), now, now,
  ).run();

  return { id: provider.id, checkoutUrl: provider.init_point, status: normalizeStatus(provider.status) };
}

export async function fetchProviderSubscription(providerId: string) {
  const token = getBindings().RAPIDEX_BILLING_MP_ACCESS_TOKEN;
  if (!token) throw new HttpError(503, "A cobrança recorrente ainda não foi ativada.", "billing_not_configured");
  const response = await fetch(`https://api.mercadopago.com/preapproval/${encodeURIComponent(providerId)}`, {
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
  });
  const provider = await response.json().catch(() => ({})) as ProviderSubscription;
  if (!response.ok || !provider.id) throw new HttpError(502, "Não foi possível consultar a assinatura.", "billing_provider_error");
  return provider;
}

export async function cancelProviderSubscription(providerId: string) {
  const token = getBindings().RAPIDEX_BILLING_MP_ACCESS_TOKEN;
  if (!token) throw new HttpError(503, "A cobrança recorrente ainda não foi ativada.", "billing_not_configured");
  const response = await fetch(`https://api.mercadopago.com/preapproval/${encodeURIComponent(providerId)}`, {
    method: "PUT",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ status: "canceled" }),
  });
  const provider = await response.json().catch(() => ({})) as ProviderSubscription & { message?: string };
  if (!response.ok || !provider.id) {
    console.error("Rapidex billing cancellation failed", response.status, provider.message || "unknown");
    throw new HttpError(502, "Não foi possível cancelar a renovação agora.", "billing_provider_error");
  }
  return provider;
}

export async function syncProviderSubscription(provider: ProviderSubscription) {
  if (!provider.id || !provider.external_reference) throw new HttpError(400, "Assinatura inválida.", "invalid_subscription");
  const db = getDatabase();
  const local = await db.prepare(
    `SELECT id, restaurant_id, plan, amount_cents, next_payment_at FROM platform_subscriptions
     WHERE provider = 'mercado_pago' AND provider_subscription_id = ? LIMIT 1`,
  ).bind(provider.id).first<{
    id: string;
    restaurant_id: string;
    plan: RapidexPlan;
    amount_cents: number;
    next_payment_at: number | null;
  }>();
  if (!local || local.restaurant_id !== String(provider.external_reference)) {
    throw new HttpError(404, "Assinatura não reconhecida.", "subscription_not_found");
  }
  const providerAmount = Math.round(Number(provider.auto_recurring?.transaction_amount || 0) * 100);
  if (providerAmount && providerAmount !== Number(local.amount_cents)) {
    throw new HttpError(409, "Valor da assinatura não confere com o plano contratado.", "subscription_amount_mismatch");
  }

  const status = normalizeStatus(provider.status);
  const now = Date.now();
  const providerNextPayment = parseDate(provider.next_payment_date);
  const paidThrough = providerNextPayment || Number(local.next_payment_at || 0) || null;
  const subscriptionNextPayment = providerNextPayment || local.next_payment_at || null;
  const restaurantStatements: D1PreparedStatement[] = [];

  if (status === "authorized") {
    restaurantStatements.push(
      db.prepare(
        `UPDATE restaurants SET status = 'active', plan = ?, access_ends_at = NULL, updated_at = ? WHERE id = ?`,
      ).bind(local.plan, now, local.restaurant_id),
    );
  } else if (status === "paused" || status === "cancelled") {
    const accessEndsAt = paidThrough && paidThrough > now ? paidThrough : now;
    restaurantStatements.push(
      db.prepare(
        `UPDATE restaurants SET status = ?, plan = ?, access_ends_at = ?, updated_at = ? WHERE id = ?`,
      ).bind(accessEndsAt > now ? "active" : "paused", local.plan, accessEndsAt, now, local.restaurant_id),
    );
  }

  await db.batch([
    db.prepare(
      `UPDATE platform_subscriptions SET status = ?, next_payment_at = ?, provider_data_json = ?, updated_at = ?
       WHERE id = ?`,
    ).bind(status, subscriptionNextPayment, JSON.stringify(provider), now, local.id),
    ...restaurantStatements,
  ]);
  return { restaurantId: local.restaurant_id, status, plan: local.plan, accessEndsAt: paidThrough };
}

function normalizeStatus(value: unknown): "pending" | "authorized" | "paused" | "cancelled" | "unknown" {
  if (value === "pending" || value === "authorized" || value === "paused" || value === "cancelled") return value;
  if (value === "canceled") return "cancelled";
  return "unknown";
}

function parseDate(value: unknown) {
  if (typeof value !== "string") return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function planName(plan: RapidexPlan) {
  return ({ start: "Começo", growth: "Crescimento", scale: "Escala" } as const)[plan];
}
