import assert from "node:assert/strict";
import test from "node:test";
import { publicSignupAllowed, resolveSignupMode } from "../lib/signup-policy";

test("produção fecha cadastro público por padrão e mesmo se configuração legada estiver aberta", () => {
  assert.equal(resolveSignupMode({ environment: "production" }), "invite_only");
  assert.equal(resolveSignupMode({ environment: "production", configuredMode: "open" }), "invite_only");
  assert.equal(publicSignupAllowed(resolveSignupMode({ environment: "production" })), false);
});

test("HMG continua aberta para validação e pode ser fechada explicitamente", () => {
  assert.equal(resolveSignupMode({ environment: "hmg" }), "open");
  assert.equal(resolveSignupMode({ environment: "hmg", configuredMode: "closed" }), "closed");
  assert.equal(resolveSignupMode({ environment: "hmg", legacyEnabled: "false" }), "closed");
});
