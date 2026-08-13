import { resolveDeliveryTerms } from "./delivery-zones";
import { HttpError } from "./http";
import { attributeAcceptedUpsells } from "./profit-engine";
import { isRestaurantAcceptingOrders } from "./store-availability";
import { booleanValue, normalizePhone, optionalString, positiveInteger, requiredString, safeSlug } from "./validation";

export type FulfillmentType = "delivery" | "pickup" | "dine_in";
type PricingStrategy = "sum" | "highest" | "average" | "included";

type OrderInput = {
  restaurantSlug?: unknown;
  clientOrderId?: unknown;
  source?: unknown;
  fulfillmentType?: unknown;
  tableCode?: unknown;
  customer?: {
    name?: unknown;
    phone?: unknown;
    email?: unknown;
    whatsappConsent?: unknown;
    address?: unknown;
  };
  items?: Array<{ productId?: unknown; quantity?: unknown; notes?: unknown; optionIds?: unknown }>;
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

type OptionGroupRow = {
  id: string;
  product_id: string;
  name: string;
  min_select: number;
  max_select: number;
  pricing_strategy: PricingStrategy;
};

type ProductOptionRow = {
  id: string;
  group_id: string;
  product_id: string;
  name: string;
  price_delta_cents: number;
  cost_delta_cents: number;
};

type NormalizedItem = {
  productId: string;
  quantity: number;
  notes: string | null;
  optionIds: string[];
};

type SelectedOptionSnapshot = {
  groupId: string;
  groupName: string;
  optionId: string;
  optionName: string;
  rawPriceDeltaCents: number;
  costDeltaCents: number;
  chargedDeltaCents: number;
  pricingStrategy: PricingStrategy;
};

type PricedItem = NormalizedItem & {
  product: ProductRow;
  unitPriceCents: number;
  unitCostCents: number;
  selectedOptions: SelectedOptionSnapshot[];
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
  deliveryZoneName: string | null;
  contributionMarginCents: number;
  paymentMethod: "pix" | "cash" | "card_on_delivery";
  fulfillmentType: FulfillmentType;
  tableCode: string | null;
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
  const fulfillmentType = validateFulfillmentType(input.fulfillmentType);
  const address = fulfillmentType === "delivery" ? validateAddress(customer.address) : null;
  const tableCode = fulfillmentType === "dine_in"
    ? requiredString(input.tableCode, "Mesa", 1, 30)
    : null;
  const whatsappConsent = booleanValue(customer.whatsappConsent);
  const notes = optionalString(input.notes, "Observações", 500);
  const source = validateSource(input.source);
  const paymentMethod = validatePaymentMethod(input.paymentMethod);

  if (!Array.isArray(input.items) || input.items.length < 1 || input.items.length > 30) {
    throw new HttpError(400, "Escolha de 1 a 30 itens.", "validation_error", { field: "items" });
  }

  const normalizedItems = input.items.map((item, index): NormalizedItem => ({
    productId: requiredString(item.productId, `Produto ${index + 1}`, 2, 100),
    quantity: positiveInteger(item.quantity, `Quantidade do item ${index + 1}`, 20),
    notes: optionalString(item.notes, `Observação do item ${index + 1}`, 240),
    optionIds: normalizeOptionIds(item.optionIds, index),
  }));
  const compactItems = new Map<string, NormalizedItem>();
  for (const item of normalizedItems) {
    const key = `${item.productId}|${item.optionIds.join(",")}|${item.notes || ""}`;
    const current = compactItems.get(key);
    const nextQuantity = (current?.quantity ?? 0) + item.quantity;
    if (nextQuantity > 20) {
      throw new HttpError(400, "Quantidade máxima por configuração de produto excedida.", "validation_error");
    }
    compactItems.set(key, { ...item, quantity: nextQuantity });
  }
  const items = Array.from(compactItems.values());

  const now = Date.now();
  const restaurant = await db
    .prepare(
      `SELECT id, slug, name, is_open, timezone, settings_json, delivery_fee_cents, minimum_order_cents,
              average_prep_minutes, delivery_minutes, max_concurrent_orders
       FROM restaurants WHERE slug = ? AND (
         (status = 'active' AND (access_ends_at IS NULL OR access_ends_at > ?))
         OR (status = 'trial' AND (trial_ends_at IS NULL OR trial_ends_at > ?))
       ) LIMIT 1`,
    )
    .bind(slug, now, now)
    .first<RestaurantRow>();
  if (!restaurant) throw new HttpError(403, "Esta loja está temporariamente indisponível para novos pedidos.", "store_subscription_inactive");
  if (!isRestaurantAcceptingOrders({
    isOpen: restaurant.is_open,
    timezone: restaurant.timezone,
    settingsJson: restaurant.settings_json,
    now,
  })) {
    throw new HttpError(409, "A loja está fechada agora.", "store_closed");
  }

  const existing = await findExistingOrder(db, restaurant, clientOrderId, email);
  if (existing) return existing;

  const productIds = Array.from(new Set(items.map((item) => item.productId)));
  const placeholders = productIds.map(() => "?").join(", ");
  const [productResult, groupResult, optionResult] = await Promise.all([
    db.prepare(
      `SELECT id, name, price_cents, cost_cents, stock_control_enabled, stock_quantity
       FROM products
       WHERE restaurant_id = ? AND active = 1 AND available = 1 AND id IN (${placeholders})`,
    ).bind(restaurant.id, ...productIds).all<ProductRow>(),
    db.prepare(
      `SELECT id, product_id, name, min_select, max_select, pricing_strategy
       FROM product_option_groups
       WHERE restaurant_id = ? AND active = 1 AND product_id IN (${placeholders})
       ORDER BY position, created_at`,
    ).bind(restaurant.id, ...productIds).all<OptionGroupRow>(),
    db.prepare(
      `SELECT po.id, po.group_id, pog.product_id, po.name, po.price_delta_cents, po.cost_delta_cents
       FROM product_options po
       JOIN product_option_groups pog ON pog.id = po.group_id
       WHERE po.restaurant_id = ? AND po.available = 1 AND pog.active = 1
         AND pog.product_id IN (${placeholders})
       ORDER BY pog.position, po.position`,
    ).bind(restaurant.id, ...productIds).all<ProductOptionRow>(),
  ]);
  const products = new Map(productResult.results.map((product) => [product.id, product]));
  if (products.size !== productIds.length) {
    throw new HttpError(409, "Um dos produtos não está disponível.", "product_unavailable");
  }
  const optionGroups = groupResult.results;
  const optionsById = new Map(optionResult.results.map((option) => [option.id, option]));

  let subtotalCents = 0;
  let costCents = 0;
  const pricedItems: PricedItem[] = [];
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
    const priced = priceItemOptions(item, product, optionGroups, optionsById);
    subtotalCents += priced.unitPriceCents * item.quantity;
    costCents += priced.unitCostCents * item.quantity;
    pricedItems.push(priced);
  }

  const deliveryTerms = fulfillmentType === "delivery" && address
    ? await resolveDeliveryTerms(db, {
        restaurantId: restaurant.id,
        settingsValue: restaurant.settings_json,
        address: { neighborhood: address.neighborhood, postalCode: address.postalCode },
        defaultFeeCents: Number(restaurant.delivery_fee_cents),
        defaultMinimumOrderCents: Number(restaurant.minimum_order_cents),
      })
    : null;
  const effectiveMinimumOrderCents = deliveryTerms?.minimumOrderCents ?? 0;
  if (fulfillmentType === "delivery" && subtotalCents < effectiveMinimumOrderCents) {
    throw new HttpError(
      409,
      `Pedido mínimo de R$ ${(effectiveMinimumOrderCents / 100).toFixed(2).replace(".", ",")} para esta entrega.`,
      "minimum_order",
      { zoneName: deliveryTerms?.zoneName || null, minimumOrderCents: effectiveMinimumOrderCents },
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
  const logisticsMinutes = fulfillmentType === "delivery"
    ? restaurant.delivery_minutes + (deliveryTerms?.extraMinutes ?? 0)
    : 0;
  const promisedFromMinutes = restaurant.average_prep_minutes * (1 + kitchenRounds) + logisticsMinutes;
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
      address ? JSON.stringify(address) : null,
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
  const deliveryFeeCents = fulfillmentType === "delivery" ? (deliveryTerms?.feeCents ?? 0) : 0;
  const totalCents = subtotalCents + deliveryFeeCents;
  const contributionMarginCents = subtotalCents - costCents;
  const timestamp = Date.now();
  const statements: D1PreparedStatement[] = [
    db
      .prepare(
        `INSERT INTO orders
         (id, restaurant_id, customer_id, order_number, client_order_id, tracking_token, source,
          fulfillment_type, table_code, delivery_zone_id, delivery_zone_name, status, payment_status,
          payment_method, subtotal_cents, delivery_fee_cents, total_cents, cost_cents,
          contribution_margin_cents, address_json, notes, promised_from_minutes, promised_to_minutes,
          created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'received', 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        orderId,
        restaurant.id,
        customerRow.id,
        sequence.next_order_number,
        clientOrderId,
        trackingToken,
        source,
        fulfillmentType,
        tableCode,
        deliveryTerms?.zoneId ?? null,
        deliveryTerms?.zoneName ?? null,
        paymentMethod,
        subtotalCents,
        deliveryFeeCents,
        totalCents,
        costCents,
        contributionMarginCents,
        address ? JSON.stringify(address) : null,
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

  for (const item of pricedItems) {
    const orderItemId = crypto.randomUUID();
    statements.push(
      db
        .prepare(
          `INSERT INTO order_items
           (id, order_id, product_id, product_name, quantity, unit_price_cents, unit_cost_cents,
            notes, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          orderItemId,
          orderId,
          item.product.id,
          item.product.name,
          item.quantity,
          item.unitPriceCents,
          item.unitCostCents,
          item.notes,
          timestamp,
        ),
    );
    for (const option of item.selectedOptions) {
      statements.push(
        db.prepare(
          `INSERT INTO order_item_options
           (id, order_item_id, option_group_id, option_id, option_group_name, option_name,
            price_delta_cents, cost_delta_cents, pricing_strategy, charged_delta_cents, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).bind(
          crypto.randomUUID(),
          orderItemId,
          option.groupId,
          option.optionId,
          option.groupName,
          option.optionName,
          option.rawPriceDeltaCents,
          option.costDeltaCents,
          option.pricingStrategy,
          option.chargedDeltaCents,
          timestamp,
        ),
      );
    }
    if (item.product.stock_control_enabled) {
      statements.push(
        db
          .prepare(
            `UPDATE products SET stock_quantity = stock_quantity - ?, updated_at = ?
             WHERE id = ? AND stock_quantity >= ?`,
          )
          .bind(item.quantity, timestamp, item.product.id, item.quantity),
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
      pricedItems.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        priceCents: item.unitPriceCents,
        costCents: item.unitCostCents,
      })),
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
    deliveryZoneName: deliveryTerms?.zoneName ?? null,
    contributionMarginCents,
    paymentMethod,
    fulfillmentType,
    tableCode,
    promisedFromMinutes,
    promisedToMinutes,
    existing: false,
    customerEmail: email,
  };
}

function priceItemOptions(
  item: NormalizedItem,
  product: ProductRow,
  groups: OptionGroupRow[],
  optionsById: Map<string, ProductOptionRow>,
): PricedItem {
  const productGroups = groups.filter((group) => group.product_id === product.id);
  const selectedRows: ProductOptionRow[] = [];
  for (const optionId of item.optionIds) {
    const option = optionsById.get(optionId);
    if (!option || option.product_id !== product.id) {
      throw new HttpError(409, `${product.name}: uma opção selecionada não está mais disponível.`, "option_unavailable", {
        productId: product.id,
        optionId,
      });
    }
    selectedRows.push(option);
  }

  let optionPriceCents = 0;
  let optionCostCents = 0;
  const selectedOptions: SelectedOptionSnapshot[] = [];
  for (const group of productGroups) {
    const selected = selectedRows.filter((option) => option.group_id === group.id);
    if (selected.length < Number(group.min_select) || selected.length > Number(group.max_select)) {
      throw new HttpError(
        409,
        `${product.name}: escolha de ${group.min_select} a ${group.max_select} opção(ões) em “${group.name}”.`,
        "option_selection_invalid",
        { productId: product.id, groupId: group.id, min: group.min_select, max: group.max_select },
      );
    }
    const groupPrice = calculateGroupCharge(selected.map((option) => Number(option.price_delta_cents)), group.pricing_strategy);
    optionPriceCents += groupPrice;
    optionCostCents += selected.reduce((sum, option) => sum + Number(option.cost_delta_cents), 0);
    selected.forEach((option, index) => selectedOptions.push({
      groupId: group.id,
      groupName: group.name,
      optionId: option.id,
      optionName: option.name,
      rawPriceDeltaCents: Number(option.price_delta_cents),
      costDeltaCents: Number(option.cost_delta_cents),
      chargedDeltaCents: index === 0 ? groupPrice : 0,
      pricingStrategy: group.pricing_strategy,
    }));
  }

  if (selectedRows.length !== selectedOptions.length) {
    throw new HttpError(409, `${product.name}: configuração de opções inválida.`, "option_selection_invalid");
  }
  return {
    ...item,
    product,
    unitPriceCents: product.price_cents + optionPriceCents,
    unitCostCents: product.cost_cents + optionCostCents,
    selectedOptions,
  };
}

function calculateGroupCharge(values: number[], strategy: PricingStrategy) {
  if (!values.length || strategy === "included") return 0;
  if (strategy === "highest") return Math.max(...values);
  if (strategy === "average") return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
  return values.reduce((sum, value) => sum + value, 0);
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
              delivery_fee_cents, delivery_zone_name, contribution_margin_cents, payment_method,
              fulfillment_type, table_code, promised_from_minutes, promised_to_minutes
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
      delivery_zone_name: string | null;
      contribution_margin_cents: number;
      payment_method: CreatedOrder["paymentMethod"];
      fulfillment_type: FulfillmentType;
      table_code: string | null;
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
    deliveryZoneName: row.delivery_zone_name,
    contributionMarginCents: row.contribution_margin_cents,
    paymentMethod: row.payment_method,
    fulfillmentType: row.fulfillment_type || "delivery",
    tableCode: row.table_code,
    promisedFromMinutes: row.promised_from_minutes,
    promisedToMinutes: row.promised_to_minutes,
    existing: true,
    customerEmail: email,
  };
}

function normalizeOptionIds(value: unknown, itemIndex: number) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > 50) {
    throw new HttpError(400, `Opções do item ${itemIndex + 1} inválidas.`, "validation_error");
  }
  const ids = value.map((optionId, optionIndex) => requiredString(optionId, `Opção ${optionIndex + 1}`, 2, 100));
  return Array.from(new Set(ids)).sort();
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

function validateFulfillmentType(value: unknown): FulfillmentType {
  const type = value ?? "delivery";
  if (!["delivery", "pickup", "dine_in"].includes(String(type))) {
    throw new HttpError(400, "Tipo de atendimento inválido.", "validation_error", {
      field: "fulfillmentType",
    });
  }
  return type as FulfillmentType;
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
