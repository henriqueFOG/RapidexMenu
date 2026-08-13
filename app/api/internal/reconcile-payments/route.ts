import { apiError, HttpError, json } from "@/lib/http";
import { reconcileMercadoPagoPayment } from "@/lib/payment-reconciliation";
import { getBindings, getDatabase } from "@/lib/runtime";
import { constantTimeEqual } from "@/lib/security";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  return reconcile(request);
}

export async function POST(request: Request) {
  return reconcile(request);
}

async function reconcile(request: Request) {
  try {
    authorizeJob(request);
    const db = getDatabase();
    const cutoff = Date.now() - 5 * 60_000;
    const pending = await db.prepare(
      `SELECT provider_payment_id, restaurant_id, order_id
       FROM payments
       WHERE provider = 'mercado_pago'
         AND status = 'pending'
         AND provider_payment_id IS NOT NULL
         AND created_at <= ?
       ORDER BY updated_at ASC
       LIMIT 50`,
    ).bind(cutoff).all<{
      provider_payment_id: string;
      restaurant_id: string;
      order_id: string;
    }>();

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

    return json({
      ok: true,
      scanned: pending.results.length,
      reconciled,
      changed,
      failed: failures.length,
      failures: failures.slice(0, 10),
    });
  } catch (error) {
    return apiError(error);
  }
}

function authorizeJob(request: Request) {
  const secret = getBindings().RAPIDEX_CRON_SECRET || "";
  if (secret.length < 32) {
    throw new HttpError(503, "Reconciliação automática ainda não está configurada.", "reconciliation_not_configured");
  }
  const authorization = request.headers.get("authorization") || "";
  const provided = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!provided || !constantTimeEqual(secret, provided)) {
    throw new HttpError(401, "Acesso não autorizado.", "invalid_job_secret");
  }
}
