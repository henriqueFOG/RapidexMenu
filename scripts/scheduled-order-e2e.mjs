import assert from "node:assert/strict";

const baseUrl = process.env.RAPIDEX_E2E_URL || "http://127.0.0.1:3000";
const origin = new URL(baseUrl).origin;
const suffix = String(process.env.GITHUB_RUN_ID || Date.now()).replace(/\D/g, "").slice(-10) || String(Date.now()).slice(-10);
const slug = `schedule-e2e-${suffix}`;

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
  assert.ok(match, "signup deve retornar sessão");
  return match[1];
}

const signup = await call("/api/auth/signup", {
  method: "POST",
  headers: headers(),
  body: JSON.stringify({
    ownerName: "Schedule E2E",
    email: `schedule-${suffix}@rapidex-hmg.test`,
    password: "RapidexHmg12345",
    phone: "+5524999980001",
    whatsapp: "+5524999980001",
    restaurantName: `Schedule E2E ${suffix}`,
    slug,
    city: "Petrópolis",
    state: "RJ",
    plan: "start",
    termsAccepted: true,
    privacyAccepted: true,
  }),
}, [201]);
const cookie = cookieFrom(signup.response);

const alwaysOpen = {
  sun: [{ open: "00:00", close: "00:00" }],
  mon: [{ open: "00:00", close: "00:00" }],
  tue: [{ open: "00:00", close: "00:00" }],
  wed: [{ open: "00:00", close: "00:00" }],
  thu: [{ open: "00:00", close: "00:00" }],
  fri: [{ open: "00:00", close: "00:00" }],
  sat: [{ open: "00:00", close: "00:00" }],
};
await call("/api/admin/settings", {
  method: "PATCH",
  headers: headers(cookie),
  body: JSON.stringify({
    weeklyHours: alwaysOpen,
    fulfillment: { deliveryEnabled: true, pickupEnabled: true, dineInEnabled: true },
  }),
}, [200]);

const catalog = await call("/api/admin/products", { headers: { cookie } }, [200]);
const categoryId = catalog.payload.categories[0].id;
const createdProduct = await call("/api/admin/products", {
  method: "POST",
  headers: headers(cookie),
  body: JSON.stringify({
    categoryId,
    name: "Produto Agendado E2E",
    description: "Valida capacidade e restauração de estoque",
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
function scheduledBody(index, scheduledFor = slot) {
  return {
    restaurantSlug: slug,
    clientOrderId: `scheduled-${suffix}-${String(index).padStart(2, "0")}`,
    source: "menu",
    fulfillmentType: "pickup",
    scheduledFor,
    customer: {
      name: `Cliente ${index}`,
      phone: `+55249${String(70000000 + index).padStart(8, "0")}`,
      email: `scheduled-${suffix}-${index}@rapidex-hmg.test`,
      whatsappConsent: false,
    },
    items: [{ productId, quantity: 1 }],
    paymentMethod: "card_on_delivery",
  };
}

console.log("[Scheduled E2E] lead time");
const tooSoon = await call("/api/public/scheduled-orders", {
  method: "POST", headers: headers(), body: JSON.stringify(scheduledBody(90, Date.now() + 10 * 60_000)),
}, [409]);
assert.equal(tooSoon.payload.error?.code, "schedule_too_soon");

console.log("[Scheduled E2E] target opening hours");
const closedHours = { sun: [], mon: [], tue: [], wed: [], thu: [], fri: [], sat: [] };
await call("/api/admin/settings", {
  method: "PATCH", headers: headers(cookie), body: JSON.stringify({ weeklyHours: closedHours }),
}, [200]);
const closedTarget = await call("/api/public/scheduled-orders", {
  method: "POST", headers: headers(), body: JSON.stringify(scheduledBody(91)),
}, [409]);
assert.equal(closedTarget.payload.error?.code, "scheduled_store_closed");
await call("/api/admin/settings", {
  method: "PATCH", headers: headers(cookie), body: JSON.stringify({ weeklyHours: alwaysOpen }),
}, [200]);

console.log("[Scheduled E2E] idempotency");
const first = await call("/api/public/scheduled-orders", {
  method: "POST", headers: headers(), body: JSON.stringify(scheduledBody(1)),
}, [201]);
assert.equal(first.payload.order.scheduledFor, slot);
const duplicate = await call("/api/public/scheduled-orders", {
  method: "POST", headers: headers(), body: JSON.stringify(scheduledBody(1)),
}, [200]);
assert.equal(duplicate.payload.order.id, first.payload.order.id);
assert.equal(duplicate.payload.order.existing, true);
const changedSchedule = await call("/api/public/scheduled-orders", {
  method: "POST", headers: headers(), body: JSON.stringify(scheduledBody(1, slot + 15 * 60_000)),
}, [409]);
assert.equal(changedSchedule.payload.error?.code, "idempotency_conflict");

console.log("[Scheduled E2E] capacity race");
const remaining = await Promise.all(Array.from({ length: 12 }, (_, offset) => call(
  "/api/public/scheduled-orders",
  { method: "POST", headers: headers(), body: JSON.stringify(scheduledBody(offset + 2)) },
  [201, 409],
)));
const successes = [first, ...remaining].filter((item) => item.response.status === 201);
const conflicts = remaining.filter((item) => item.response.status === 409);
assert.equal(successes.length, 12, "capacidade padrão de 12 deve aceitar exatamente 12 pedidos no slot");
assert.equal(conflicts.length, 1, "13º pedido concorrendo pelo mesmo slot deve ser bloqueado");
assert.equal(conflicts[0].payload.error?.code, "schedule_capacity_full");

console.log("[Scheduled E2E] cancel restores stock and frees slot");
const beforeCancel = await call("/api/admin/products", { headers: { cookie } }, [200]);
const beforeProduct = beforeCancel.payload.products.find((item) => item.id === productId);
assert.equal(beforeProduct.stockQuantity, 8, "12 pedidos válidos devem reservar 12 unidades");

await call(`/api/admin/orders/${encodeURIComponent(first.payload.order.id)}`, {
  method: "PATCH", headers: headers(cookie), body: JSON.stringify({ status: "canceled" }),
}, [200]);
const afterCancel = await call("/api/admin/products", { headers: { cookie } }, [200]);
const afterProduct = afterCancel.payload.products.find((item) => item.id === productId);
assert.equal(afterProduct.stockQuantity, 9, "cancelamento deve devolver exatamente uma unidade");

const replacement = await call("/api/public/scheduled-orders", {
  method: "POST", headers: headers(), body: JSON.stringify(scheduledBody(99)),
}, [201]);
assert.equal(replacement.payload.order.scheduledFor, slot);
const finalCatalog = await call("/api/admin/products", { headers: { cookie } }, [200]);
const finalProduct = finalCatalog.payload.products.find((item) => item.id === productId);
assert.equal(finalProduct.stockQuantity, 8, "novo pedido deve ocupar a capacidade e reservar a unidade devolvida");

console.log("[Scheduled E2E] PASS: janela, horário, idempotência, capacidade, cancelamento e estoque");
