import { audit, requireAdminContext, requireRole } from "@/lib/admin-auth";
import { apiError, assertSameOrigin, HttpError, json, readJson } from "@/lib/http";
import { getDatabase } from "@/lib/runtime";
import { cents, optionalString, positiveInteger, requiredString } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const context = await requireAdminContext();
    const db = getDatabase();
    const [products, categories] = await Promise.all([
      db
        .prepare(
          `SELECT p.*, c.name AS category_name FROM products p
           LEFT JOIN categories c ON c.id = p.category_id
           WHERE p.restaurant_id = ? AND p.active = 1 ORDER BY c.position, p.position, p.name`,
        )
        .bind(context.restaurantId)
        .all<Record<string, unknown>>(),
      db
        .prepare(
          "SELECT id, name, position FROM categories WHERE restaurant_id = ? AND active = 1 ORDER BY position, name",
        )
        .bind(context.restaurantId)
        .all<Record<string, unknown>>(),
    ]);
    return json({
      ok: true,
      categories: categories.results,
      products: products.results.map(mapProduct),
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const context = await requireAdminContext();
    requireRole(context, ["owner", "manager"]);
    const body = await readJson<Record<string, unknown>>(request, 30_000);
    const db = getDatabase();
    const name = requiredString(body.name, "Nome", 2, 100);
    const description = optionalString(body.description, "Descrição", 500) || "";
    const priceCents = cents(body.priceCents, "Preço", 100);
    const costCents = cents(body.costCents ?? 0, "Custo", 0);
    if (costCents >= priceCents) {
      throw new HttpError(400, "O preço precisa ser maior que o custo.", "invalid_margin");
    }
    const categoryId = optionalString(body.categoryId, "Categoria", 100);
    if (categoryId) await assertCategory(db, context.restaurantId, categoryId);
    const id = crypto.randomUUID();
    const timestamp = Date.now();
    await db
      .prepare(
        `INSERT INTO products
         (id, restaurant_id, category_id, name, description, price_cents, cost_cents, emoji, tag,
          active, available, prep_minutes, position, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, ?, ?, ?, ?)`,
      )
      .bind(
        id,
        context.restaurantId,
        categoryId,
        name,
        description,
        priceCents,
        costCents,
        optionalString(body.emoji, "Emoji", 8) || "🍽️",
        optionalString(body.tag, "Selo", 60),
        positiveInteger(body.prepMinutes ?? 10, "Tempo de preparo", 180),
        Number.isInteger(body.position) ? Number(body.position) : 0,
        timestamp,
        timestamp,
      )
      .run();
    await audit(context, "product.created", "product", id, { name });
    return json({ ok: true, id }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}

function mapProduct(product: Record<string, unknown>) {
  const price = Number(product.price_cents);
  const cost = Number(product.cost_cents);
  const marginPercent = price ? Math.round(((price - cost) / price) * 100) : 0;
  return {
    id: product.id,
    categoryId: product.category_id,
    categoryName: product.category_name,
    name: product.name,
    description: product.description,
    priceCents: price,
    costCents: cost,
    marginPercent,
    marginHealth: marginPercent >= 35 ? "healthy" : marginPercent >= 20 ? "attention" : "low",
    emoji: product.emoji,
    tag: product.tag,
    imageKey: product.image_key,
    imageUrl: product.image_key ? `/api/public/media/${String(product.image_key)}` : null,
    available: Boolean(product.available),
    stockControlEnabled: Boolean(product.stock_control_enabled),
    stockQuantity: product.stock_quantity,
    minimumStock: product.minimum_stock,
    prepMinutes: product.prep_minutes,
    position: product.position,
  };
}

async function assertCategory(db: D1Database, restaurantId: string, categoryId: string) {
  const category = await db
    .prepare("SELECT id FROM categories WHERE id = ? AND restaurant_id = ? AND active = 1")
    .bind(categoryId, restaurantId)
    .first();
  if (!category) throw new HttpError(400, "Categoria inválida.", "validation_error");
}
