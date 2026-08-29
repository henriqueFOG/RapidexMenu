import { fulfillmentSettingsFrom } from "./fulfillment";
import { HttpError } from "./http";
import { isRestaurantAcceptingOrders } from "./store-availability";

type RestaurantRow = {
  id: string;
  slug: string;
  name: string;
  city: string | null;
  state: string | null;
  phone: string | null;
  whatsapp: string | null;
  delivery_fee_cents: number;
  minimum_order_cents: number;
  average_prep_minutes: number;
  delivery_minutes: number;
  is_open: number;
  timezone: string;
  settings_json: string;
  catalog_version: number;
};
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
type PublicProductRow = {
  id: string;
  category_id: string | null;
  name: string;
  description: string;
  price_cents: number;
  emoji: string;
  tag: string | null;
  image_key: string | null;
  available: number;
  stock_control_enabled: number;
  stock_quantity: number | null;
  prep_minutes: number;
  position: number;
};

export async function loadPublicRestaurant(db: D1Database, slug: string, now = Date.now()) {
  const restaurant = await db.prepare(
    `SELECT id, slug, name, city, state, phone, whatsapp, delivery_fee_cents,
            minimum_order_cents, average_prep_minutes, delivery_minutes, is_open, timezone,
            settings_json, catalog_version
     FROM restaurants
     WHERE slug = ? AND (
       (status = 'active' AND (access_ends_at IS NULL OR access_ends_at > ?))
       OR (status = 'trial' AND (trial_ends_at IS NULL OR trial_ends_at > ?))
     )
     LIMIT 1`,
  ).bind(slug, now, now).first<RestaurantRow>();
  if (!restaurant) {
    throw new HttpError(404, "Loja não encontrada ou temporariamente indisponível.", "store_not_found");
  }
  return restaurant;
}

export async function buildPublicStoreState(db: D1Database, restaurant: RestaurantRow, now = Date.now()) {
  const paymentConnection = await db.prepare(
    `SELECT id FROM restaurant_payment_connections
     WHERE restaurant_id = ? AND provider = 'mercado_pago' AND status = 'active' LIMIT 1`,
  ).bind(restaurant.id).first<{ id: string }>();
  const settings = safeJson(restaurant.settings_json);
  const fulfillment = fulfillmentSettingsFrom(settings);
  const acceptingOrders = isRestaurantAcceptingOrders({
    isOpen: Number(restaurant.is_open),
    timezone: String(restaurant.timezone || "America/Sao_Paulo"),
    settingsJson: settings,
    now,
  });
  const configuredBrandColor = typeof settings.brandColor === "string" ? settings.brandColor.toLowerCase() : "";
  const brandColor = !configuredBrandColor || configuredBrandColor === "#c9ff4a" ? "#ff650b" : configuredBrandColor;
  return {
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
    deliveryFeeCents: Number(restaurant.delivery_fee_cents),
    minimumOrderCents: Number(restaurant.minimum_order_cents),
    prepMinutes: Number(restaurant.average_prep_minutes),
    deliveryMinutes: Number(restaurant.delivery_minutes),
    estimatedMinutes: Number(restaurant.average_prep_minutes) + Number(restaurant.delivery_minutes),
    brandColor,
    cuisine: settings.cuisine || "Restaurante",
    fulfillment,
    catalogVersion: Number(restaurant.catalog_version || 1),
  };
}

export async function buildPublicCatalog(db: D1Database, restaurantId: string, catalogVersion: number) {
  const [categories, products, optionGroups, productOptions] = await Promise.all([
    db.prepare(
      `SELECT id, name, position FROM categories
       WHERE restaurant_id = ? AND active = 1 ORDER BY position, name`,
    ).bind(restaurantId).all<{ id: string; name: string; position: number }>(),
    db.prepare(
      `SELECT id, category_id, name, description, price_cents, emoji, tag, image_key,
              available, stock_control_enabled, stock_quantity, prep_minutes, position
       FROM products WHERE restaurant_id = ? AND active = 1
       ORDER BY position, name`,
    ).bind(restaurantId).all<PublicProductRow>(),
    db.prepare(
      `SELECT id, product_id, name, min_select, max_select, pricing_strategy, kind, position
       FROM product_option_groups
       WHERE restaurant_id = ? AND active = 1
       ORDER BY product_id, position, created_at`,
    ).bind(restaurantId).all<PublicGroup>(),
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
    ).bind(restaurantId).all<PublicOption>(),
  ]);
  const groups = optionGroups.results;
  const options = productOptions.results;
  return {
    catalogVersion,
    categories: categories.results.map((category) => ({
      id: category.id,
      name: category.name,
      products: products.results
        .filter((product) => product.category_id === category.id)
        .map((product) => publicProduct(product, groups, options)),
    })),
    uncategorized: products.results
      .filter((product) => !product.category_id)
      .map((product) => publicProduct(product, groups, options)),
  };
}

export function catalogEtag(restaurantId: string, version: number) {
  return `W/\"rapidex-catalog-${restaurantId}-${Math.max(1, Math.floor(version))}\"`;
}

function publicProduct(product: PublicProductRow, groups: PublicGroup[], options: PublicOption[]) {
  const productGroups = groups.filter((group) => group.product_id === product.id);
  const variantGroup = productGroups.find((group) => group.kind === "variant") || null;
  const orderableVariants = variantGroup ? options.filter((option) => option.group_id === variantGroup.id) : [];
  const baseStockAvailable = !product.stock_control_enabled || (product.stock_quantity !== null && Number(product.stock_quantity) > 0);
  return {
    id: product.id,
    name: product.name,
    description: product.description,
    priceCents: Number(product.price_cents),
    priceIsFrom: Boolean(variantGroup),
    emoji: product.emoji,
    tag: product.tag,
    imageUrl: product.image_key ? `/api/public/media/${encodeKey(product.image_key)}` : null,
    available: Boolean(product.available) && baseStockAvailable && (!variantGroup || orderableVariants.length > 0),
    prepMinutes: Number(product.prep_minutes),
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

function safeJson(value: unknown): Record<string, unknown> {
  try {
    const parsed = JSON.parse(String(value || "{}"));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function encodeKey(key: string) {
  return key.split("/").map(encodeURIComponent).join("/");
}
