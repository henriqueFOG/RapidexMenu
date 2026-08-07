import type { CreatedOrder } from "../order-service";
import { HttpError } from "../http";
import { getBindings } from "../runtime";
import { getSellerAccessToken } from "../mercado-pago-seller";
import { hmacSha256Hex, constantTimeEqual } from "../security";

type MercadoPagoOrder = Record<string, unknown> & {
  id?: string;
  status?: string;
  external_reference?: string;
  transactions?: {
    payments?: Array<{
      status?: string;
      status_detail?: string;
      payment_method?: {
        ticket_url?: string;
        qr_code?: string;
        qr_code_base64?: string;
      };
    }>;
  };
};

export async function createPixOrder(order: CreatedOrder) {
  const accessToken = await getSellerAccessToken(order.restaurantId);
  if (!accessToken) return null;
  if (!order.customerEmail) {
    throw new HttpError(400, "E-mail é necessário para gerar o Pix.", "email_required_for_pix");
  }
  const amount = (order.totalCents / 100).toFixed(2);
  const idempotencyKey = `rapidex:${order.id}`;
  const response = await fetch("https://api.mercadopago.com/v1/orders", {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
      "x-idempotency-key": idempotencyKey,
    },
    body: JSON.stringify({
      type: "online",
      processing_mode: "automatic",
      external_reference: order.id,
      total_amount: amount,
      payer: { email: order.customerEmail },
      transactions: {
        payments: [
          {
            amount,
            payment_method: { id: "pix", type: "bank_transfer" },
            expiration_time: "PT30M",
          },
        ],
      },
    }),
  });
  const payload = (await response.json()) as MercadoPagoOrder;
  if (!response.ok || !payload.id) {
    console.error("Mercado Pago create Pix failed", response.status);
    throw new HttpError(502, "Não foi possível gerar o Pix agora.", "pix_creation_failed");
  }
  return normalizePix(payload, idempotencyKey);
}

export async function getMercadoPagoOrder(providerOrderId: string, restaurantId: string) {
  const accessToken = await getSellerAccessToken(restaurantId);
  if (!accessToken) {
    throw new HttpError(503, "Mercado Pago não está conectado para esta loja.", "integration_not_configured");
  }
  const response = await fetch(
    `https://api.mercadopago.com/v1/orders/${encodeURIComponent(providerOrderId)}`,
    { headers: { authorization: `Bearer ${accessToken}` } },
  );
  if (!response.ok) throw new HttpError(502, "Falha ao consultar o pagamento.", "pix_lookup_failed");
  return (await response.json()) as MercadoPagoOrder;
}

export async function verifyMercadoPagoSignature(
  request: Request,
  dataIdFromBody?: string,
) {
  const secret = getBindings().MERCADO_PAGO_WEBHOOK_SECRET;
  if (!secret) return false;
  const xSignature = request.headers.get("x-signature");
  const requestId = request.headers.get("x-request-id");
  if (!xSignature || !requestId) return false;

  const parts = Object.fromEntries(
    xSignature.split(",").map((part) => {
      const [key, ...value] = part.trim().split("=");
      return [key, value.join("=")];
    }),
  );
  if (!parts.ts || !parts.v1) return false;
  const url = new URL(request.url);
  const dataId = (url.searchParams.get("data.id") || dataIdFromBody || "").toLowerCase();
  if (!dataId) return false;
  const manifest = `id:${dataId};request-id:${requestId};ts:${parts.ts};`;
  const expected = await hmacSha256Hex(secret, manifest);
  return constantTimeEqual(expected, parts.v1);
}

export function normalizeMercadoPagoStatus(payload: MercadoPagoOrder) {
  const payment = payload.transactions?.payments?.[0];
  const raw = payment?.status || payload.status || "pending";
  if (["approved", "processed", "completed", "paid"].includes(raw)) return "paid";
  if (["rejected", "failed"].includes(raw)) return "failed";
  if (["cancelled", "canceled", "expired"].includes(raw)) return "canceled";
  if (["refunded", "charged_back"].includes(raw)) return "refunded";
  return "pending";
}

function normalizePix(payload: MercadoPagoOrder, idempotencyKey: string) {
  const payment = payload.transactions?.payments?.[0];
  const method = payment?.payment_method;
  return {
    providerOrderId: payload.id!,
    idempotencyKey,
    status: normalizeMercadoPagoStatus(payload),
    providerStatus: payment?.status || payload.status || "pending",
    providerStatusDetail: payment?.status_detail || null,
    ticketUrl: method?.ticket_url || null,
    pixCode: method?.qr_code || null,
    qrCodeBase64: method?.qr_code_base64 || null,
    raw: payload,
  };
}
