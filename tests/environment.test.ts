import assert from "node:assert/strict";
import test from "node:test";
import { normalizeRapidexEnvironment, validateEnvironmentConfiguration } from "../lib/environment";

test("normalizes common environment aliases", () => {
  assert.equal(normalizeRapidexEnvironment("homologation"), "hmg");
  assert.equal(normalizeRapidexEnvironment("staging"), "hmg");
  assert.equal(normalizeRapidexEnvironment("prod"), "production");
  assert.equal(normalizeRapidexEnvironment("test"), "ci");
});

test("HMG rejects the official production domain", () => {
  const result = validateEnvironmentConfiguration({
    environment: "hmg",
    publicUrl: "https://rapidexmenu.com.br",
  });
  assert.equal(result.environment, "hmg");
  assert.ok(result.issues.some((issue) => issue.includes("domínio oficial")));
});

test("HMG rejects platform billing credential", () => {
  const result = validateEnvironmentConfiguration({
    environment: "hmg",
    publicUrl: "https://hmg.rapidexmenu.com.br",
    billingToken: "test-token",
  });
  assert.ok(result.issues.some((issue) => issue.includes("RAPIDEX_BILLING_MP_ACCESS_TOKEN")));
});

test("production requires HTTPS and a non-HMG URL", () => {
  const insecure = validateEnvironmentConfiguration({
    environment: "production",
    publicUrl: "http://rapidexmenu.com.br",
  });
  assert.ok(insecure.issues.some((issue) => issue.includes("HTTPS")));

  const hmgUrl = validateEnvironmentConfiguration({
    environment: "production",
    publicUrl: "https://hmg.rapidexmenu.com.br",
  });
  assert.ok(hmgUrl.issues.some((issue) => issue.includes("HMG/staging")));
});

test("valid HMG and production configurations pass", () => {
  assert.deepEqual(
    validateEnvironmentConfiguration({ environment: "hmg", publicUrl: "https://rapidexmenu-hmg.vercel.app" }).issues,
    [],
  );
  assert.deepEqual(
    validateEnvironmentConfiguration({ environment: "production", publicUrl: "https://rapidexmenu.com.br" }).issues,
    [],
  );
});
