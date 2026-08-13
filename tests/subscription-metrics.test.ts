import assert from "node:assert/strict";
import test from "node:test";
import { classifyMrrMovement } from "../lib/subscription-events";

test("classifies new, expansion, contraction and churn MRR", () => {
  assert.deepEqual(
    classifyMrrMovement({ status: "pending", plan: "growth", amountCents: 29700 }, { status: "authorized", plan: "growth", amountCents: 29700 }),
    { newMrrCents: 29700, expansionMrrCents: 0, contractionMrrCents: 0, churnMrrCents: 0, newLogos: 1, churnedLogos: 0 },
  );
  assert.equal(
    classifyMrrMovement({ status: "authorized", plan: "start", amountCents: 9700 }, { status: "authorized", plan: "growth", amountCents: 29700 }).expansionMrrCents,
    20000,
  );
  assert.equal(
    classifyMrrMovement({ status: "authorized", plan: "scale", amountCents: 59700 }, { status: "authorized", plan: "growth", amountCents: 29700 }).contractionMrrCents,
    30000,
  );
  const churn = classifyMrrMovement({ status: "authorized", plan: "growth", amountCents: 29700 }, { status: "cancelled", plan: "growth", amountCents: 29700 });
  assert.equal(churn.churnMrrCents, 29700);
  assert.equal(churn.churnedLogos, 1);
});

test("non-revenue status changes do not create fake MRR movement", () => {
  const movement = classifyMrrMovement(
    { status: "pending", plan: "growth", amountCents: 29700 },
    { status: "paused", plan: "growth", amountCents: 29700 },
  );
  assert.equal(Object.values(movement).reduce((sum, value) => sum + value, 0), 0);
});
