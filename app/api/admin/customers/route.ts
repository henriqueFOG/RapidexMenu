import { requireAdminContext } from "@/lib/admin-auth";
import { apiError, json } from "@/lib/http";
import { getDatabase } from "@/lib/runtime";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const context = await requireAdminContext();
    const search = new URL(request.url).searchParams.get("q")?.trim().slice(0, 80) || "";
    const db = getDatabase();
    const query = search
      ? `SELECT * FROM customers WHERE restaurant_id = ? AND (name LIKE ? OR phone LIKE ?)
         ORDER BY last_order_at DESC LIMIT 100`
      : `SELECT * FROM customers WHERE restaurant_id = ? ORDER BY last_order_at DESC LIMIT 100`;
    const customers = await (search
      ? db.prepare(query).bind(context.restaurantId, `%${search}%`, `%${search.replace(/\D/g, "")}%`).all<Record<string, unknown>>()
      : db.prepare(query).bind(context.restaurantId).all<Record<string, unknown>>());
    return json({
      ok: true,
      customers: customers.results.map((customer) => ({
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        orderCount: customer.order_count,
        lifetimeValueCents: customer.lifetime_value_cents,
        lastOrderAt: customer.last_order_at,
        whatsappConsent: Boolean(customer.whatsapp_consent),
      })),
    });
  } catch (error) {
    return apiError(error);
  }
}
