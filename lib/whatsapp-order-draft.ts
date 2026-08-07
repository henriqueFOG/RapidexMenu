export type WhatsAppDraftItem = { productId: string; quantity: number; notes: string };
export type WhatsAppDraftAddress = {
  street: string;
  number: string;
  neighborhood: string;
  city: string;
  state: string;
  postalCode: string;
  complement: string;
};
export type WhatsAppDraft = {
  id: string;
  restaurantId: string;
  customerId: string;
  conversationId: string;
  clientOrderId: string;
  items: WhatsAppDraftItem[];
  address: WhatsAppDraftAddress;
  paymentMethod: "cash" | "card_on_delivery" | null;
  stage: "collecting" | "awaiting_address" | "awaiting_payment" | "awaiting_confirmation" | "completed";
  completedOrderId: string | null;
};

type DraftRow = {
  id: string;
  restaurant_id: string;
  customer_id: string;
  conversation_id: string;
  client_order_id: string;
  items_json: string;
  address_json: string;
  payment_method: "cash" | "card_on_delivery" | null;
  stage: WhatsAppDraft["stage"];
  completed_order_id: string | null;
};

const emptyAddress: WhatsAppDraftAddress = {
  street: "",
  number: "",
  neighborhood: "",
  city: "",
  state: "",
  postalCode: "",
  complement: "",
};

export async function getWhatsAppDraft(
  db: D1Database,
  restaurantId: string,
  customerId: string,
  conversationId: string,
): Promise<WhatsAppDraft> {
  let row = await db.prepare(
    `SELECT id, restaurant_id, customer_id, conversation_id, client_order_id, items_json,
            address_json, payment_method, stage, completed_order_id
     FROM whatsapp_order_drafts WHERE conversation_id = ? LIMIT 1`,
  ).bind(conversationId).first<DraftRow>();

  const now = Date.now();
  if (!row) {
    const id = crypto.randomUUID();
    const clientOrderId = `wa-${crypto.randomUUID()}`;
    await db.prepare(
      `INSERT INTO whatsapp_order_drafts
       (id, restaurant_id, customer_id, conversation_id, client_order_id, items_json,
        address_json, stage, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, '[]', '{}', 'collecting', ?, ?)`,
    ).bind(id, restaurantId, customerId, conversationId, clientOrderId, now, now).run();
    row = {
      id,
      restaurant_id: restaurantId,
      customer_id: customerId,
      conversation_id: conversationId,
      client_order_id: clientOrderId,
      items_json: "[]",
      address_json: "{}",
      payment_method: null,
      stage: "collecting",
      completed_order_id: null,
    };
  } else if (row.restaurant_id !== restaurantId || row.customer_id !== customerId) {
    throw new Error("Rascunho do WhatsApp não pertence ao contexto atual.");
  } else if (row.stage === "completed") {
    const clientOrderId = `wa-${crypto.randomUUID()}`;
    await db.prepare(
      `UPDATE whatsapp_order_drafts SET client_order_id = ?, items_json = '[]', address_json = '{}',
       payment_method = NULL, stage = 'collecting', completed_order_id = NULL, updated_at = ? WHERE id = ?`,
    ).bind(clientOrderId, now, row.id).run();
    row = { ...row, client_order_id: clientOrderId, items_json: "[]", address_json: "{}", payment_method: null, stage: "collecting", completed_order_id: null };
  }
  return fromRow(row);
}

export async function saveWhatsAppDraft(
  db: D1Database,
  draft: WhatsAppDraft,
  changes: {
    items?: WhatsAppDraftItem[];
    address?: Partial<WhatsAppDraftAddress>;
    paymentMethod?: "cash" | "card_on_delivery" | null;
  },
) {
  const items = changes.items ?? draft.items;
  const address = { ...draft.address, ...(changes.address || {}) };
  const paymentMethod = changes.paymentMethod === undefined ? draft.paymentMethod : changes.paymentMethod;
  const stage = inferDraftStage(items, address, paymentMethod);
  await db.prepare(
    `UPDATE whatsapp_order_drafts SET items_json = ?, address_json = ?, payment_method = ?, stage = ?, updated_at = ?
     WHERE id = ? AND restaurant_id = ?`,
  ).bind(JSON.stringify(items), JSON.stringify(address), paymentMethod, stage, Date.now(), draft.id, draft.restaurantId).run();
  return { ...draft, items, address, paymentMethod, stage } satisfies WhatsAppDraft;
}

export async function completeWhatsAppDraft(db: D1Database, draft: WhatsAppDraft, orderId: string) {
  await db.prepare(
    `UPDATE whatsapp_order_drafts SET stage = 'completed', completed_order_id = ?, updated_at = ?
     WHERE id = ? AND restaurant_id = ?`,
  ).bind(orderId, Date.now(), draft.id, draft.restaurantId).run();
}

export function inferDraftStage(
  items: WhatsAppDraftItem[],
  address: WhatsAppDraftAddress,
  paymentMethod: WhatsAppDraft["paymentMethod"],
): WhatsAppDraft["stage"] {
  if (!items.length) return "collecting";
  if (!addressComplete(address)) return "awaiting_address";
  if (!paymentMethod) return "awaiting_payment";
  return "awaiting_confirmation";
}

export function addressComplete(address: WhatsAppDraftAddress) {
  return Boolean(
    address.street.trim() &&
    address.number.trim() &&
    address.neighborhood.trim() &&
    address.city.trim() &&
    /^[A-Za-z]{2}$/.test(address.state.trim()) &&
    /^\d{8}$/.test(address.postalCode.replace(/\D/g, "")),
  );
}

export function explicitWhatsAppConfirmation(message: string) {
  const text = message.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return /^(sim|confirmo|confirmar|pode confirmar|pode fechar|fechar pedido|finalizar|finalizar pedido|pode pedir|manda o pedido)[.! ]*$/.test(text);
}

function fromRow(row: DraftRow): WhatsAppDraft {
  return {
    id: row.id,
    restaurantId: row.restaurant_id,
    customerId: row.customer_id,
    conversationId: row.conversation_id,
    clientOrderId: row.client_order_id,
    items: safeItems(row.items_json),
    address: { ...emptyAddress, ...safeObject(row.address_json) },
    paymentMethod: row.payment_method,
    stage: row.stage,
    completedOrderId: row.completed_order_id,
  };
}

function safeItems(value: string): WhatsAppDraftItem[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item) => item && typeof item.productId === "string" && Number.isInteger(item.quantity)) : [];
  } catch { return []; }
}
function safeObject(value: string): Partial<WhatsAppDraftAddress> {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch { return {}; }
}
