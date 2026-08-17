import assert from "node:assert/strict";

const baseUrl = process.env.RAPIDEX_E2E_URL || "http://127.0.0.1:3000";
const origin = new URL(baseUrl).origin;

async function call(path, options = {}, expectedStatuses = [200]) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const text = await response.text();
  let payload = null;
  try { payload = text ? JSON.parse(text) : null; } catch { payload = { raw: text }; }
  if (!expectedStatuses.includes(response.status)) {
    throw new Error(`${options.method || "GET"} ${path} -> ${response.status}: ${text.slice(0, 1200)}`);
  }
  return { response, payload };
}

function jsonHeaders(cookie) {
  return {
    "content-type": "application/json",
    origin,
    ...(cookie ? { cookie } : {}),
  };
}

function sessionCookie(response) {
  const raw = response.headers.get("set-cookie") || "";
  const match = raw.match(/(?:^|,\s*)([^=;,\s]+=[^;,]+)/);
  assert.ok(match, "signup deve retornar cookie de sessão");
  return match[1];
}

async function signup({ suffix, slug, restaurantName }) {
  const { response, payload } = await call(
    "/api/auth/signup",
    {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({
        ownerName: `Owner ${suffix}`,
        email: `owner-${suffix}@rapidex-hmg.test`,
        password: "RapidexHmg12345",
        phone: "+5524999990001",
        whatsapp: "+5524999990001",
        restaurantName,
        slug,
        city: "Petrópolis",
        state: "RJ",
        plan: "start",
        termsAccepted: true,
        privacyAccepted: true,
      }),
    },
    [201],
  );
  assert.equal(payload.ok, true);
  assert.equal(payload.restaurant.slug, slug);
  assert.equal(payload.legal?.termsVersion, "2026-08-07");
  assert.equal(payload.legal?.privacyVersion, "2026-08-07");
  return { cookie: sessionCookie(response), restaurant: payload.restaurant };
}

async function createProduct(cookie, categoryId, body) {
  const { payload } = await call(
    "/api/admin/products",
    {
      method: "POST",
      headers: jsonHeaders(cookie),
      body: JSON.stringify({ categoryId, ...body }),
    },
    [201],
  );
  assert.equal(payload.ok, true);
  return payload.id;
}

async function patchProduct(cookie, productId, body) {
  return call(
    `/api/admin/products/${encodeURIComponent(productId)}`,
    {
      method: "PATCH",
      headers: jsonHeaders(cookie),
      body: JSON.stringify(body),
    },
    [200],
  );
}

async function changeStatus(cookie, orderId, status, expectedStatus, expectedStatuses = [200]) {
  return call(
    `/api/admin/orders/${encodeURIComponent(orderId)}`,
    {
      method: "PATCH",
      headers: jsonHeaders(cookie),
      body: JSON.stringify({ status, expectedStatus }),
    },
    expectedStatuses,
  );
}

function deliveryAddress(overrides = {}) {
  return {
    street: "Rua do Teste",
    number: "10",
    neighborhood: "Centro",
    city: "Petrópolis",
    state: "RJ",
    postalCode: "25600000",
    complement: "E2E",
    ...overrides,
  };
}

function orderPayload({ clientOrderId, productId, phone, name = "Cliente HMG", quantity = 1, fulfillmentType = "delivery", tableCode = null, optionIds = [] }) {
  return {
    restaurantSlug: "hmg-burger-a",
    clientOrderId,
    source: "menu",
    fulfillmentType,
    tableCode,
    customer: {
      name,
      phone,
      email: `${clientOrderId}@rapidex-hmg.test`,
      whatsappConsent: false,
      ...(fulfillmentType === "delivery" ? { address: deliveryAddress() } : {}),
    },
    items: [{ productId, quantity, optionIds, priceCents: 1 }],
    paymentMethod: "cash",
  };
}

