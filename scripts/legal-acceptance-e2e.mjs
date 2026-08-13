import assert from "node:assert/strict";

const baseUrl = process.env.RAPIDEX_E2E_URL || "http://127.0.0.1:3000";
const origin = new URL(baseUrl).origin;
const suffix = String(process.env.GITHUB_RUN_ID || Date.now()).replace(/\D/g, "").slice(-10) || String(Date.now()).slice(-10);

async function call(path, body, expected) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", origin, "x-forwarded-for": "198.51.100.88" },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  assert.equal(response.status, expected, `${path} deveria retornar ${expected}: ${JSON.stringify(payload)}`);
  return payload;
}

const baseSignup = {
  ownerName: "Legal E2E",
  email: `legal-${suffix}@rapidex-hmg.test`,
  password: "RapidexLegal12345",
  phone: "+5524999912345",
  whatsapp: "+5524999912345",
  restaurantName: `Legal E2E ${suffix}`,
  slug: `legal-e2e-${suffix}`,
  city: "Petrópolis",
  state: "RJ",
  plan: "start",
};

console.log("[Legal E2E] aceite explícito é obrigatório");
const refused = await call("/api/auth/signup", { ...baseSignup, termsAccepted: false, privacyAccepted: true }, 400);
assert.equal(refused.error?.code, "consent_required");

console.log("[Legal E2E] signup retorna as versões que serão persistidas");
const accepted = await call("/api/auth/signup", { ...baseSignup, termsAccepted: true, privacyAccepted: true }, 201);
assert.match(String(accepted.legal?.termsVersion || ""), /^\d{4}-\d{2}-\d{2}$/);
assert.match(String(accepted.legal?.privacyVersion || ""), /^\d{4}-\d{2}-\d{2}$/);
assert.equal(accepted.restaurant?.slug, baseSignup.slug);

console.log(`[Legal E2E] PASS: terms=${accepted.legal.termsVersion} privacy=${accepted.legal.privacyVersion}`);
