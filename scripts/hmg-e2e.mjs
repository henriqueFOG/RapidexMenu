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

function formHeaders(cookie) {
  return { origin, ...(cookie ? { cookie } : {}) };
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
        phone: `+55249999900${suffix === "a" ? "01" : "02"}`,
        whatsapp: `+55249999900${suffix === "a" ? "01" : "02"}`,
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

async function updateProduct(cookie, productId, body, expectedStatuses = [200]) {
  return call(
    `/api/admin/products/${encodeURIComponent(productId)}`,
    { method: "PATCH", headers: jsonHeaders(cookie), body: JSON.stringify(body) },
    expectedStatuses,
  );
}

async function createPublicOrder({ slug, productId, clientOrderId, name, email, phone }) {
  return call(
    "/api/public/orders",
    {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({
        restaurantSlug: slug,
        clientOrderId,
        source: "menu",
        customer: {
          name,
          phone,
          email,
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
      }),
    },
    [201],
  );
}

const alwaysOpenHours = {
  sun: [{ open: "00:00", close: "00:00" }],
  mon: [{ open: "00:00", close: "00:00" }],
  tue: [{ open: "00:00", close: "00:00" }],
  wed: [{ open: "00:00", close: "00:00" }],
  thu: [{ open: "00:00", close: "00:00" }],
  fri: [{ open: "00:00", close: "00:00" }],
  sat: [{ open: "00:00", close: "00:00" }],
};

console.log("[HMG E2E] health");
{
  const { payload } = await call("/api/health", {}, [200]);
  assert.equal(payload.ok, true);
  assert.equal(payload.integrations?.environment, "hmg");
  assert.equal(payload.integrations?.database, true);
  assert.equal(payload.integrations?.databaseEngine, "postgres");
  assert.equal(payload.integrations?.uploads, true, "piloto deve aceitar fotos sem credencial externa");
  assert.equal(payload.integrations?.uploadStorage, "database");
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

console.log("[HMG E2E] upload de foto persistente");
const tinyPng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z4xQAAAAASUVORK5CYII=", "base64");
const uploadForm = new FormData();
uploadForm.set("file", new Blob([tinyPng], { type: "image/png" }), "burger-hmg.png");
const uploaded = await call(
  "/api/admin/uploads",
  { method: "POST", headers: formHeaders(tenantA.cookie), body: uploadForm },
  [201],
);
assert.equal(uploaded.payload.ok, true);
assert.match(uploaded.payload.key, /^public\/restaurants\/.+\/products\/.+\.png$/);
await updateProduct(tenantA.cookie, burgerId, { imageKey: uploaded.payload.key }, [200]);
const mediaResponse = await fetch(`${baseUrl}${uploaded.payload.url}`);
assert.equal(mediaResponse.status, 200);
assert.equal(mediaResponse.headers.get("content-type"), "image/png");
assert.deepEqual(Buffer.from(await mediaResponse.arrayBuffer()), tinyPng);

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
assert.equal(catalogAfterImport.payload.products.find((product) => product.id === burgerId)?.imageKey, uploaded.payload.key);

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
assert.equal(publicProducts.find((product) => product.id === burgerId)?.imageUrl, uploaded.payload.url);
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

console.log("[HMG E2E] tenant B + isolamento forte");
const tenantB = await signup({ suffix: "b", slug: "hmg-burger-b", restaurantName: "HMG Burger B" });
const tenantBCatalogInitial = await call("/api/admin/products", { headers: { cookie: tenantB.cookie } }, [200]);
assert.equal(tenantBCatalogInitial.payload.products.length, 0, "tenant B não pode enxergar produtos do tenant A");
const categoryBId = tenantBCatalogInitial.payload.categories[0].id;
const bProductId = await createProduct(tenantB.cookie, categoryBId, {
  name: "Pizza Tenant B",
  description: "Produto exclusivo do tenant B",
  priceCents: 3900,
  costCents: 1400,
  emoji: "🍕",
  prepMinutes: 15,
});
await call(
  "/api/admin/settings",
  { method: "PATCH", headers: jsonHeaders(tenantB.cookie), body: JSON.stringify({ weeklyHours: alwaysOpenHours }) },
  [200],
);
await call("/api/admin/onboarding", { method: "PATCH", headers: jsonHeaders(tenantB.cookie), body: "{}" }, [200]);

const tenantAProducts = await call("/api/admin/products", { headers: { cookie: tenantA.cookie } }, [200]);
const tenantBProducts = await call("/api/admin/products", { headers: { cookie: tenantB.cookie } }, [200]);
assert.equal(tenantAProducts.payload.products.some((product) => product.id === bProductId), false);
assert.equal(tenantBProducts.payload.products.some((product) => product.id === burgerId), false);

const crossProductPatch = await updateProduct(tenantA.cookie, bProductId, { available: false }, [404]);
assert.equal(crossProductPatch.payload.error?.code, "product_not_found");
const crossProductDelete = await call(
  `/api/admin/products/${encodeURIComponent(bProductId)}`,
  { method: "DELETE", headers: formHeaders(tenantA.cookie) },
  [404],
);
assert.equal(crossProductDelete.payload.error?.code, "product_not_found");

const crossImageAttach = await updateProduct(tenantB.cookie, bProductId, { imageKey: uploaded.payload.key }, [400]);
assert.equal(crossImageAttach.payload.error?.code, "validation_error", "tenant B não pode anexar foto do tenant A");

const bOrder = await createPublicOrder({
  slug: "hmg-burger-b",
  productId: bProductId,
  clientOrderId: "hmg-e2e-order-b-0001",
  name: "Cliente Tenant B",
  email: "cliente-b@rapidex-hmg.test",
  phone: "+5524977770002",
});
const bOrderId = bOrder.payload.order.id;

const tenantBOrders = await call("/api/admin/orders", { headers: { cookie: tenantB.cookie } }, [200]);
assert.equal(tenantBOrders.payload.orders.some((order) => order.id === orderId), false, "tenant B não pode enxergar pedidos do tenant A");
assert.equal(tenantBOrders.payload.orders.some((order) => order.id === bOrderId), true);
const tenantAOrders = await call("/api/admin/orders", { headers: { cookie: tenantA.cookie } }, [200]);
assert.equal(tenantAOrders.payload.orders.some((order) => order.id === bOrderId), false, "tenant A não pode enxergar pedidos do tenant B");

const crossTenantMutation = await changeStatus(tenantB.cookie, orderId, "canceled", [404]);
assert.equal(crossTenantMutation.payload.error?.code, "order_not_found");
const reverseCrossTenantMutation = await changeStatus(tenantA.cookie, bOrderId, "confirmed", [404]);
assert.equal(reverseCrossTenantMutation.payload.error?.code, "order_not_found");

const customersA = await call("/api/admin/customers", { headers: { cookie: tenantA.cookie } }, [200]);
const customersB = await call("/api/admin/customers", { headers: { cookie: tenantB.cookie } }, [200]);
assert.equal(JSON.stringify(customersA.payload).includes("Cliente Tenant B"), false, "tenant A não pode enxergar cliente do tenant B");
assert.equal(JSON.stringify(customersB.payload).includes("Cliente HMG"), false, "tenant B não pode enxergar cliente do tenant A");
assert.equal(JSON.stringify(customersA.payload).includes("Cliente HMG"), true);
assert.equal(JSON.stringify(customersB.payload).includes("Cliente Tenant B"), true);

console.log("[HMG E2E] PASS: signup, upload de foto, importação, horários, catálogo, pedido, tracking, ROI, status e isolamento multiempresa forte");
