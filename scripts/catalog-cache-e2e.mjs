import assert from "node:assert/strict";

const baseUrl = process.env.RAPIDEX_E2E_URL || "http://127.0.0.1:3000";
const origin = new URL(baseUrl).origin;
const suffix = `${Date.now()}`.slice(-9);
const clientIp = "198.51.100.88";

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
function headers(cookie, extra = {}) {
  return { "content-type": "application/json", origin, "x-forwarded-for": clientIp, ...(cookie ? { cookie } : {}), ...extra };
}
function sessionCookie(response) {
  const raw = response.headers.get("set-cookie") || "";
  const match = raw.match(/(?:^|,\s*)([^=;,\s]+=[^;,]+)/);
  assert.ok(match, "signup de cache deve retornar sessão");
  return match[1];
}

const slug = `cache-${suffix}`;
const signup = await call("/api/auth/signup", {
  method: "POST",
  headers: headers(),
  body: JSON.stringify({
    ownerName: "Owner Cache E2E",
    email: `cache-${suffix}@rapidex-hmg.test`,
    password: "RapidexCache12345",
    phone: `247${suffix.slice(-8)}`,
    restaurantName: `Cache Store ${suffix}`,
    slug,
    city: "Petrópolis",
    state: "RJ",
    plan: "start",
    termsAccepted: true,
    privacyAccepted: true,
  }),
}, [201]);
const cookie = sessionCookie(signup.response);
const products = await call("/api/admin/products", { headers: headers(cookie) });
const categoryId = products.payload.categories[0].id;
const created = await call("/api/admin/products", {
  method: "POST",
  headers: headers(cookie),
  body: JSON.stringify({
    categoryId,
    name: "Produto Cache",
    description: "Versão original",
    priceCents: 2200,
    costCents: 700,
    prepMinutes: 7,
  }),
}, [201]);

const state1 = await call(`/api/public/store-state/${slug}`);
const version1 = Number(state1.payload.restaurant.catalogVersion);
assert.ok(version1 >= 1);
assert.equal(state1.response.headers.get("cache-control"), "no-store");

const catalog1 = await call(`/api/public/catalog/${slug}?v=${version1}`);
assert.match(catalog1.response.headers.get("cache-control") || "", /s-maxage=31536000/);
const etag1 = catalog1.response.headers.get("etag");
assert.ok(etag1, "catálogo versionado deve emitir ETag");
assert.ok(JSON.stringify(catalog1.payload).includes("Versão original"));

const notModified = await fetch(`${baseUrl}/api/public/catalog/${slug}?v=${version1}`, {
  headers: { "if-none-match": etag1 },
});
assert.equal(notModified.status, 304, "ETag atual deve evitar reconstrução do payload");

await call(`/api/admin/products/${created.payload.id}`, {
  method: "PATCH",
  headers: headers(cookie),
  body: JSON.stringify({ description: "Versão atualizada" }),
});
const state2 = await call(`/api/public/store-state/${slug}`);
const version2 = Number(state2.payload.restaurant.catalogVersion);
assert.ok(version2 > version1, "mudança pública deve incrementar catalog_version");

const stale = await call(`/api/public/catalog/${slug}?v=${version1}`, {}, [409]);
assert.equal(stale.payload.error?.code, "catalog_version_changed");
assert.equal(Number(stale.payload.error?.details?.currentVersion), version2);

const catalog2 = await call(`/api/public/catalog/${slug}?v=${version2}`);
assert.ok(JSON.stringify(catalog2.payload).includes("Versão atualizada"));
assert.notEqual(catalog2.response.headers.get("etag"), etag1);

console.log(`[CATALOG CACHE E2E] PASS: versão ${version1} → ${version2}, ETag 304 e URL antiga invalidada`);
