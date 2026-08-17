import { apiError, json } from "@/lib/http";
import { requirePlatformAdmin } from "@/lib/platform-admin";
import { getDatabase } from "@/lib/runtime";
import { addMrrMovements, classifyMrrMovement, EMPTY_MRR_MOVEMENT } from "@/lib/subscription-events";

export const dynamic = "force-dynamic";

type RestaurantRow = {
  id: string;
  name: string;
  slug: string;
  owner_email: string;
  plan: "start" | "growth" | "scale";
  status: string;
  published_at: number | null;
  trial_ends_at: number | null;
  access_ends_at: number | null;
  created_at: number;
};
type FirstOrderRow = { restaurant_id: string; first_order_at: number };
type SubscriptionRow = {
  restaurant_id: string;
  plan: string;
  amount_cents: number;
  status: string;
  updated_at: number;
};
type IntegrationRow = { restaurant_id: string; provider: string; status: string };
type CountRow = { status: string; total: number };
type SubscriptionEventRow = {
  source: string;
  status_before: string | null;
  status_after: string;
  plan_before: string | null;
  plan_after: string;
  amount_before_cents: number | null;
  amount_after_cents: number;
  occurred_at: number;
};

export async function GET(request: Request) {
  try {
    await requirePlatformAdmin();
    const db = getDatabase();
    const now = Date.now();
    const today = new Date(now).toISOString().slice(0, 10);
    const cutoff30d = now - 30 * 24 * 60 * 60_000;
    const stalePaymentCutoff = now - 30 * 60_000;
    const webhookCutoff = now - 24 * 60 * 60_000;
    const [
      restaurantsResult,
      firstOrdersResult,
      subscriptionsResult,
      integrationsResult,
      jobsResult,
      aiUsage,
      dunningResult,
      failedWebhooks,
      stalePayments,
      subscriptionEvents,
      eventWindow,
    ] = await Promise.all([
      db.prepare(
        `SELECT id, name, slug, owner_email, plan, status, published_at, trial_ends_at, access_ends_at, created_at
         FROM restaurants
         WHERE status != 'canceled'
         ORDER BY created_at DESC
         LIMIT 1000`,
      ).all<RestaurantRow>(),
      db.prepare(
        `SELECT restaurant_id, MIN(created_at) AS first_order_at
         FROM orders GROUP BY restaurant_id`,
      ).all<FirstOrderRow>(),
      db.prepare(
        `SELECT restaurant_id, plan, amount_cents, status, updated_at
         FROM platform_subscriptions
         ORDER BY updated_at DESC`,
      ).all<SubscriptionRow>(),
      db.prepare(
        `SELECT restaurant_id, provider, status FROM integrations`,
      ).all<IntegrationRow>(),
      db.prepare(
        `SELECT status, COUNT(*) AS total FROM job_queue GROUP BY status`,
      ).all<CountRow>(),
      db.prepare(
        `SELECT COALESCE(SUM(response_requests),0) AS response_requests,
                COALESCE(SUM(transcription_requests),0) AS transcription_requests,
                COALESCE(SUM(input_tokens),0) AS input_tokens,
                COALESCE(SUM(output_tokens),0) AS output_tokens
         FROM ai_usage_daily WHERE usage_day = ?`,
      ).bind(today).first<{
        response_requests: number;
        transcription_requests: number;
        input_tokens: number;
        output_tokens: number;
      }>(),
      db.prepare(
        `SELECT status, COUNT(*) AS total FROM billing_dunning_events GROUP BY status`,
      ).all<CountRow>(),
      db.prepare(
        `SELECT COUNT(*) AS total FROM webhook_events
         WHERE status = 'failed' AND received_at >= ?`,
      ).bind(webhookCutoff).first<{ total: number }>(),
      db.prepare(
        `SELECT COUNT(*) AS total FROM payments
         WHERE status = 'pending' AND created_at <= ?`,
      ).bind(stalePaymentCutoff).first<{ total: number }>(),
      db.prepare(
        `SELECT source, status_before, status_after, plan_before, plan_after,
                amount_before_cents, amount_after_cents, occurred_at
         FROM platform_subscription_events
         WHERE occurred_at >= ? AND source != 'migration_snapshot'
         ORDER BY occurred_at ASC`,
      ).bind(cutoff30d).all<SubscriptionEventRow>(),
      db.prepare(
        `SELECT MIN(occurred_at) AS oldest_event_at FROM platform_subscription_events`,
      ).first<{ oldest_event_at: number | null }>(),
    ]);

    const restaurants = restaurantsResult.results;
    const firstOrders = new Map(firstOrdersResult.results.map((row) => [row.restaurant_id, Number(row.first_order_at)]));
    const latestSubscriptions = new Map<string, SubscriptionRow>();
    for (const subscription of subscriptionsResult.results) {
      if (!latestSubscriptions.has(subscription.restaurant_id)) latestSubscriptions.set(subscription.restaurant_id, subscription);
    }
    const integrations = new Map<string, IntegrationRow[]>();
    for (const integration of integrationsResult.results) {
      const current = integrations.get(integration.restaurant_id) || [];
      current.push(integration);
      integrations.set(integration.restaurant_id, current);
    }

    const jobCounts = Object.fromEntries(jobsResult.results.map((row) => [row.status, Number(row.total)]));
    const dunningCounts = Object.fromEntries(dunningResult.results.map((row) => [row.status, Number(row.total)]));
    const paying = Array.from(latestSubscriptions.values()).filter((subscription) => subscription.status === "authorized");
    const mrrCents = paying.reduce((sum, subscription) => sum + Number(subscription.amount_cents), 0);
    const movements30d = subscriptionEvents.results.reduce((total, event) => addMrrMovements(total, classifyMrrMovement(
      { status: event.status_before, plan: event.plan_before, amountCents: event.amount_before_cents },
      { status: event.status_after, plan: event.plan_after, amountCents: event.amount_after_cents },
    )), EMPTY_MRR_MOVEMENT);
    const oldestEventAt = Number(eventWindow?.oldest_event_at || 0) || null;
    const has30dSubscriptionHistory = Boolean(oldestEventAt && oldestEventAt <= cutoff30d);
    const startingMrr30dCents = Math.max(0,
      mrrCents - movements30d.newMrrCents - movements30d.expansionMrrCents +
      movements30d.contractionMrrCents + movements30d.churnMrrCents,
    );
    const startingLogos30d = Math.max(0, paying.length - movements30d.newLogos + movements30d.churnedLogos);
    const nrr30d = has30dSubscriptionHistory && startingMrr30dCents > 0
      ? round1(((startingMrr30dCents + movements30d.expansionMrrCents - movements30d.contractionMrrCents - movements30d.churnMrrCents) / startingMrr30dCents) * 100)
      : null;
    const logoChurn30d = has30dSubscriptionHistory && startingLogos30d > 0
      ? round1((movements30d.churnedLogos / startingLogos30d) * 100)
      : null;

    const published = restaurants.filter((restaurant) => Boolean(restaurant.published_at));
    const activated = restaurants.filter((restaurant) => firstOrders.has(restaurant.id));
    const activated48h = activated.filter((restaurant) => {
      const first = firstOrders.get(restaurant.id)!;
      return first - Number(restaurant.created_at) <= 48 * 60 * 60 * 1000;
    });
    const trials = restaurants.filter((restaurant) => restaurant.status === "trial");
    const expiringTrials = trials.filter((restaurant) => restaurant.trial_ends_at && Number(restaurant.trial_ends_at) > now && Number(restaurant.trial_ends_at) <= now + 3 * 24 * 60 * 60_000);

    return json({
      ok: true,
      metrics: {
        restaurants: restaurants.length,
        published: published.length,
        activated: activated.length,
        activationRate: restaurants.length ? round1((activated.length / restaurants.length) * 100) : 0,
        activation48hRate: activated.length ? round1((activated48h.length / activated.length) * 100) : 0,
        trials: trials.length,
        trialsExpiring72h: expiringTrials.length,
        payingRestaurants: paying.length,
        mrrCents,
        arrRunRateCents: mrrCents * 12,
        has30dSubscriptionHistory,
        newMrr30dCents: movements30d.newMrrCents,
        expansionMrr30dCents: movements30d.expansionMrrCents,
        contractionMrr30dCents: movements30d.contractionMrrCents,
        churnMrr30dCents: movements30d.churnMrrCents,
        nrr30d,
        logoChurn30d,
      },
      operations: {
        jobsQueued: Number(jobCounts.queued || 0),
        jobsRunning: Number(jobCounts.running || 0),
        jobsRetry: Number(jobCounts.retry || 0),
        jobsDead: Number(jobCounts.dead || 0),
        failedWebhooks24h: Number(failedWebhooks?.total || 0),
        stalePendingPayments: Number(stalePayments?.total || 0),
        dunningFailed: Number(dunningCounts.failed || 0),
        dunningSending: Number(dunningCounts.sending || 0),
        aiResponsesToday: Number(aiUsage?.response_requests || 0),
        aiTranscriptionsToday: Number(aiUsage?.transcription_requests || 0),
        aiInputTokensToday: Number(aiUsage?.input_tokens || 0),
        aiOutputTokensToday: Number(aiUsage?.output_tokens || 0),
      },
      restaurants: restaurants.slice(0, 200).map((restaurant) => {
        const subscription = latestSubscriptions.get(restaurant.id);
        const restaurantIntegrations = integrations.get(restaurant.id) || [];
        const firstOrderAt = firstOrders.get(restaurant.id) || null;
        return {
          id: restaurant.id,
          name: restaurant.name,
          slug: restaurant.slug,
          ownerEmail: restaurant.owner_email,
          plan: restaurant.plan,
          status: restaurant.status,
          published: Boolean(restaurant.published_at),
          createdAt: restaurant.created_at,
          firstOrderAt,
          activatedWithin48h: firstOrderAt ? firstOrderAt - Number(restaurant.created_at) <= 48 * 60 * 60_000 : false,
          trialEndsAt: restaurant.trial_ends_at,
          accessEndsAt: restaurant.access_ends_at,
          subscription: subscription ? {
            plan: subscription.plan,
            amountCents: Number(subscription.amount_cents),
            status: subscription.status,
          } : null,
          integrations: restaurantIntegrations.map((integration) => ({ provider: integration.provider, status: integration.status })),
        };
      }),
    }, { headers: { "x-request-id": request.headers.get("x-request-id") || crypto.randomUUID() } });
  } catch (error) {
    return apiError(error, request);
  }
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}
