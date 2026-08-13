import { requireAdminContext } from "@/lib/admin-auth";
import { requireCommercialFeature } from "@/lib/entitlements";
import { apiError, assertSameOrigin, json, readJson } from "@/lib/http";
import { generateSalesReply } from "@/lib/integrations/openai";
import { getDatabase } from "@/lib/runtime";
import { normalizePhone, optionalString, requiredString } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const context = await requireAdminContext();
    requireCommercialFeature(context, "ai_sales");
    const body = await readJson<Record<string, unknown>>(request, 20_000);
    const message = requiredString(body.message, "Mensagem", 1, 2000);
    const phone = body.phone ? normalizePhone(body.phone) : null;
    const db = getDatabase();
    const customer = phone
      ? await db
          .prepare("SELECT id, name FROM customers WHERE restaurant_id = ? AND phone = ?")
          .bind(context.restaurantId, phone)
          .first<{ id: string; name: string }>()
      : null;
    const products = await db
      .prepare(
        `SELECT id, name, description, price_cents, cost_cents, available
         FROM products WHERE restaurant_id = ? AND active = 1 ORDER BY position`,
      )
      .bind(context.restaurantId)
      .all<Record<string, unknown>>();
    const preferences = customer
      ? await db
          .prepare("SELECT kind, value FROM customer_preferences WHERE customer_id = ?")
          .bind(customer.id)
          .all<{ kind: string; value: string }>()
      : { results: [] as Array<{ kind: string; value: string }> };
    const recentOrders = customer
      ? await db
          .prepare(
            `SELECT order_number, total_cents, id FROM orders WHERE customer_id = ? AND status != 'canceled'
             ORDER BY created_at DESC LIMIT 3`,
          )
          .bind(customer.id)
          .all<{ order_number: number; total_cents: number; id: string }>()
      : { results: [] as Array<{ order_number: number; total_cents: number; id: string }> };
    const reply = await generateSalesReply({
      restaurantId: context.restaurantId,
      restaurantName: context.restaurantName,
      message,
      customerName: customer?.name || optionalString(body.customerName, "Cliente", 80),
      preferences: preferences.results,
      products: products.results.map((product) => ({
        id: String(product.id),
        name: String(product.name),
        description: String(product.description),
        priceCents: Number(product.price_cents),
        marginPercent: Math.round(
          ((Number(product.price_cents) - Number(product.cost_cents)) / Number(product.price_cents)) * 100,
        ),
        available: Boolean(product.available),
      })),
      recentOrders: recentOrders.results.map((order) => ({
        orderNumber: order.order_number,
        items: [],
        totalCents: order.total_cents,
      })),
    });
    return json({ ok: true, reply });
  } catch (error) {
    return apiError(error);
  }
}
