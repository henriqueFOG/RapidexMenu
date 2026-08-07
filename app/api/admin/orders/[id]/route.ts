import { audit, requireAdminContext, requireRole } from "@/lib/admin-auth";
import { apiError, assertSameOrigin, HttpError, json, readJson } from "@/lib/http";
import { getDatabase } from "@/lib/runtime";
import { requiredString } from "@/lib/validation";
import { notifyWhatsAppOrderStatus } from "@/lib/whatsapp-order-status";

const transitions: Record<string, string[]> = {
  received: ["confirmed", "preparing", "canceled"],
  confirmed: ["preparing", "canceled"],
  preparing: ["ready", "canceled"],
  ready: ["out_for_delivery", "delivered"],
  out_for_delivery: ["delivered"],
  delivered: [],
  canceled: [],
};

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);
    const context = await requireAdminContext();
    requireRole(context, ["owner", "manager", "operator"]);
    const id = requiredString((await params).id, "Pedido", 2, 100);
    const body = await readJson<Record<string, unknown>>(request, 10_000);
    const nextStatus = requiredString(body.status, "Status", 2, 40);
    const db = getDatabase();
    const current = await db
      .prepare("SELECT status FROM orders WHERE id = ? AND restaurant_id = ?")
      .bind(id, context.restaurantId)
      .first<{ status: string }>();
    if (!current) throw new HttpError(404, "Pedido não encontrado.", "order_not_found");
    if (!(transitions[current.status] || []).includes(nextStatus)) {
      throw new HttpError(409, "Mudança de status inválida.", "invalid_status_transition", {
        from: current.status,
        to: nextStatus,
      });
    }
    const timestamp = Date.now();
    await db
      .prepare(
        `UPDATE orders SET status = ?, updated_at = ?,
         confirmed_at = CASE WHEN ? IN ('confirmed','preparing') AND confirmed_at IS NULL THEN ? ELSE confirmed_at END,
         delivered_at = CASE WHEN ? = 'delivered' THEN ? ELSE delivered_at END,
         canceled_at = CASE WHEN ? = 'canceled' THEN ? ELSE canceled_at END
         WHERE id = ? AND restaurant_id = ?`,
      )
      .bind(
        nextStatus,
        timestamp,
        nextStatus,
        timestamp,
        nextStatus,
        timestamp,
        nextStatus,
        timestamp,
        id,
        context.restaurantId,
      )
      .run();
    await audit(context, "order.status_changed", "order", id, { from: current.status, to: nextStatus });
    const notification = await notifyWhatsAppOrderStatus(db, context.restaurantId, id, nextStatus);
    return json({ ok: true, status: nextStatus, notification });
  } catch (error) {
    return apiError(error);
  }
}
