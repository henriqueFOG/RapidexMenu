import { HttpError } from "./http";
import { attributeAcceptedUpsells } from "./profit-engine";
import { isRestaurantAcceptingOrders } from "./store-availability";
import { booleanValue, normalizePhone, optionalString, positiveInteger, requiredString, safeSlug } from "./validation";

type OrderInput = {
  restaurantSlug?: unknown;
  clientOrderId?: unknown;
  source?: unknown;
  customer?: {
    name?: unknown;
    phone?: unknown;
    email?: unknown;
    whatsappConsent?: unknown;
    address?: unknown;
  };
  items?: Array<{ productId?: unknown; quantity?: unknown; notes?: unknown }>;
  paymentMethod?: unknown;
  notes?: unknown;
};

type RestaurantRow = {
  id: string;
  slug: string;
  name: string;
  is_open: number;
  timezone: string;
  settings_json: string;
  delivery_fee_cents: number;
  minimum_order_cents: number;
  average_prep_minutes: number;
  delivery_minutes: number;
  max_concurrent_orders: number;
};

type ProductRow = {
  id: string;
  name: string;
  price_cents: number;
  cost_cents: number;
  stock_control_enabled: number;
  stock_quantity: number | null;
};

export type CreatedOrder = {
  id: string;
  trackingToken: string;
  orderNumber: number;
  restaurantId: string;
  restaurantName: string;
  customerId: string;
  totalCents: number;
  subtotalCents: number;
  deliveryFeeCents: number;
  contributionMarginCents: number;
  paymentMethod: "pix" | "cash" | "card_on_delivery";
  promisedFromMinutes: number;
  promisedToMinutes: number;
  existing: boolean;
  customerEmail: string | null;
};

