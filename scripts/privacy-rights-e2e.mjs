import assert from "node:assert/strict";

const baseUrl = process.env.RAPIDEX_E2E_URL || "http://127.0.0.1:3000";
const origin = new URL(baseUrl).origin;
const suffix = String(process.env.GITHUB_RUN_ID || Date.now()).replace(/\D/g, "").slice(-10) || String(Date.now()).slice(-10);
const slug = `privacy-e2e-${suffix}`;

async function call(path, options = {}, expected = [200]) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const text = await response.text();
  let payload = {};
  try { payload = text ? JSON.parse(text) : {}; } catch { payload = { raw: text }; }
  assert.ok(expected.includes(response.status), `${options.method || "GET"} ${path} -> ${response.status}: ${text.slice(0, 1200)}`);
  return { response, payload };
}
function headers(cookie, ip = "198.51.100.89") {
  return { "content-type": "application/json", origin, "x-forwarded-for": ip, ...(cookie ? { cookie } : {}) };
}
function cookieFrom(response) {
  const match = (response.headers.get("set-cookie") || "").match(/(?:^|,\s*)([^=;,\s]+=[^;,]+)/);
  assert.ok(match, "sessão deve ser criada");
  return match[1];
}

const signup = await call("/api/auth/signup", {
  method: "POST",
  headers: headers(),
  body: JSON.stringify({
    ownerName: "Privacy E2E",
    email: `privacy-${suffix}@rapidex-hmg.test`,
    password: "RapidexPrivacy12345",
    phone: "+5524999900001",
    whatsapp: "+5524999900001",
    restaurantName: `Privacy E2E ${suffix}`,
    slug,
    city: "Petrópolis",
    state: "RJ",
    plan: "start",
    termsAccepted: true,
    privacyAccepted: true,
  }),
}, [201]);
const cookie = cookieFrom(signup.response);

await call("/api/admin/settings", {
  method: "PATCH",
  headers: headers(cookie),
  body: JSON.stringify({
    isOpen: true,
    fulfillment: { deliveryEnabled: true, pickupEnabled: true, dineInEnabled: true },
    weeklyHours: {
      sun: [{ open: "00:00", close: "00:00" }], mon: [{ open: "00:00", close: "00:00" }],
      tue: [{ open: "00:00", close: "00:00" }], wed: [{ open: "00:00", close: "00:00" }],
      thu: [{ open: "00:00", close: "00:00" }], fri: [{ open: "00:00", close: "00:00" }],
      sat: [{ open: "00:00", close: "00:00" }],
    },
  }),
});

const catalog = await call("/api/admin/products", { headers: { cookie } });
const categoryId = catalog.payload.categories[0].id;
const product = await call("/api/admin/products", {
  method: "POST",
  headers: headers(cookie),
  body: JSON.stringify({ categoryId, name: "Produto LGPD", description: "E2E", priceCents: 1590, costCents: 500, prepMinutes: 5, emoji: "🧾" }),
}, [201]);

const customerPhone = "+5524999900100";
const order = await call("/api/public/orders", {
  method: "POST",
  headers: headers(null, "198.51.100.90"),
  body: JSON.stringify({
    restaurantSlug: slug,
    clientOrderId: `privacy-order-${suffix}`,
    source: "menu",
    fulfillmentType: "pickup",
    customer: {
      name: "Cliente Original",
      phone: customerPhone,
      email: `titular-${suffix}@example.test`,
      whatsappConsent: true,
    },
    items: [{ productId: product.payload.id, quantity: 1 }],
    paymentMethod: "cash",
  }),
}, [201]);
assert.equal(order.payload.order.totalCents, 1590);

console.log("[Privacy E2E] localizar titular no tenant");
let privacy = await call("/api/admin/privacy", { headers: { cookie } });
const customer = privacy.payload.customers.find((item) => item.phone === customerPhone.replace(/\D/g, ""));
assert.ok(customer, "cliente do pedido deve aparecer na visão de privacidade");
const customerId = customer.id;

console.log("[Privacy E2E] exportação auditável");
const exported = await call(`/api/admin/customers/${encodeURIComponent(customerId)}/privacy`, { headers: { cookie } });
assert.equal(exported.payload.export.customer.id, customerId);
assert.equal(exported.payload.export.orders.length, 1);
assert.equal(exported.payload.export.customer.whatsappConsent, true);

console.log("[Privacy E2E] correção");
await call(`/api/admin/customers/${encodeURIComponent(customerId)}/privacy`, {
  method: "POST",
  headers: headers(cookie),
  body: JSON.stringify({ action: "correction", name: "Cliente Corrigido", email: `corrigido-${suffix}@example.test` }),
});
privacy = await call("/api/admin/privacy", { headers: { cookie } });
const corrected = privacy.payload.customers.find((item) => item.id === customerId);
assert.equal(corrected.name, "Cliente Corrigido");
assert.equal(corrected.email, `corrigido-${suffix}@example.test`);

console.log("[Privacy E2E] opt-out imediato");
await call(`/api/admin/customers/${encodeURIComponent(customerId)}/privacy`, {
  method: "POST",
  headers: headers(cookie),
  body: JSON.stringify({ action: "opt_out" }),
});
privacy = await call("/api/admin/privacy", { headers: { cookie } });
const optedOut = privacy.payload.customers.find((item) => item.id === customerId);
assert.equal(Boolean(optedOut.whatsapp_consent), false);
assert.ok(Number(optedOut.marketing_opt_out_at) > 0);

console.log("[Privacy E2E] solicitações de acesso, portabilidade e eliminação");
for (const action of ["access_request", "portability_request", "deletion_request"]) {
  const result = await call(`/api/admin/customers/${encodeURIComponent(customerId)}/privacy`, {
    method: "POST",
    headers: headers(cookie),
    body: JSON.stringify({ action, requesterReference: `e2e-${action}` }),
  }, [201]);
  assert.equal(result.payload.status, "pending");
  if (action === "deletion_request") assert.equal(result.payload.destructiveActionDeferred, true);
}

privacy = await call("/api/admin/privacy", { headers: { cookie } });
const types = new Set(privacy.payload.requests.filter((item) => item.customer_id === customerId).map((item) => item.request_type));
for (const type of ["correction", "opt_out", "access", "portability", "deletion"]) assert.ok(types.has(type), `fila deve registrar ${type}`);

console.log("[Privacy E2E] isolamento entre tenants");
const otherSignup = await call("/api/auth/signup", {
  method: "POST",
  headers: headers(null, "198.51.100.91"),
  body: JSON.stringify({
    ownerName: "Privacy Other",
    email: `privacy-other-${suffix}@rapidex-hmg.test`,
    password: "RapidexPrivacy12345",
    phone: "+5524999900002",
    whatsapp: "+5524999900002",
    restaurantName: `Privacy Other ${suffix}`,
    slug: `privacy-other-${suffix}`,
    city: "Petrópolis",
    state: "RJ",
    plan: "start",
    termsAccepted: true,
    privacyAccepted: true,
  }),
}, [201]);
const otherCookie = cookieFrom(otherSignup.response);
await call(`/api/admin/customers/${encodeURIComponent(customerId)}/privacy`, { headers: { cookie: otherCookie } }, [404]);

console.log("[Privacy E2E] PASS: exportação, correção, opt-out, fila de direitos, eliminação diferida e isolamento");
