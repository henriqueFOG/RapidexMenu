import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

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

async function storeState() {
  const { payload } = await call("/api/public/store-state/hmg-burger-a");
  assert.ok(payload.restaurant?.catalogVersion, "store-state deve publicar catalogVersion");
  return payload.restaurant;
}

async function catalog() {
  const state = await storeState();
  const { payload } = await call(`/api/public/catalog/hmg-burger-a?v=${state.catalogVersion}`);
  assert.equal(payload.catalogVersion, state.catalogVersion);
  return { state, payload };
}

function findProduct(payload, productId) {
  return [...payload.categories.flatMap((category) => category.products), ...(payload.uncategorized || [])]
    .find((product) => product.id === productId);
}

function orderBody(key, productId, optionIds, phoneSuffix) {
  return {
    restaurantSlug: "hmg-burger-a",
    clientOrderId: key,
    source: "menu",
    fulfillmentType: "pickup",
    customer: {
      name: "Cliente Variante",
      phone: `+55248888${String(phoneSuffix).padStart(4, "0")}`,
      email: `${key}@rapidex-hmg.test`,
      whatsappConsent: false,
    },
    items: [{ productId, quantity: 1, optionIds }],
    paymentMethod: "cash",
  };
}

function psqlScalar(sql) {
  return execFileSync("psql", [
    "-h", "127.0.0.1",
    "-U", "rapidex",
    "-d", "rapidex_hmg",
    "-tAc", sql,
  ], { encoding: "utf8" }).trim();
}

console.log("[Variants E2E] login + versão inicial do catálogo real");
const ownerA = await login("owner-a@rapidex-hmg.test");
const beforeCreate = await storeState();
const products = await call("/api/admin/products", { headers: { cookie: ownerA } });
const categoryId = products.payload.categories[0]?.id;
assert.ok(categoryId, "tenant A deve possuir categoria criada pelo baseline");

console.log("[Variants E2E] criação de produto invalida catálogo versionado");
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
assert.ok(productId);
const afterCreate = await storeState();
assert.ok(afterCreate.catalogVersion > beforeCreate.catalogVersion, "criar produto deve invalidar catálogo público");

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
assert.ok(variantGroup?.id, "grupo de variação deve receber ID estável");
assert.equal(variantGroup.minSelect, 1);
assert.equal(variantGroup.maxSelect, 1);
const small = variantGroup.options.find((option) => option.name === "300 ml");
const large = variantGroup.options.find((option) => option.name === "500 ml");
const extra = modifierGroup.options[0];
assert.ok(small?.id && large?.id && extra?.id);
assert.equal(small.finalPriceCents, 1200);
assert.equal(large.finalPriceCents, 1800);
assert.equal(small.stockQuantity, 1);

const afterOptions = await storeState();
assert.ok(afterOptions.catalogVersion > afterCreate.catalogVersion, "editar opções deve invalidar catálogo público");

console.log("[Variants E2E] salvar modificadores preserva IDs das variações");
const resaved = await call(`/api/admin/products/${encodeURIComponent(productId)}/options`, {
  method: "PUT",
  headers: headers(ownerA),
  body: JSON.stringify({
    groups: [
      variantGroup,
      {
        kind: "modifier",
        name: "Adicionais",
        minSelect: 0,
        maxSelect: 2,
        pricingStrategy: "sum",
        options: [
          { name: "Leite em pó", priceDeltaCents: 250, costDeltaCents: 80, available: true },
        ],
      },
    ],
  }),
});
const stableVariant = resaved.payload.groups.find((group) => group.kind === "variant");
assert.equal(stableVariant.id, variantGroup.id);
assert.equal(stableVariant.options.find((option) => option.name === "300 ml").id, small.id);
assert.equal(stableVariant.options.find((option) => option.name === "500 ml").id, large.id);
const currentExtra = resaved.payload.groups.find((group) => group.kind === "modifier").options[0];

console.log("[Variants E2E] catálogo realmente consumido pela loja publica variações compráveis");
let publicCatalog = await catalog();
let publicProduct = findProduct(publicCatalog.payload, productId);
assert.ok(publicProduct, "produto deve aparecer no /api/public/catalog real");
assert.equal(publicProduct.priceCents, 1200);
assert.equal(publicProduct.priceIsFrom, true);
const publicVariantGroup = publicProduct.optionGroups.find((group) => group.kind === "variant");
assert.ok(publicVariantGroup);
assert.equal(publicVariantGroup.options.length, 2);
assert.equal(publicVariantGroup.options.find((option) => option.id === large.id).priceDeltaCents, 600);

