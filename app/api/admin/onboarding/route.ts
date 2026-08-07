import { audit, requireAdminContext, requireRole } from "@/lib/admin-auth";
import { apiError, assertSameOrigin, HttpError, json } from "@/lib/http";
import { getDatabase } from "@/lib/runtime";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const context = await requireAdminContext();
    const db = getDatabase();
    const restaurant = await db.prepare(
      `SELECT id, name, slug, plan, status, phone, whatsapp, city, state, is_open,
              delivery_fee_cents, minimum_order_cents, average_prep_minutes, delivery_minutes,
              onboarding_completed, published_at, trial_ends_at, settings_json
       FROM restaurants WHERE id = ? LIMIT 1`,
    ).bind(context.restaurantId).first<Record<string, unknown>>();
    const counts = await db.prepare(
      `SELECT
        (SELECT COUNT(*) FROM categories WHERE restaurant_id = ? AND active = 1) AS categories,
        (SELECT COUNT(*) FROM products WHERE restaurant_id = ? AND active = 1) AS products`,
    ).bind(context.restaurantId, context.restaurantId).first<{ categories: number; products: number }>();
    return json({
      ok: true,
      restaurant,
      readiness: {
        hasLocation: Boolean(restaurant?.city && restaurant?.state),
        hasWhatsapp: Boolean(restaurant?.whatsapp || restaurant?.phone),
        hasCategory: Number(counts?.categories || 0) > 0,
        hasProduct: Number(counts?.products || 0) > 0,
        published: Boolean(restaurant?.onboarding_completed && restaurant?.published_at),
      },
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    assertSameOrigin(request);
    const context = await requireAdminContext();
    requireRole(context, ["owner"]);
    const db = getDatabase();
    const restaurant = await db.prepare(
      `SELECT city, state, phone, whatsapp, onboarding_completed FROM restaurants WHERE id = ? LIMIT 1`,
    ).bind(context.restaurantId).first<Record<string, unknown>>();
    const product = await db.prepare(
      "SELECT id FROM products WHERE restaurant_id = ? AND active = 1 AND available = 1 LIMIT 1",
    ).bind(context.restaurantId).first();
    if (!restaurant?.city || !restaurant?.state) {
      throw new HttpError(409, "Informe cidade e estado antes de publicar.", "onboarding_location_required");
    }
    if (!restaurant.whatsapp && !restaurant.phone) {
      throw new HttpError(409, "Informe um WhatsApp ou telefone antes de publicar.", "onboarding_contact_required");
    }
    if (!product) throw new HttpError(409, "Cadastre pelo menos um produto disponível antes de publicar.", "onboarding_product_required");

    const now = Date.now();
    await db.prepare(
      `UPDATE restaurants SET onboarding_completed = 1, published_at = COALESCE(published_at, ?),
       is_open = 1, updated_at = ? WHERE id = ?`,
    ).bind(now, now, context.restaurantId).run();
    await audit(context, "restaurant.published", "restaurant", context.restaurantId);
    return json({ ok: true, next: "/admin", store: `/loja/${context.restaurantSlug}` });
  } catch (error) {
    return apiError(error);
  }
}
