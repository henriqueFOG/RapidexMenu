import { requireAdminContext } from "@/lib/admin-auth";
import { apiError, json } from "@/lib/http";
import { getDatabase } from "@/lib/runtime";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const context = await requireAdminContext();
    const status = new URL(request.url).searchParams.get("status");
    const allowed = ["received", "confirmed", "preparing", "ready", "out_for_delivery", "delivered", "canceled"];
    const filter = status && allowed.includes(status) ? " AND o.status = ?" : "";
    const statement = getDatabase().prepare(
      `SELECT o.*, c.name AS customer_name, c.phone AS customer_phone
       FROM orders o LEFT JOIN customers c ON c.id = o.customer_id
       WHERE o.restaurant_id = ?${filter} ORDER BY o.created_at DESC LIMIT 100`,
    );
    const result = await (filter
      ? statement.bind(context.restaurantId, status).all<Record<string, unknown>>()
      : statement.bind(context.restaurantId).all<Record<string, unknown>>());
    return json({ ok: true, orders: result.results });
  } catch (error) {
    return apiError(error);
  }
}
