import { HttpError } from "./http";

export type DiningAttachment = {
  tableId: string;
  tableCode: string;
  tableLabel: string;
  tabId: string;
};

export async function attachOrderToDiningTab(
  db: D1Database,
  input: { orderId: string; restaurantId: string; tableCode: string },
): Promise<DiningAttachment | null> {
  const table = await db.prepare(
    `SELECT id, code, label
     FROM dining_tables
     WHERE restaurant_id = ? AND lower(code) = lower(?) AND active = 1
     LIMIT 1`,
  ).bind(input.restaurantId, input.tableCode.trim()).first<{ id: string; code: string; label: string }>();

  // Free-form table codes remain compatible for restaurants that have not yet
  // opted into managed tables. Configured tables receive the tab/comanda flow.
  if (!table) return null;

  let tab = await findOpenTab(db, input.restaurantId, table.id);
  if (!tab) {
    const now = Date.now();
    try {
      const id = crypto.randomUUID();
      await db.prepare(
        `INSERT INTO dining_tabs
         (id, restaurant_id, table_id, status, opened_at, created_at, updated_at)
         VALUES (?, ?, ?, 'open', ?, ?, ?)`,
      ).bind(id, input.restaurantId, table.id, now, now, now).run();
      tab = { id };
    } catch {
      // Concurrent first orders can race to open the same table. The partial
      // unique index chooses one tab; the loser simply reuses the winner.
      tab = await findOpenTab(db, input.restaurantId, table.id);
      if (!tab) throw new HttpError(409, "Não foi possível abrir a comanda da mesa.", "dining_tab_conflict");
    }
  }

  await db.prepare(
    `UPDATE orders
     SET dining_table_id = ?, dining_tab_id = ?, updated_at = ?
     WHERE id = ? AND restaurant_id = ? AND fulfillment_type = 'dine_in'`,
  ).bind(table.id, tab.id, Date.now(), input.orderId, input.restaurantId).run();

  return { tableId: table.id, tableCode: table.code, tableLabel: table.label, tabId: tab.id };
}

export async function closeDiningTab(
  db: D1Database,
  input: { restaurantId: string; tabId: string; userId: string | null },
) {
  const tab = await db.prepare(
    `SELECT id, status FROM dining_tabs WHERE id = ? AND restaurant_id = ? LIMIT 1`,
  ).bind(input.tabId, input.restaurantId).first<{ id: string; status: string }>();
  if (!tab) throw new HttpError(404, "Comanda não encontrada.", "dining_tab_not_found");
  if (tab.status === "closed") return { closed: true, existing: true };

  const pending = await db.prepare(
    `SELECT count(*) AS total
     FROM orders
     WHERE restaurant_id = ? AND dining_tab_id = ? AND status NOT IN ('delivered', 'canceled')`,
  ).bind(input.restaurantId, input.tabId).first<{ total: number }>();
  if (Number(pending?.total || 0) > 0) {
    throw new HttpError(409, "Ainda existem pedidos em andamento nesta comanda.", "dining_tab_has_open_orders", {
      pendingOrders: Number(pending?.total || 0),
    });
  }

  const now = Date.now();
  await db.prepare(
    `UPDATE dining_tabs
     SET status = 'closed', closed_at = ?, closed_by_user_id = ?, updated_at = ?
     WHERE id = ? AND restaurant_id = ? AND status = 'open'`,
  ).bind(now, input.userId, now, input.tabId, input.restaurantId).run();
  return { closed: true, existing: false };
}

async function findOpenTab(db: D1Database, restaurantId: string, tableId: string) {
  return db.prepare(
    `SELECT id FROM dining_tabs
     WHERE restaurant_id = ? AND table_id = ? AND status = 'open'
     LIMIT 1`,
  ).bind(restaurantId, tableId).first<{ id: string }>();
}
