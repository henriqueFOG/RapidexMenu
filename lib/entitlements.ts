import type { AdminContext, RapidexPlan } from "./admin-auth";
import { HttpError } from "./http";

export type CommercialFeature =
  | "ai_sales"
  | "whatsapp_connection"
  | "multi_unit"
  | "kds";

const planRank: Record<RapidexPlan, number> = {
  start: 1,
  growth: 2,
  scale: 3,
};

const minimumPlan: Record<CommercialFeature, RapidexPlan> = {
  ai_sales: "growth",
  whatsapp_connection: "growth",
  multi_unit: "scale",
  kds: "scale",
};

export function effectiveCommercialPlan(
  input: Pick<AdminContext, "plan" | "restaurantStatus" | "trialEndsAt">,
  now = Date.now(),
): RapidexPlan {
  // Sales rule: every valid trial demonstrates at least the Growth experience.
  // Scale-only capabilities remain exclusive to Scale even during a Start/Growth trial.
  if (input.restaurantStatus === "trial" && (!input.trialEndsAt || input.trialEndsAt > now)) {
    return planRank[input.plan] >= planRank.growth ? input.plan : "growth";
  }
  return input.plan;
}

export function hasCommercialFeature(
  input: Pick<AdminContext, "plan" | "restaurantStatus" | "trialEndsAt">,
  feature: CommercialFeature,
  now = Date.now(),
) {
  const plan = effectiveCommercialPlan(input, now);
  return planRank[plan] >= planRank[minimumPlan[feature]];
}

export function requireCommercialFeature(
  context: Pick<AdminContext, "plan" | "restaurantStatus" | "trialEndsAt">,
  feature: CommercialFeature,
) {
  if (hasCommercialFeature(context, feature)) return;
  const required = minimumPlan[feature];
  throw new HttpError(
    403,
    `Este recurso está disponível a partir do plano ${planLabel(required)}.`,
    "feature_not_in_plan",
    { feature, requiredPlan: required },
  );
}

function planLabel(plan: RapidexPlan) {
  return ({ start: "Começo", growth: "Crescimento", scale: "Escala" } as const)[plan];
}