console.log("[Variants E2E] corrida real: estoque 1 nunca vende duas unidades");
const raceKeyA = `variant-small-a-${suffix}`;
const raceKeyB = `variant-small-b-${suffix}`;
const race = await Promise.all([
  call("/api/public/orders", { method: "POST", headers: headers(), body: JSON.stringify(orderBody(raceKeyA, productId, [small.id], 1001)) }, [201, 409]),
  call("/api/public/orders", { method: "POST", headers: headers(), body: JSON.stringify(orderBody(raceKeyB, productId, [small.id], 1002)) }, [201, 409]),
]);
const winners = race.filter((item) => item.response.status === 201);
const losers = race.filter((item) => item.response.status === 409);
assert.equal(winners.length, 1, "estoque 1 deve gerar exatamente um pedido válido");
assert.equal(losers.length, 1, "segunda compra concorrente deve ser bloqueada");
assert.equal(losers[0].payload.error?.code, "insufficient_stock");
assert.equal(winners[0].payload.order.subtotalCents, 1200);

console.log("[Variants E2E] estoque altera a versão e variação esgotada some do catálogo real");
publicCatalog = await catalog();
publicProduct = findProduct(publicCatalog.payload, productId);
assert.equal(publicProduct.optionGroups.find((group) => group.kind === "variant").options.some((option) => option.id === small.id), false);

console.log("[Variants E2E] cancelamento devolve estoque e republica a escolha");
await call(`/api/admin/orders/${encodeURIComponent(winners[0].payload.order.id)}`, {
  method: "PATCH",
  headers: headers(ownerA),
  body: JSON.stringify({ status: "canceled", expectedStatus: "received" }),
});
publicCatalog = await catalog();
publicProduct = findProduct(publicCatalog.payload, productId);
assert.equal(publicProduct.optionGroups.find((group) => group.kind === "variant").options.some((option) => option.id === small.id), true);

console.log("[Variants E2E] preço final servidor + idempotência não consome estoque duas vezes");
const pricedKey = `variant-large-${suffix}`;
const pricedPayload = orderBody(pricedKey, productId, [large.id, currentExtra.id], 1003);
const priced = await call("/api/public/orders", { method: "POST", headers: headers(), body: JSON.stringify(pricedPayload) }, [201]);
assert.equal(priced.payload.order.subtotalCents, 2050, "500ml 1800 + adicional 250");
const duplicate = await call("/api/public/orders", { method: "POST", headers: headers(), body: JSON.stringify(pricedPayload) }, [200]);
assert.equal(duplicate.payload.order.id, priced.payload.order.id);
let afterDuplicate = await call(`/api/admin/products/${encodeURIComponent(productId)}/options`, { headers: { cookie: ownerA } });
assert.equal(afterDuplicate.payload.groups.find((group) => group.kind === "variant").options.find((option) => option.id === large.id).stockQuantity, 1);

console.log("[Variants E2E] remover variação não apaga identidade histórica");
const currentGroups = afterDuplicate.payload.groups;
const currentVariant = currentGroups.find((group) => group.kind === "variant");
const currentModifier = currentGroups.find((group) => group.kind === "modifier");
await call(`/api/admin/products/${encodeURIComponent(productId)}/options`, {
  method: "PUT",
  headers: headers(ownerA),
  body: JSON.stringify({
    groups: [
      { ...currentVariant, options: currentVariant.options.filter((option) => option.id !== large.id) },
      currentModifier,
    ],
  }),
});
const afterRemoval = await call(`/api/admin/products/${encodeURIComponent(productId)}/options`, { headers: { cookie: ownerA } });
assert.equal(afterRemoval.payload.groups.find((group) => group.kind === "variant").options.some((option) => option.id === large.id), false);
publicCatalog = await catalog();
publicProduct = findProduct(publicCatalog.payload, productId);
assert.equal(publicProduct.optionGroups.find((group) => group.kind === "variant").options.some((option) => option.id === large.id), false);
const retiredBeforeCancel = psqlScalar(`SELECT retired || ':' || stock_quantity FROM product_options WHERE id = '${large.id}'`);
assert.equal(retiredBeforeCancel, "1:1");

console.log("[Variants E2E] pedido antigo cancelado restaura estoque da variação aposentada");
await call(`/api/admin/orders/${encodeURIComponent(priced.payload.order.id)}`, {
  method: "PATCH",
  headers: headers(ownerA),
  body: JSON.stringify({ status: "canceled", expectedStatus: "received" }),
});
const retiredAfterCancel = psqlScalar(`SELECT retired || ':' || stock_quantity FROM product_options WHERE id = '${large.id}'`);
assert.equal(retiredAfterCancel, "1:2", "histórico deve manter a variação para devolver estoque corretamente");

console.log("[Variants E2E] isolamento de tenant");
const ownerB = await login("owner-b@rapidex-hmg.test");
await call(`/api/admin/products/${encodeURIComponent(productId)}/options`, {
  method: "PUT",
  headers: headers(ownerB),
  body: JSON.stringify({ groups: [] }),
}, [404]);

console.log("[Variants E2E] PASS: catálogo real, cache, preço, custo, estoque, corrida, cancelamento, histórico, idempotência e tenant");
