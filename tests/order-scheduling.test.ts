import assert from "node:assert/strict";
import test from "node:test";
import { HttpError } from "../lib/http";
import {
  assertScheduledAvailability,
  normalizeScheduledFor,
  scheduleSlotStart,
  SCHEDULE_SLOT_MS,
} from "../lib/order-scheduling";

const NOW = Date.UTC(2026, 7, 13, 12, 0, 0);

test("scheduled order accepts a future minute and normalizes seconds", () => {
  const value = normalizeScheduledFor(NOW + 90 * 60_000 + 32_100, NOW);
  assert.equal(value, NOW + 90 * 60_000);
});

test("scheduled order rejects a time with less than 30 minutes lead", () => {
  assert.throws(
    () => normalizeScheduledFor(NOW + 29 * 60_000, NOW),
    (error: unknown) => error instanceof HttpError && error.code === "schedule_too_soon" && error.status === 409,
  );
});

test("scheduled order rejects dates beyond 14 days", () => {
  assert.throws(
    () => normalizeScheduledFor(NOW + 15 * 24 * 60 * 60_000, NOW),
    (error: unknown) => error instanceof HttpError && error.code === "schedule_too_far" && error.status === 409,
  );
});

test("schedule slot is deterministic in 15 minute buckets", () => {
  const timestamp = NOW + 37 * 60_000;
  const slot = scheduleSlotStart(timestamp);
  assert.equal(slot % SCHEDULE_SLOT_MS, 0);
  assert.ok(timestamp >= slot && timestamp < slot + SCHEDULE_SLOT_MS);
});

test("scheduled order validates the target opening hours", () => {
  const monday = Date.UTC(2026, 7, 10, 15, 0, 0); // 12:00 America/Sao_Paulo
  assert.doesNotThrow(() => assertScheduledAvailability({
    scheduledFor: monday,
    isOpen: 1,
    timezone: "America/Sao_Paulo",
    settingsJson: JSON.stringify({ weeklyHours: { mon: [{ open: "11:00", close: "14:00" }] } }),
  }));

  assert.throws(
    () => assertScheduledAvailability({
      scheduledFor: monday + 4 * 60 * 60_000,
      isOpen: 1,
      timezone: "America/Sao_Paulo",
      settingsJson: JSON.stringify({ weeklyHours: { mon: [{ open: "11:00", close: "14:00" }] } }),
    }),
    (error: unknown) => error instanceof HttpError && error.code === "scheduled_store_closed",
  );
});
