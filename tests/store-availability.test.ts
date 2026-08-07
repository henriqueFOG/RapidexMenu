import assert from "node:assert/strict";
import test from "node:test";
import { isRestaurantAcceptingOrders, validateWeeklyHours } from "../lib/store-availability";

const schedule = {
  fri: [{ open: "18:00", close: "02:00" }],
  sat: [{ open: "18:00", close: "23:00" }],
};

test("manual pause always blocks orders", () => {
  assert.equal(isRestaurantAcceptingOrders({
    isOpen: 0,
    settingsJson: { weeklyHours: schedule },
    now: Date.parse("2026-08-07T22:00:00Z"),
  }), false);
});

test("store opens inside same-day weekly window", () => {
  assert.equal(isRestaurantAcceptingOrders({
    isOpen: 1,
    timezone: "America/Sao_Paulo",
    settingsJson: { weeklyHours: schedule },
    now: Date.parse("2026-08-07T22:00:00Z"),
  }), true);
});

test("overnight window remains open after midnight", () => {
  assert.equal(isRestaurantAcceptingOrders({
    isOpen: 1,
    timezone: "America/Sao_Paulo",
    settingsJson: { weeklyHours: schedule },
    now: Date.parse("2026-08-08T04:00:00Z"),
  }), true);
});

test("overnight window closes after configured end", () => {
  assert.equal(isRestaurantAcceptingOrders({
    isOpen: 1,
    timezone: "America/Sao_Paulo",
    settingsJson: { weeklyHours: schedule },
    now: Date.parse("2026-08-08T06:00:00Z"),
  }), false);
});

test("legacy stores without schedule preserve manual open flag", () => {
  assert.equal(isRestaurantAcceptingOrders({ isOpen: 1, settingsJson: {} }), true);
});

test("malformed stored schedule fails closed", () => {
  assert.equal(isRestaurantAcceptingOrders({ isOpen: 1, settingsJson: { weeklyHours: "bad" } }), false);
});

test("weekly schedule validator rejects invalid times", () => {
  assert.throws(() => validateWeeklyHours({ mon: [{ open: "25:00", close: "18:00" }] }));
});
