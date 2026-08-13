import assert from "node:assert/strict";

const baseUrl = process.env.RAPIDEX_E2E_URL || "http://127.0.0.1:3000";
const origin = new URL(baseUrl).origin;
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
  const match = (response.headers.get("set-cookie") || "").match(/(?:^|,\s*)([^=;,\s]+=[^;,]+)/);
  assert.ok(match, "login deve retornar sessão");
  return match[1];
}
async function login(email) {
  const result = await call("/api/auth/login", {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ email, password: "RapidexHmg12345" }),
  });
  return cookieFrom(result.response);
}

const ownerA = await login("owner-a@rapidex-hmg.test");
await call("/api/admin/settings", {
  method: "PATCH",
  headers: headers(ownerA),
  body: JSON.stringify({ isOpen: true }),
});
const catalog = await call("/api/admin/products", { headers: { cookie: ownerA } });
const categoryId = catalog.payload.categories[0].id;

const created = await call("/api/admin/products", {
  method: "POST",
  headers: headers(ownerA),
  body: JSON.stringify({
    categoryId,
    name: `Açaí Variável ${suffix}`,
    description: "Produto E2E com tamanho e estoque independentes",
    priceCents: 1000,
    costCents: 300,
    prepMinutes: 5,
    emoji: "🥤",
  }),
}, [201]);
const productId = created.payload.id;

console.log("[Variants E2E] configurar tamanhos e adicional");
const configured = await call(`/api/admin/products/${encodeURIComponent(productId)}/options`, {
  method: "PUT",
  headers: headers(ownerA),
  body: JSON.stringify({
    groups: [
      {
        kind: "variant",
        name: "Tamanho",
        minSelect: 1,
        maxSelect: 1,
        pricingStrategy: "sum",
        options: [
          { name: "300 ml", finalPriceCents: 1200, finalCostCents: 400, available: true, stockControlEnabled: true, stockQuantity: 1 },
          { name: "500 ml", finalPriceCents: 1800, finalCostCents: 700, available: true, stockControlEnabled: true, stockQuantity: 2 },
        ],
      },
      {
        kind: "modifier",
        name: "Adicionais",
        minSelect: 0,
        maxSelect: 2,
        pricingStrategy: "sum",
        options: [
          { name: "Leite em pó", priceDeltaCents: 200, costDeltaCents: 80, available: true },
        ],
      },
    ],
  }),
});
const variantGroup = configured.payload.groups.find((group) => group.kind === "variant");
const modifierGroup = configured.payload.groups.find((group) => group.kind === "modifier");
assert.ok(variantGroup, "grupo de variação deve existir");
assert.equal(variantGroup.minSelect, 1);
assert.equal(variantGroup.maxSelect, 1);
const small = variantGroup.options.find((option) => option.name === "300 ml");
const large = variantGroup.options.find((option) => option.name === "500 ml");
const extra = modifierGroup.options[0];
assert.equal(small.finalPriceCents, 1200);
assert.equal(large.finalPriceCents, 1800);
assert.equal(small.stockQuantity, 1);

console.log("[Variants E2E] base vira menor preço e menu publica variações compráveis");
const publicMenu = await call("/api/public/menu/hmg-burger-a");
const publicProducts = [...publicMenu.payload.categories.flatMap((category) => category.products), ...publicMenu.payload.uncategorized];
const publicProduct = publicProducts.find((product) => product.id === productId);
assert.equal(publicProduct.priceCents, 1200);
assert.equal(publicProduct.priceIsFrom, true);
const publicVariantGroup = publicProduct.optionGroups.find((group) => group.kind === "variant");
assert.equal(publicVariantGroup.options.length, 2);
assert.equal(publicVariantGroup.options.find((option) => option.id === large.id).priceDeltaCents, 600);

function orderBody(key, optionIds) {
  return {
    restaurantSlug: "hmg-burger-a",
    clientOrderId: key,
    source: "menu",
    fulfillmentType: "pickup",
    customer: {
      name: "Cliente Variante",
      phone: `+55248${String(Math.floor(Math.random() * 89999999) + 10000000)}`,
      email: `${key}@rapidex-hmg.test`,
      whatsappConsent: false,
    },
    items: [{ productId, quantity: 1, optionIds }],
    paymentMethod: "cash",
  };
}

