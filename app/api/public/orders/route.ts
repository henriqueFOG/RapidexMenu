import { ensureDemoData } from "@/lib/demo-data";
import { apiError, HttpError, json, readJson } from "@/lib/http";
import { createPixOrder } from "@/lib/integrations/mercado-pago";
import { createOrder } from "@/lib/order-service";
import { consumeRateLimit, rateLimitKey } from "@/lib/rate-limit";
import { getBindings, getDatabase } from "@/lib/runtime";

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
    const wantsPix = (body.paymentMethod ?? "pix") === "pix";
    const email = (body.customer as Record<string, unknown> | undefined)?.email;
    if (wantsPix && getBindings().MERCADO_PAGO_ACCESS_TOKEN && !email) {
      throw new HttpError(400, "Informe o e-mail para gerar o Pix.", "email_required_for_pix");
    }

    const order = await createOrder(db, body);
    let payment: Record<string, unknown> = {
      providerConfigured: Boolean(getBindings().MERCADO_PAGO_ACCESS_TOKEN),
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
          if (pix) {
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
                JSON.stringify({
                  providerStatus: pix.providerStatus,
                  providerStatusDetail: pix.providerStatusDetail,
                }),
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
          }
        } catch (error) {
          console.error("Pix generation deferred", error instanceof Error ? error.message : "unknown");
          payment = {
            providerConfigured: true,
            status: "pending",
            error: "Pedido criado, mas o Pix não foi gerado. Escolha pagamento na entrega ou tente novamente.",
          };
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
