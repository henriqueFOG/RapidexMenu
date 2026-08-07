import { apiError, HttpError } from "@/lib/http";
import {
  getMercadoPagoOrder,
  normalizeMercadoPagoStatus,
  verifyMercadoPagoSignature,
} from "@/lib/integrations/mercado-pago";
import { getDatabase } from "@/lib/runtime";
import { sha256Hex } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > 200_000) {
      throw new HttpError(413, "Webhook acima do limite.", "payload_too_large");
    }
    const payload = JSON.parse(rawBody) as {
      id?: string | number;
      action?: string;
      type?: string;
      data?: { id?: string };
    };
    const providerOrderId = payload.data?.id;
    if (!providerOrderId) throw new HttpError(400, "Pedido do provedor ausente.", "invalid_webhook");
    if (!(await verifyMercadoPagoSignature(request, providerOrderId))) {
      throw new HttpError(401, "Assinatura do webhook inválida.", "invalid_signature");
    }
    const db = getDatabase();
    const paymentOwner = await db.prepare(
      `SELECT restaurant_id, order_id FROM payments
       WHERE provider = 'mercado_pago' AND provider_payment_id = ? LIMIT 1`,
    ).bind(providerOrderId).first<{ restaurant_id: string; order_id: string }>();
    if (!paymentOwner) throw new HttpError(404, "Pagamento não reconhecido.", "payment_not_found");

    const eventId = `${payload.id || providerOrderId}:${payload.action || payload.type || "order"}`;
    const previous = await db
      .prepare(
        "SELECT status FROM webhook_events WHERE provider = 'mercado_pago' AND provider_event_id = ?",
      )
      .bind(eventId)
      .first<{ status: string }>();
    if (previous?.status === "processed") return new Response("OK", { status: 200 });
    if (!previous) {
      await db
        .prepare(
          `INSERT INTO webhook_events
           (id, provider, provider_event_id, event_type, signature_valid, status, payload_hash, received_at)
           VALUES (?, 'mercado_pago', ?, ?, 1, 'received', ?, ?)`,
        )
        .bind(
          crypto.randomUUID(),
          eventId,
          payload.action || payload.type || "order",
          await sha256Hex(rawBody),
          Date.now(),
        )
        .run();
    }

    try {
      const providerOrder = await getMercadoPagoOrder(providerOrderId, paymentOwner.restaurant_id);
      const orderId = typeof providerOrder.external_reference === "string" ? providerOrder.external_reference : null;
      if (!orderId || orderId !== paymentOwner.order_id) {
        throw new HttpError(400, "Referência do pedido não confere.", "invalid_webhook");
      }
      const status = normalizeMercadoPagoStatus(providerOrder);
      const timestamp = Date.now();
      await db.batch([
        db
          .prepare(
            `UPDATE payments SET status = ?, provider_data_json = ?, updated_at = ?
             WHERE provider = 'mercado_pago' AND provider_payment_id = ? AND restaurant_id = ?`,
          )
          .bind(
            status,
            JSON.stringify({ providerStatus: providerOrder.status || null }),
            timestamp,
            providerOrderId,
            paymentOwner.restaurant_id,
          ),
        db
          .prepare(
            `UPDATE orders SET payment_status = ?,
             status = CASE WHEN ? = 'paid' AND status = 'received' THEN 'confirmed' ELSE status END,
             confirmed_at = CASE WHEN ? = 'paid' AND confirmed_at IS NULL THEN ? ELSE confirmed_at END,
             updated_at = ? WHERE id = ? AND restaurant_id = ?`,
          )
          .bind(status, status, status, timestamp, timestamp, orderId, paymentOwner.restaurant_id),
        db
          .prepare(
            `UPDATE webhook_events SET status = 'processed', processed_at = ?, error = NULL
             WHERE provider = 'mercado_pago' AND provider_event_id = ?`,
          )
          .bind(timestamp, eventId),
      ]);
    } catch (error) {
      await db
        .prepare(
          `UPDATE webhook_events SET status = 'failed', processed_at = ?, error = ?
           WHERE provider = 'mercado_pago' AND provider_event_id = ?`,
        )
        .bind(Date.now(), error instanceof Error ? error.message.slice(0, 500) : "unknown", eventId)
        .run();
      throw error;
    }
    return new Response("OK", { status: 200 });
  } catch (error) {
    return apiError(error);
  }
}
