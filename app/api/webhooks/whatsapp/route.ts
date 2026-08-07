import { DEMO_RESTAURANT_ID, ensureDemoData } from "@/lib/demo-data";
import { apiError, HttpError } from "@/lib/http";
import { generateSalesReply, transcribeAudio } from "@/lib/integrations/openai";
import { downloadWhatsAppMedia, sendWhatsAppText } from "@/lib/integrations/whatsapp";
import { getBindings, getDatabase } from "@/lib/runtime";
import { sha256Hex, verifyHmacSha256 } from "@/lib/security";
import { applyWhatsAppOrderFlow, cartContext, getWhatsAppTrackingReply, latestRepeatCart } from "@/lib/whatsapp-order-flow";
import { getWhatsAppDraft } from "@/lib/whatsapp-order-draft";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const bindings = getBindings();
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  if (
    mode === "subscribe" &&
    challenge &&
    bindings.WHATSAPP_VERIFY_TOKEN &&
    token === bindings.WHATSAPP_VERIFY_TOKEN
  ) {
    return new Response(challenge, {
      status: 200,
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
    });
  }
  return new Response("Forbidden", { status: 403 });
}

export async function POST(request: Request) {
  try {
    const bindings = getBindings();
    if (!bindings.WHATSAPP_APP_SECRET) {
      throw new HttpError(503, "Webhook do WhatsApp ainda não configurado.", "integration_not_configured");
    }
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > 2 * 1024 * 1024) {
      throw new HttpError(413, "Webhook acima do limite.", "payload_too_large");
    }
    const signatureHeader = request.headers.get("x-hub-signature-256") || "";
    const provided = signatureHeader.startsWith("sha256=") ? signatureHeader.slice(7) : "";
    if (!provided || !(await verifyHmacSha256(bindings.WHATSAPP_APP_SECRET, rawBody, provided))) {
      throw new HttpError(401, "Assinatura do webhook inválida.", "invalid_signature");
    }

    const payload = JSON.parse(rawBody) as WhatsAppWebhook;
    if (payload.object !== "whatsapp_business_account") {
      return new Response("Ignored", { status: 200 });
    }
    const db = getDatabase();
    await ensureDemoData(db);
    const payloadHash = await sha256Hex(rawBody);

    for (const entry of payload.entry || []) {
      for (const change of entry.changes || []) {
        if (change.field !== "messages") continue;
        const value = change.value;
        const phoneNumberId = value.metadata?.phone_number_id || "";
        const restaurantId = await resolveRestaurant(db, phoneNumberId);
        for (const status of value.statuses || []) {
          await db
            .prepare("UPDATE messages SET status = ? WHERE provider_message_id = ?")
            .bind(status.status || "unknown", status.id)
            .run();
        }
        for (const message of value.messages || []) {
          const eventId = message.id;
          const previous = await db
            .prepare(
              "SELECT status FROM webhook_events WHERE provider = 'whatsapp' AND provider_event_id = ?",
            )
            .bind(eventId)
            .first<{ status: string }>();
          if (previous?.status === "processed") continue;
          if (!previous) {
            await db
              .prepare(
                `INSERT INTO webhook_events
                 (id, provider, provider_event_id, event_type, signature_valid, status, payload_hash, received_at)
                 VALUES (?, 'whatsapp', ?, ?, 1, 'received', ?, ?)`,
              )
              .bind(crypto.randomUUID(), eventId, message.type || "unknown", payloadHash, Date.now())
              .run();
          }
          try {
            await processInboundMessage(
              db,
              restaurantId,
              phoneNumberId,
              message,
              value.contacts?.[0]?.profile?.name || null,
            );
            await db
              .prepare(
                `UPDATE webhook_events SET status = 'processed', processed_at = ?, error = NULL
                 WHERE provider = 'whatsapp' AND provider_event_id = ?`,
              )
              .bind(Date.now(), eventId)
              .run();
          } catch (error) {
            await db
              .prepare(
                `UPDATE webhook_events SET status = 'failed', processed_at = ?, error = ?
                 WHERE provider = 'whatsapp' AND provider_event_id = ?`,
              )
              .bind(
                Date.now(),
                error instanceof Error ? error.message.slice(0, 500) : "unknown",
                eventId,
              )
              .run();
            throw error;
          }
        }
      }
    }
    return new Response("OK", { status: 200 });
  } catch (error) {
    return apiError(error);
  }
}

