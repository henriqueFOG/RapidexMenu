import { audit, requireAdminContext, requireRole } from "@/lib/admin-auth";
import { apiError, assertSameOrigin, HttpError, json, readJson } from "@/lib/http";
import { getDatabase } from "@/lib/runtime";
import { cents, optionalString, positiveInteger, requiredString } from "@/lib/validation";

export const dynamic = "force-dynamic";

type ImportRow = {
  category?: unknown;
  name?: unknown;
  description?: unknown;
  priceCents?: unknown;
  costCents?: unknown;
  prepMinutes?: unknown;
  emoji?: unknown;
  tag?: unknown;
};

type ImportBody = { rows?: unknown };

type ExistingCategory = { id: string; name: string; position: number };
type ExistingProduct = { id: string; name: string; category_id: string | null };

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const context = await requireAdminContext();
    requireRole(context, ["owner", "manager"]);
    const body = await readJson<ImportBody>(request, 500_000);
    if (!Array.isArray(body.rows) || body.rows.length < 1 || body.rows.length > 250) {
      throw new HttpError(400, "Envie de 1 a 250 produtos por importação.", "validation_error", { field: "rows" });
    }

    const db = getDatabase();
    const [categoryResult, productResult] = await Promise.all([
      db.prepare(
        "SELECT id, name, position FROM categories WHERE restaurant_id = ? AND active = 1 ORDER BY position, name",
      ).bind(context.restaurantId).all<ExistingCategory>(),
      db.prepare(
        "SELECT id, name, category_id FROM products WHERE restaurant_id = ? AND active = 1",
      ).bind(context.restaurantId).all<ExistingProduct>(),
    ]);

    const now = Date.now();
    const categories = new Map<string, ExistingCategory>();
    for (const category of categoryResult.results) categories.set(normalizeKey(category.name), category);
    const defaultCategory = categoryResult.results.find((item) => normalizeKey(item.name) === "principais") || categoryResult.results[0] || null;
    let nextCategoryPosition = categoryResult.results.reduce((max, item) => Math.max(max, Number(item.position || 0)), -1) + 1;

    const products = new Map<string, ExistingProduct>();
    for (const product of productResult.results) {
      products.set(productKey(product.category_id, product.name), product);
    }

    const statements: D1PreparedStatement[] = [];
    let categoriesCreated = 0;
    let productsCreated = 0;
    let productsUpdated = 0;

    for (let index = 0; index < body.rows.length; index += 1) {
      const raw = body.rows[index] as ImportRow;
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
        throw new HttpError(400, `Linha ${index + 1} inválida.`, "validation_error", { row: index + 1 });
      }
      const name = requiredString(raw.name, `Produto da linha ${index + 1}`, 2, 100);
      const description = optionalString(raw.description, `Descrição da linha ${index + 1}`, 500) || "";
      const priceCents = cents(raw.priceCents, `Preço da linha ${index + 1}`, 100);
      if (raw.costCents === undefined || raw.costCents === null || raw.costCents === "") {
        throw new HttpError(400, `Informe o custo da linha ${index + 1} para o Profit Engine calcular a margem.`, "validation_error", { row: index + 1, field: "costCents" });
      }
      const costCents = cents(raw.costCents, `Custo da linha ${index + 1}`, 0);
      if (costCents >= priceCents) {
        throw new HttpError(400, `Na linha ${index + 1}, o preço precisa ser maior que o custo.`, "invalid_margin", { row: index + 1 });
      }
      const prepMinutes = positiveInteger(raw.prepMinutes ?? 10, `Preparo da linha ${index + 1}`, 180);
      const categoryName = optionalString(raw.category, `Categoria da linha ${index + 1}`, 100) || defaultCategory?.name || "Principais";
      const categoryKey = normalizeKey(categoryName);
      let category = categories.get(categoryKey);
      if (!category) {
        category = { id: crypto.randomUUID(), name: categoryName, position: nextCategoryPosition++ };
        categories.set(categoryKey, category);
        categoriesCreated += 1;
        statements.push(
          db.prepare(
            `INSERT INTO categories (id, restaurant_id, name, position, active, created_at, updated_at)
             VALUES (?, ?, ?, ?, 1, ?, ?)`,
          ).bind(category.id, context.restaurantId, category.name, category.position, now, now),
        );
      }

      const key = productKey(category.id, name);
      const existing = products.get(key);
      const emoji = optionalString(raw.emoji, `Emoji da linha ${index + 1}`, 8) || "🍽️";
      const tag = optionalString(raw.tag, `Selo da linha ${index + 1}`, 60);
      if (existing) {
        productsUpdated += 1;
        statements.push(
          db.prepare(
            `UPDATE products SET description = ?, price_cents = ?, cost_cents = ?, emoji = ?, tag = ?,
             available = 1, prep_minutes = ?, updated_at = ?
             WHERE id = ? AND restaurant_id = ?`,
          ).bind(description, priceCents, costCents, emoji, tag, prepMinutes, now, existing.id, context.restaurantId),
        );
      } else {
        const id = crypto.randomUUID();
        productsCreated += 1;
        products.set(key, { id, name, category_id: category.id });
        statements.push(
          db.prepare(
            `INSERT INTO products
             (id, restaurant_id, category_id, name, description, price_cents, cost_cents, emoji, tag,
              active, available, prep_minutes, position, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, ?, ?, ?, ?)`,
          ).bind(
            id,
            context.restaurantId,
            category.id,
            name,
            description,
            priceCents,
            costCents,
            emoji,
            tag,
            prepMinutes,
            index,
            now,
            now,
          ),
        );
      }
    }

    if (statements.length) await db.batch(statements);
    await audit(context, "menu.bulk_imported", "restaurant", context.restaurantId, {
      rows: body.rows.length,
      categoriesCreated,
      productsCreated,
      productsUpdated,
    });
    return json({
      ok: true,
      rows: body.rows.length,
      categoriesCreated,
      productsCreated,
      productsUpdated,
    }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}

function normalizeKey(value: string) {
  return value.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ");
}

function productKey(categoryId: string | null, name: string) {
  return `${categoryId || "none"}:${normalizeKey(name)}`;
}
