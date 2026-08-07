import { HttpError } from "./http";
import type { SalesReply } from "./integrations/openai";
import { createOrder, type CreatedOrder } from "./order-service";
import { getBindings } from "./runtime";
import {
  completeWhatsAppDraft,
  explicitWhatsAppConfirmation,
  saveWhatsAppDraft,
  type WhatsAppDraft,
  type WhatsAppDraftItem,
} from "./whatsapp-order-draft";

type Product = {
  id: string;
  name: string;
  price_cents: number;
  available: number | boolean;
};

type FlowInput = {
  db: D1Database;
  draft: WhatsAppDraft;
  salesReply: SalesReply;
  message: string;
  restaurantSlug: string;
  customerName: string;
  customerPhone: string;
  products: Product[];
};

export async function applyWhatsAppOrderFlow(input: FlowInput) {
  const productMap = new Map(input.products.map((product) => [product.id, product]));
  let desiredItems = input.draft.items;
  const replacesCart = input.salesReply.intent === "order" || input.salesReply.intent === "repeat" || input.salesReply.cartItems.length > 0;
  if (replacesCart) {
    desiredItems = input.salesReply.cartItems
      .filter((item) => productMap.get(item.productId)?.available)
      .map((item) => ({ productId: item.productId, quantity: item.quantity, notes: item.notes.slice(0, 240) }));
  }

  const checkout = input.salesReply.checkout;
  const address = Object.fromEntries(
    Object.entries(checkout.address).filter(([, value]) => typeof value === "string" && value.trim()),
  );
  const paymentMethod = checkout.paymentMethod || input.draft.paymentMethod;
  const draft = await saveWhatsAppDraft(input.db, input.draft, {
    items: normalizeItems(desiredItems),
    address,
    paymentMethod: paymentMethod || null,
  });

  if (draft.stage === "awaiting_confirmation" && explicitWhatsAppConfirmation(input.message)) {
    const completed = await tryCreateWhatsAppOrder(input, draft);
    if (completed.order) {
      await completeWhatsAppDraft(input.db, draft, completed.order.id);
      return { reply: confirmationText(completed.order), order: completed.order, draft: { ...draft, stage: "completed" as const, completedOrderId: completed.order.id } };
    }
    return { reply: completed.reply, order: null, draft };
  }

  return { reply: guidedReply(input.salesReply.reply, draft, productMap), order: null, draft };
}

export function cartContext(draft: WhatsAppDraft, products: Product[]) {
  const productMap = new Map(products.map((product) => [product.id, product]));
  return draft.items.flatMap((item) => {
    const product = productMap.get(item.productId);
    return product ? [{ productId: item.productId, name: product.name, quantity: item.quantity, notes: item.notes, priceCents: Number(product.price_cents) }] : [];
  });
}

