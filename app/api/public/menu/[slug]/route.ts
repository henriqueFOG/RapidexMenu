import { ensureDemoData } from "@/lib/demo-data";
import { apiError, json, HttpError } from "@/lib/http";
import { getDatabase } from "@/lib/runtime";
import { safeSlug } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const db = getDatabase();
    await ensureDemoData(db);
    const slug = safeSlug((await params).slug);
    const restaurant = await db
      .prepare(
        `SELECT id, slug, name, city, state, phone, whatsapp, delivery_fee_cents,
                minimum_order_cents, average_prep_minutes, delivery_minutes, is_open, settings_json
         FROM restaurants
         WHERE slug = ? AND (status = 'active' OR (status = 'trial' AND (trial_ends_at IS NULL OR trial_ends_at > ?)))
         LIMIT 1`,
      )
      .bind(slug, Date.now())
      .first<Record<string, unknown>>();
    if (!restaurant) throw new HttpError(404, "Loja não encontrada ou temporariamente indisponível.", "store_not_found");

    const [categories, products, paymentConnection] = await Promise.all([
      db
        .prepare(
          `SELECT id, name, position FROM categories
           WHERE restaurant_id = ? AND active = 1 ORDER BY position, name`,
        )
        .bind(restaurant.id)
        .all<{ id: string; name: string; position: number }>(),
      db
        .prepare(
          `SELECT id, category_id, name, description, price_cents, emoji, tag, image_key,
                  available, prep_minutes, position
           FROM products WHERE restaurant_id = ? AND active = 1
           ORDER BY position, name`,
        )
        .bind(restaurant.id)
        .all<{
          id: string;
          category_id: string | null;
          name: string;
          description: string;
          price_cents: number;
          emoji: string;
          tag: string | null;
          image_key: string | null;
          available: number;
          prep_minutes: number;
          position: number;
        }>(),
      db
        .prepare(
          `SELECT id FROM restaurant_payment_connections
           WHERE restaurant_id = ? AND provider = 'mercado_pago' AND status = 'active' LIMIT 1`,
        )
        .bind(restaurant.id)
        .first<{ id: string }>(),
    ]);

    let settings: Record<string, unknown> = {};
    try { settings = JSON.parse(String(restaurant.settings_json || "{}")); } catch { settings = {}; }

    return json({
      ok: true,
      restaurant: {
        id: restaurant.id,
        slug: restaurant.slug,
        name: restaurant.name,
        city: restaurant.city,
        state: restaurant.state,
        phone: restaurant.phone,
        whatsapp: restaurant.whatsapp,
        isOpen: Boolean(restaurant.is_open),
        pixAvailable: Boolean(paymentConnection),
        deliveryFeeCents: restaurant.delivery_fee_cents,
        minimumOrderCents: restaurant.minimum_order_cents,
        estimatedMinutes: Number(restaurant.average_prep_minutes) + Number(restaurant.delivery_minutes),
        brandColor: settings.brandColor || "#c9ff4a",
        cuisine: settings.cuisine || "Restaurante",
      },
      categories: categories.results.map((category) => ({
        id: category.id,
        name: category.name,
        products: products.results.filter((product) => product.category_id === category.id).map(publicProduct),
      })),
      uncategorized: products.results.filter((product) => !product.category_id).map(publicProduct),
    });
  } catch (error) {
    return apiError(error);
  }
}

function publicProduct(product: {
  id: string;
  name: string;
  description: string;
  price_cents: number;
  emoji: string;
  tag: string | null;
  image_key: string | null;
  available: number;
  prep_minutes: number;
}) {
  return {
    id: product.id,
    name: product.name,
    description: product.description,
    priceCents: product.price_cents,
    emoji: product.emoji,
    tag: product.tag,
    imageUrl: product.image_key ? `/api/public/media/${encodeKey(product.image_key)}` : null,
    available: Boolean(product.available),
    prepMinutes: product.prep_minutes,
  };
}

function encodeKey(key: string) {
  return key.split("/").map(encodeURIComponent).join("/");
}
