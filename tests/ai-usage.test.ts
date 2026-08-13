import assert from "node:assert/strict";
import test from "node:test";
import { aiDailyLimit, aiUsageLimitsForPlan } from "../lib/ai-usage-policy";

test("AI safety ceilings increase with commercial plan", () => {
  const start = aiUsageLimitsForPlan("start");
  const growth = aiUsageLimitsForPlan("growth");
  const scale = aiUsageLimitsForPlan("scale");

  assert.ok(start.responseDaily < growth.responseDaily);
  assert.ok(growth.responseDaily < scale.responseDaily);
  assert.ok(start.transcriptionDaily < growth.transcriptionDaily);
  assert.ok(growth.transcriptionDaily < scale.transcriptionDaily);
});

test("unknown plans fail closed to the Start safety ceiling", () => {
  assert.deepEqual(aiUsageLimitsForPlan("unknown"), aiUsageLimitsForPlan("start"));
});

test("trial uses the smaller internal safety ceiling", () => {
  assert.equal(aiDailyLimit({ plan: "scale", kind: "response", trialActive: true }), 300);
  assert.equal(aiDailyLimit({ plan: "scale", kind: "transcription", trialActive: true }), 40);
  assert.equal(aiDailyLimit({ plan: "scale", kind: "response", trialActive: false }), 10_000);
});
