import { requireAdminContext } from "@/lib/admin-auth";
import { apiError, HttpError, json } from "@/lib/http";
import { getDatabase } from "@/lib/runtime";

export const dynamic = "force-dynamic";

const activeStatuses = ["received", "confirmed", "preparing", "ready"];

export async function GET() {
  try {
    const context = await requireAdminContext();
    if (context.plan !== "scale") {
      throw new HttpError(403, "KDS está disponível no plano Escala.", "feature_not_in_plan", {
        feature: "kds",
        requiredPlan: "scale",
      });
    }
    const db = getDatabase();
    const orders = await db.prepare(
      `SELECT id, order_number, source, fulfillment_type, table_code, status, payment_status,
              notes, promised_from_minutes, promised_to_minutes, created_at, updated_at
       FROM orders
       WHERE restaurant_id = ? AND status IN ('received','confirmed','preparing','ready')
       ORDER BY created_at ASC
       LIMIT 200`,
    ).bind(context.restaurantId).all<Record<string, unknown>>();
    const orderIds = orders.results.map((order) => String(order.id));
    const items = orderIds.length
      ? await db.prepare(
          `SELECT id, order_id, product_name, quantity, notes
           FROM order_items WHERE order_id IN (${orderIds.map(() => "?").join(",")})
           ORDER BY created_at`,
        ).bind(...orderIds).all<Record<string, unknown>>()
      : { results: [] as Record<string, unknown>[] };
    const itemIds = items.results.map((item) => String(item.id));
    const options = itemIds.length
      ? await db.prepare(
          `SELECT order_item_id, option_group_name, option_name
           FROM order_item_options WHERE order_item_id IN (${itemIds.map(() => "?").join(",")})
           ORDER BY created_at`,
        ).bind(...itemIds).all<Record<string, unknown>>()
      : { results: [] as Record<string, unknown>[] };
    const now = Date.now();
    return json({
      ok: true,
      generatedAt: now,
      statuses: activeStatuses,
      orders: orders.results.map((order) => {
        const createdAt = Number(order.created_at);
        const promiseTo = Number(order.promised_to_minutes || 0);
        const dueAt = createdAt + promiseTo * 60_000;
        return {
          id: order.id,
          number: order.order_number,
          source: order.source,
          fulfillmentType: order.fulfillment_type || "delivery",
          tableCode: order.table_code || null,
          status: order.status,
          paymentStatus: order.payment_status,
          notes: order.notes,
          createdAt,
          ageMinutes: Math.max(0, Math.floor((now - createdAt) / 60_000)),
          promisedFromMinutes: order.promised_from_minutes,
          promisedToMinutes: order.promised_to_minutes,
          dueAt,
          late: now > dueAt && order.status !== "ready",
          items: items.results.filter((item) => item.order_id === order.id).map((item) => ({
            id: item.id,
            name: item.product_name,
            quantity: item.quantity,
            notes: item.notes,
            options: options.results.filter((option) => option.order_item_id === item.id).map((option) => ({
              group: option.option_group_name,
              name: option.option_name,
            })),
          })),
        };
      }),
    });
  } catch (error) {
    return apiError(error);
  }
}
