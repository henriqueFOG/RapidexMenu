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

async function changeStatus(cookie, orderId, status, expectedStatuses = [200]) {
  return call(
    `/api/admin/orders/${encodeURIComponent(orderId)}`,
    {
      method: "PATCH",
      headers: jsonHeaders(cookie),
      body: JSON.stringify({ status }),
    },
    expectedStatuses,
  );
}

function orderPayload({ clientOrderId, productId, phone, name = "Cliente HMG" }) {
  return {
    restaurantSlug: "hmg-burger-a",
    clientOrderId,
    source: "menu",
    customer: {
      name,
      phone,
      email: `${clientOrderId}@rapidex-hmg.test`,
      whatsappConsent: false,
      address: {
        street: "Rua do Teste",
        number: "10",
        neighborhood: "Centro",
        city: "Petrópolis",
        state: "RJ",
        postalCode: "25600000",
        complement: "E2E",
      },
    },
    items: [{ productId, quantity: 1, priceCents: 1 }],
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

console.log("[HMG E2E] importação de cardápio + horários");
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
    body: JSON.stringify({ weeklyHours: alwaysOpenHours }),
  },
  [200],
);
const settings = await call("/api/admin/settings", { headers: { cookie: tenantA.cookie } }, [200]);
assert.deepEqual(settings.payload.settings.weeklyHours, alwaysOpenHours);

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
  customer: {
    name: "Cliente HMG",
    phone: "+5524988880001",
    email: "cliente@rapidex-hmg.test",
    whatsappConsent: false,
    address: {
      street: "Rua do Teste",
      number: "10",
      neighborhood: "Centro",
      city: "Petrópolis",
      state: "RJ",
      postalCode: "25600000",
      complement: "E2E",
    },
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

console.log("[HMG E2E] concorrência de estoque: a última unidade só pode gerar um pedido");
const lastUnitId = await createProduct(tenantA.cookie, categoryId, {
  name: "Última Unidade HMG",
  description: "Produto usado para validar lock transacional de estoque",
  priceCents: 1900,
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
assert.deepEqual(stockStatuses, [201, 409], "uma transação deve vencer e a concorrente deve receber conflito de estoque");
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
await changeStatus(tenantA.cookie, orderId, "confirmed", [200]);
const invalidTransition = await changeStatus(tenantA.cookie, orderId, "delivered", [409]);
assert.equal(invalidTransition.payload.error?.code, "invalid_status_transition");
await changeStatus(tenantA.cookie, orderId, "preparing", [200]);
await changeStatus(tenantA.cookie, orderId, "ready", [200]);
await changeStatus(tenantA.cookie, orderId, "delivered", [200]);
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
      phone: "+5524966660001",
      name: "Race Status",
    })),
  },
  [201],
);
const statusRaceId = statusRaceCreated.payload.order.id;
const statusRace = await Promise.all([
  changeStatus(tenantA.cookie, statusRaceId, "confirmed", [200, 409]),
  changeStatus(tenantA.cookie, statusRaceId, "canceled", [200, 409]),
]);
assert.equal(statusRace.filter((result) => result.response.status === 200).length, 1, "somente uma transição concorrente pode vencer");
const conflict = statusRace.find((result) => result.response.status === 409);
assert.equal(conflict?.payload.error?.code, "order_state_conflict");

console.log("[HMG E2E] tenant B isolation");
const tenantB = await signup({ suffix: "b", slug: "hmg-burger-b", restaurantName: "HMG Burger B" });
const tenantBOrders = await call("/api/admin/orders", { headers: { cookie: tenantB.cookie } }, [200]);
assert.equal(tenantBOrders.payload.orders.length, 0, "tenant B não pode enxergar pedidos do tenant A");
const crossTenantMutation = await changeStatus(tenantB.cookie, orderId, "canceled", [404]);
assert.equal(crossTenantMutation.payload.error?.code, "order_not_found");

console.log("[HMG E2E] PASS: signup, aceite legal versionado, importação, horários, catálogo, recomendação, pedido, idempotência, concorrência de estoque, tracking, ROI, status concorrente e isolamento multiempresa");
