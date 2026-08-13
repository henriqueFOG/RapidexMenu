export type SubscriptionRevenueState = {
  status: string | null;
  plan: string | null;
  amountCents: number | null;
};

export type MrrMovement = {
  newMrrCents: number;
  expansionMrrCents: number;
  contractionMrrCents: number;
  churnMrrCents: number;
  newLogos: number;
  churnedLogos: number;
};

export function subscriptionEventStatement(
  db: D1Database,
  input: {
    subscriptionId: string;
    restaurantId: string;
    source: string;
    before: SubscriptionRevenueState;
    after: { status: string; plan: string; amountCents: number };
    occurredAt?: number;
  },
) {
  const occurredAt = input.occurredAt ?? Date.now();
  return db.prepare(
    `INSERT INTO platform_subscription_events
     (id, subscription_id, restaurant_id, source, status_before, status_after,
      plan_before, plan_after, amount_before_cents, amount_after_cents, occurred_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    crypto.randomUUID(),
    input.subscriptionId,
    input.restaurantId,
    input.source.slice(0, 80),
    input.before.status,
    input.after.status,
    input.before.plan,
    input.after.plan,
    input.before.amountCents,
    input.after.amountCents,
    occurredAt,
    Date.now(),
  );
}

export function classifyMrrMovement(
  before: SubscriptionRevenueState,
  after: SubscriptionRevenueState,
): MrrMovement {
  const beforeMrr = before.status === "authorized" ? Math.max(0, Number(before.amountCents || 0)) : 0;
  const afterMrr = after.status === "authorized" ? Math.max(0, Number(after.amountCents || 0)) : 0;
  const delta = afterMrr - beforeMrr;
  return {
    newMrrCents: beforeMrr === 0 && afterMrr > 0 ? afterMrr : 0,
    expansionMrrCents: beforeMrr > 0 && delta > 0 ? delta : 0,
    contractionMrrCents: afterMrr > 0 && delta < 0 ? Math.abs(delta) : 0,
    churnMrrCents: beforeMrr > 0 && afterMrr === 0 ? beforeMrr : 0,
    newLogos: beforeMrr === 0 && afterMrr > 0 ? 1 : 0,
    churnedLogos: beforeMrr > 0 && afterMrr === 0 ? 1 : 0,
  };
}

export function addMrrMovements(left: MrrMovement, right: MrrMovement): MrrMovement {
  return {
    newMrrCents: left.newMrrCents + right.newMrrCents,
    expansionMrrCents: left.expansionMrrCents + right.expansionMrrCents,
    contractionMrrCents: left.contractionMrrCents + right.contractionMrrCents,
    churnMrrCents: left.churnMrrCents + right.churnMrrCents,
    newLogos: left.newLogos + right.newLogos,
    churnedLogos: left.churnedLogos + right.churnedLogos,
  };
}

export const EMPTY_MRR_MOVEMENT: MrrMovement = {
  newMrrCents: 0,
  expansionMrrCents: 0,
  contractionMrrCents: 0,
  churnMrrCents: 0,
  newLogos: 0,
  churnedLogos: 0,
};
