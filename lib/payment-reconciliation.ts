import { HttpError } from "./http";
import { getMercadoPagoOrder, normalizeMercadoPagoStatus } from "./integrations/mercado-pago";

export async function reconcileMercadoPagoPayment(
  db: D1Database,
  input: { providerOrderId: string; restaurantId: string; orderId: string },
) {
  const providerOrder = await getMercadoPagoOrder(input.providerOrderId, input.restaurantId);
  const externalOrderId = typeof providerOrder.external_reference === "string" ? providerOrder.external_reference : null;
  if (!externalOrderId || externalOrderId !== input.orderId) {
    throw new HttpError(409, "Referência do pagamento não confere com o pedido.", "payment_reference_mismatch");
  }

  const status = normalizeMercadoPagoStatus(providerOrder);
  const timestamp = Date.now();
  await db.batch([
    db.prepare(
      `UPDATE payments SET status = ?, provider_data_json = ?, updated_at = ?
       WHERE provider = 'mercado_pago' AND provider_payment_id = ? AND restaurant_id = ? AND order_id = ?`,
    ).bind(
      status,
      JSON.stringify({ providerStatus: providerOrder.status || null, reconciledAt: timestamp }),
      timestamp,
      input.providerOrderId,
      input.restaurantId,
      input.orderId,
    ),
    db.prepare(
      `UPDATE orders SET payment_status = ?,
       status = CASE WHEN ? = 'paid' AND status = 'received' THEN 'confirmed' ELSE status END,
       confirmed_at = CASE WHEN ? = 'paid' AND confirmed_at IS NULL THEN ? ELSE confirmed_at END,
       updated_at = ? WHERE id = ? AND restaurant_id = ?`,
    ).bind(status, status, status, timestamp, timestamp, input.orderId, input.restaurantId),
  ]);

  return { status, providerOrder };
}
