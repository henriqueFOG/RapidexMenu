import { apiError, HttpError, json } from "@/lib/http";
import { getDatabase } from "@/lib/runtime";
import { requiredString } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const token = requiredString((await params).token, "Código de acompanhamento", 24, 160);
    const db = getDatabase();
    const order = await db
      .prepare(
        `SELECT o.id, o.order_number, o.status, o.payment_status, o.payment_method,
                o.subtotal_cents, o.delivery_fee_cents, o.total_cents,
                o.promised_from_minutes, o.promised_to_minutes, o.created_at, o.updated_at,
                r.name AS restaurant_name
         FROM orders o JOIN restaurants r ON r.id = o.restaurant_id
         WHERE o.tracking_token = ? LIMIT 1`,
      )
      .bind(token)
      .first<Record<string, unknown>>();
    if (!order) throw new HttpError(404, "Pedido não encontrado.", "order_not_found");
    const items = await db
      .prepare(
        `SELECT product_name, quantity, unit_price_cents, notes
         FROM order_items WHERE order_id = ? ORDER BY created_at`,
      )
      .bind(order.id)
      .all<Record<string, unknown>>();
    const payment = await db
      .prepare(
        `SELECT status, pix_code, ticket_url, expires_at FROM payments
         WHERE order_id = ? ORDER BY created_at DESC LIMIT 1`,
      )
      .bind(order.id)
      .first<Record<string, unknown>>();

    return json({
      ok: true,
      order: {
        id: order.id,
        number: order.order_number,
        restaurantName: order.restaurant_name,
        status: order.status,
        paymentStatus: order.payment_status,
        paymentMethod: order.payment_method,
        subtotalCents: order.subtotal_cents,
        deliveryFeeCents: order.delivery_fee_cents,
        totalCents: order.total_cents,
        promisedFromMinutes: order.promised_from_minutes,
        promisedToMinutes: order.promised_to_minutes,
        createdAt: order.created_at,
        updatedAt: order.updated_at,
        items: items.results.map((item) => ({
          name: item.product_name,
          quantity: item.quantity,
          unitPriceCents: item.unit_price_cents,
          notes: item.notes,
        })),
      },
      payment: payment
        ? {
            status: payment.status,
            pixCode: payment.pix_code,
            ticketUrl: payment.ticket_url,
            expiresAt: payment.expires_at,
          }
        : null,
    });
  } catch (error) {
    return apiError(error);
  }
}
