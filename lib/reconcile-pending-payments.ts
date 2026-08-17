import { HttpError } from "./http";
import { reconcileMercadoPagoPayment } from "./payment-reconciliation";
import { getDatabase } from "./runtime";

export async function reconcilePendingPayments(limit = 50) {
  const db = getDatabase();
  const cutoff = Date.now() - 5 * 60_000;
  const pending = await db.prepare(
    `SELECT provider_payment_id, restaurant_id, order_id
     FROM payments
     WHERE provider = 'mercado_pago' AND status = 'pending'
       AND provider_payment_id IS NOT NULL AND created_at <= ?
     ORDER BY updated_at ASC LIMIT ?`,
  ).bind(cutoff, limit).all<{ provider_payment_id: string; restaurant_id: string; order_id: string }>();
  let reconciled = 0;
  let changed = 0;
  const failures: Array<{ providerOrderId: string; code: string }> = [];
  for (const payment of pending.results) {
    try {
      const current = await db.prepare(
        "SELECT status FROM payments WHERE provider = 'mercado_pago' AND provider_payment_id = ? AND restaurant_id = ? LIMIT 1",
      ).bind(payment.provider_payment_id, payment.restaurant_id).first<{ status: string }>();
      if (!current || current.status !== "pending") continue;
      const result = await reconcileMercadoPagoPayment(db, {
        providerOrderId: payment.provider_payment_id,
        restaurantId: payment.restaurant_id,
        orderId: payment.order_id,
      });
      reconciled += 1;
      if (result.status !== current.status) changed += 1;
    } catch (error) {
      failures.push({
        providerOrderId: payment.provider_payment_id,
        code: error instanceof HttpError ? error.code : "reconciliation_failed",
      });
    }
  }
  return { scanned: pending.results.length, reconciled, changed, failed: failures.length, failures: failures.slice(0, 10) };
}