console.log("[HMG E2E] health");
{
  const { payload } = await call("/api/health", {}, [200]);
  assert.equal(payload.ok, true);
  assert.equal(payload.integrations?.environment, "hmg");
  assert.equal(payload.integrations?.database, true);
  assert.equal(payload.integrations?.databaseEngine, "postgres");
}

console.log("[HMG E2E] tenant A signup + catálogo");
const tenantA = await signup({ suffix: "a", slug: "hmg-burger-a", restaurantName: "HMG Burger A" });
const initialCatalog = await call("/api/admin/products", { headers: { cookie: tenantA.cookie } }, [200]);
assert.equal(initialCatalog.payload.products.length, 0);
assert.ok(initialCatalog.payload.categories.length >= 1);
const categoryId = initialCatalog.payload.categories[0].id;

const burgerId = await createProduct(tenantA.cookie, categoryId, {
  name: "Burger HMG",
  description: "Produto principal do E2E",
  priceCents: 2500,
  costCents: 1000,
  emoji: "🍔",
  prepMinutes: 12,
});
const friesId = await createProduct(tenantA.cookie, categoryId, {
  name: "Batata HMG",
  description: "Upsell do E2E",
  priceCents: 1200,
  costCents: 300,
  emoji: "🍟",
  prepMinutes: 5,
});

console.log("[HMG E2E] importação de cardápio + horários + modalidades");
const imported = await call(
  "/api/admin/menu-import",
  {
    method: "POST",
    headers: jsonHeaders(tenantA.cookie),
    body: JSON.stringify({
      rows: [
        {
          category: "Extras",
          name: "Molho HMG",
          description: "Item importado pelo fluxo comercial E2E",
          priceCents: 300,
          costCents: 250,
          prepMinutes: 1,
          emoji: "🥫",
          tag: "Importado",
        },
      ],
    }),
  },
  [201],
);
assert.equal(imported.payload.ok, true);
assert.equal(imported.payload.productsCreated, 1);
assert.equal(imported.payload.rows, 1);

const alwaysOpenHours = {
  sun: [{ open: "00:00", close: "00:00" }],
  mon: [{ open: "00:00", close: "00:00" }],
  tue: [{ open: "00:00", close: "00:00" }],
  wed: [{ open: "00:00", close: "00:00" }],
  thu: [{ open: "00:00", close: "00:00" }],
  fri: [{ open: "00:00", close: "00:00" }],
  sat: [{ open: "00:00", close: "00:00" }],
};
await call(
  "/api/admin/settings",
  {
    method: "PATCH",
    headers: jsonHeaders(tenantA.cookie),
    body: JSON.stringify({
      weeklyHours: alwaysOpenHours,
      fulfillment: { deliveryEnabled: true, pickupEnabled: true, dineInEnabled: true },
    }),
  },
  [200],
);
const settings = await call("/api/admin/settings", { headers: { cookie: tenantA.cookie } }, [200]);
assert.deepEqual(settings.payload.settings.weeklyHours, alwaysOpenHours);
assert.equal(settings.payload.settings.fulfillment.pickupEnabled, true);
assert.equal(settings.payload.settings.fulfillment.dineInEnabled, true);

const catalogAfterImport = await call("/api/admin/products", { headers: { cookie: tenantA.cookie } }, [200]);
assert.equal(catalogAfterImport.payload.products.length, 3);
assert.ok(catalogAfterImport.payload.products.some((product) => product.name === "Molho HMG" && product.priceCents === 300));

await call(
  "/api/admin/onboarding",
  { method: "PATCH", headers: jsonHeaders(tenantA.cookie), body: "{}" },
  [200],
);

console.log("[HMG E2E] cardápio público + recomendação");
const menu = await call("/api/public/menu/hmg-burger-a", {}, [200]);
assert.equal(menu.payload.restaurant.isOpen, true);
assert.equal(menu.payload.restaurant.fulfillment.pickupEnabled, true);
assert.equal(menu.payload.restaurant.fulfillment.dineInEnabled, true);
const publicProducts = [...menu.payload.categories.flatMap((category) => category.products), ...(menu.payload.uncategorized || [])];
assert.equal(publicProducts.length, 3);
assert.ok(publicProducts.some((product) => product.id === burgerId && product.priceCents === 2500));
assert.ok(publicProducts.some((product) => product.name === "Molho HMG" && product.priceCents === 300));

