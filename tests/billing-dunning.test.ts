import assert from "node:assert/strict";
import test from "node:test";
import { billingDunningStage, DUNNING_GRACE_WINDOW_MS } from "../lib/billing-dunning-policy";

const now = Date.UTC(2026, 7, 13, 12, 0, 0);

test("cancelled subscription never enters delinquency dunning", () => {
  assert.equal(billingDunningStage({
    subscriptionStatus: "cancelled",
    restaurantStatus: "active",
    accessEndsAt: now + 12 * 60 * 60 * 1000,
    now,
  }), null);
});

test("already-paid future period does not trigger early dunning", () => {
  assert.equal(billingDunningStage({
    subscriptionStatus: "paused",
    restaurantStatus: "active",
    accessEndsAt: now + DUNNING_GRACE_WINDOW_MS + 1,
    now,
  }), null);
});

test("dunning progresses from grace to last warning to suspension", () => {
  assert.equal(billingDunningStage({
    subscriptionStatus: "pending",
    restaurantStatus: "active",
    accessEndsAt: now + 48 * 60 * 60 * 1000,
    now,
  }), "grace_started");
  assert.equal(billingDunningStage({
    subscriptionStatus: "pending",
    restaurantStatus: "active",
    accessEndsAt: now + 12 * 60 * 60 * 1000,
    now,
  }), "grace_24h");
  assert.equal(billingDunningStage({
    subscriptionStatus: "paused",
    restaurantStatus: "paused",
    accessEndsAt: now,
    now,
  }), "suspended");
});
