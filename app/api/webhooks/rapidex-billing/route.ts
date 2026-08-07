import { apiError, HttpError, json, readJson } from "@/lib/http";
import { fetchProviderSubscription, syncProviderSubscription } from "@/lib/platform-billing";
import { consumeRateLimit, rateLimitKey } from "@/lib/rate-limit";
import { getDatabase } from "@/lib/runtime";

export const dynamic = "force-dynamic";

type WebhookBody = { type?: unknown; data?: { id?: unknown } };

export async function POST(request: Request) {
  try {
    const db = getDatabase();
    const limit = await consumeRateLimit(db, await rateLimitKey(request, "billing-webhook"), 120, 60_000);
    if (!limit.allowed) throw new HttpError(429, "Limite temporário excedido.", "rate_limited");
    const body = await readJson<WebhookBody>(request, 50_000);
    if (body.type !== "subscription_preapproval") return json({ ok: true, ignored: true });
    if (typeof body.data?.id !== "string" || body.data.id.length < 3 || body.data.id.length > 120) {
      throw new HttpError(400, "Notificação inválida.", "invalid_webhook");
    }

    // O corpo do webhook nunca é autoridade para ativar uma conta. Reconsultamos a assinatura
    // diretamente no Mercado Pago e só sincronizamos se external_reference e valor coincidirem.
    const provider = await fetchProviderSubscription(body.data.id);
    const synced = await syncProviderSubscription(provider);
    return json({ ok: true, status: synced.status });
  } catch (error) {
    return apiError(error);
  }
}
