import { audit, requireAdminContext, requireRole } from "@/lib/admin-auth";
import { apiError, assertSameOrigin, HttpError, json, readJson } from "@/lib/http";
import { getDatabase } from "@/lib/runtime";
import { validateWeeklyHours } from "@/lib/store-availability";
import { booleanValue, cents, normalizePhone, optionalString, positiveInteger, requiredString } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const context = await requireAdminContext();
    const restaurant = await getDatabase()
      .prepare("SELECT * FROM restaurants WHERE id = ?")
      .bind(context.restaurantId)
      .first<Record<string, unknown>>();
    const settings = safeJson(restaurant?.settings_json);
    return json({ ok: true, restaurant, settings });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    assertSameOrigin(request);
    const context = await requireAdminContext();
    requireRole(context, ["owner", "manager"]);
    const body = await readJson<Record<string, unknown>>(request, 30_000);
    const db = getDatabase();
    const current = await db
      .prepare("SELECT * FROM restaurants WHERE id = ?")
      .bind(context.restaurantId)
      .first<Record<string, unknown>>();
    const settings = safeJson(current?.settings_json);
    const phone =
      body.phone === null
        ? null
        : body.phone !== undefined
          ? normalizePhone(body.phone)
          : current?.phone
            ? String(current.phone)
            : null;
    const whatsapp =
      body.whatsapp === null
        ? null
        : body.whatsapp !== undefined
          ? normalizePhone(body.whatsapp)
          : current?.whatsapp
            ? String(current.whatsapp)
            : null;
    if (body.brandColor !== undefined) settings.brandColor = optionalString(body.brandColor, "Cor", 20);
    if (body.cuisine !== undefined) settings.cuisine = optionalString(body.cuisine, "Categoria", 80);
    if (body.weeklyHours !== undefined) {
      try { settings.weeklyHours = validateWeeklyHours(body.weeklyHours); }
      catch (error) {
        throw new HttpError(400, error instanceof Error ? error.message : "Horários inválidos.", "validation_error", { field: "weeklyHours" });
      }
    }
    await db
      .prepare(
        `UPDATE restaurants SET name = ?, phone = ?, whatsapp = ?, city = ?, state = ?,
         delivery_fee_cents = ?, minimum_order_cents = ?, average_prep_minutes = ?,
         delivery_minutes = ?, max_concurrent_orders = ?, is_open = ?, settings_json = ?, updated_at = ?
         WHERE id = ?`,
      )
      .bind(
        requiredString(body.name ?? current?.name, "Nome", 2, 120),
        phone,
        whatsapp,
        optionalString(body.city ?? current?.city, "Cidade", 80),
        optionalString(body.state ?? current?.state, "Estado", 2)?.toUpperCase(),
        cents(body.deliveryFeeCents ?? current?.delivery_fee_cents, "Taxa de entrega", 0, 100_000),
        cents(body.minimumOrderCents ?? current?.minimum_order_cents, "Pedido mínimo", 0, 1_000_000),
        positiveInteger(body.averagePrepMinutes ?? current?.average_prep_minutes, "Preparo", 240),
        positiveInteger(body.deliveryMinutes ?? current?.delivery_minutes, "Entrega", 240),
        positiveInteger(body.maxConcurrentOrders ?? current?.max_concurrent_orders, "Capacidade", 500),
        body.isOpen === undefined ? Number(current?.is_open) : booleanValue(body.isOpen) ? 1 : 0,
        JSON.stringify(settings),
        Date.now(),
        context.restaurantId,
      )
      .run();
    await audit(context, "restaurant.settings_updated", "restaurant", context.restaurantId, {
      fields: Object.keys(body),
    });
    return json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}

function safeJson(value: unknown): Record<string, unknown> {
  try {
    return JSON.parse(String(value || "{}"));
  } catch {
    return {};
  }
}
