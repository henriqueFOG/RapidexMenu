import { sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const now = sql`(unixepoch() * 1000)`;

export const restaurants = sqliteTable(
  "restaurants",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    legalName: text("legal_name"),
    ownerEmail: text("owner_email").notNull(),
    plan: text("plan", { enum: ["start", "growth", "scale"] })
      .notNull()
      .default("growth"),
    status: text("status", { enum: ["trial", "active", "paused", "canceled"] })
      .notNull()
      .default("trial"),
    phone: text("phone"),
    whatsapp: text("whatsapp"),
    city: text("city"),
    state: text("state"),
    timezone: text("timezone").notNull().default("America/Sao_Paulo"),
    currency: text("currency").notNull().default("BRL"),
    deliveryFeeCents: integer("delivery_fee_cents").notNull().default(690),
    minimumOrderCents: integer("minimum_order_cents").notNull().default(2000),
    averagePrepMinutes: integer("average_prep_minutes").notNull().default(18),
    deliveryMinutes: integer("delivery_minutes").notNull().default(24),
    maxConcurrentOrders: integer("max_concurrent_orders").notNull().default(12),
    nextOrderNumber: integer("next_order_number").notNull().default(1280),
    isOpen: integer("is_open", { mode: "boolean" }).notNull().default(true),
    platformBlockedAt: integer("platform_blocked_at", { mode: "timestamp_ms" }),
    platformBlockReason: text("platform_block_reason"),
    platformPreviousStatus: text("platform_previous_status"),
    settingsJson: text("settings_json").notNull().default("{}"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(now),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(now),
  },
  (table) => [
    uniqueIndex("restaurants_slug_unique").on(table.slug),
    index("restaurants_owner_email_idx").on(table.ownerEmail),
  ],
);

export const members = sqliteTable(
  "members",
  {
    id: text("id").primaryKey(),
    restaurantId: text("restaurant_id")
      .notNull()
      .references(() => restaurants.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    name: text("name"),
    role: text("role", { enum: ["owner", "manager", "operator", "finance"] })
      .notNull()
      .default("operator"),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(now),
  },
  (table) => [
    uniqueIndex("members_restaurant_email_unique").on(table.restaurantId, table.email),
    index("members_email_idx").on(table.email),
  ],
);

export const categories = sqliteTable(
  "categories",
  {
    id: text("id").primaryKey(),
    restaurantId: text("restaurant_id")
      .notNull()
      .references(() => restaurants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    position: integer("position").notNull().default(0),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(now),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(now),
  },
  (table) => [
    index("categories_restaurant_position_idx").on(table.restaurantId, table.position),
  ],
);

export const products = sqliteTable(
  "products",
  {
    id: text("id").primaryKey(),
    restaurantId: text("restaurant_id")
      .notNull()
      .references(() => restaurants.id, { onDelete: "cascade" }),
    categoryId: text("category_id").references(() => categories.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    priceCents: integer("price_cents").notNull(),
    costCents: integer("cost_cents").notNull().default(0),
    emoji: text("emoji").notNull().default("🍽️"),
    tag: text("tag"),
    imageKey: text("image_key"),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    available: integer("available", { mode: "boolean" }).notNull().default(true),
    stockControlEnabled: integer("stock_control_enabled", { mode: "boolean" })
      .notNull()
      .default(false),
    stockQuantity: integer("stock_quantity"),
    minimumStock: integer("minimum_stock"),
    prepMinutes: integer("prep_minutes").notNull().default(10),
    position: integer("position").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(now),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(now),
  },
  (table) => [
    index("products_restaurant_active_idx").on(table.restaurantId, table.active, table.available),
    index("products_category_position_idx").on(table.categoryId, table.position),
  ],
);

export const customers = sqliteTable(
  "customers",
  {
    id: text("id").primaryKey(),
    restaurantId: text("restaurant_id")
      .notNull()
      .references(() => restaurants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    phone: text("phone").notNull(),
    email: text("email"),
    defaultAddressJson: text("default_address_json"),
    orderCount: integer("order_count").notNull().default(0),
    lifetimeValueCents: integer("lifetime_value_cents").notNull().default(0),
    lastOrderAt: integer("last_order_at", { mode: "timestamp_ms" }),
    whatsappConsent: integer("whatsapp_consent", { mode: "boolean" }).notNull().default(false),
    consentAt: integer("consent_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(now),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(now),
  },
  (table) => [
    uniqueIndex("customers_restaurant_phone_unique").on(table.restaurantId, table.phone),
    index("customers_restaurant_last_order_idx").on(table.restaurantId, table.lastOrderAt),
  ],
);

export const customerPreferences = sqliteTable(
  "customer_preferences",
  {
    id: text("id").primaryKey(),
    customerId: text("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["ingredient", "product", "delivery", "payment", "note"] })
      .notNull(),
    value: text("value").notNull(),
    confidence: integer("confidence").notNull().default(100),
    source: text("source").notNull().default("order"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(now),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(now),
  },
  (table) => [
    uniqueIndex("customer_preferences_unique").on(table.customerId, table.kind, table.value),
  ],
);

export const orders = sqliteTable(
  "orders",
  {
    id: text("id").primaryKey(),
    restaurantId: text("restaurant_id")
      .notNull()
      .references(() => restaurants.id, { onDelete: "cascade" }),
    customerId: text("customer_id").references(() => customers.id, { onDelete: "set null" }),
    orderNumber: integer("order_number").notNull(),
    clientOrderId: text("client_order_id").notNull(),
    trackingToken: text("tracking_token").notNull(),
    source: text("source", { enum: ["menu", "whatsapp", "counter", "link", "admin"] })
      .notNull()
      .default("menu"),
    status: text("status", {
      enum: ["received", "confirmed", "preparing", "ready", "out_for_delivery", "delivered", "canceled"],
    })
      .notNull()
      .default("received"),
    paymentStatus: text("payment_status", {
      enum: ["pending", "authorized", "paid", "failed", "refunded", "canceled"],
    })
      .notNull()
      .default("pending"),
    paymentMethod: text("payment_method", { enum: ["pix", "cash", "card_on_delivery"] })
      .notNull()
      .default("pix"),
    subtotalCents: integer("subtotal_cents").notNull(),
    deliveryFeeCents: integer("delivery_fee_cents").notNull().default(0),
    discountCents: integer("discount_cents").notNull().default(0),
    totalCents: integer("total_cents").notNull(),
    costCents: integer("cost_cents").notNull().default(0),
    contributionMarginCents: integer("contribution_margin_cents").notNull().default(0),
    addressJson: text("address_json"),
    notes: text("notes"),
    promisedFromMinutes: integer("promised_from_minutes"),
    promisedToMinutes: integer("promised_to_minutes"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(now),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(now),
    confirmedAt: integer("confirmed_at", { mode: "timestamp_ms" }),
    deliveredAt: integer("delivered_at", { mode: "timestamp_ms" }),
    canceledAt: integer("canceled_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    uniqueIndex("orders_restaurant_number_unique").on(table.restaurantId, table.orderNumber),
    uniqueIndex("orders_restaurant_client_id_unique").on(table.restaurantId, table.clientOrderId),
    uniqueIndex("orders_tracking_token_unique").on(table.trackingToken),
    index("orders_restaurant_status_created_idx").on(table.restaurantId, table.status, table.createdAt),
    index("orders_customer_created_idx").on(table.customerId, table.createdAt),
  ],
);

export const orderItems = sqliteTable(
  "order_items",
  {
    id: text("id").primaryKey(),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    productId: text("product_id").references(() => products.id, { onDelete: "set null" }),
    productName: text("product_name").notNull(),
    quantity: integer("quantity").notNull(),
    unitPriceCents: integer("unit_price_cents").notNull(),
    unitCostCents: integer("unit_cost_cents").notNull().default(0),
    notes: text("notes"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(now),
  },
  (table) => [index("order_items_order_idx").on(table.orderId)],
);

export const payments = sqliteTable(
  "payments",
  {
    id: text("id").primaryKey(),
    restaurantId: text("restaurant_id")
      .notNull()
      .references(() => restaurants.id, { onDelete: "cascade" }),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    provider: text("provider").notNull().default("mercado_pago"),
    providerPaymentId: text("provider_payment_id"),
    idempotencyKey: text("idempotency_key").notNull(),
    status: text("status").notNull().default("pending"),
    amountCents: integer("amount_cents").notNull(),
    pixCode: text("pix_code"),
    ticketUrl: text("ticket_url"),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }),
    providerDataJson: text("provider_data_json").notNull().default("{}"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(now),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(now),
  },
  (table) => [
    uniqueIndex("payments_idempotency_unique").on(table.idempotencyKey),
    uniqueIndex("payments_provider_id_unique").on(table.provider, table.providerPaymentId),
    index("payments_order_idx").on(table.orderId),
  ],
);

export const conversations = sqliteTable(
  "conversations",
  {
    id: text("id").primaryKey(),
    restaurantId: text("restaurant_id")
      .notNull()
      .references(() => restaurants.id, { onDelete: "cascade" }),
    customerId: text("customer_id").references(() => customers.id, { onDelete: "set null" }),
    channel: text("channel").notNull().default("whatsapp"),
    externalContactId: text("external_contact_id").notNull(),
    status: text("status", { enum: ["bot", "human", "closed"] }).notNull().default("bot"),
    lastMessageAt: integer("last_message_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(now),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(now),
  },
  (table) => [
    uniqueIndex("conversations_contact_unique").on(
      table.restaurantId,
      table.channel,
      table.externalContactId,
    ),
  ],
);

export const messages = sqliteTable(
  "messages",
  {
    id: text("id").primaryKey(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    providerMessageId: text("provider_message_id"),
    direction: text("direction", { enum: ["inbound", "outbound"] }).notNull(),
    type: text("type", { enum: ["text", "audio", "image", "interactive", "system"] })
      .notNull()
      .default("text"),
    body: text("body"),
    status: text("status").notNull().default("received"),
    metadataJson: text("metadata_json").notNull().default("{}"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(now),
  },
  (table) => [
    uniqueIndex("messages_provider_id_unique").on(table.providerMessageId),
    index("messages_conversation_created_idx").on(table.conversationId, table.createdAt),
  ],
);

export const automationEvents = sqliteTable(
  "automation_events",
  {
    id: text("id").primaryKey(),
    restaurantId: text("restaurant_id")
      .notNull()
      .references(() => restaurants.id, { onDelete: "cascade" }),
    customerId: text("customer_id").references(() => customers.id, { onDelete: "set null" }),
    orderId: text("order_id").references(() => orders.id, { onDelete: "set null" }),
    kind: text("kind").notNull(),
    status: text("status", { enum: ["draft", "approved", "sent", "converted", "failed"] })
      .notNull()
      .default("draft"),
    reason: text("reason"),
    expectedRevenueCents: integer("expected_revenue_cents").notNull().default(0),
    recoveredRevenueCents: integer("recovered_revenue_cents").notNull().default(0),
    marginPercent: integer("margin_percent"),
    metadataJson: text("metadata_json").notNull().default("{}"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(now),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(now),
  },
  (table) => [index("automation_restaurant_status_idx").on(table.restaurantId, table.status)],
);

export const webhookEvents = sqliteTable(
  "webhook_events",
  {
    id: text("id").primaryKey(),
    provider: text("provider").notNull(),
    providerEventId: text("provider_event_id").notNull(),
    eventType: text("event_type").notNull(),
    signatureValid: integer("signature_valid", { mode: "boolean" }).notNull().default(false),
    status: text("status", { enum: ["received", "processed", "ignored", "failed"] })
      .notNull()
      .default("received"),
    payloadHash: text("payload_hash").notNull(),
    error: text("error"),
    receivedAt: integer("received_at", { mode: "timestamp_ms" }).notNull().default(now),
    processedAt: integer("processed_at", { mode: "timestamp_ms" }),
  },
  (table) => [uniqueIndex("webhook_provider_event_unique").on(table.provider, table.providerEventId)],
);

export const rateLimitBuckets = sqliteTable(
  "rate_limit_buckets",
  {
    key: text("key").primaryKey(),
    count: integer("count").notNull().default(1),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(now),
  },
  (table) => [index("rate_limits_expires_idx").on(table.expiresAt)],
);

export const leads = sqliteTable(
  "leads",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    restaurantName: text("restaurant_name").notNull(),
    whatsapp: text("whatsapp").notNull(),
    monthlyOrdersRange: text("monthly_orders_range"),
    source: text("source").notNull().default("landing"),
    status: text("status", { enum: ["new", "contacted", "trial", "won", "lost"] })
      .notNull()
      .default("new"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(now),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(now),
  },
  (table) => [index("leads_status_created_idx").on(table.status, table.createdAt)],
);

export const subscriptions = sqliteTable(
  "subscriptions",
  {
    id: text("id").primaryKey(),
    restaurantId: text("restaurant_id")
      .notNull()
      .references(() => restaurants.id, { onDelete: "cascade" }),
    plan: text("plan").notNull(),
    status: text("status").notNull().default("trialing"),
    provider: text("provider"),
    providerCustomerId: text("provider_customer_id"),
    providerSubscriptionId: text("provider_subscription_id"),
    trialEndsAt: integer("trial_ends_at", { mode: "timestamp_ms" }),
    currentPeriodEndsAt: integer("current_period_ends_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(now),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(now),
  },
  (table) => [uniqueIndex("subscriptions_restaurant_unique").on(table.restaurantId)],
);

export const integrations = sqliteTable(
  "integrations",
  {
    id: text("id").primaryKey(),
    restaurantId: text("restaurant_id")
      .notNull()
      .references(() => restaurants.id, { onDelete: "cascade" }),
    provider: text("provider", { enum: ["whatsapp", "mercado_pago", "openai"] }).notNull(),
    status: text("status", { enum: ["pending", "connected", "error", "disabled"] })
      .notNull()
      .default("pending"),
    externalAccountId: text("external_account_id"),
    externalPhoneId: text("external_phone_id"),
    secretRef: text("secret_ref"),
    settingsJson: text("settings_json").notNull().default("{}"),
    lastError: text("last_error"),
    connectedAt: integer("connected_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(now),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(now),
  },
  (table) => [
    uniqueIndex("integrations_restaurant_provider_unique").on(table.restaurantId, table.provider),
    index("integrations_phone_idx").on(table.provider, table.externalPhoneId),
  ],
);

export const auditLogs = sqliteTable(
  "audit_logs",
  {
    id: text("id").primaryKey(),
    restaurantId: text("restaurant_id").references(() => restaurants.id, { onDelete: "set null" }),
    actorEmail: text("actor_email").notNull(),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    metadataJson: text("metadata_json").notNull().default("{}"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(now),
  },
  (table) => [index("audit_restaurant_created_idx").on(table.restaurantId, table.createdAt)],
);
