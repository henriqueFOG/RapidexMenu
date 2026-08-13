import test from "node:test";
import assert from "node:assert/strict";
import { effectiveCommercialPlan, hasCommercialFeature } from "../lib/entitlements";

const future = Date.now() + 60_000;
const past = Date.now() - 60_000;

test("trial Start demonstra recursos Growth, mas não Scale", () => {
  const trial = { plan: "start" as const, restaurantStatus: "trial", trialEndsAt: future };
  assert.equal(effectiveCommercialPlan(trial), "growth");
  assert.equal(hasCommercialFeature(trial, "ai_sales"), true);
  assert.equal(hasCommercialFeature(trial, "whatsapp_connection"), true);
  assert.equal(hasCommercialFeature(trial, "multi_unit"), false);
});

test("Start pago não recebe recursos Growth", () => {
  const active = { plan: "start" as const, restaurantStatus: "active", trialEndsAt: null };
  assert.equal(effectiveCommercialPlan(active), "start");
  assert.equal(hasCommercialFeature(active, "ai_sales"), false);
  assert.equal(hasCommercialFeature(active, "whatsapp_connection"), false);
});

test("trial vencido respeita plano contratado", () => {
  const expired = { plan: "start" as const, restaurantStatus: "trial", trialEndsAt: past };
  assert.equal(effectiveCommercialPlan(expired), "start");
  assert.equal(hasCommercialFeature(expired, "ai_sales"), false);
});

test("Scale recebe todas as capacidades comerciais modeladas", () => {
  const scale = { plan: "scale" as const, restaurantStatus: "active", trialEndsAt: null };
  assert.equal(hasCommercialFeature(scale, "ai_sales"), true);
  assert.equal(hasCommercialFeature(scale, "whatsapp_connection"), true);
  assert.equal(hasCommercialFeature(scale, "multi_unit"), true);
  assert.equal(hasCommercialFeature(scale, "kds"), true);
});
