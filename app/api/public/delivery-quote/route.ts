import { resolveDeliveryTerms } from "@/lib/delivery-zones";
import { apiError, HttpError, json, readJson } from "@/lib/http";
import { getDatabase } from "@/lib/runtime";
import { requiredString, safeSlug } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await readJson<Record<string, unknown>>(request, 20_000);
    const slug = safeSlug(body.restaurantSlug);
    const postalCode = requiredString(body.postalCode, "CEP", 3, 10);
    const neighborhood = requiredString(body.neighborhood, "Bairro", 2, 100);
    const db = getDatabase();
    const restaurant = await db.prepare(
      `SELECT id, settings_json, delivery_fee_cents, minimum_order_cents, delivery_minutes
       FROM restaurants
       WHERE slug = ? AND status IN ('active', 'trial') LIMIT 1`,
    ).bind(slug).first<{
      id: string;
      settings_json: string;
      delivery_fee_cents: number;
      minimum_order_cents: number;
      delivery_minutes: number;
    }>();
    if (!restaurant) throw new HttpError(404, "Loja não encontrada.", "store_not_found");
    const terms = await resolveDeliveryTerms(db, {
      restaurantId: restaurant.id,
      settingsValue: restaurant.settings_json,
      address: { postalCode, neighborhood },
      defaultFeeCents: Number(restaurant.delivery_fee_cents),
      defaultMinimumOrderCents: Number(restaurant.minimum_order_cents),
    });
    return json({
      ok: true,
      quote: {
        zoneName: terms.zoneName,
        matched: terms.matched,
        coverageRestricted: terms.coverageRestricted,
        feeCents: terms.feeCents,
        minimumOrderCents: terms.minimumOrderCents,
        deliveryMinutes: Number(restaurant.delivery_minutes) + terms.extraMinutes,
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
