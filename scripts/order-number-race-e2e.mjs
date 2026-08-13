import assert from "node:assert/strict";

const baseUrl = process.env.RAPIDEX_E2E_URL || "http://127.0.0.1:3000";
const origin = new URL(baseUrl).origin;
const suffix = `${Date.now()}`.slice(-9);
const isolatedClientIp = "198.51.100.77";

async function call(path, options = {}, expected = [200]) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const text = await response.text();
  let payload = null;
  try { payload = text ? JSON.parse(text) : null; } catch { payload = { raw: text }; }
  if (!expected.includes(response.status)) {
    throw new Error(`${options.method || "GET"} ${path} -> ${response.status}: ${text.slice(0, 1000)}`);
  }
  return { response, payload };
}

function jsonHeaders(cookie) {
  // The isolated HMG runtime is called directly, without Vercel in front of it.
  // Give this concurrency test its own rate-limit bucket so the commercial E2E
  // executed immediately before it does not consume the same 20 req/min window.
  // Vercel overwrites X-Forwarded-For in real deployments, preventing clients
  // from using this technique to bypass production IP limits.
  return {
    "content-type": "application/json",
    origin,
    "x-forwarded-for": isolatedClientIp,
    ...(cookie ? { cookie } : {}),
  };
}

function sessionCookie(response) {
  const raw = response.headers.get("set-cookie") || "";
  const match = raw.match(/(?:^|,\s*)([^=;,\s]+=[^;,]+)/);
  assert.ok(match, "signup concorrente deve retornar sessão");
  return match[1];
}

const slug = `race-${suffix}`;
const signup = await call("/api/auth/signup", {
  method: "POST",
  headers: jsonHeaders(),
  body: JSON.stringify({
    ownerName: "Owner Race E2E",
    email: `race-${suffix}@rapidex-hmg.test`,
    password: "RapidexRace12345",
    phone: `249${suffix.slice(-8)}`,
    restaurantName: `Race Orders ${suffix}`,
    slug,
    city: "Petrópolis",
    state: "RJ",
    plan: "start",
    termsAccepted: true,
    privacyAccepted: true,
  }),
}, [201]);
const cookie = sessionCookie(signup.response);

await call("/api/admin/settings", {
  method: "PATCH",
  headers: jsonHeaders(cookie),
  body: JSON.stringify({ isOpen: true }),
});
const catalog = await call("/api/admin/products", { headers: jsonHeaders(cookie) });
const categoryId = catalog.payload.categories[0].id;
const product = await call("/api/admin/products", {
  method: "POST",
  headers: jsonHeaders(cookie),
  body: JSON.stringify({
    categoryId,
    name: "Item Race",
    description: "Concorrência de numeração",
    priceCents: 1500,
    costCents: 500,
    prepMinutes: 5,
  }),
}, [201]);

const concurrency = 12;
const requests = Array.from({ length: concurrency }, (_, index) => call("/api/public/orders", {
  method: "POST",
  headers: jsonHeaders(),
  body: JSON.stringify({
    restaurantSlug: slug,
    clientOrderId: `race-${suffix}-${String(index).padStart(2, "0")}`,
    source: "menu",
    customer: {
      name: `Cliente Race ${index}`,
      phone: `248${suffix.slice(-7)}${String(index).padStart(2, "0")}`.slice(0, 15),
      email: null,
      whatsappConsent: false,
      address: {
        street: "Rua Race",
        number: String(index + 1),
        neighborhood: "Centro",
        city: "Petrópolis",
        state: "RJ",
        postalCode: "25600000",
        complement: null,
      },
    },
    items: [{ productId: product.payload.id, quantity: 1 }],
    paymentMethod: "cash",
  }),
}, [201]));

const results = await Promise.all(requests);
const numbers = results.map(({ payload }) => Number(payload.order.number)).sort((a, b) => a - b);
assert.equal(new Set(numbers).size, concurrency, "números de pedido devem ser únicos sob concorrência");
for (let index = 1; index < numbers.length; index += 1) {
  assert.equal(numbers[index], numbers[index - 1] + 1, "sequência concorrente não deve criar colisão ou lacuna interna");
}

console.log(`[ORDER NUMBER E2E] PASS: ${concurrency} pedidos concorrentes receberam números únicos ${numbers[0]}–${numbers.at(-1)}`);