async function processInboundMessage(
  db: D1Database,
  restaurantId: string,
  phoneNumberId: string,
  message: WhatsAppMessage,
  profileName: string | null,
) {
  const phone = String(message.from || "").replace(/\D/g, "");
  if (!phone) throw new HttpError(400, "Contato do WhatsApp ausente.", "invalid_webhook");
  let text = message.text?.body?.trim() || message.interactive?.button_reply?.title?.trim() || "";
  if (message.type === "audio" && message.audio?.id) {
    const media = await downloadWhatsAppMedia(message.audio.id, phoneNumberId);
    text = await transcribeAudio(media.blob, `pedido.${extensionFor(media.mimeType)}`);
  }
  if (!text) return;

  const timestamp = Date.now();
  const customer = await db
    .prepare(
      `INSERT INTO customers (id, restaurant_id, name, phone, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(restaurant_id, phone) DO UPDATE SET
         name = CASE WHEN customers.name = 'Cliente WhatsApp' THEN excluded.name ELSE customers.name END,
         updated_at = excluded.updated_at
       RETURNING id, name`,
    )
    .bind(
      crypto.randomUUID(),
      restaurantId,
      profileName?.slice(0, 80) || "Cliente WhatsApp",
      phone,
      timestamp,
      timestamp,
    )
    .first<{ id: string; name: string }>();
  if (!customer) throw new HttpError(500, "Cliente do WhatsApp não registrado.");
  const conversation = await db
    .prepare(
      `INSERT INTO conversations
       (id, restaurant_id, customer_id, channel, external_contact_id, status, last_message_at, created_at, updated_at)
       VALUES (?, ?, ?, 'whatsapp', ?, 'bot', ?, ?, ?)
       ON CONFLICT(restaurant_id, channel, external_contact_id) DO UPDATE SET
         customer_id = excluded.customer_id, last_message_at = excluded.last_message_at,
         updated_at = excluded.updated_at
       RETURNING id, status`,
    )
    .bind(crypto.randomUUID(), restaurantId, customer.id, phone, timestamp, timestamp, timestamp)
    .first<{ id: string; status: string }>();
  if (!conversation) throw new HttpError(500, "Conversa não registrada.");
  await db
    .prepare(
      `INSERT OR IGNORE INTO messages
       (id, conversation_id, provider_message_id, direction, type, body, status, metadata_json, created_at)
       VALUES (?, ?, ?, 'inbound', ?, ?, 'received', ?, ?)`,
    )
    .bind(
      crypto.randomUUID(),
      conversation.id,
      message.id,
      message.type === "audio" ? "audio" : "text",
      text,
      JSON.stringify({ transcribed: message.type === "audio", phoneNumberId }),
      timestamp,
    )
    .run();
  if (conversation.status === "human") return;

  const draft = await getWhatsAppDraft(db, restaurantId, customer.id, conversation.id);
  const [restaurant, productRows, preferences, recentOrders] = await Promise.all([
    db.prepare("SELECT name, slug FROM restaurants WHERE id = ?").bind(restaurantId).first<{ name: string; slug: string }>(),
    db
      .prepare(
        `SELECT id, name, description, price_cents, cost_cents, available
         FROM products WHERE restaurant_id = ? AND active = 1 ORDER BY position`,
      )
      .bind(restaurantId)
      .all<{
        id: string;
        name: string;
        description: string;
        price_cents: number;
        cost_cents: number;
        available: number;
      }>(),
    db
      .prepare("SELECT kind, value FROM customer_preferences WHERE customer_id = ?")
      .bind(customer.id)
      .all<{ kind: string; value: string }>(),
    db
      .prepare(
        `SELECT id, order_number, total_cents FROM orders
         WHERE customer_id = ? AND status != 'canceled' ORDER BY created_at DESC LIMIT 3`,
      )
      .bind(customer.id)
      .all<{ id: string; order_number: number; total_cents: number }>(),
  ]);
  if (!restaurant) throw new HttpError(404, "Loja não encontrada.", "store_not_found");

  const orderIds = recentOrders.results.map((order) => order.id);
  const recentItems = orderIds.length
    ? await db
        .prepare(
          `SELECT order_id, product_name FROM order_items WHERE order_id IN (${orderIds
            .map(() => "?")
            .join(",")}) ORDER BY created_at`,
        )
        .bind(...orderIds)
        .all<{ order_id: string; product_name: string }>()
    : { results: [] as Array<{ order_id: string; product_name: string }> };
  const reply = await generateSalesReply({
    restaurantName: restaurant.name,
    message: text,
    customerName: customer.name,
    preferences: preferences.results,
    products: productRows.results.map((product) => ({
      id: product.id,
      name: product.name,
      description: product.description,
      priceCents: Number(product.price_cents),
      marginPercent: Math.round(
        ((Number(product.price_cents) - Number(product.cost_cents)) / Number(product.price_cents)) * 100,
      ),
      available: Boolean(product.available),
    })),
    recentOrders: recentOrders.results.map((order) => ({
      orderNumber: order.order_number,
      totalCents: order.total_cents,
      items: recentItems.results
        .filter((item) => item.order_id === order.id)
        .map((item) => item.product_name),
    })),
    currentCart: cartContext(draft, productRows.results),
    currentCheckout: {
      address: draft.address,
      paymentMethod: draft.paymentMethod || "",
    },
  });

  for (const memory of reply.memory.slice(0, 5)) {
    if (!memory.kind || !memory.value) continue;
    await db
      .prepare(
        `INSERT OR IGNORE INTO customer_preferences
         (id, customer_id, kind, value, confidence, source, created_at, updated_at)
         VALUES (?, ?, ?, ?, 80, 'whatsapp', ?, ?)`,
      )
      .bind(
        crypto.randomUUID(),
        customer.id,
        normalizeMemoryKind(memory.kind),
        memory.value.slice(0, 120),
        timestamp,
        timestamp,
      )
      .run();
  }

  let outboundText = reply.reply;
  let orderId: string | null = null;
  if (reply.requiresHuman) {
    await db
      .prepare("UPDATE conversations SET status = 'human', updated_at = ? WHERE id = ?")
      .bind(Date.now(), conversation.id)
      .run();
  } else if (reply.intent === "track") {
    outboundText = await getWhatsAppTrackingReply(db, restaurantId, customer.id, text);
  } else {
    let salesReply = reply;
    if (reply.intent === "repeat" && reply.cartItems.length === 0) {
      salesReply = { ...reply, cartItems: await latestRepeatCart(db, restaurantId, customer.id) };
    }
    const flow = await applyWhatsAppOrderFlow({
      db,
      draft,
      salesReply,
      message: text,
      restaurantSlug: restaurant.slug,
      customerName: customer.name,
      customerPhone: phone,
      products: productRows.results,
    });
    outboundText = flow.reply;
    orderId = flow.order?.id || null;
  }

  const outboundId = crypto.randomUUID();
  await db
    .prepare(
      `INSERT INTO messages
       (id, conversation_id, direction, type, body, status, metadata_json, created_at)
       VALUES (?, ?, 'outbound', 'text', ?, 'queued', ?, ?)`,
    )
    .bind(
      outboundId,
      conversation.id,
      outboundText,
      JSON.stringify({ replyTo: message.id, intent: reply.intent, reason: reply.decisionReason, phoneNumberId, orderId }),
      Date.now(),
    )
    .run();
  const sent = await sendWhatsAppText(phone, outboundText, phoneNumberId);
  await db
    .prepare("UPDATE messages SET provider_message_id = ?, status = 'sent' WHERE id = ?")
    .bind(sent.providerMessageId, outboundId)
    .run();
}