const clientOrderId = "hmg-e2e-order-0001";
const recommendation = await call(
  "/api/public/recommendations",
  {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify({
      restaurantSlug: "hmg-burger-a",
      clientOrderId,
      productIds: [burgerId],
    }),
  },
  [200],
);
assert.equal(recommendation.payload.ok, true);
assert.ok(recommendation.payload.recommendations.some((item) => item.id === friesId), "Profit Engine deve sugerir a batata");

console.log("[HMG E2E] pedido + proteção de preço + idempotência");
const orderBody = {
  restaurantSlug: "hmg-burger-a",
  clientOrderId,
  source: "menu",
  fulfillmentType: "delivery",
  customer: {
    name: "Cliente HMG",
    phone: "+5524988880001",
    email: "cliente@rapidex-hmg.test",
    whatsappConsent: false,
    address: deliveryAddress(),
  },
  items: [
    { productId: burgerId, quantity: 1, priceCents: 1 },
    { productId: friesId, quantity: 1, priceCents: 1 },
  ],
  paymentMethod: "cash",
};
const created = await call(
  "/api/public/orders",
  { method: "POST", headers: jsonHeaders(), body: JSON.stringify(orderBody) },
  [201],
);
assert.equal(created.payload.order.subtotalCents, 3700, "servidor deve ignorar preço adulterado pelo cliente");
assert.equal(created.payload.order.deliveryFeeCents, 0, "nova loja não deve cobrar frete arbitrário antes da configuração");
assert.equal(created.payload.order.existing, false);
const orderId = created.payload.order.id;
const trackingToken = created.payload.order.trackingToken;

const duplicate = await call(
  "/api/public/orders",
  { method: "POST", headers: jsonHeaders(), body: JSON.stringify(orderBody) },
  [200],
);
assert.equal(duplicate.payload.order.id, orderId);
assert.equal(duplicate.payload.order.existing, true);

console.log("[HMG E2E] modificadores: obrigatório, preço server-side e snapshot");
const configuredOptions = await call(
  `/api/admin/products/${encodeURIComponent(burgerId)}/options`,
  {
    method: "PUT",
    headers: jsonHeaders(tenantA.cookie),
    body: JSON.stringify({
      groups: [
        {
          name: "Tamanho",
          minSelect: 1,
          maxSelect: 1,
          pricingStrategy: "sum",
          options: [
            { name: "Normal", priceDeltaCents: 0, costDeltaCents: 0, available: true },
            { name: "Grande", priceDeltaCents: 800, costDeltaCents: 300, available: true },
          ],
        },
      ],
    }),
  },
  [200],
);
const sizeGroup = configuredOptions.payload.groups[0];
const largeOption = sizeGroup.options.find((option) => option.name === "Grande");
assert.ok(largeOption?.id, "opção Grande deve receber ID server-side");

const missingRequiredOption = await call(
  "/api/public/orders",
  {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify(orderPayload({
      clientOrderId: "hmg-option-required",
      productId: burgerId,
      phone: "+5524955550001",
      fulfillmentType: "pickup",
    })),
  },
  [409],
);
assert.equal(missingRequiredOption.payload.error?.code, "option_selection_invalid");

const pickupConfigured = await call(
  "/api/public/orders",
  {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify(orderPayload({
      clientOrderId: "hmg-pickup-configured",
      productId: burgerId,
      phone: "+5524955550002",
      fulfillmentType: "pickup",
      optionIds: [largeOption.id],
    })),
  },
  [201],
);
assert.equal(pickupConfigured.payload.order.fulfillmentType, "pickup");
assert.equal(pickupConfigured.payload.order.deliveryFeeCents, 0);
assert.equal(pickupConfigured.payload.order.subtotalCents, 3300, "servidor deve cobrar preço base + opção, ignorando preço do cliente");
const pickupTracking = await call(`/api/public/orders/${pickupConfigured.payload.order.trackingToken}`, {}, [200]);
assert.equal(pickupTracking.payload.order.items[0].options[0].name, "Grande");
assert.equal(pickupTracking.payload.order.items[0].options[0].chargedDeltaCents, 800);

