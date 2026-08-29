import { requireAdminContext } from "@/lib/admin-auth";
import { apiError, json } from "@/lib/http";
import { getDatabase } from "@/lib/runtime";

export const dynamic = "force-dynamic";

const PLAN_PRICE_CENTS: Record<string, number> = {
  start: 9700,
  growth: 29700,
  scale: 59700,
};

type SalesAggregate = {
  orders: number;
  revenue: number;
  cost: number;
  contribution: number;
};

export async function GET() {
  try {
    const context = await requireAdminContext();
    const db = getDatabase();
    const now = Date.now();
    const dayStart = startOfSaoPauloDay(now);
    const monthStart = startOfSaoPauloMonth(now);

    const [restaurant, day, month, growth, monthGrowth, automation, promise, returning, products] = await Promise.all([
      db.prepare(
        "SELECT plan, status FROM restaurants WHERE id = ? LIMIT 1",
      ).bind(context.restaurantId).first<{ plan: string; status: string }>(),
      db.prepare(
        `SELECT COUNT(*) AS orders,
                COALESCE(SUM(total_cents), 0) AS revenue,
                COALESCE(SUM(cost_cents), 0) AS cost,
                COALESCE(SUM(contribution_margin_cents), 0) AS contribution
         FROM orders
         WHERE restaurant_id = ? AND created_at >= ? AND status <> 'canceled'`,
      ).bind(context.restaurantId, dayStart).first<SalesAggregate>(),
      db.prepare(
        `SELECT COUNT(*) AS orders,
                COALESCE(SUM(total_cents), 0) AS revenue,
                COALESCE(SUM(cost_cents), 0) AS cost,
                COALESCE(SUM(contribution_margin_cents), 0) AS contribution
         FROM orders
         WHERE restaurant_id = ? AND created_at >= ? AND status <> 'canceled'`,
      ).bind(context.restaurantId, monthStart).first<SalesAggregate>(),
      db.prepare(
        `SELECT
           SUM(CASE WHEN event_type = 'upsell_shown' THEN 1 ELSE 0 END) AS shown,
           SUM(CASE WHEN event_type = 'upsell_accepted' THEN 1 ELSE 0 END) AS accepted,
           COALESCE(SUM(CASE WHEN event_type = 'upsell_accepted' THEN value_cents ELSE 0 END), 0) AS value,
           COALESCE(SUM(CASE WHEN event_type = 'upsell_accepted' THEN contribution_cents ELSE 0 END), 0) AS contribution
         FROM growth_events WHERE restaurant_id = ? AND created_at >= ?`,
      ).bind(context.restaurantId, dayStart).first<{ shown: number; accepted: number; value: number; contribution: number }>(),
      db.prepare(
        `SELECT COALESCE(SUM(value_cents), 0) AS value,
                COALESCE(SUM(contribution_cents), 0) AS contribution
         FROM growth_events
         WHERE restaurant_id = ? AND created_at >= ? AND event_type IN ('upsell_accepted', 'reorder_converted')`,
      ).bind(context.restaurantId, monthStart).first<{ value: number; contribution: number }>(),
      db.prepare(
        `SELECT COALESCE(SUM(recovered_revenue_cents), 0) AS recovered
         FROM automation_events
         WHERE restaurant_id = ? AND created_at >= ? AND status IN ('sent', 'converted')`,
      ).bind(context.restaurantId, monthStart).first<{ recovered: number }>(),
      db.prepare(
        `SELECT COUNT(*) AS delivered,
                SUM(CASE WHEN delivered_at IS NOT NULL AND promised_to_minutes IS NOT NULL
                          AND ((delivered_at - created_at) / 60000.0) <= promised_to_minutes
                         THEN 1 ELSE 0 END) AS on_time
         FROM orders
         WHERE restaurant_id = ? AND created_at >= ? AND status = 'delivered'`,
      ).bind(context.restaurantId, monthStart).first<{ delivered: number; on_time: number }>(),
      db.prepare(
        `SELECT COUNT(*) AS total,
                SUM(CASE WHEN order_count > 1 THEN 1 ELSE 0 END) AS returning
         FROM customers WHERE restaurant_id = ?`,
      ).bind(context.restaurantId).first<{ total: number; returning: number }>(),
      db.prepare(
        `SELECT id, name, price_cents, cost_cents,
                CASE WHEN price_cents > 0 THEN ROUND(((price_cents - cost_cents) * 100.0) / price_cents) ELSE 0 END AS margin_percent
         FROM products WHERE restaurant_id = ? AND active = 1
         ORDER BY margin_percent ASC, name LIMIT 12`,
      ).bind(context.restaurantId).all<{ id: string; name: string; price_cents: number; cost_cents: number; margin_percent: number }>(),
    ]);

    const shown = Number(growth?.shown || 0);
    const accepted = Number(growth?.accepted || 0);
    const dayRevenue = Number(day?.revenue || 0);
    const dayContribution = Number(day?.contribution || 0);
    const monthRevenue = Number(month?.revenue || 0);
    const monthContribution = Number(month?.contribution || 0);
    const planPrice = PLAN_PRICE_CENTS[restaurant?.plan || "start"] || PLAN_PRICE_CENTS.start;
    const recoveredMonth = Number(monthGrowth?.value || 0) + Number(automation?.recovered || 0);
    const delivered = Number(promise?.delivered || 0);
    const totalCustomers = Number(returning?.total || 0);

    return json({
      ok: true,
      period: { dayStart, monthStart, now },
      restaurant: { plan: restaurant?.plan || "start", status: restaurant?.status || "trial", planPriceCents: planPrice },
      today: {
        orders: Number(day?.orders || 0),
        revenueCents: dayRevenue,
        costCents: Number(day?.cost || 0),
        contributionCents: dayContribution,
        contributionMarginPercent: dayRevenue > 0 ? Math.round((dayContribution / dayRevenue) * 100) : 0,
      },
      month: {
        orders: Number(month?.orders || 0),
        revenueCents: monthRevenue,
        costCents: Number(month?.cost || 0),
        contributionCents: monthContribution,
        contributionMarginPercent: monthRevenue > 0 ? Math.round((monthContribution / monthRevenue) * 100) : 0,
      },
      profitEngine: {
        shown,
        accepted,
        conversionPercent: shown > 0 ? Math.round((accepted / shown) * 100) : 0,
        addedRevenueCents: Number(growth?.value || 0),
        addedContributionCents: Number(growth?.contribution || 0),
        recoveredMonthCents: recoveredMonth,
        recoveredContributionMonthCents: Number(monthGrowth?.contribution || 0),
        monthlyRoi: planPrice > 0 ? Number((recoveredMonth / planPrice).toFixed(2)) : 0,
      },
      operation: {
        delivered,
        onTime: Number(promise?.on_time || 0),
        promiseAccuracyPercent: delivered > 0 ? Math.round((Number(promise?.on_time || 0) / delivered) * 100) : null,
        customers: totalCustomers,
        returningCustomers: Number(returning?.returning || 0),
        returningPercent: totalCustomers > 0 ? Math.round((Number(returning?.returning || 0) / totalCustomers) * 100) : 0,
      },
      products: products.results.map((product) => ({
        id: product.id,
        name: product.name,
        priceCents: Number(product.price_cents),
        costCents: Number(product.cost_cents),
        marginPercent: Number(product.margin_percent || 0),
      })),
    });
  } catch (error) {
    return apiError(error);
  }
}

function startOfSaoPauloDay(timestamp: number) {
  const date = new Date(timestamp);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return new Date(`${values.year}-${values.month}-${values.day}T00:00:00-03:00`).getTime();
}

function startOfSaoPauloMonth(timestamp: number) {
  const dayStart = new Date(startOfSaoPauloDay(timestamp));
  const year = dayStart.toLocaleString("en-US", { timeZone: "America/Sao_Paulo", year: "numeric" });
  const month = dayStart.toLocaleString("en-US", { timeZone: "America/Sao_Paulo", month: "2-digit" });
  return new Date(`${year}-${month}-01T00:00:00-03:00`).getTime();
}
