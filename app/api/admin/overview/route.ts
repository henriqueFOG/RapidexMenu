import { requireAdminContext } from "@/lib/admin-auth";
import { apiError, json } from "@/lib/http";
import { getDatabase } from "@/lib/runtime";

export const dynamic = "force-dynamic";

const DAY_MS = 24 * 60 * 60_000;

export async function GET() {
  try {
    const context = await requireAdminContext();
    const db = getDatabase();
    const dayStart = startOfSaoPauloDay();
    const yesterdayStart = dayStart - DAY_MS;
    const weekStart = Date.now() - 7 * DAY_MS;

    const [
      restaurant,
      metrics,
      statuses,
      channelRows,
      ordersResult,
      automation,
      returningCustomers,
      todayRows,
      yesterdayRows,
      topProductRows,
      lateOrdersRow,
      todayStatusRows,
    ] = await Promise.all([
      db
        .prepare(
          `SELECT id, name, slug, city, state, plan, status, is_open,
                  average_prep_minutes, delivery_minutes, max_concurrent_orders
           FROM restaurants WHERE id = ?`,
        )
        .bind(context.restaurantId)
        .first<Record<string, unknown>>(),
      db
        .prepare(
          `SELECT COALESCE(sum(total_cents), 0) AS revenue_cents,
                  count(*) AS order_count,
                  COALESCE(avg(total_cents), 0) AS average_ticket_cents,
                  COALESCE(sum(contribution_margin_cents), 0) AS contribution_margin_cents
           FROM orders
           WHERE restaurant_id = ? AND created_at >= ? AND status != 'canceled'`,
        )
        .bind(context.restaurantId, dayStart)
        .first<Record<string, number>>(),
      db
        .prepare(
          `SELECT status, count(*) AS total FROM orders
           WHERE restaurant_id = ? AND status IN ('received','confirmed','preparing','ready','out_for_delivery')
           GROUP BY status`,
        )
        .bind(context.restaurantId)
        .all<{ status: string; total: number }>(),
      db
        .prepare(
          `SELECT source, COALESCE(sum(total_cents), 0) AS revenue_cents, count(*) AS orders
           FROM orders WHERE restaurant_id = ? AND created_at >= ? AND status != 'canceled'
           GROUP BY source ORDER BY revenue_cents DESC`,
        )
        .bind(context.restaurantId, weekStart)
        .all<{ source: string; revenue_cents: number; orders: number }>(),
      db
        .prepare(
          `SELECT o.id, o.order_number, o.status, o.source, o.total_cents, o.created_at,
                  o.promised_from_minutes, o.promised_to_minutes, c.name AS customer_name
           FROM orders o LEFT JOIN customers c ON c.id = o.customer_id
           WHERE o.restaurant_id = ?
           ORDER BY CASE o.status
             WHEN 'received' THEN 0 WHEN 'confirmed' THEN 1 WHEN 'preparing' THEN 2
             WHEN 'ready' THEN 3 WHEN 'out_for_delivery' THEN 4 ELSE 5 END,
             o.created_at DESC LIMIT 18`,
        )
        .bind(context.restaurantId)
        .all<Record<string, unknown>>(),
      db
        .prepare(
          `SELECT id, kind, status, reason, expected_revenue_cents, recovered_revenue_cents,
                  margin_percent, metadata_json, created_at
           FROM automation_events WHERE restaurant_id = ?
           ORDER BY CASE status WHEN 'draft' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END, created_at DESC
           LIMIT 1`,
        )
        .bind(context.restaurantId)
        .first<Record<string, unknown>>(),
      db
        .prepare(
          `SELECT id, name, phone, order_count, lifetime_value_cents, last_order_at
           FROM customers WHERE restaurant_id = ? AND order_count > 1
           ORDER BY last_order_at DESC LIMIT 5`,
        )
        .bind(context.restaurantId)
        .all<Record<string, unknown>>(),
      db
        .prepare(
          `SELECT total_cents, created_at FROM orders
           WHERE restaurant_id = ? AND created_at >= ? AND status != 'canceled'
           ORDER BY created_at`,
        )
        .bind(context.restaurantId, dayStart)
        .all<{ total_cents: number; created_at: number }>(),
      db
        .prepare(
          `SELECT total_cents, created_at FROM orders
           WHERE restaurant_id = ? AND created_at >= ? AND created_at < ? AND status != 'canceled'
           ORDER BY created_at`,
        )
        .bind(context.restaurantId, yesterdayStart, dayStart)
        .all<{ total_cents: number; created_at: number }>(),
      db
        .prepare(
          `SELECT oi.product_name AS name, COALESCE(sum(oi.quantity), 0) AS quantity
           FROM order_items oi
           JOIN orders o ON o.id = oi.order_id
           WHERE o.restaurant_id = ? AND o.created_at >= ? AND o.status != 'canceled'
           GROUP BY oi.product_name
           ORDER BY quantity DESC
           LIMIT 5`,
        )
        .bind(context.restaurantId, dayStart)
        .all<{ name: string; quantity: number }>(),
      db
        .prepare(
          `SELECT count(*) AS total FROM orders
           WHERE restaurant_id = ?
             AND status IN ('received','confirmed','preparing','ready','out_for_delivery')
             AND created_at + (promised_to_minutes * 60000) < ?`,
        )
        .bind(context.restaurantId, Date.now())
        .first<{ total: number }>(),
      db
        .prepare(
          `SELECT status, count(*) AS total FROM orders
           WHERE restaurant_id = ? AND created_at >= ?
           GROUP BY status`,
        )
        .bind(context.restaurantId, dayStart)
        .all<{ status: string; total: number }>(),
    ]);

    const orderIds = ordersResult.results.map((order) => String(order.id));
    const itemRows = orderIds.length
      ? await db
          .prepare(
            `SELECT order_id, product_name, quantity FROM order_items
             WHERE order_id IN (${orderIds.map(() => "?").join(",")}) ORDER BY created_at`,
          )
          .bind(...orderIds)
          .all<{ order_id: string; product_name: string; quantity: number }>()
      : { results: [] as Array<{ order_id: string; product_name: string; quantity: number }> };

    const recovered = await db
      .prepare(
        `SELECT COALESCE(sum(recovered_revenue_cents), 0) AS recovered_cents
         FROM automation_events WHERE restaurant_id = ? AND created_at >= ?`,
      )
      .bind(context.restaurantId, startOfSaoPauloMonth())
      .first<{ recovered_cents: number }>();

    const channelTotal = channelRows.results.reduce((sum, channel) => sum + Number(channel.revenue_cents), 0);
    const activeOrders = statuses.results.reduce((sum, row) => sum + Number(row.total), 0);
    const monthlyPriceCents = restaurant?.plan === "scale" ? 59700 : restaurant?.plan === "start" ? 9700 : 29700;
    const hourlySales = hourlyBuckets(todayRows.results);
    const yesterdayHourlySales = hourlyBuckets(yesterdayRows.results);
    const yesterdayRevenueCents = yesterdayRows.results.reduce((sum, row) => sum + Number(row.total_cents), 0);
    const yesterdayOrderCount = yesterdayRows.results.length;
    const yesterdayAverageTicketCents = yesterdayOrderCount ? Math.round(yesterdayRevenueCents / yesterdayOrderCount) : 0;
    const todayRevenueCents = Number(metrics?.revenue_cents ?? 0);
    const todayOrderCount = Number(metrics?.order_count ?? 0);
    const todayAverageTicketCents = Math.round(Number(metrics?.average_ticket_cents ?? 0));
    const peakHour = hourlySales.reduce<(typeof hourlySales)[number] | null>(
      (best, bucket) => (!best || bucket.revenueCents > best.revenueCents ? bucket : best),
      null,
    );

    return json({
      ok: true,
      user: { name: context.user.displayName, email: context.user.email, role: context.role },
      restaurant: {
        id: restaurant?.id,
        name: restaurant?.name,
        slug: restaurant?.slug,
        city: restaurant?.city,
        state: restaurant?.state,
        plan: restaurant?.plan,
        status: restaurant?.status,
        isOpen: Boolean(restaurant?.is_open),
        activeOrders,
      },
      metrics: {
        revenueCents: todayRevenueCents,
        orderCount: todayOrderCount,
        averageTicketCents: todayAverageTicketCents,
        contributionMarginCents: Number(metrics?.contribution_margin_cents ?? 0),
        recoveredRevenueCents: Number(recovered?.recovered_cents ?? 0),
        rapidexRoi:
          monthlyPriceCents > 0
            ? Number((Number(recovered?.recovered_cents ?? 0) / monthlyPriceCents).toFixed(1))
            : 0,
      },
      analytics: {
        hourlySales,
        yesterdayHourlySales,
        revenueDeltaPct: percentDelta(todayRevenueCents, yesterdayRevenueCents),
        ordersDeltaPct: percentDelta(todayOrderCount, yesterdayOrderCount),
        ticketDeltaPct: percentDelta(todayAverageTicketCents, yesterdayAverageTicketCents),
        yesterdayRevenueCents,
        yesterdayOrderCount,
        averagePrepMinutes: Number(restaurant?.average_prep_minutes ?? 0),
        lateOrders: Number(lateOrdersRow?.total ?? 0),
        peakHour: peakHour && peakHour.orders > 0 ? peakHour : null,
        todayStatusCounts: Object.fromEntries(todayStatusRows.results.map((row) => [row.status, Number(row.total)])),
        topProducts: topProductRows.results.map((row) => ({ name: row.name, quantity: Number(row.quantity) })),
      },
      statusCounts: Object.fromEntries(statuses.results.map((row) => [row.status, Number(row.total)])),
      orders: ordersResult.results.map((order) => ({
        id: order.id,
        number: order.order_number,
        customerName: order.customer_name || "Cliente",
        status: order.status,
        source: order.source,
        totalCents: order.total_cents,
        createdAt: order.created_at,
        promisedFromMinutes: order.promised_from_minutes,
        promisedToMinutes: order.promised_to_minutes,
        items: itemRows.results
          .filter((item) => item.order_id === order.id)
          .map((item) => ({ name: item.product_name, quantity: item.quantity })),
      })),
      channels: channelRows.results.map((channel) => ({
        name: channel.source,
        revenueCents: Number(channel.revenue_cents),
        orders: Number(channel.orders),
        share: channelTotal ? Math.round((Number(channel.revenue_cents) / channelTotal) * 100) : 0,
      })),
      opportunity: automation
        ? {
            id: automation.id,
            kind: automation.kind,
            status: automation.status,
            reason: automation.reason,
            expectedRevenueCents: automation.expected_revenue_cents,
            recoveredRevenueCents: automation.recovered_revenue_cents,
            marginPercent: automation.margin_percent,
            metadata: safeJson(automation.metadata_json),
          }
        : null,
      returningCustomers: returningCustomers.results.map((customer) => ({
        id: customer.id,
        name: customer.name,
        phoneSuffix: String(customer.phone).slice(-4),
        orderCount: customer.order_count,
        lifetimeValueCents: customer.lifetime_value_cents,
        lastOrderAt: customer.last_order_at,
      })),
    });
  } catch (error) {
    return apiError(error);
  }
}

function hourlyBuckets(rows: Array<{ total_cents: number; created_at: number }>) {
  const buckets = Array.from({ length: 24 }, (_, hour) => ({ hour, revenueCents: 0, orders: 0 }));
  for (const row of rows) {
    const local = new Date(Number(row.created_at) - 3 * 60 * 60_000);
    const hour = local.getUTCHours();
    buckets[hour].revenueCents += Number(row.total_cents);
    buckets[hour].orders += 1;
  }
  return buckets;
}

function percentDelta(current: number, previous: number) {
  if (!previous) return null;
  return Math.round(((current - previous) / previous) * 100);
}

function startOfSaoPauloDay() {
  const now = new Date(Date.now() - 3 * 60 * 60_000);
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) + 3 * 60 * 60_000;
}

function startOfSaoPauloMonth() {
  const now = new Date(Date.now() - 3 * 60 * 60_000);
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1) + 3 * 60 * 60_000;
}

function safeJson(value: unknown) {
  try {
    return JSON.parse(String(value || "{}"));
  } catch {
    return {};
  }
}
