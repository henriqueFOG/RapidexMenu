export type BillingDunningStage = "grace_started" | "grace_24h" | "suspended";

export const DUNNING_GRACE_WINDOW_MS = 72 * 60 * 60 * 1000;
const LAST_WARNING_MS = 24 * 60 * 60 * 1000;

export function billingDunningStage(input: {
  subscriptionStatus: string;
  restaurantStatus: string;
  accessEndsAt: number | null;
  now?: number;
}): BillingDunningStage | null {
  const now = input.now ?? Date.now();
  // A voluntary cancellation simply runs through the already-paid period and
  // must not be treated as delinquency. Dunning is only for payment states.
  if (!['pending', 'paused'].includes(input.subscriptionStatus)) return null;

  const accessEndsAt = Number(input.accessEndsAt || 0);
  if (input.restaurantStatus === "paused" || (accessEndsAt > 0 && accessEndsAt <= now)) {
    return "suspended";
  }
  if (!accessEndsAt) return null;

  const remaining = accessEndsAt - now;
  // A provider can be paused/pending while the customer is still inside an
  // already-paid period. Dunning only starts in the explicit 72h grace window.
  if (remaining > DUNNING_GRACE_WINDOW_MS) return null;
  if (remaining <= LAST_WARNING_MS) return "grace_24h";
  return "grace_started";
}
