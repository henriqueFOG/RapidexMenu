import assert from "node:assert/strict";

const baseUrl = process.env.RAPIDEX_E2E_URL || "http://127.0.0.1:3000";
const secret = process.env.CRON_SECRET || process.env.RAPIDEX_CRON_SECRET || "";
assert.ok(secret.length >= 32, "CRON_SECRET de E2E deve ter pelo menos 32 caracteres");

async function request(path, authorization) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: authorization ? { authorization: `Bearer ${authorization}` } : {},
  });
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

for (const path of [
  "/api/internal/process-jobs",
  "/api/internal/reconcile-payments",
  "/api/internal/reconcile-subscriptions",
]) {
  const unauthorized = await request(path);
  assert.equal(unauthorized.response.status, 401, `${path} deve rejeitar cron sem Bearer`);
  assert.equal(unauthorized.payload?.error?.code, "invalid_job_secret");
  assert.ok(unauthorized.response.headers.get("x-request-id"), `${path} deve retornar correlation id em erro`);

  const wrong = await request(path, `${secret.slice(0, -1)}x`);
  assert.equal(wrong.response.status, 401, `${path} deve rejeitar segredo incorreto`);
  assert.equal(wrong.payload?.error?.code, "invalid_job_secret");

  const authorized = await request(path, secret);
  assert.equal(authorized.response.status, 200, `${path} deve aceitar CRON_SECRET válido`);
  assert.equal(authorized.payload?.ok, true);
  assert.ok(authorized.response.headers.get("x-request-id"), `${path} deve retornar correlation id`);
}

console.log("[CRON E2E] PASS: worker/reconciliação exigem CRON_SECRET e retornam correlation IDs");