console.log("[Variants E2E] corrida real: estoque 1 nunca vende duas unidades");
const raceKeyA = `variant-small-a-${suffix}`;
const raceKeyB = `variant-small-b-${suffix}`;
const race = await Promise.all([
  call("/api/public/orders", { method: "POST", headers: headers(), body: JSON.stringify(orderBody(raceKeyA, [small.id])) }, [201, 409]),
  call("/api/public/orders", { method: "POST", headers: headers(), body: JSON.stringify(orderBody(raceKeyB, [small.id])) }, [201, 409]),
]);
const winners = race.filter((item) => item.response.status === 201);
const losers = race.filter((item) => item.response.status === 409);
assert.equal(winners.length, 1, "estoque 1 deve gerar exatamente um pedido válido");
assert.equal(losers.length, 1, "segunda compra concorrente deve ser bloqueada");
assert.equal(losers[0].payload.error?.code, "insufficient_stock");
assert.equal(winners[0].payload.order.totalCents, 1200);

let afterRace = await call(`/api/admin/products/${encodeURIComponent(productId)}/options`, { headers: { cookie: ownerA } });
let afterSmall = afterRace.payload.groups.find((group) => group.kind === "variant").options.find((option) => option.name === "300 ml");
assert.equal(afterSmall.stockQuantity, 0);
const menuAfterRace = await call("/api/public/menu/hmg-burger-a");
const productAfterRace = [...menuAfterRace.payload.categories.flatMap((category) => category.products), ...menuAfterRace.payload.uncategorized].find((product) => product.id === productId);
assert.equal(productAfterRace.optionGroups.find((group) => group.kind === "variant").options.some((option) => option.id === small.id), false, "variação esgotada deve sumir das opções compráveis");

console.log("[Variants E2E] cancelamento devolve estoque exatamente uma vez");
await call(`/api/admin/orders/${encodeURIComponent(winners[0].payload.order.id)}`, {
  method: "PATCH",
  headers: headers(ownerA),
  body: JSON.stringify({ status: "canceled" }),
});
afterRace = await call(`/api/admin/products/${encodeURIComponent(productId)}/options`, { headers: { cookie: ownerA } });
afterSmall = afterRace.payload.groups.find((group) => group.kind === "variant").options.find((option) => option.name === "300 ml");
assert.equal(afterSmall.stockQuantity, 1);
await call(`/api/admin/orders/${encodeURIComponent(winners[0].payload.order.id)}`, {
  method: "PATCH",
  headers: headers(ownerA),
  body: JSON.stringify({ status: "canceled" }),
}, [200, 409]);
afterRace = await call(`/api/admin/products/${encodeURIComponent(productId)}/options`, { headers: { cookie: ownerA } });
afterSmall = afterRace.payload.groups.find((group) => group.kind === "variant").options.find((option) => option.name === "300 ml");
assert.equal(afterSmall.stockQuantity, 1, "retry do cancelamento não pode duplicar reposição");

console.log("[Variants E2E] preço final servidor + idempotência não consome estoque duas vezes");
const pricedKey = `variant-large-${suffix}`;
const pricedPayload = orderBody(pricedKey, [large.id, extra.id]);
const priced = await call("/api/public/orders", { method: "POST", headers: headers(), body: JSON.stringify(pricedPayload) }, [201]);
assert.equal(priced.payload.order.totalCents, 2000, "500ml 1800 + adicional 200");
const duplicate = await call("/api/public/orders", { method: "POST", headers: headers(), body: JSON.stringify(pricedPayload) }, [200]);
assert.equal(duplicate.payload.order.id, priced.payload.order.id);
const afterDuplicate = await call(`/api/admin/products/${encodeURIComponent(productId)}/options`, { headers: { cookie: ownerA } });
assert.equal(afterDuplicate.payload.groups.find((group) => group.kind === "variant").options.find((option) => option.name === "500 ml").stockQuantity, 1);

console.log("[Variants E2E] isolamento de tenant");
const ownerB = await login("owner-b@rapidex-hmg.test");
await call(`/api/admin/products/${encodeURIComponent(productId)}/options`, {
  method: "PUT",
  headers: headers(ownerB),
  body: JSON.stringify({ groups: [] }),
}, [404]);

console.log("[Variants E2E] PASS: preço, custo, disponibilidade, estoque, corrida, cancelamento, idempotência e tenant");
