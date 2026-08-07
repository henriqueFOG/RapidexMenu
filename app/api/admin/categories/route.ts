import { audit, requireAdminContext, requireRole } from "@/lib/admin-auth";
import { apiError, assertSameOrigin, HttpError, json, readJson } from "@/lib/http";
import { getDatabase } from "@/lib/runtime";
import { booleanValue, requiredString } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const context = await requireAdminContext();
    const result = await getDatabase().prepare(
      `SELECT id, name, position, active FROM categories
       WHERE restaurant_id = ? ORDER BY position, name`,
    ).bind(context.restaurantId).all();
    return json({ ok: true, categories: result.results });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const context = await requireAdminContext();
    requireRole(context, ["owner", "manager"]);
    const body = await readJson<Record<string, unknown>>(request, 10_000);
    const name = requiredString(body.name, "Nome da categoria", 2, 80);
    const db = getDatabase();
    const duplicate = await db.prepare(
      "SELECT id FROM categories WHERE restaurant_id = ? AND lower(name) = lower(?) AND active = 1 LIMIT 1",
    ).bind(context.restaurantId, name).first();
    if (duplicate) throw new HttpError(409, "Essa categoria já existe.", "category_exists");
    const maxPosition = await db.prepare(
      "SELECT COALESCE(MAX(position), -1) AS position FROM categories WHERE restaurant_id = ?",
    ).bind(context.restaurantId).first<{ position: number }>();
    const id = crypto.randomUUID();
    const now = Date.now();
    await db.prepare(
      `INSERT INTO categories (id, restaurant_id, name, position, active, created_at, updated_at)
       VALUES (?, ?, ?, ?, 1, ?, ?)`,
    ).bind(id, context.restaurantId, name, Number(maxPosition?.position ?? -1) + 1, now, now).run();
    await audit(context, "category.created", "category", id, { name });
    return json({ ok: true, category: { id, name, active: true } }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    assertSameOrigin(request);
    const context = await requireAdminContext();
    requireRole(context, ["owner", "manager"]);
    const body = await readJson<Record<string, unknown>>(request, 10_000);
    const id = requiredString(body.id, "Categoria", 2, 100);
    const db = getDatabase();
    const current = await db.prepare(
      "SELECT id, name, active FROM categories WHERE id = ? AND restaurant_id = ? LIMIT 1",
    ).bind(id, context.restaurantId).first<{ id: string; name: string; active: number }>();
    if (!current) throw new HttpError(404, "Categoria não encontrada.", "category_not_found");
    const name = body.name === undefined ? current.name : requiredString(body.name, "Nome da categoria", 2, 80);
    const active = body.active === undefined ? Number(current.active) : booleanValue(body.active) ? 1 : 0;
    await db.prepare("UPDATE categories SET name = ?, active = ?, updated_at = ? WHERE id = ? AND restaurant_id = ?")
      .bind(name, active, Date.now(), id, context.restaurantId).run();
    await audit(context, "category.updated", "category", id, { name, active: Boolean(active) });
    return json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
