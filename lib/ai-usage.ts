import { getDatabase } from "./runtime";

type AiUsageKind = "response" | "transcription";
type RapidexPlan = "start" | "growth" | "scale";

type TenantCommercialState = {
  plan: RapidexPlan;
  status: string;
  trial_ends_at: number | null;
};

const RESPONSE_DAILY_LIMIT: Record<RapidexPlan, number> = {
  start: 300,
  growth: 2_000,
  scale: 10_000,
};

const TRANSCRIPTION_DAILY_LIMIT: Record<RapidexPlan, number> = {
  start: 40,
  growth: 250,
  scale: 1_000,
};

const FAILURE_WINDOW_MS = 5 * 60_000;
const CIRCUIT_OPEN_MS = 10 * 60_000;
const FAILURE_THRESHOLD = 5;

export async function reserveAiUsage(restaurantId: string, kind: AiUsageKind, now = Date.now()) {
  const db = getDatabase();
  const state = await db.prepare(
    "SELECT plan, status, trial_ends_at FROM restaurants WHERE id = ? LIMIT 1",
  ).bind(restaurantId).first<TenantCommercialState>();
  if (!state) return { allowed: false, reason: "tenant_not_found" as const, limit: 0, used: 0 };

  const plan = normalizePlan(state.plan);
  // Trial accounts use a deliberately smaller safety ceiling. This is an internal
  // abuse/cost guard, not a published usage allowance or billing entitlement.
  const trialActive = state.status === "trial" && (!state.trial_ends_at || Number(state.trial_ends_at) > now);
  const baseLimit = kind === "response" ? RESPONSE_DAILY_LIMIT[plan] : TRANSCRIPTION_DAILY_LIMIT[plan];
  const limit = trialActive ? Math.min(baseLimit, kind === "response" ? 300 : 40) : baseLimit;
  const usageDay = utcDay(now);
  const responseIncrement = kind === "response" ? 1 : 0;
  const transcriptionIncrement = kind === "transcription" ? 1 : 0;
  const countColumn = kind === "response" ? "response_requests" : "transcription_requests";

  const row = await db.prepare(
    `INSERT INTO ai_usage_daily
     (restaurant_id, usage_day, response_requests, transcription_requests, input_tokens, output_tokens, created_at, updated_at)
     VALUES (?, ?, ?, ?, 0, 0, ?, ?)
     ON CONFLICT (restaurant_id, usage_day) DO UPDATE SET
       response_requests = ai_usage_daily.response_requests + ?,
       transcription_requests = ai_usage_daily.transcription_requests + ?,
       updated_at = excluded.updated_at
     WHERE ai_usage_daily.${countColumn} < ?
     RETURNING response_requests, transcription_requests`,
  ).bind(
    restaurantId,
    usageDay,
    responseIncrement,
    transcriptionIncrement,
    now,
    now,
    responseIncrement,
    transcriptionIncrement,
    limit,
  ).first<{ response_requests: number; transcription_requests: number }>();

  if (!row) return { allowed: false, reason: "daily_limit" as const, limit, used: limit };
  return {
    allowed: true,
    reason: "reserved" as const,
    limit,
    used: kind === "response" ? Number(row.response_requests) : Number(row.transcription_requests),
  };
}

export async function addAiTokenUsage(
  restaurantId: string,
  inputTokens: number,
  outputTokens: number,
  now = Date.now(),
) {
  const safeInput = safeTokenCount(inputTokens);
  const safeOutput = safeTokenCount(outputTokens);
  if (!safeInput && !safeOutput) return;
  await getDatabase().prepare(
    `UPDATE ai_usage_daily SET input_tokens = input_tokens + ?, output_tokens = output_tokens + ?, updated_at = ?
     WHERE restaurant_id = ? AND usage_day = ?`,
  ).bind(safeInput, safeOutput, now, restaurantId, utcDay(now)).run();
}

export async function aiCircuitOpen(restaurantId: string, provider = "openai", now = Date.now()) {
  const row = await getDatabase().prepare(
    `SELECT open_until FROM ai_provider_circuits WHERE restaurant_id = ? AND provider = ? LIMIT 1`,
  ).bind(restaurantId, provider).first<{ open_until: number | null }>();
  const openUntil = Number(row?.open_until || 0);
  return { open: openUntil > now, openUntil: openUntil || null };
}

export async function recordAiProviderSuccess(restaurantId: string, provider = "openai", now = Date.now()) {
  await getDatabase().prepare(
    `INSERT INTO ai_provider_circuits
     (restaurant_id, provider, failure_count, window_started_at, open_until, last_error_code, updated_at)
     VALUES (?, ?, 0, ?, NULL, NULL, ?)
     ON CONFLICT (restaurant_id, provider) DO UPDATE SET
       failure_count = 0, window_started_at = excluded.window_started_at,
       open_until = NULL, last_error_code = NULL, updated_at = excluded.updated_at`,
  ).bind(restaurantId, provider, now, now).run();
}

export async function recordAiProviderFailure(
  restaurantId: string,
  errorCode: string,
  provider = "openai",
  now = Date.now(),
) {
  const windowCutoff = now - FAILURE_WINDOW_MS;
  await getDatabase().prepare(
    `INSERT INTO ai_provider_circuits
     (restaurant_id, provider, failure_count, window_started_at, open_until, last_error_code, updated_at)
     VALUES (?, ?, 1, ?, NULL, ?, ?)
     ON CONFLICT (restaurant_id, provider) DO UPDATE SET
       failure_count = CASE
         WHEN ai_provider_circuits.window_started_at < ? THEN 1
         ELSE ai_provider_circuits.failure_count + 1
       END,
       window_started_at = CASE
         WHEN ai_provider_circuits.window_started_at < ? THEN excluded.window_started_at
         ELSE ai_provider_circuits.window_started_at
       END,
       open_until = CASE
         WHEN ai_provider_circuits.window_started_at >= ?
          AND ai_provider_circuits.failure_count + 1 >= ? THEN ?
         ELSE NULL
       END,
       last_error_code = excluded.last_error_code,
       updated_at = excluded.updated_at`,
  ).bind(
    restaurantId,
    provider,
    now,
    errorCode.slice(0, 80),
    now,
    windowCutoff,
    windowCutoff,
    windowCutoff,
    FAILURE_THRESHOLD,
    now + CIRCUIT_OPEN_MS,
  ).run();
}

export function aiUsageLimitsForPlan(plan: string) {
  const normalized = normalizePlan(plan);
  return {
    responseDaily: RESPONSE_DAILY_LIMIT[normalized],
    transcriptionDaily: TRANSCRIPTION_DAILY_LIMIT[normalized],
  };
}

function normalizePlan(plan: string): RapidexPlan {
  if (plan === "scale" || plan === "growth") return plan;
  return "start";
}

function utcDay(timestamp: number) {
  return new Date(timestamp).toISOString().slice(0, 10);
}

function safeTokenCount(value: number) {
  return Number.isFinite(value) && value > 0 ? Math.min(100_000_000, Math.floor(value)) : 0;
}
