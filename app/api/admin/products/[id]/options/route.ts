import { audit, requireAdminContext, requireRole } from "@/lib/admin-auth";
import { apiError, assertSameOrigin, HttpError, json, readJson } from "@/lib/http";
import { getDatabase } from "@/lib/runtime";
import { requiredString } from "@/lib/validation";

export const dynamic = "force-dynamic";

type PricingStrategy = "sum" | "highest" | "average" | "included";
type OptionInput = { name?: unknown; priceDeltaCents?: unknown; costDeltaCents?: unknown; available?: unknown };
type GroupInput = {
  name?: unknown;
  minSelect?: unknown;
  maxSelect?: unknown;
  pricingStrategy?: unknown;
  options?: OptionInput[];
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const context = await requireAdminContext();
    const productId = requiredString((await params).id, "Produto", 2, 100);
    const db = getDatabase();
    await requireOwnedProduct(db, context.restaurantId, productId);
    return json({ ok: true, groups: await loadGroups(db, context.restaurantId, productId) });
  } catch (error) {
    return apiError(error);
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);
    const context = await requireAdminContext();
    requireRole(context, ["owner", "manager"]);
    const productId = requiredString((await params).id, "Produto", 2, 100);
    const body = await readJson<{ groups?: GroupInput[] }>(request, 80_000);
    const db = getDatabase();
    await requireOwnedProduct(db, context.restaurantId, productId);
    const groups = normalizeGroups(body.groups);
    const now = Date.now();
    const statements: D1PreparedStatement[] = [
      db.prepare("DELETE FROM product_option_groups WHERE restaurant_id = ? AND product_id = ?").bind(context.restaurantId, productId),
    ];

    for (let groupPosition = 0; groupPosition < groups.length; groupPosition += 1) {
      const group = groups[groupPosition];
      const groupId = crypto.randomUUID();
      statements.push(
        db.prepare(
          `INSERT INTO product_option_groups
           (id, restaurant_id, product_id, name, min_select, max_select, pricing_strategy, position, active, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
        ).bind(
          groupId,
          context.restaurantId,
          productId,
          group.name,
          group.minSelect,
          group.maxSelect,
          group.pricingStrategy,
          groupPosition,
          now,
          now,
        ),
      );
      for (let optionPosition = 0; optionPosition < group.options.length; optionPosition += 1) {
        const option = group.options[optionPosition];
        statements.push(
          db.prepare(
            `INSERT INTO product_options
             (id, restaurant_id, group_id, name, price_delta_cents, cost_delta_cents, available, position, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          ).bind(
            crypto.randomUUID(),
            context.restaurantId,
            groupId,
            option.name,
            option.priceDeltaCents,
            option.costDeltaCents,
            option.available ? 1 : 0,
            optionPosition,
            now,
            now,
          ),
        );
      }
    }
    await db.batch(statements);
    await audit(context, "product.options_replaced", "product", productId, {
      groups: groups.length,
      options: groups.reduce((sum, group) => sum + group.options.length, 0),
    });
    return json({ ok: true, groups: await loadGroups(db, context.restaurantId, productId) });
  } catch (error) {
    return apiError(error);
  }
}

async function requireOwnedProduct(db: D1Database, restaurantId: string, productId: string) {
  const product = await db
    .prepare("SELECT id, name FROM products WHERE id = ? AND restaurant_id = ? AND active = 1 LIMIT 1")
    .bind(productId, restaurantId)
    .first<{ id: string; name: string }>();
  if (!product) throw new HttpError(404, "Produto não encontrado.", "product_not_found");
  return product;
}

async function loadGroups(db: D1Database, restaurantId: string, productId: string) {
  const [groups, options] = await Promise.all([
    db.prepare(
      `SELECT id, name, min_select, max_select, pricing_strategy, position
       FROM product_option_groups
       WHERE restaurant_id = ? AND product_id = ? AND active = 1
       ORDER BY position, created_at`,
    ).bind(restaurantId, productId).all<{
      id: string; name: string; min_select: number; max_select: number; pricing_strategy: PricingStrategy; position: number;
    }>(),
    db.prepare(
      `SELECT po.id, po.group_id, po.name, po.price_delta_cents, po.cost_delta_cents, po.available, po.position
       FROM product_options po
       JOIN product_option_groups pog ON pog.id = po.group_id
       WHERE po.restaurant_id = ? AND pog.product_id = ?
       ORDER BY po.position, po.created_at`,
    ).bind(restaurantId, productId).all<{
      id: string; group_id: string; name: string; price_delta_cents: number; cost_delta_cents: number; available: number; position: number;
    }>(),
  ]);
  return groups.results.map((group) => ({
    id: group.id,
    name: group.name,
    minSelect: Number(group.min_select),
    maxSelect: Number(group.max_select),
    pricingStrategy: group.pricing_strategy,
    options: options.results.filter((option) => option.group_id === group.id).map((option) => ({
      id: option.id,
      name: option.name,
      priceDeltaCents: Number(option.price_delta_cents),
      costDeltaCents: Number(option.cost_delta_cents),
      available: Boolean(option.available),
    })),
  }));
}

function normalizeGroups(value: unknown) {
  if (!Array.isArray(value)) throw new HttpError(400, "Envie os grupos de opções.", "validation_error", { field: "groups" });
  if (value.length > 20) throw new HttpError(400, "Um produto pode ter no máximo 20 grupos de opções.", "validation_error");
  return value.map((raw, groupIndex) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new HttpError(400, "Grupo de opções inválido.", "validation_error");
    const group = raw as GroupInput;
    const name = requiredString(group.name, `Grupo ${groupIndex + 1}`, 2, 80);
    const minSelect = integerBetween(group.minSelect ?? 0, 0, 20, "Mínimo de escolhas");
    const maxSelect = integerBetween(group.maxSelect ?? 1, 1, 20, "Máximo de escolhas");
    if (minSelect > maxSelect) throw new HttpError(400, `${name}: mínimo não pode ser maior que máximo.`, "validation_error");
    const pricingStrategy = normalizeStrategy(group.pricingStrategy);
    if (!Array.isArray(group.options) || group.options.length < 1 || group.options.length > 80) {
      throw new HttpError(400, `${name}: informe de 1 a 80 opções.`, "validation_error");
    }
    const options = group.options.map((option, optionIndex) => ({
      name: requiredString(option.name, `${name} · opção ${optionIndex + 1}`, 1, 100),
      priceDeltaCents: integerBetween(option.priceDeltaCents ?? 0, 0, 1_000_000, "Acréscimo de preço"),
      costDeltaCents: integerBetween(option.costDeltaCents ?? 0, 0, 1_000_000, "Acréscimo de custo"),
      available: option.available === undefined ? true : option.available === true,
    }));
    if (minSelect > options.filter((option) => option.available).length) {
      throw new HttpError(400, `${name}: não há opções disponíveis suficientes para cumprir o mínimo.`, "validation_error");
    }
    return { name, minSelect, maxSelect, pricingStrategy, options };
  });
}

function integerBetween(value: unknown, min: number, max: number, label: string) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > max) {
    throw new HttpError(400, `${label} inválido.`, "validation_error");
  }
  return number;
}

function normalizeStrategy(value: unknown): PricingStrategy {
  const strategy = String(value || "sum");
  if (!["sum", "highest", "average", "included"].includes(strategy)) {
    throw new HttpError(400, "Estratégia de preço inválida.", "validation_error");
  }
  return strategy as PricingStrategy;
}
