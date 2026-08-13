import { apiError, json } from "@/lib/http";
import { requirePlatformAdmin } from "@/lib/platform-admin";
import { getDatabase } from "@/lib/runtime";

export const dynamic = "force-dynamic";

type RestaurantRow = {
  id: string;
  name: string;
  slug: string;
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

export async function GET(request: Request) {
  try {
    await requirePlatformAdmin();
    const db = getDatabase();
    const now = Date.now();
    const today = new Date(now).toISOString().slice(0, 10);
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
    ] = await Promise.all([
      db.prepare(
        `SELECT id, name, slug, plan, status, published_at, trial_ends_at, access_ends_at, created_at
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
    const published = restaurants.filter((restaurant) => Boolean(restaurant.published_at));
    const activated = restaurants.filter((restaurant) => firstOrders.has(restaurant.id));
    const activated48h = activated.filter((restaurant) => {
      const first = firstOrders.get(restaurant.id)!;
      return first - Number(restaurant.created_at) <= 48 * 60 * 60 * 1000;
    });
    const trials = restaurants.filter((restaurant) => restaurant.status === "trial");
    const expiringTrials = trials.filter((restaurant) => restaurant.trial_ends_at && Number(restaurant.trial_ends_at) > now && Number(restaurant.trial_ends_at) <= now + 3 * 24 * 60 * 60 * 1000);

    return json({
      ok: true,
      metrics: {
        restaurants: restaurants.length,
        published: published.length,
        activated: activated.length,
        activationRate: restaurants.length ? Math.round((activated.length / restaurants.length) * 1000) / 10 : 0,
        activation48hRate: activated.length ? Math.round((activated48h.length / activated.length) * 1000) / 10 : 0,
        trials: trials.length,
        trialsExpiring72h: expiringTrials.length,
        payingRestaurants: paying.length,
        mrrCents,
        arrRunRateCents: mrrCents * 12,
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
          plan: restaurant.plan,
          status: restaurant.status,
          published: Boolean(restaurant.published_at),
          createdAt: restaurant.created_at,
          firstOrderAt,
          activatedWithin48h: firstOrderAt ? firstOrderAt - Number(restaurant.created_at) <= 48 * 60 * 60 * 1000 : false,
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