async function resolveRestaurant(db: D1Database, phoneNumberId: string) {
  if (phoneNumberId) {
    const integration = await db
      .prepare(
        `SELECT restaurant_id FROM integrations
         WHERE provider = 'whatsapp' AND external_phone_id = ? AND status = 'connected' LIMIT 1`,
      )
      .bind(phoneNumberId)
      .first<{ restaurant_id: string }>();
    if (integration) return integration.restaurant_id;
  }
  const bindings = getBindings();
  if (
    bindings.RAPIDEX_AUTH_MODE === "hmg-access-code" &&
    (!phoneNumberId || phoneNumberId === bindings.WHATSAPP_PHONE_NUMBER_ID)
  ) {
    return DEMO_RESTAURANT_ID;
  }
  throw new HttpError(404, "Número do WhatsApp não vinculado a uma loja.", "integration_not_found");
}

function normalizeMemoryKind(kind: string) {
  return ["ingredient", "product", "delivery", "payment", "note"].includes(kind) ? kind : "note";
}

function extensionFor(mimeType: string) {
  if (mimeType.includes("mpeg")) return "mp3";
  if (mimeType.includes("wav")) return "wav";
  if (mimeType.includes("mp4")) return "m4a";
  return "ogg";
}

type WhatsAppMessage = {
  id: string;
  from?: string;
  type?: string;
  text?: { body?: string };
  audio?: { id?: string };
  interactive?: { button_reply?: { title?: string } };
};

type WhatsAppWebhook = {
  object?: string;
  entry?: Array<{
    changes?: Array<{
      field?: string;
      value: {
        metadata?: { phone_number_id?: string };
        contacts?: Array<{ profile?: { name?: string } }>;
        messages?: WhatsAppMessage[];
        statuses?: Array<{ id: string; status?: string }>;
      };
    }>;
  }>;
};