export async function createOrder(db: D1Database, input: OrderInput): Promise<CreatedOrder> {
  const slug = safeSlug(input.restaurantSlug);
  const clientOrderId = requiredString(input.clientOrderId, "Identificador do pedido", 8, 100);
  const customer = input.customer ?? {};
  const customerName = requiredString(customer.name, "Nome", 2, 80);
  const phone = normalizePhone(customer.phone);
  const email = optionalString(customer.email, "E-mail", 160);
  if (email && !/^\S+@\S+\.\S+$/.test(email)) {
    throw new HttpError(400, "E-mail inválido.", "validation_error", { field: "email" });
  }
  const address = validateAddress(customer.address);
  const whatsappConsent = booleanValue(customer.whatsappConsent);
  const notes = optionalString(input.notes, "Observações", 500);
  const source = validateSource(input.source);
  const paymentMethod = validatePaymentMethod(input.paymentMethod);

  if (!Array.isArray(input.items) || input.items.length < 1 || input.items.length > 30) {
    throw new HttpError(400, "Escolha de 1 a 30 itens.", "validation_error", { field: "items" });
  }

  const normalizedItems = input.items.map((item, index) => ({
    productId: requiredString(item.productId, `Produto ${index + 1}`, 2, 100),
    quantity: positiveInteger(item.quantity, `Quantidade do item ${index + 1}`, 20),
    notes: optionalString(item.notes, `Observação do item ${index + 1}`, 240),
  }));
  const compactItems = new Map<string, { productId: string; quantity: number; notes: string | null }>();
  for (const item of normalizedItems) {
    const current = compactItems.get(item.productId);
    const nextQuantity = (current?.quantity ?? 0) + item.quantity;
    if (nextQuantity > 20) {
      throw new HttpError(400, "Quantidade máxima por produto excedida.", "validation_error");
    }
    compactItems.set(item.productId, {
      productId: item.productId,
      quantity: nextQuantity,
      notes: [current?.notes, item.notes].filter(Boolean).join(" · ") || null,
    });
  }
  const items = Array.from(compactItems.values());

  const restaurant = await db
    .prepare(
      `SELECT id, slug, name, is_open, timezone, settings_json, delivery_fee_cents, minimum_order_cents,
              average_prep_minutes, delivery_minutes, max_concurrent_orders
       FROM restaurants WHERE slug = ? AND status IN ('trial', 'active') LIMIT 1`,
    )
    .bind(slug)
    .first<RestaurantRow>();
  if (!restaurant) throw new HttpError(404, "Loja não encontrada.", "store_not_found");
  if (!isRestaurantAcceptingOrders({
    isOpen: restaurant.is_open,
    timezone: restaurant.timezone,
    settingsJson: restaurant.settings_json,
  })) {
    throw new HttpError(409, "A loja está fechada agora.", "store_closed");
  }

  const existing = await findExistingOrder(db, restaurant, clientOrderId, email);
  if (existing) return existing;

  const placeholders = items.map(() => "?").join(", ");
  const result = await db
    .prepare(
      `SELECT id, name, price_cents, cost_cents, stock_control_enabled, stock_quantity
       FROM products
       WHERE restaurant_id = ? AND active = 1 AND available = 1 AND id IN (${placeholders})`,
    )
    .bind(restaurant.id, ...items.map((item) => item.productId))
    .all<ProductRow>();
  const products = new Map(result.results.map((product) => [product.id, product]));
  if (products.size !== items.length) {
    throw new HttpError(409, "Um dos produtos não está disponível.", "product_unavailable");
  }

  let subtotalCents = 0;
  let costCents = 0;
  for (const item of items) {
    const product = products.get(item.productId)!;
    if (
      product.stock_control_enabled &&
      (product.stock_quantity === null || product.stock_quantity < item.quantity)
    ) {
      throw new HttpError(409, `${product.name} esgotou.`, "insufficient_stock", {
        productId: product.id,
      });
    }
    subtotalCents += product.price_cents * item.quantity;
    costCents += product.cost_cents * item.quantity;
  }
  if (subtotalCents < restaurant.minimum_order_cents) {
    throw new HttpError(
      409,
      `Pedido mínimo de R$ ${(restaurant.minimum_order_cents / 100).toFixed(2).replace(".", ",")}.`,
      "minimum_order",
    );
  }

  const active = await db
    .prepare(
      `SELECT count(*) AS total FROM orders
       WHERE restaurant_id = ? AND status IN ('received', 'confirmed', 'preparing', 'ready')`,
    )
    .bind(restaurant.id)
    .first<{ total: number }>();
  const kitchenRounds = Math.floor((active?.total ?? 0) / Math.max(1, restaurant.max_concurrent_orders));
  const promisedFromMinutes =
    restaurant.average_prep_minutes * (1 + kitchenRounds) + restaurant.delivery_minutes;
  const promisedToMinutes = promisedFromMinutes + 8;

  const customerId = crypto.randomUUID();
  const customerRow = await db
    .prepare(
      `INSERT INTO customers
       (id, restaurant_id, name, phone, email, default_address_json, whatsapp_consent,
        consent_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(restaurant_id, phone) DO UPDATE SET
         name = excluded.name,
         email = COALESCE(excluded.email, customers.email),
         default_address_json = COALESCE(excluded.default_address_json, customers.default_address_json),
         whatsapp_consent = CASE WHEN excluded.whatsapp_consent = 1 THEN 1 ELSE customers.whatsapp_consent END,
         consent_at = CASE WHEN excluded.whatsapp_consent = 1 THEN excluded.consent_at ELSE customers.consent_at END,
         updated_at = excluded.updated_at
       RETURNING id`,
    )
    .bind(
      customerId,
      restaurant.id,
      customerName,
      phone,
      email,
      JSON.stringify(address),
      whatsappConsent ? 1 : 0,
      whatsappConsent ? Date.now() : null,
      Date.now(),
      Date.now(),
    )
    .first<{ id: string }>();
  if (!customerRow) throw new HttpError(500, "Não foi possível registrar o cliente.");

  const sequence = await db
    .prepare(
      `UPDATE restaurants SET next_order_number = next_order_number + 1, updated_at = ?
       WHERE id = ? RETURNING next_order_number`,
    )
    .bind(Date.now(), restaurant.id)
    .first<{ next_order_number: number }>();
  if (!sequence) throw new HttpError(500, "Não foi possível numerar o pedido.");

  const orderId = crypto.randomUUID();
  const trackingToken = `${crypto.randomUUID()}${crypto.randomUUID()}`.replaceAll("-", "");
  const deliveryFeeCents = restaurant.delivery_fee_cents;
  const totalCents = subtotalCents + deliveryFeeCents;
  const contributionMarginCents = subtotalCents - costCents;
  const timestamp = Date.now();
  const statements: D1PreparedStatement[] = [
    db
      .prepare(
        `INSERT INTO orders
         (id, restaurant_id, customer_id, order_number, client_order_id, tracking_token, source,
          status, payment_status, payment_method, subtotal_cents, delivery_fee_cents, total_cents,
          cost_cents, contribution_margin_cents, address_json, notes, promised_from_minutes,
          promised_to_minutes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'received', 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        orderId,
        restaurant.id,
        customerRow.id,
        sequence.next_order_number,
        clientOrderId,
        trackingToken,
        source,
        paymentMethod,
        subtotalCents,
        deliveryFeeCents,
        totalCents,
        costCents,
        contributionMarginCents,
        JSON.stringify(address),
        notes,
        promisedFromMinutes,
        promisedToMinutes,
        timestamp,
        timestamp,
      ),
    db
      .prepare(
        `UPDATE customers SET order_count = order_count + 1,
         lifetime_value_cents = lifetime_value_cents + ?, last_order_at = ?, updated_at = ?
         WHERE id = ?`,
      )
      .bind(totalCents, timestamp, timestamp, customerRow.id),
  ];

  for (const item of items) {
    const product = products.get(item.productId)!;
    statements.push(
      db
        .prepare(
          `INSERT INTO order_items
           (id, order_id, product_id, product_name, quantity, unit_price_cents, unit_cost_cents,
            notes, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          crypto.randomUUID(),
          orderId,
          product.id,
          product.name,
          item.quantity,
          product.price_cents,
          product.cost_cents,
          item.notes,
          timestamp,
        ),
    );
    if (product.stock_control_enabled) {
      statements.push(
        db
          .prepare(
            `UPDATE products SET stock_quantity = stock_quantity - ?, updated_at = ?
             WHERE id = ? AND stock_quantity >= ?`,
          )
          .bind(item.quantity, timestamp, product.id, item.quantity),
      );
    }
  }

  try {
    await db.batch(statements);
  } catch (error) {
    const raced = await findExistingOrder(db, restaurant, clientOrderId, email);
    if (raced) return raced;
    throw error;
  }

  try {
    await attributeAcceptedUpsells(
      db,
      restaurant.id,
      clientOrderId,
      orderId,
      items.map((item) => {
        const product = products.get(item.productId)!;
        return {
          productId: item.productId,
          quantity: item.quantity,
          priceCents: product.price_cents,
          costCents: product.cost_cents,
        };
      }),
    );
  } catch (error) {
    console.error("Profit attribution skipped", error instanceof Error ? error.message : "unknown");
  }

  return {
    id: orderId,
    trackingToken,
    orderNumber: sequence.next_order_number,
    restaurantId: restaurant.id,
    restaurantName: restaurant.name,
    customerId: customerRow.id,
    totalCents,
    subtotalCents,
    deliveryFeeCents,
    contributionMarginCents,
    paymentMethod,
    promisedFromMinutes,
    promisedToMinutes,
    existing: false,
    customerEmail: email,
  };
}

