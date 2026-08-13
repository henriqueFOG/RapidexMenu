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

export async function GET() {
  try {
    await requirePlatformAdmin();
    const db = getDatabase();
    const [restaurantsResult, firstOrdersResult, subscriptionsResult, integrationsResult] = await Promise.all([
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

    const paying = Array.from(latestSubscriptions.values()).filter((subscription) => subscription.status === "authorized");
    const mrrCents = paying.reduce((sum, subscription) => sum + Number(subscription.amount_cents), 0);
    const published = restaurants.filter((restaurant) => Boolean(restaurant.published_at));
    const activated = restaurants.filter((restaurant) => firstOrders.has(restaurant.id));
    const activated48h = activated.filter((restaurant) => {
      const first = firstOrders.get(restaurant.id)!;
      return first - Number(restaurant.created_at) <= 48 * 60 * 60 * 1000;
    });
    const trials = restaurants.filter((restaurant) => restaurant.status === "trial");
    const now = Date.now();
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
    });
  } catch (error) {
    return apiError(error);
  }
}
