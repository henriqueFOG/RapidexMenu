import assert from "node:assert/strict";
import test from "node:test";
import { aiUsageLimitsForPlan } from "../lib/ai-usage";

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
