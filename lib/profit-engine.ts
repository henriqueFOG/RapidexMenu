import { HttpError } from "./http";
import { safeSlug } from "./validation";

type CandidateRow = {
  id: string;
  name: string;
  description: string;
  price_cents: number;
  cost_cents: number;
  emoji: string;
  tag: string | null;
  prep_minutes: number;
  category_id: string | null;
};

type RestaurantRow = {
  id: string;
  max_concurrent_orders: number;
};

export type SmartUpsell = {
  id: string;
  name: string;
  description: string;
  priceCents: number;
  emoji: string;
  tag: string | null;
  prepMinutes: number;
  reason: string;
};

export async function getSmartUpsells(
  db: D1Database,
  restaurantSlug: unknown,
  selectedProductIds: string[],
  limit = 3,
): Promise<{ restaurantId: string; pressure: number; recommendations: SmartUpsell[] }> {
  const slug = safeSlug(restaurantSlug);
  const restaurant = await db.prepare(
    `SELECT id, max_concurrent_orders FROM restaurants
     WHERE slug = ? AND status IN ('trial', 'active') LIMIT 1`,
  ).bind(slug).first<RestaurantRow>();
  if (!restaurant) throw new HttpError(404, "Loja não encontrada.", "store_not_found");

  const active = await db.prepare(
    `SELECT COUNT(*) AS total FROM orders
     WHERE restaurant_id = ? AND status IN ('received', 'confirmed', 'preparing', 'ready')`,
  ).bind(restaurant.id).first<{ total: number }>();
  const pressure = Math.min(2, Number(active?.total || 0) / Math.max(1, Number(restaurant.max_concurrent_orders || 1)));

  const result = await db.prepare(
    `SELECT id, name, description, price_cents, cost_cents, emoji, tag, prep_minutes, category_id
     FROM products
     WHERE restaurant_id = ? AND active = 1 AND available = 1 AND price_cents > cost_cents
     ORDER BY position, name`,
  ).bind(restaurant.id).all<CandidateRow>();

  const selected = new Set(selectedProductIds.filter((value) => typeof value === "string" && value.length <= 100));
  const affinity = await loadAffinity(db, restaurant.id, Array.from(selected));
  const scored = result.results
    .filter((product) => !selected.has(product.id))
    .map((product) => {
      const marginCents = Number(product.price_cents) - Number(product.cost_cents);
      const marginPercent = product.price_cents > 0 ? (marginCents / Number(product.price_cents)) * 100 : 0;
      const coOrders = affinity.get(product.id) || 0;
      const prepPenalty = Number(product.prep_minutes) * (pressure >= 0.75 ? 1.8 : 0.45);
      const score = marginPercent + Math.min(32, coOrders * 6) + Math.min(24, marginCents / 55) - prepPenalty;
      return { product, score, coOrders, marginPercent };
    })
    .filter(({ marginPercent }) => marginPercent >= 18)
    .sort((left, right) => right.score - left.score)
    .slice(0, Math.max(1, Math.min(5, limit)));

  return {
    restaurantId: restaurant.id,
    pressure,
    recommendations: scored.map(({ product, coOrders }) => ({
      id: product.id,
      name: product.name,
      description: product.description,
      priceCents: Number(product.price_cents),
      emoji: product.emoji,
      tag: product.tag,
      prepMinutes: Number(product.prep_minutes),
      reason: coOrders >= 2
        ? "Clientes costumam pedir junto"
        : pressure >= 0.75 && Number(product.prep_minutes) <= 8
          ? "Boa combinação e rápido de preparar"
          : "Combina com seu pedido",
    })),
  };
}

export async function recordUpsellShown(
  db: D1Database,
  restaurantId: string,
  clientOrderId: string,
  products: SmartUpsell[],
) {
  const now = Date.now();
  const statements = products.map((product) => db.prepare(
    `INSERT INTO growth_events
     (id, restaurant_id, client_order_id, product_id, event_type, value_cents,
      contribution_cents, metadata_json, created_at, updated_at)
     SELECT ?, ?, ?, p.id, 'upsell_shown', 0, 0, ?, ?, ?
     FROM products p WHERE p.id = ? AND p.restaurant_id = ?
     ON CONFLICT (restaurant_id, client_order_id, event_type, product_id) DO NOTHING`,
  ).bind(
    crypto.randomUUID(),
    restaurantId,
    clientOrderId,
    JSON.stringify({ reason: product.reason }),
    now,
    now,
    product.id,
    restaurantId,
  ));
  if (statements.length) await db.batch(statements);
}

export async function attributeAcceptedUpsells(
  db: D1Database,
  restaurantId: string,
  clientOrderId: string,
  orderId: string,
  items: Array<{ productId: string; quantity: number; priceCents: number; costCents: number }>,
) {
  const now = Date.now();
  const statements = items.map((item) => db.prepare(
    `UPDATE growth_events
     SET event_type = 'upsell_accepted', order_id = ?, value_cents = ?, contribution_cents = ?, updated_at = ?
     WHERE restaurant_id = ? AND client_order_id = ? AND product_id = ? AND event_type = 'upsell_shown'`,
  ).bind(
    orderId,
    item.priceCents * item.quantity,
    Math.max(0, item.priceCents - item.costCents) * item.quantity,
    now,
    restaurantId,
    clientOrderId,
    item.productId,
  ));
  if (statements.length) await db.batch(statements);
}

async function loadAffinity(db: D1Database, restaurantId: string, selectedProductIds: string[]) {
  const affinity = new Map<string, number>();
  if (!selectedProductIds.length) return affinity;
  const placeholders = selectedProductIds.map(() => "?").join(", ");
  const result = await db.prepare(
    `SELECT oi2.product_id, COUNT(DISTINCT oi1.order_id) AS co_orders
     FROM order_items oi1
     JOIN orders o ON o.id = oi1.order_id
     JOIN order_items oi2 ON oi2.order_id = oi1.order_id AND oi2.product_id <> oi1.product_id
     WHERE o.restaurant_id = ? AND o.status <> 'canceled'
       AND oi1.product_id IN (${placeholders}) AND oi2.product_id IS NOT NULL
     GROUP BY oi2.product_id`,
  ).bind(restaurantId, ...selectedProductIds).all<{ product_id: string; co_orders: number }>();
  for (const row of result.results) affinity.set(row.product_id, Number(row.co_orders || 0));
  return affinity;
}
