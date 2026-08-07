import { apiError, HttpError, json, readJson } from "@/lib/http";
import { getSmartUpsells, recordUpsellShown } from "@/lib/profit-engine";
import { consumeRateLimit, rateLimitKey } from "@/lib/rate-limit";
import { getDatabase } from "@/lib/runtime";
import { requiredString } from "@/lib/validation";

export const dynamic = "force-dynamic";

type Body = {
  restaurantSlug?: unknown;
  clientOrderId?: unknown;
  productIds?: unknown;
};

export async function POST(request: Request) {
  try {
    const db = getDatabase();
    const limit = await consumeRateLimit(db, await rateLimitKey(request, "recommendations"), 60, 60_000);
    if (!limit.allowed) throw new HttpError(429, "Muitas recomendações em pouco tempo.", "rate_limited");

    const body = await readJson<Body>(request, 20_000);
    const clientOrderId = requiredString(body.clientOrderId, "Identificador do carrinho", 8, 100);
    const productIds = normalizeProductIds(body.productIds);
    if (!productIds.length) return json({ ok: true, recommendations: [], pressure: 0 });

    const result = await getSmartUpsells(db, body.restaurantSlug, productIds, 3);
    await recordUpsellShown(db, result.restaurantId, clientOrderId, result.recommendations);
    return json({
      ok: true,
      recommendations: result.recommendations,
      pressure: Math.round(result.pressure * 100),
    });
  } catch (error) {
    return apiError(error);
  }
}

function normalizeProductIds(value: unknown) {
  if (!Array.isArray(value)) throw new HttpError(400, "Produtos do carrinho inválidos.", "validation_error");
  const result = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length >= 2 && item.length <= 100);
  return Array.from(new Set(result)).slice(0, 30);
}
