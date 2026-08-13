import { ensureDemoData } from "@/lib/demo-data";
import { assertFulfillmentEnabled } from "@/lib/fulfillment";
import { apiError, HttpError, json, readJson } from "@/lib/http";
import { createOrder, type FulfillmentType } from "@/lib/order-service";
import { assertScheduledAvailability, normalizeScheduledFor } from "@/lib/order-scheduling";
import { consumeRateLimit, rateLimitKey } from "@/lib/rate-limit";
import { getDatabase } from "@/lib/runtime";
import { safeSlug } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const db = getDatabase();
    const limit = await consumeRateLimit(db, await rateLimitKey(request, "scheduled-orders"), 15, 60_000);
    if (!limit.allowed) throw new HttpError(429, "Muitas tentativas. Aguarde um minuto.", "rate_limited");

    await ensureDemoData(db);
    const body = await readJson<Record<string, unknown>>(request, 120_000);
    const slug = safeSlug(body.restaurantSlug);
    const restaurant = await db.prepare(
      `SELECT id, status, trial_ends_at, access_ends_at, settings_json, is_open, timezone
       FROM restaurants WHERE slug = ? LIMIT 1`,
    ).bind(slug).first<{
      id: string;
      status: string;
      trial_ends_at: number | null;
      access_ends_at: number | null;
      settings_json: string;
      is_open: number;
      timezone: string;
    }>();

    const now = Date.now();
    const trialValid = restaurant?.status === "trial" && (!restaurant.trial_ends_at || Number(restaurant.trial_ends_at) > now);
    const activeValid = restaurant?.status === "active" && (!restaurant.access_ends_at || Number(restaurant.access_ends_at) > now);
    if (!restaurant || (!trialValid && !activeValid)) {
      throw new HttpError(403, "Esta loja está temporariamente indisponível para novos pedidos.", "store_subscription_inactive");
    }

    const scheduledFor = normalizeScheduledFor(body.scheduledFor, now);
    if (!scheduledFor) throw new HttpError(400, "Informe a data e a hora do pedido agendado.", "schedule_required");
    assertScheduledAvailability({
      scheduledFor,
      isOpen: restaurant.is_open,
      timezone: restaurant.timezone,
      settingsJson: restaurant.settings_json,
    });

    const fulfillmentType = String(body.fulfillmentType ?? "delivery");
    if (!["delivery", "pickup", "dine_in"].includes(fulfillmentType)) {
      throw new HttpError(400, "Tipo de atendimento inválido.", "validation_error", { field: "fulfillmentType" });
    }
    assertFulfillmentEnabled(restaurant.settings_json, fulfillmentType as FulfillmentType);

    const paymentMethod = String(body.paymentMethod ?? "card_on_delivery");
    if (!["cash", "card_on_delivery"].includes(paymentMethod)) {
      throw new HttpError(
        409,
        "Para pedido agendado, use dinheiro ou cartão no atendimento enquanto o Pix agendado passa pela homologação financeira.",
        "scheduled_payment_not_available",
      );
    }

    const order = await createOrder(db, { ...body, paymentMethod });
    const current = await db.prepare(
      "SELECT scheduled_for FROM orders WHERE id = ? AND restaurant_id = ? LIMIT 1",
    ).bind(order.id, order.restaurantId).first<{ scheduled_for: number | null }>();
    const persisted = current?.scheduled_for === null || current?.scheduled_for === undefined ? null : Number(current.scheduled_for);

    if (order.existing) {
      if (persisted !== scheduledFor) {
        throw new HttpError(
          409,
          "Esse identificador de pedido já foi usado com outro horário. Atualize a página e tente novamente.",
          "idempotency_conflict",
        );
      }
    } else {
      try {
        await db.prepare(
          "UPDATE orders SET scheduled_for = ?, updated_at = ? WHERE id = ? AND restaurant_id = ? AND status = 'received'",
        ).bind(scheduledFor, Date.now(), order.id, order.restaurantId).run();
      } catch (error) {
        const timestamp = Date.now();
        try {
          await db.batch([
            db.prepare(
              "UPDATE orders SET status = 'canceled', canceled_at = ?, updated_at = ? WHERE id = ? AND restaurant_id = ? AND status = 'received'",
            ).bind(timestamp, timestamp, order.id, order.restaurantId),
            db.prepare(
              `UPDATE customers SET order_count = GREATEST(0, order_count - 1),
               lifetime_value_cents = GREATEST(0, lifetime_value_cents - ?), updated_at = ?
               WHERE id = ? AND restaurant_id = ?`,
            ).bind(order.totalCents, timestamp, order.customerId, order.restaurantId),
          ]);
        } catch (cleanupError) {
          console.error("Scheduled order compensation failed", cleanupError instanceof Error ? cleanupError.message : "unknown");
        }
        throw error;
      }
    }

    return json({
      ok: true,
      order: {
        id: order.id,
        trackingToken: order.trackingToken,
        number: order.orderNumber,
        restaurantName: order.restaurantName,
        totalCents: order.totalCents,
        subtotalCents: order.subtotalCents,
        deliveryFeeCents: order.deliveryFeeCents,
        deliveryZoneName: order.deliveryZoneName,
        fulfillmentType: order.fulfillmentType,
        tableCode: order.tableCode,
        scheduledFor,
        status: "received",
        promisedFromMinutes: order.promisedFromMinutes,
        promisedToMinutes: order.promisedToMinutes,
        existing: order.existing,
      },
      payment: { providerConfigured: false, status: "pending" },
    }, { status: order.existing ? 200 : 201 });
  } catch (error) {
    return apiError(error, request);
  }
}
