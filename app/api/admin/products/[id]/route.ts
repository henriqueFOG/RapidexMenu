import { audit, requireAdminContext, requireRole } from "@/lib/admin-auth";
import { apiError, assertSameOrigin, HttpError, json, readJson } from "@/lib/http";
import { getDatabase } from "@/lib/runtime";
import { booleanValue, cents, optionalString, positiveInteger, requiredString } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);
    const context = await requireAdminContext();
    requireRole(context, ["owner", "manager"]);
    const id = requiredString((await params).id, "Produto", 2, 100);
    const db = getDatabase();
    const current = await db
      .prepare("SELECT * FROM products WHERE id = ? AND restaurant_id = ? AND active = 1")
      .bind(id, context.restaurantId)
      .first<Record<string, unknown>>();
    if (!current) throw new HttpError(404, "Produto não encontrado.", "product_not_found");
    const body = await readJson<Record<string, unknown>>(request, 30_000);
    const categoryId =
      body.categoryId === null
        ? null
        : optionalString(body.categoryId ?? current.category_id, "Categoria", 100);
    if (categoryId) {
      const category = await db
        .prepare("SELECT id FROM categories WHERE id = ? AND restaurant_id = ? AND active = 1")
        .bind(categoryId, context.restaurantId)
        .first();
      if (!category) throw new HttpError(400, "Categoria inválida.", "validation_error");
    }
    const price = cents(body.priceCents ?? current.price_cents, "Preço", 100);
    const cost = cents(body.costCents ?? current.cost_cents, "Custo", 0);
    if (cost >= price) throw new HttpError(400, "O preço precisa ser maior que o custo.", "invalid_margin");
    const imageKey =
      body.imageKey === null
        ? null
        : optionalString(body.imageKey ?? current.image_key, "Imagem", 300);
    if (imageKey && !imageKey.startsWith(`public/restaurants/${context.restaurantId}/products/`)) {
      throw new HttpError(400, "Imagem inválida para este restaurante.", "invalid_media_owner");
    }
    const timestamp = Date.now();
    await db
      .prepare(
        `UPDATE products SET category_id = ?, name = ?, description = ?, price_cents = ?,
         cost_cents = ?, emoji = ?, tag = ?, image_key = ?, available = ?,
         stock_control_enabled = ?, stock_quantity = ?, minimum_stock = ?, prep_minutes = ?,
         position = ?, updated_at = ? WHERE id = ? AND restaurant_id = ?`,
      )
      .bind(
        categoryId,
        requiredString(body.name ?? current.name, "Nome", 2, 100),
        optionalString(body.description ?? current.description, "Descrição", 500) || "",
        price,
        cost,
        optionalString(body.emoji ?? current.emoji, "Emoji", 8) || "🍽️",
        optionalString(body.tag ?? current.tag, "Selo", 60),
        imageKey,
        body.available === undefined ? Number(current.available) : booleanValue(body.available) ? 1 : 0,
        body.stockControlEnabled === undefined
          ? Number(current.stock_control_enabled)
          : booleanValue(body.stockControlEnabled)
            ? 1
            : 0,
        body.stockQuantity === null
          ? null
          : body.stockQuantity === undefined
            ? current.stock_quantity
            : cents(body.stockQuantity, "Estoque", 0, 1_000_000),
        body.minimumStock === null
          ? null
          : body.minimumStock === undefined
            ? current.minimum_stock
            : cents(body.minimumStock, "Estoque mínimo", 0, 1_000_000),
        positiveInteger(body.prepMinutes ?? current.prep_minutes, "Tempo de preparo", 180),
        Number.isInteger(body.position) ? Number(body.position) : Number(current.position),
        timestamp,
        id,
        context.restaurantId,
      )
      .run();
    await audit(context, "product.updated", "product", id, { fields: Object.keys(body) });
    return json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);
    const context = await requireAdminContext();
    requireRole(context, ["owner", "manager"]);
    const id = requiredString((await params).id, "Produto", 2, 100);
    const result = await getDatabase()
      .prepare("UPDATE products SET active = 0, available = 0, updated_at = ? WHERE id = ? AND restaurant_id = ?")
      .bind(Date.now(), id, context.restaurantId)
      .run();
    if (!(result.meta.changes ?? 0)) throw new HttpError(404, "Produto não encontrado.", "product_not_found");
    await audit(context, "product.archived", "product", id);
    return json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