console.log("[HMG E2E] mesa: pedido sem endereço e sem frete");
const dineIn = await call(
  "/api/public/orders",
  {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify(orderPayload({
      clientOrderId: "hmg-dine-in",
      productId: friesId,
      phone: "+5524955550003",
      fulfillmentType: "dine_in",
      tableCode: "12",
    })),
  },
  [201],
);
assert.equal(dineIn.payload.order.fulfillmentType, "dine_in");
assert.equal(dineIn.payload.order.tableCode, "12");
assert.equal(dineIn.payload.order.deliveryFeeCents, 0);
assert.equal(dineIn.payload.order.subtotalCents, 1200);

console.log("[HMG E2E] zonas de entrega: cotação, bloqueio e snapshot");
await call(
  "/api/admin/delivery-zones",
  {
    method: "PUT",
    headers: jsonHeaders(tenantA.cookie),
    body: JSON.stringify({
      restrictToZones: true,
      zones: [
        {
          name: "Centro CEP",
          matchType: "postal_prefix",
          matchValue: "25600",
          feeCents: 900,
          minimumOrderCents: 3000,
          extraMinutes: 10,
          active: true,
        },
      ],
    }),
  },
  [200],
);
const quote = await call(
  "/api/public/delivery-quote",
  {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify({ restaurantSlug: "hmg-burger-a", postalCode: "25600000", neighborhood: "Centro" }),
  },
  [200],
);
assert.equal(quote.payload.quote.zoneName, "Centro CEP");
assert.equal(quote.payload.quote.feeCents, 900);
assert.equal(quote.payload.quote.minimumOrderCents, 3000);

const outsideQuote = await call(
  "/api/public/delivery-quote",
  {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify({ restaurantSlug: "hmg-burger-a", postalCode: "20000000", neighborhood: "Outro" }),
  },
  [409],
);
assert.equal(outsideQuote.payload.error?.code, "delivery_outside_area");

const zonedOrder = await call(
  "/api/public/orders",
  {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify(orderPayload({
      clientOrderId: "hmg-zoned-delivery",
      productId: friesId,
      quantity: 3,
      phone: "+5524955550004",
      fulfillmentType: "delivery",
    })),
  },
  [201],
);
assert.equal(zonedOrder.payload.order.subtotalCents, 3600);
assert.equal(zonedOrder.payload.order.deliveryFeeCents, 900);
assert.equal(zonedOrder.payload.order.totalCents, 4500);
assert.equal(zonedOrder.payload.order.deliveryZoneName, "Centro CEP");

console.log("[HMG E2E] concorrência de estoque: a última unidade só pode gerar um pedido");
const lastUnitId = await createProduct(tenantA.cookie, categoryId, {
  name: "Última Unidade HMG",
  description: "Produto usado para validar lock transacional de estoque",
  priceCents: 3100,
  costCents: 700,
  emoji: "🔒",
  prepMinutes: 3,
});
await patchProduct(tenantA.cookie, lastUnitId, { stockControlEnabled: true, stockQuantity: 1, minimumStock: 0 });
const stockRace = await Promise.all([
  call(
    "/api/public/orders",
    { method: "POST", headers: jsonHeaders(), body: JSON.stringify(orderPayload({ clientOrderId: "hmg-stock-race-a", productId: lastUnitId, phone: "+5524977770001", name: "Race Estoque A" })) },
    [201, 409],
  ),
  call(
    "/api/public/orders",
    { method: "POST", headers: jsonHeaders(), body: JSON.stringify(orderPayload({ clientOrderId: "hmg-stock-race-b", productId: lastUnitId, phone: "+5524977770002", name: "Race Estoque B" })) },
    [201, 409],
  ),
]);
const stockStatuses = stockRace.map((result) => result.response.status).sort((a, b) => a - b);
assert.deepEqual(stockStatuses, [201, 409], `uma transação deve vencer e a concorrente deve receber conflito de estoque; recebidos=${JSON.stringify(stockRace.map((item) => ({ status: item.response.status, code: item.payload?.error?.code })))}`);
const stockConflict = stockRace.find((result) => result.response.status === 409);
assert.equal(stockConflict?.payload.error?.code, "insufficient_stock");
assert.ok(stockRace.some((result) => result.payload?.order?.id), "uma compra da última unidade deve ser criada");