export async function getWhatsAppTrackingReply(
  db: D1Database,
  restaurantId: string,
  customerId: string,
  message: string,
) {
  const explicitNumber = message.match(/#?\s*(\d{1,8})/)?.[1];
  const order = explicitNumber
    ? await db.prepare(
        `SELECT order_number, status, total_cents FROM orders
         WHERE restaurant_id = ? AND customer_id = ? AND order_number = ? LIMIT 1`,
      ).bind(restaurantId, customerId, Number(explicitNumber)).first<{ order_number: number; status: string; total_cents: number }>()
    : await db.prepare(
        `SELECT order_number, status, total_cents FROM orders
         WHERE restaurant_id = ? AND customer_id = ? ORDER BY created_at DESC LIMIT 1`,
      ).bind(restaurantId, customerId).first<{ order_number: number; status: string; total_cents: number }>();
  if (!order) return explicitNumber ? `Não encontrei o pedido #${explicitNumber} nesta conversa.` : "Ainda não encontrei um pedido seu para acompanhar.";
  return `Pedido #${order.order_number}: ${statusLabel(order.status)} · total ${money(order.total_cents)}.`;
}

export async function latestRepeatCart(db: D1Database, restaurantId: string, customerId: string) {
  const order = await db.prepare(
    `SELECT id FROM orders WHERE restaurant_id = ? AND customer_id = ? AND status <> 'canceled'
     ORDER BY created_at DESC LIMIT 1`,
  ).bind(restaurantId, customerId).first<{ id: string }>();
  if (!order) return [] as WhatsAppDraftItem[];
  const result = await db.prepare(
    `SELECT product_id, quantity, notes FROM order_items
     WHERE order_id = ? AND product_id IS NOT NULL ORDER BY created_at`,
  ).bind(order.id).all<{ product_id: string; quantity: number; notes: string | null }>();
  return result.results.map((item) => ({ productId: item.product_id, quantity: Number(item.quantity), notes: item.notes || "" }));
}

async function tryCreateWhatsAppOrder(input: FlowInput, draft: WhatsAppDraft): Promise<{ order: CreatedOrder | null; reply: string }> {
  if (!draft.paymentMethod) return { order: null, reply: "Escolha dinheiro ou cartão na entrega antes de confirmar." };
  try {
    const order = await createOrder(input.db, {
      restaurantSlug: input.restaurantSlug,
      clientOrderId: draft.clientOrderId,
      source: "whatsapp",
      customer: {
        name: input.customerName,
        phone: input.customerPhone,
        whatsappConsent: false,
        address: draft.address,
      },
      items: draft.items,
      paymentMethod: draft.paymentMethod,
    });
    return { order, reply: "" };
  } catch (error) {
    if (error instanceof HttpError && error.status < 500) {
      return { order: null, reply: `Ainda não consegui confirmar o pedido: ${error.message}` };
    }
    throw error;
  }
}

function guidedReply(base: string, draft: WhatsAppDraft, products: Map<string, Product>) {
  const cleanBase = base.trim();
  if (!draft.items.length) return cleanBase || "Me diga o que você gostaria de pedir.";
  const summary = cartSummary(draft.items, products);
  if (draft.stage === "awaiting_address") {
    return join(cleanBase, summary, "Para fechar, me envie rua, número, bairro, cidade/UF e CEP.");
  }
  if (draft.stage === "awaiting_payment") {
    return join(cleanBase, summary, "Pagamento na entrega: prefere dinheiro ou cartão?");
  }
  if (draft.stage === "awaiting_confirmation") {
    const address = `${draft.address.street}, ${draft.address.number} · ${draft.address.neighborhood} · ${draft.address.city}/${draft.address.state}`;
    const payment = draft.paymentMethod === "cash" ? "dinheiro na entrega" : "cartão na entrega";
    return join(cleanBase, summary, `Entrega: ${address}. Pagamento: ${payment}.`, "Se estiver tudo certo, responda CONFIRMAR.");
  }
  return join(cleanBase, summary);
}

function confirmationText(order: CreatedOrder) {
  const publicUrl = (getBindings().RAPIDEX_PUBLIC_URL || "").replace(/\/$/, "");
  const tracking = publicUrl ? `\nAcompanhe: ${publicUrl}/acompanhar/${order.trackingToken}` : "";
  return `✅ Pedido #${order.orderNumber} confirmado! Total: ${money(order.totalCents)}. Previsão: ${order.promisedFromMinutes}–${order.promisedToMinutes} min.${tracking}`;
}

function cartSummary(items: WhatsAppDraftItem[], products: Map<string, Product>) {
  let total = 0;
  const lines = items.flatMap((item) => {
    const product = products.get(item.productId);
    if (!product) return [];
    total += Number(product.price_cents) * item.quantity;
    return [`${item.quantity}x ${product.name} — ${money(Number(product.price_cents) * item.quantity)}`];
  });
  return `Seu pedido:\n${lines.join("\n")}\nSubtotal: ${money(total)}`;
}

function normalizeItems(items: WhatsAppDraftItem[]) {
  const compact = new Map<string, WhatsAppDraftItem>();
  for (const item of items) {
    if (!item.productId || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 20) continue;
    compact.set(item.productId, { productId: item.productId, quantity: item.quantity, notes: item.notes || "" });
  }
  return Array.from(compact.values()).slice(0, 30);
}

function statusLabel(status: string) {
  return ({
    received: "recebido pela loja",
    confirmed: "confirmado",
    preparing: "em preparo",
    ready: "pronto",
    out_for_delivery: "saiu para entrega",
    delivered: "entregue",
    canceled: "cancelado",
  } as Record<string, string>)[status] || status;
}
function join(...parts: string[]) { return parts.filter((part) => part.trim()).join("\n\n").slice(0, 4096); }
function money(cents: number) { return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100); }
