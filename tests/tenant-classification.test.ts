import assert from "node:assert/strict";
import test from "node:test";
import { classifyTenant, isSyntheticEmail } from "../lib/tenant-classification";

test("classifica demonstração, teste automatizado e cliente real separadamente", () => {
  assert.equal(classifyTenant({ id: "rest_serra_burger", ownerEmail: "dono@empresa.com" }), "demo");
  assert.equal(classifyTenant({ id: "r-test", ownerEmail: "e2e.123@rapidex-hmg.test" }), "test");
  assert.equal(classifyTenant({ id: "r-name", name: "Rapidex E2E 123", ownerEmail: "qa@example.com" }), "test");
  assert.equal(classifyTenant({ id: "r-live", name: "Heloisa Gall", ownerEmail: "loja@example.com" }), "live");
});

test("domínio sintético é detectado sem confundir e-mails reais", () => {
  assert.equal(isSyntheticEmail("CLIENTE@rapidex-hmg.test"), true);
  assert.equal(isSyntheticEmail("henry.francisco31@hotmail.com"), false);
  assert.equal(isSyntheticEmail("heloisa.gall@gmail.com"), false);
});