console.log("[HMG E2E] tracking + Profit Engine");
const tracking = await call(`/api/public/orders/${trackingToken}`, {}, [200]);
assert.equal(tracking.payload.order.status, "received");
assert.equal(tracking.payload.order.totalCents, created.payload.order.totalCents);
assert.equal(JSON.stringify(tracking.payload).includes("Rua do Teste"), false, "tracking público não deve expor endereço");

const profit = await call("/api/admin/profit", { headers: { cookie: tenantA.cookie } }, [200]);
assert.ok(profit.payload.profitEngine.shown >= 1);
assert.ok(profit.payload.profitEngine.accepted >= 1);
assert.ok(profit.payload.profitEngine.addedRevenueCents >= 1200);

console.log("[HMG E2E] status + transição inválida");
await changeStatus(tenantA.cookie, orderId, "confirmed", "received", [200]);
const invalidTransition = await changeStatus(tenantA.cookie, orderId, "delivered", "confirmed", [409]);
assert.equal(invalidTransition.payload.error?.code, "invalid_status_transition");
await changeStatus(tenantA.cookie, orderId, "preparing", "confirmed", [200]);
await changeStatus(tenantA.cookie, orderId, "ready", "preparing", [200]);
await changeStatus(tenantA.cookie, orderId, "delivered", "ready", [200]);
const deliveredTracking = await call(`/api/public/orders/${trackingToken}`, {}, [200]);
assert.equal(deliveredTracking.payload.order.status, "delivered");

console.log("[HMG E2E] concorrência de status: compare-and-set impede sobrescrita silenciosa");
const statusRaceCreated = await call(
  "/api/public/orders",
  {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify(orderPayload({
      clientOrderId: "hmg-status-race-0001",
      productId: friesId,
      quantity: 3,
      phone: "+5524966660001",
      name: "Race Status",
    })),
  },
  [201],
);
const statusRaceId = statusRaceCreated.payload.order.id;
const statusRace = await Promise.all([
  changeStatus(tenantA.cookie, statusRaceId, "confirmed", "received", [200, 409]),
  changeStatus(tenantA.cookie, statusRaceId, "canceled", "received", [200, 409]),
]);
assert.equal(statusRace.filter((result) => result.response.status === 200).length, 1, "somente uma transição concorrente pode vencer");
const conflict = statusRace.find((result) => result.response.status === 409);
assert.equal(conflict?.payload.error?.code, "order_state_conflict");

console.log("[HMG E2E] tenant B isolation");
const tenantB = await signup({ suffix: "b", slug: "hmg-burger-b", restaurantName: "HMG Burger B" });
const tenantBOrders = await call("/api/admin/orders", { headers: { cookie: tenantB.cookie } }, [200]);
assert.equal(tenantBOrders.payload.orders.length, 0, "tenant B não pode enxergar pedidos do tenant A");
const crossTenantMutation = await changeStatus(tenantB.cookie, orderId, "canceled", "delivered", [404]);
assert.equal(crossTenantMutation.payload.error?.code, "order_not_found");

console.log("[HMG E2E] PASS: signup, legal versionado, importação, modalidades, modificadores, zonas, pedido, idempotência, concorrência de estoque, tracking, ROI, status concorrente e isolamento multiempresa");
