import { ensureDemoData } from "@/lib/demo-data";
import { apiError, HttpError, json, readJson } from "@/lib/http";
import { createPixOrder } from "@/lib/integrations/mercado-pago";
import { sellerPixAvailable } from "@/lib/mercado-pago-seller";
import { createOrder } from "@/lib/order-service";
import { consumeRateLimit, rateLimitKey } from "@/lib/rate-limit";
import { getDatabase } from "@/lib/runtime";
import { safeSlug } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const db = getDatabase();
    const limit = await consumeRateLimit(db, await rateLimitKey(request, "orders"), 20, 60_000);
    if (!limit.allowed) {
      throw new HttpError(429, "Muitas tentativas. Aguarde um minuto.", "rate_limited");
    }
    await ensureDemoData(db);
    const body = await readJson<Record<string, unknown>>(request, 120_000);
    const slug = safeSlug(body.restaurantSlug);
    const subscription = await db.prepare(
      `SELECT id, status, trial_ends_at, access_ends_at FROM restaurants WHERE slug = ? LIMIT 1`,
    ).bind(slug).first<{ id: string; status: string; trial_ends_at: number | null; access_ends_at: number | null }>();
    const now = Date.now();
    const trialValid = subscription?.status === "trial" && (!subscription.trial_ends_at || Number(subscription.trial_ends_at) > now);
    const activeValid = subscription?.status === "active" && (!subscription.access_ends_at || Number(subscription.access_ends_at) > now);
    if (!subscription || (!activeValid && !trialValid)) {
      throw new HttpError(403, "Esta loja está temporariamente indisponível para novos pedidos.", "store_subscription_inactive");
    }

    const wantsPix = (body.paymentMethod ?? "pix") === "pix";
    const email = (body.customer as Record<string, unknown> | undefined)?.email;
    const pixAvailable = wantsPix ? await sellerPixAvailable(subscription.id) : false;
    if (wantsPix && !pixAvailable) {
      throw new HttpError(409, "Pix ainda não está disponível nesta loja. Escolha dinheiro ou cartão na entrega.", "pix_not_available");
    }
    if (wantsPix && !email) {
      throw new HttpError(400, "Informe o e-mail para gerar o Pix.", "email_required_for_pix");
    }

    const order = await createOrder(db, body);
    let payment: Record<string, unknown> = {
      providerConfigured: order.paymentMethod === "pix" ? pixAvailable : false,
      status: "pending",
    };

    if (order.paymentMethod === "pix") {
      const existingPayment = await db
        .prepare(
          `SELECT provider_payment_id, status, pix_code, ticket_url, expires_at
           FROM payments WHERE order_id = ? LIMIT 1`,
        )
        .bind(order.id)
        .first<{
          provider_payment_id: string | null;
          status: string;
          pix_code: string | null;
          ticket_url: string | null;
          expires_at: number | null;
        }>();
      if (existingPayment) {
        payment = {
          providerConfigured: true,
          providerOrderId: existingPayment.provider_payment_id,
          status: existingPayment.status,
          pixCode: existingPayment.pix_code,
          ticketUrl: existingPayment.ticket_url,
          expiresAt: existingPayment.expires_at,
        };
      } else {
        try {
          const pix = await createPixOrder(order);
          if (!pix) throw new HttpError(503, "Pix ficou indisponível para esta loja.", "pix_not_available");
          const expiresAt = Date.now() + 30 * 60_000;
          await db
            .prepare(
              `INSERT INTO payments
               (id, restaurant_id, order_id, provider, provider_payment_id, idempotency_key,
                status, amount_cents, pix_code, ticket_url, expires_at, provider_data_json,
                created_at, updated_at)
               VALUES (?, ?, ?, 'mercado_pago', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            )
            .bind(
              crypto.randomUUID(),
              order.restaurantId,
              order.id,
              pix.providerOrderId,
              pix.idempotencyKey,
              pix.status,
              order.totalCents,
              pix.pixCode,
              pix.ticketUrl,
              expiresAt,
              JSON.stringify({ providerStatus: pix.providerStatus, providerStatusDetail: pix.providerStatusDetail }),
              Date.now(),
              Date.now(),
            )
            .run();
          payment = {
            providerConfigured: true,
            providerOrderId: pix.providerOrderId,
            status: pix.status,
            pixCode: pix.pixCode,
            ticketUrl: pix.ticketUrl,
            qrCodeBase64: pix.qrCodeBase64,
            expiresAt,
          };
        } catch (error) {
          console.error("Pix generation failed", error instanceof Error ? error.message : "unknown");
          throw error;
        }
      }
    }

    return json(
      {
        ok: true,
        order: {
          id: order.id,
          trackingToken: order.trackingToken,
          number: order.orderNumber,
          restaurantName: order.restaurantName,
          totalCents: order.totalCents,
          subtotalCents: order.subtotalCents,
          deliveryFeeCents: order.deliveryFeeCents,
          status: "received",
          promisedFromMinutes: order.promisedFromMinutes,
          promisedToMinutes: order.promisedToMinutes,
          existing: order.existing,
        },
        payment,
      },
      { status: order.existing ? 200 : 201 },
    );
  } catch (error) {
    return apiError(error);
  }
}
