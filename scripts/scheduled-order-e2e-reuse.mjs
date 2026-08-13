import assert from "node:assert/strict";

const baseUrl = process.env.RAPIDEX_E2E_URL || "http://127.0.0.1:3000";
const origin = new URL(baseUrl).origin;
const slug = "hmg-burger-a";
const suffix = String(process.env.GITHUB_RUN_ID || Date.now()).replace(/\D/g, "").slice(-10) || String(Date.now()).slice(-10);

async function call(path, options = {}, expected = [200]) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const text = await response.text();
  let payload = null;
  try { payload = text ? JSON.parse(text) : null; } catch { payload = { raw: text }; }
  if (!expected.includes(response.status)) {
    throw new Error(`${options.method || "GET"} ${path} -> ${response.status}: ${text.slice(0, 1200)}`);
  }
  return { response, payload };
}

function headers(cookie) {
  return { "content-type": "application/json", origin, ...(cookie ? { cookie } : {}) };
}

function cookieFrom(response) {
  const raw = response.headers.get("set-cookie") || "";
  const match = raw.match(/(?:^|,\s*)([^=;,\s]+=[^;,]+)/);
  assert.ok(match, "login deve retornar sessão");
  return match[1];
}

const login = await call("/api/auth/login", {
  method: "POST",
  headers: headers(),
  body: JSON.stringify({ email: "owner-a@rapidex-hmg.test", password: "RapidexHmg12345" }),
}, [200]);
const cookie = cookieFrom(login.response);

const catalog = await call("/api/admin/products", { headers: { cookie } }, [200]);
const categoryId = catalog.payload.categories[0].id;
const createdProduct = await call("/api/admin/products", {
  method: "POST",
  headers: headers(cookie),
  body: JSON.stringify({
    categoryId,
    name: `Produto Agendado ${suffix}`,
    description: "Capacidade de slot e restauração de estoque",
    priceCents: 1800,
    costCents: 600,
    prepMinutes: 8,
    emoji: "🗓️",
  }),
}, [201]);
const productId = createdProduct.payload.id;
await call(`/api/admin/products/${encodeURIComponent(productId)}`, {
  method: "PATCH",
  headers: headers(cookie),
  body: JSON.stringify({ stockControlEnabled: true, stockQuantity: 20, minimumStock: 0 }),
}, [200]);

const slot = Math.ceil((Date.now() + 65 * 60_000) / (15 * 60_000)) * (15 * 60_000);
function body(index, scheduledFor = slot) {
  return {
    restaurantSlug: slug,
    clientOrderId: `scheduled-${suffix}-${String(index).padStart(2, "0")}`,
    source: "menu",
    fulfillmentType: "pickup",
    scheduledFor,
    customer: {
      name: `Cliente Agendado ${index}`,
      phone: `+55248${String(70000000 + index).padStart(8, "0")}`,
      email: `scheduled-${suffix}-${index}@rapidex-hmg.test`,
      whatsappConsent: false,
    },
    items: [{ productId, quantity: 1 }],
    paymentMethod: "card_on_delivery",
  };
}

console.log("[Scheduled E2E] antecedência mínima");
const tooSoon = await call("/api/public/scheduled-orders", {
  method: "POST", headers: headers(), body: JSON.stringify(body(90, Date.now() + 10 * 60_000)),
}, [409]);
assert.equal(tooSoon.payload.error?.code, "schedule_too_soon");

console.log("[Scheduled E2E] idempotência");
const first = await call("/api/public/scheduled-orders", {
  method: "POST", headers: headers(), body: JSON.stringify(body(1)),
}, [201]);
assert.equal(first.payload.order.scheduledFor, slot);
const duplicate = await call("/api/public/scheduled-orders", {
  method: "POST", headers: headers(), body: JSON.stringify(body(1)),
}, [200]);
assert.equal(duplicate.payload.order.id, first.payload.order.id);
assert.equal(duplicate.payload.order.existing, true);
const changed = await call("/api/public/scheduled-orders", {
  method: "POST", headers: headers(), body: JSON.stringify(body(1, slot + 15 * 60_000)),
}, [409]);
assert.equal(changed.payload.error?.code, "idempotency_conflict");

console.log("[Scheduled E2E] corrida de capacidade");
const remaining = await Promise.all(Array.from({ length: 12 }, (_, offset) => call(
  "/api/public/scheduled-orders",
  { method: "POST", headers: headers(), body: JSON.stringify(body(offset + 2)) },
  [201, 409],
)));
const successes = [first, ...remaining].filter((item) => item.response.status === 201);
const conflicts = remaining.filter((item) => item.response.status === 409);
assert.equal(successes.length, 12, "o slot padrão deve aceitar exatamente 12 reservas");
assert.equal(conflicts.length, 1, "a 13ª reserva concorrente deve ser recusada");
assert.equal(conflicts[0].payload.error?.code, "schedule_capacity_full");

console.log("[Scheduled E2E] cancelamento devolve estoque e capacidade");
const before = await call("/api/admin/products", { headers: { cookie } }, [200]);
assert.equal(before.payload.products.find((item) => item.id === productId).stockQuantity, 8);
await call(`/api/admin/orders/${encodeURIComponent(first.payload.order.id)}`, {
  method: "PATCH", headers: headers(cookie), body: JSON.stringify({ status: "canceled" }),
}, [200]);
const after = await call("/api/admin/products", { headers: { cookie } }, [200]);
assert.equal(after.payload.products.find((item) => item.id === productId).stockQuantity, 9);
const replacement = await call("/api/public/scheduled-orders", {
  method: "POST", headers: headers(), body: JSON.stringify(body(99)),
}, [201]);
assert.equal(replacement.payload.order.scheduledFor, slot);
const finalCatalog = await call("/api/admin/products", { headers: { cookie } }, [200]);
assert.equal(finalCatalog.payload.products.find((item) => item.id === productId).stockQuantity, 8);

console.log("[Scheduled E2E] PASS: antecedência, idempotência, capacidade concorrente, cancelamento e estoque");
