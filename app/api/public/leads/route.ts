import { apiError, HttpError, json, readJson } from "@/lib/http";
import { consumeRateLimit, rateLimitKey } from "@/lib/rate-limit";
import { getDatabase } from "@/lib/runtime";
import { normalizePhone, optionalString, requiredString } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const db = getDatabase();
    const limit = await consumeRateLimit(db, await rateLimitKey(request, "leads"), 5, 60 * 60_000);
    if (!limit.allowed) throw new HttpError(429, "Tente novamente mais tarde.", "rate_limited");
    const body = await readJson<Record<string, unknown>>(request, 20_000);
    const name = requiredString(body.name, "Nome", 2, 80);
    const restaurantName = requiredString(body.restaurantName, "Restaurante", 2, 120);
    const whatsapp = normalizePhone(body.whatsapp);
    const monthlyOrdersRange = optionalString(body.monthlyOrdersRange, "Faixa de pedidos", 40);
    const id = crypto.randomUUID();
    await db
      .prepare(
        `INSERT INTO leads
         (id, name, restaurant_name, whatsapp, monthly_orders_range, source, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'landing', 'new', ?, ?)`,
      )
      .bind(id, name, restaurantName, whatsapp, monthlyOrdersRange, Date.now(), Date.now())
      .run();
    return json({ ok: true, leadId: id, message: "Cadastro recebido. Entraremos em contato." }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
