import { apiError, HttpError } from "@/lib/http";
import { verifyMercadoPagoSignature } from "@/lib/integrations/mercado-pago";
import { reconcileMercadoPagoPayment } from "@/lib/payment-reconciliation";
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
      await reconcileMercadoPagoPayment(db, {
        providerOrderId,
        restaurantId: paymentOwner.restaurant_id,
        orderId: paymentOwner.order_id,
      });
      await db.prepare(
        `UPDATE webhook_events SET status = 'processed', processed_at = ?, error = NULL
         WHERE provider = 'mercado_pago' AND provider_event_id = ?`,
      ).bind(Date.now(), eventId).run();
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
