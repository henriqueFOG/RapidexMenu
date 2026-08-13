import { ensureDemoData } from "@/lib/demo-data";
import { fulfillmentSettingsFrom } from "@/lib/fulfillment";
import { apiError, json, HttpError } from "@/lib/http";
import { getDatabase } from "@/lib/runtime";
import { isRestaurantAcceptingOrders } from "@/lib/store-availability";
import { safeSlug } from "@/lib/validation";

export const dynamic = "force-dynamic";

type PublicGroup = {
  id: string;
  product_id: string;
  name: string;
  min_select: number;
  max_select: number;
  pricing_strategy: string;
  kind: "modifier" | "variant";
  position: number;
};
type PublicOption = {
  id: string;
  group_id: string;
  name: string;
  price_delta_cents: number;
  stock_control_enabled: number;
  stock_quantity: number | null;
  position: number;
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const db = getDatabase();
    await ensureDemoData(db);
    const slug = safeSlug((await params).slug);
    const now = Date.now();
    const restaurant = await db
      .prepare(
        `SELECT id, slug, name, city, state, phone, whatsapp, delivery_fee_cents,
                minimum_order_cents, average_prep_minutes, delivery_minutes, is_open, timezone, settings_json
         FROM restaurants
         WHERE slug = ? AND (
           (status = 'active' AND (access_ends_at IS NULL OR access_ends_at > ?))
           OR (status = 'trial' AND (trial_ends_at IS NULL OR trial_ends_at > ?))
         )
         LIMIT 1`,
      )
      .bind(slug, now, now)
      .first<Record<string, unknown>>();
    if (!restaurant) throw new HttpError(404, "Loja não encontrada ou temporariamente indisponível.", "store_not_found");

    const [categories, products, paymentConnection, optionGroups, productOptions] = await Promise.all([
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
      db.prepare(
        `SELECT id, product_id, name, min_select, max_select, pricing_strategy, kind, position
         FROM product_option_groups
         WHERE restaurant_id = ? AND active = 1
         ORDER BY product_id, position, created_at`,
      ).bind(restaurant.id).all<PublicGroup>(),
      db.prepare(
        `SELECT po.id, po.group_id, po.name, po.price_delta_cents,
                po.stock_control_enabled, po.stock_quantity, po.position
         FROM product_options po
         JOIN product_option_groups pog ON pog.id = po.group_id
         WHERE po.restaurant_id = ?
           AND po.available = 1
           AND pog.active = 1
           AND (pog.kind <> 'variant' OR po.stock_control_enabled = 0 OR po.stock_quantity > 0)
         ORDER BY po.group_id, po.position, po.created_at`,
      ).bind(restaurant.id).all<PublicOption>(),
    ]);

    let settings: Record<string, unknown> = {};
    try { settings = JSON.parse(String(restaurant.settings_json || "{}")); } catch { settings = {}; }
    const fulfillment = fulfillmentSettingsFrom(settings);
    const acceptingOrders = isRestaurantAcceptingOrders({
      isOpen: Number(restaurant.is_open),
      timezone: String(restaurant.timezone || "America/Sao_Paulo"),
      settingsJson: settings,
      now,
    });
    const configuredBrandColor = typeof settings.brandColor === "string" ? settings.brandColor.toLowerCase() : "";
    const brandColor = !configuredBrandColor || configuredBrandColor === "#c9ff4a" ? "#ff650b" : configuredBrandColor;
    const groups = optionGroups.results;
    const options = productOptions.results;

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
        isOpen: acceptingOrders,
        manuallyEnabled: Boolean(restaurant.is_open),
        pixAvailable: Boolean(paymentConnection),
        deliveryFeeCents: restaurant.delivery_fee_cents,
        minimumOrderCents: restaurant.minimum_order_cents,
        prepMinutes: Number(restaurant.average_prep_minutes),
        deliveryMinutes: Number(restaurant.delivery_minutes),
        estimatedMinutes: Number(restaurant.average_prep_minutes) + Number(restaurant.delivery_minutes),
        brandColor,
        cuisine: settings.cuisine || "Restaurante",
        fulfillment,
      },
      categories: categories.results.map((category) => ({
        id: category.id,
        name: category.name,
        products: products.results.filter((product) => product.category_id === category.id).map((product) => publicProduct(product, groups, options)),
      })),
      uncategorized: products.results.filter((product) => !product.category_id).map((product) => publicProduct(product, groups, options)),
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
}, groups: PublicGroup[], options: PublicOption[]) {
  const productGroups = groups.filter((group) => group.product_id === product.id);
  const variantGroup = productGroups.find((group) => group.kind === "variant") || null;
  const orderableVariants = variantGroup ? options.filter((option) => option.group_id === variantGroup.id) : [];
  return {
    id: product.id,
    name: product.name,
    description: product.description,
    priceCents: product.price_cents,
    priceIsFrom: Boolean(variantGroup),
    emoji: product.emoji,
    tag: product.tag,
    imageUrl: product.image_key ? `/api/public/media/${encodeKey(product.image_key)}` : null,
    available: Boolean(product.available) && (!variantGroup || orderableVariants.length > 0),
    prepMinutes: product.prep_minutes,
    optionGroups: productGroups.map((group) => ({
      id: group.id,
      kind: group.kind || "modifier",
      name: group.name,
      minSelect: Number(group.min_select),
      maxSelect: Number(group.max_select),
      pricingStrategy: group.pricing_strategy,
      options: options.filter((option) => option.group_id === group.id).map((option) => ({
        id: option.id,
        name: option.name,
        priceDeltaCents: Number(option.price_delta_cents),
      })),
    })),
  };
}

function encodeKey(key: string) {
  return key.split("/").map(encodeURIComponent).join("/");
}