async function findExistingOrder(
  db: D1Database,
  restaurant: RestaurantRow,
  clientOrderId: string,
  email: string | null,
): Promise<CreatedOrder | null> {
  const row = await db
    .prepare(
      `SELECT id, customer_id, tracking_token, order_number, total_cents, subtotal_cents,
              delivery_fee_cents, contribution_margin_cents, payment_method,
              promised_from_minutes, promised_to_minutes
       FROM orders WHERE restaurant_id = ? AND client_order_id = ? LIMIT 1`,
    )
    .bind(restaurant.id, clientOrderId)
    .first<{
      id: string;
      customer_id: string;
      tracking_token: string;
      order_number: number;
      total_cents: number;
      subtotal_cents: number;
      delivery_fee_cents: number;
      contribution_margin_cents: number;
      payment_method: CreatedOrder["paymentMethod"];
      promised_from_minutes: number;
      promised_to_minutes: number;
    }>();
  if (!row) return null;
  return {
    id: row.id,
    trackingToken: row.tracking_token,
    orderNumber: row.order_number,
    restaurantId: restaurant.id,
    restaurantName: restaurant.name,
    customerId: row.customer_id,
    totalCents: row.total_cents,
    subtotalCents: row.subtotal_cents,
    deliveryFeeCents: row.delivery_fee_cents,
    contributionMarginCents: row.contribution_margin_cents,
    paymentMethod: row.payment_method,
    promisedFromMinutes: row.promised_from_minutes,
    promisedToMinutes: row.promised_to_minutes,
    existing: true,
    customerEmail: email,
  };
}

function validateAddress(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpError(400, "Endereço de entrega é obrigatório.", "validation_error", {
      field: "address",
    });
  }
  const address = value as Record<string, unknown>;
  return {
    street: requiredString(address.street, "Rua", 2, 120),
    number: requiredString(address.number, "Número", 1, 20),
    neighborhood: requiredString(address.neighborhood, "Bairro", 2, 80),
    city: requiredString(address.city, "Cidade", 2, 80),
    state: requiredString(address.state, "Estado", 2, 2).toUpperCase(),
    postalCode: requiredString(address.postalCode, "CEP", 8, 10).replace(/\D/g, ""),
    complement: optionalString(address.complement, "Complemento", 120),
  };
}

function validateSource(value: unknown): "menu" | "whatsapp" | "counter" | "link" | "admin" {
  const source = value ?? "menu";
  if (!["menu", "whatsapp", "counter", "link", "admin"].includes(String(source))) {
    throw new HttpError(400, "Canal de pedido inválido.", "validation_error");
  }
  return source as "menu" | "whatsapp" | "counter" | "link" | "admin";
}

function validatePaymentMethod(value: unknown): "pix" | "cash" | "card_on_delivery" {
  const method = value ?? "pix";
  if (!["pix", "cash", "card_on_delivery"].includes(String(method))) {
    throw new HttpError(400, "Forma de pagamento inválida.", "validation_error");
  }
  return method as "pix" | "cash" | "card_on_delivery";
}
