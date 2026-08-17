import assert from "node:assert/strict";
import test from "node:test";
import { correlationId, redactLogValue, structuredLog } from "../lib/observability";

test("correlation id preserves only safe caller IDs", () => {
  assert.equal(correlationId("req_12345678"), "req_12345678");
  assert.notEqual(correlationId("bad id with spaces"), "bad id with spaces");
  assert.match(correlationId(), /^[0-9a-f-]{36}$/i);
});

test("log redaction removes credentials and common PII", () => {
  const value = redactLogValue({
    authorization: "Bearer abcdefghijklmnopqrstuvwxyz123456",
    password: "hunter2",
    nested: {
      email: "cliente@example.com",
      freeText: "Contato cliente@example.com ou (24) 99999-9999",
      status: "failed",
    },
  }) as Record<string, unknown>;
  assert.equal(value.authorization, "[REDACTED]");
  assert.equal(value.password, "[REDACTED]");
  const nested = value.nested as Record<string, unknown>;
  assert.equal(nested.email, "[REDACTED]");
  assert.equal(String(nested.freeText).includes("cliente@example.com"), false);
  assert.equal(String(nested.freeText).includes("99999-9999"), false);
  assert.equal(nested.status, "failed");
});

test("metadata cannot overwrite reserved structured log fields", () => {
  const original = console.error;
  let captured = "";
  console.error = (line?: unknown) => { captured = String(line || ""); };
  try {
    structuredLog("error", "alerts.invalid_configuration", {
      event: "maintenance.failed",
      level: "info",
      ts: "forged",
    });
  } finally {
    console.error = original;
  }
  const payload = JSON.parse(captured);
  assert.equal(payload.event, "alerts.invalid_configuration");
  assert.equal(payload.level, "error");
  assert.notEqual(payload.ts, "forged");
});
