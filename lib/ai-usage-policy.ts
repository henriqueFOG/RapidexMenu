export type AiUsageKind = "response" | "transcription";
export type AiUsagePlan = "start" | "growth" | "scale";

const RESPONSE_DAILY_LIMIT: Record<AiUsagePlan, number> = {
  start: 300,
  growth: 2_000,
  scale: 10_000,
};

const TRANSCRIPTION_DAILY_LIMIT: Record<AiUsagePlan, number> = {
  start: 40,
  growth: 250,
  scale: 1_000,
};

export function normalizeAiUsagePlan(plan: string): AiUsagePlan {
  if (plan === "scale" || plan === "growth") return plan;
  return "start";
}

export function aiUsageLimitsForPlan(plan: string) {
  const normalized = normalizeAiUsagePlan(plan);
  return {
    responseDaily: RESPONSE_DAILY_LIMIT[normalized],
    transcriptionDaily: TRANSCRIPTION_DAILY_LIMIT[normalized],
  };
}

export function aiDailyLimit(input: {
  plan: string;
  kind: AiUsageKind;
  trialActive: boolean;
}) {
  const limits = aiUsageLimitsForPlan(input.plan);
  const base = input.kind === "response" ? limits.responseDaily : limits.transcriptionDaily;
  if (!input.trialActive) return base;
  return Math.min(base, input.kind === "response" ? 300 : 40);
}
