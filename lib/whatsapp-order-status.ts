import { sendWhatsAppText } from "./integrations/whatsapp";

type OrderContact = {
  source: string;
  order_number: number;
  phone: string | null;
  conversation_id: string | null;
  phone_number_id: string | null;
};

export async function notifyWhatsAppOrderStatus(
  db: D1Database,
  restaurantId: string,
  orderId: string,
  status: string,
) {
  const message = statusMessage(status);
  if (!message) return { sent: false, reason: "status_not_notifiable" };
  const contact = await db.prepare(
    `SELECT o.source, o.order_number, c.phone,
            conv.id AS conversation_id, i.external_phone_id AS phone_number_id
     FROM orders o
     LEFT JOIN customers c ON c.id = o.customer_id
     LEFT JOIN conversations conv ON conv.restaurant_id = o.restaurant_id
       AND conv.customer_id = o.customer_id AND conv.channel = 'whatsapp'
     LEFT JOIN integrations i ON i.restaurant_id = o.restaurant_id
       AND i.provider = 'whatsapp' AND i.status = 'connected'
     WHERE o.id = ? AND o.restaurant_id = ?
     ORDER BY conv.updated_at DESC LIMIT 1`,
  ).bind(orderId, restaurantId).first<OrderContact>();
  if (!contact || contact.source !== "whatsapp" || !contact.phone || !contact.phone_number_id) {
    return { sent: false, reason: "whatsapp_context_missing" };
  }

  const body = `Pedido #${contact.order_number}: ${message}`;
  const messageId = crypto.randomUUID();
  if (contact.conversation_id) {
    await db.prepare(
      `INSERT INTO messages
       (id, conversation_id, direction, type, body, status, metadata_json, created_at)
       VALUES (?, ?, 'outbound', 'system', ?, 'queued', ?, ?)`,
    ).bind(
      messageId,
      contact.conversation_id,
      body,
      JSON.stringify({ orderId, orderStatus: status, transactional: true }),
      Date.now(),
    ).run();
  }

  try {
    const sent = await sendWhatsAppText(contact.phone, body, contact.phone_number_id);
    if (contact.conversation_id) {
      await db.prepare("UPDATE messages SET provider_message_id = ?, status = 'sent' WHERE id = ?")
        .bind(sent.providerMessageId, messageId).run();
    }
    return { sent: true };
  } catch (error) {
    console.error("WhatsApp status notification failed", error instanceof Error ? error.message : "unknown");
    if (contact.conversation_id) {
      await db.prepare("UPDATE messages SET status = 'failed', metadata_json = ? WHERE id = ?")
        .bind(JSON.stringify({ orderId, orderStatus: status, transactional: true, failed: true }), messageId).run();
    }
    return { sent: false, reason: "provider_failed" };
  }
}

function statusMessage(status: string) {
  return ({
    confirmed: "✅ confirmado pela loja.",
    preparing: "👩‍🍳 entrou em preparo.",
    ready: "📦 está pronto.",
    out_for_delivery: "🛵 saiu para entrega.",
    delivered: "✅ foi entregue. Bom apetite!",
    canceled: "❌ foi cancelado. Se precisar, fale com a loja por aqui.",
  } as Record<string, string>)[status] || null;
}
