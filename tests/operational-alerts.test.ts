import assert from "node:assert/strict";
import test from "node:test";
import { deliverOperationalAlert } from "../lib/operational-alerts";

test("alertas ficam inativos sem endpoint configurado", async () => {
  let called = false;
  const result = await deliverOperationalAlert({}, {
    event: "maintenance.failed",
    severity: "critical",
    summary: "Falha",
  }, async () => {
    called = true;
    return new Response(null, { status: 204 });
  });
  assert.deepEqual(result, { configured: false, delivered: false });
  assert.equal(called, false);
});

test("alertas rejeitam endpoint sem HTTPS", async () => {
  const result = await deliverOperationalAlert({ RAPIDEX_ALERT_WEBHOOK_URL: "http://alerts.example.test/hook" }, {
    event: "maintenance.failed",
    severity: "critical",
    summary: "Falha",
  });
  assert.deepEqual(result, { configured: true, delivered: false, reason: "invalid_url" });
});

test("alerta externo recebe payload redigido e autenticação server-side", async () => {
  let capturedUrl = "";
  let capturedInit: RequestInit | undefined;
  const result = await deliverOperationalAlert({
    RAPIDEX_ENV: "hmg",
    RAPIDEX_ALERT_WEBHOOK_URL: "https://alerts.example.test/rapidex",
    RAPIDEX_ALERT_WEBHOOK_SECRET: "alert-secret-not-exposed-to-client",
  }, {
    event: "maintenance failed",
    severity: "warning",
    summary: "Falha para owner@example.com",
    metadata: { email: "owner@example.com", token: "secret-token-value-12345678901234567890", jobsDead: 2 },
  }, async (url, init) => {
    capturedUrl = String(url);
    capturedInit = init;
    return new Response(null, { status: 204 });
  });

  assert.deepEqual(result, { configured: true, delivered: true });
  assert.equal(capturedUrl, "https://alerts.example.test/rapidex");
  const headers = capturedInit?.headers as Record<string, string>;
  assert.equal(headers.authorization, "Bearer alert-secret-not-exposed-to-client");
  const body = JSON.parse(String(capturedInit?.body));
  assert.equal(body.environment, "hmg");
  assert.equal(body.event, "maintenance_failed");
  assert.equal(body.summary.includes("owner@example.com"), false);
  assert.equal(body.metadata.email, "[REDACTED]");
  assert.equal(body.metadata.token, "[REDACTED]");
  assert.equal(body.metadata.jobsDead, 2);
});
