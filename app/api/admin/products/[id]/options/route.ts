import { audit, requireAdminContext, requireRole } from "@/lib/admin-auth";
import { apiError, assertSameOrigin, HttpError, json, readJson } from "@/lib/http";
import { getDatabase } from "@/lib/runtime";
import { requiredString } from "@/lib/validation";

export const dynamic = "force-dynamic";

type PricingStrategy = "sum" | "highest" | "average" | "included";
type GroupKind = "modifier" | "variant";
type OptionInput = {
  name?: unknown;
  priceDeltaCents?: unknown;
  costDeltaCents?: unknown;
  finalPriceCents?: unknown;
  finalCostCents?: unknown;
  available?: unknown;
  stockControlEnabled?: unknown;
  stockQuantity?: unknown;
};
type GroupInput = {
  kind?: unknown;
  name?: unknown;
  minSelect?: unknown;
  maxSelect?: unknown;
  pricingStrategy?: unknown;
  options?: OptionInput[];
};
type OwnedProduct = { id: string; name: string; price_cents: number; cost_cents: number };
type NormalizedOption = {
  name: string;
  priceDeltaCents: number;
  costDeltaCents: number;
  finalPriceCents: number | null;
  finalCostCents: number | null;
  available: boolean;
  stockControlEnabled: boolean;
  stockQuantity: number | null;
};
type NormalizedGroup = {
  kind: GroupKind;
  name: string;
  minSelect: number;
  maxSelect: number;
  pricingStrategy: PricingStrategy;
  options: NormalizedOption[];
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const context = await requireAdminContext();
    const productId = requiredString((await params).id, "Produto", 2, 100);
    const db = getDatabase();
    const product = await requireOwnedProduct(db, context.restaurantId, productId);
    return json({ ok: true, groups: await loadGroups(db, context.restaurantId, product) });
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
    const body = await readJson<{ groups?: GroupInput[] }>(request, 100_000);
    const db = getDatabase();
    const product = await requireOwnedProduct(db, context.restaurantId, productId);
    const groups = normalizeGroups(body.groups);
    const variantGroup = groups.find((group) => group.kind === "variant") || null;
    const now = Date.now();

    const variantBasePrice = variantGroup
      ? Math.min(...variantGroup.options.map((option) => Number(option.finalPriceCents)))
      : null;
    const variantBaseCost = variantGroup
      ? Math.min(...variantGroup.options.map((option) => Number(option.finalCostCents)))
      : null;

    const statements: D1PreparedStatement[] = [
      db.prepare("DELETE FROM product_option_groups WHERE restaurant_id = ? AND product_id = ?")
        .bind(context.restaurantId, productId),
    ];

    if (variantGroup && variantBasePrice !== null && variantBaseCost !== null) {
      statements.push(
        db.prepare(
          `UPDATE products
           SET price_cents = ?, cost_cents = ?, stock_control_enabled = 0, stock_quantity = NULL, updated_at = ?
           WHERE id = ? AND restaurant_id = ?`,
        ).bind(variantBasePrice, variantBaseCost, now, productId, context.restaurantId),
      );
    }

    for (let groupPosition = 0; groupPosition < groups.length; groupPosition += 1) {
      const group = groups[groupPosition];
      const groupId = crypto.randomUUID();
      statements.push(
        db.prepare(
          `INSERT INTO product_option_groups
           (id, restaurant_id, product_id, name, min_select, max_select, pricing_strategy, kind, position, active, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
        ).bind(
          groupId,
          context.restaurantId,
          productId,
          group.name,
          group.minSelect,
          group.maxSelect,
          group.pricingStrategy,
          group.kind,
          groupPosition,
          now,
          now,
        ),
      );
      for (let optionPosition = 0; optionPosition < group.options.length; optionPosition += 1) {
        const option = group.options[optionPosition];
        const priceDeltaCents = group.kind === "variant"
          ? Number(option.finalPriceCents) - Number(variantBasePrice)
          : option.priceDeltaCents;
        const costDeltaCents = group.kind === "variant"
          ? Number(option.finalCostCents) - Number(variantBaseCost)
          : option.costDeltaCents;
        statements.push(
          db.prepare(
            `INSERT INTO product_options
             (id, restaurant_id, group_id, name, price_delta_cents, cost_delta_cents, available,
              stock_control_enabled, stock_quantity, position, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          ).bind(
            crypto.randomUUID(),
            context.restaurantId,
            groupId,
            option.name,
            priceDeltaCents,
            costDeltaCents,
            option.available ? 1 : 0,
            group.kind === "variant" && option.stockControlEnabled ? 1 : 0,
            group.kind === "variant" && option.stockControlEnabled ? option.stockQuantity : null,
            optionPosition,
            now,
            now,
          ),
        );
      }
    }

    statements.push(
      db.prepare(
        "UPDATE restaurants SET catalog_version = catalog_version + 1, updated_at = ? WHERE id = ?",
      ).bind(now, context.restaurantId),
    );

    await db.batch(statements);
    const currentProduct = variantGroup && variantBasePrice !== null && variantBaseCost !== null
      ? { ...product, price_cents: variantBasePrice, cost_cents: variantBaseCost }
      : product;
    await audit(context, "product.options_replaced", "product", productId, {
      groups: groups.length,
      options: groups.reduce((sum, group) => sum + group.options.length, 0),
      variants: variantGroup?.options.length || 0,
    });
    return json({ ok: true, groups: await loadGroups(db, context.restaurantId, currentProduct) });
  } catch (error) {
    return apiError(error, request);
  }
}

async function requireOwnedProduct(db: D1Database, restaurantId: string, productId: string): Promise<OwnedProduct> {
  const product = await db
    .prepare("SELECT id, name, price_cents, cost_cents FROM products WHERE id = ? AND restaurant_id = ? AND active = 1 LIMIT 1")
    .bind(productId, restaurantId)
    .first<OwnedProduct>();
  if (!product) throw new HttpError(404, "Produto não encontrado.", "product_not_found");
  return product;
}

async function loadGroups(db: D1Database, restaurantId: string, product: OwnedProduct) {
  const [groups, options] = await Promise.all([
    db.prepare(
      `SELECT id, name, min_select, max_select, pricing_strategy, kind, position
       FROM product_option_groups
       WHERE restaurant_id = ? AND product_id = ? AND active = 1
       ORDER BY position, created_at`,
    ).bind(restaurantId, product.id).all<{
      id: string;
      name: string;
      min_select: number;
      max_select: number;
      pricing_strategy: PricingStrategy;
      kind: GroupKind;
      position: number;
    }>(),
    db.prepare(
      `SELECT po.id, po.group_id, po.name, po.price_delta_cents, po.cost_delta_cents, po.available,
              po.stock_control_enabled, po.stock_quantity, po.position, pog.kind
       FROM product_options po
       JOIN product_option_groups pog ON pog.id = po.group_id
       WHERE po.restaurant_id = ? AND pog.product_id = ?
       ORDER BY po.position, po.created_at`,
    ).bind(restaurantId, product.id).all<{
      id: string;
      group_id: string;
      name: string;
      price_delta_cents: number;
      cost_delta_cents: number;
      available: number;
      stock_control_enabled: number;
      stock_quantity: number | null;
      position: number;
      kind: GroupKind;
    }>(),
  ]);
  return groups.results.map((group) => ({
    id: group.id,
    kind: group.kind || "modifier",
    name: group.name,
    minSelect: Number(group.min_select),
    maxSelect: Number(group.max_select),
    pricingStrategy: group.pricing_strategy,
    options: options.results.filter((option) => option.group_id === group.id).map((option) => ({
      id: option.id,
      name: option.name,
      priceDeltaCents: Number(option.price_delta_cents),
      costDeltaCents: Number(option.cost_delta_cents),
      finalPriceCents: group.kind === "variant" ? Number(product.price_cents) + Number(option.price_delta_cents) : null,
      finalCostCents: group.kind === "variant" ? Number(product.cost_cents) + Number(option.cost_delta_cents) : null,
      available: Boolean(option.available),
      stockControlEnabled: group.kind === "variant" ? Boolean(option.stock_control_enabled) : false,
      stockQuantity: group.kind === "variant" && option.stock_quantity !== null ? Number(option.stock_quantity) : null,
    })),
  }));
}

function normalizeGroups(value: unknown): NormalizedGroup[] {
  if (!Array.isArray(value)) throw new HttpError(400, "Envie os grupos de opções.", "validation_error", { field: "groups" });
  if (value.length > 20) throw new HttpError(400, "Um produto pode ter no máximo 20 grupos de opções.", "validation_error");

  const normalized = value.map((raw, groupIndex): NormalizedGroup => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new HttpError(400, "Grupo de opções inválido.", "validation_error");
    const group = raw as GroupInput;
    const kind = normalizeKind(group.kind);
    const name = requiredString(group.name, `Grupo ${groupIndex + 1}`, 2, 80);
    const minSelect = kind === "variant" ? 1 : integerBetween(group.minSelect ?? 0, 0, 20, "Mínimo de escolhas");
    const maxSelect = kind === "variant" ? 1 : integerBetween(group.maxSelect ?? 1, 1, 20, "Máximo de escolhas");
    if (minSelect > maxSelect) throw new HttpError(400, `${name}: mínimo não pode ser maior que máximo.`, "validation_error");
    const pricingStrategy = kind === "variant" ? "sum" : normalizeStrategy(group.pricingStrategy);
    if (!Array.isArray(group.options) || group.options.length < 1 || group.options.length > (kind === "variant" ? 40 : 80)) {
      throw new HttpError(400, `${name}: informe de 1 a ${kind === "variant" ? 40 : 80} opções.`, "validation_error");
    }

    const options = group.options.map((rawOption, optionIndex): NormalizedOption => {
      if (!rawOption || typeof rawOption !== "object" || Array.isArray(rawOption)) {
        throw new HttpError(400, `${name}: opção ${optionIndex + 1} inválida.`, "validation_error");
      }
      const option = rawOption as OptionInput;
      const available = option.available === undefined ? true : option.available === true;
      if (kind === "variant") {
        const finalPriceCents = integerBetween(option.finalPriceCents, 1, 1_000_000, "Preço da variação");
        const finalCostCents = integerBetween(option.finalCostCents ?? 0, 0, 1_000_000, "Custo da variação");
        if (finalCostCents >= finalPriceCents) {
          throw new HttpError(400, `${name}: o preço da variação precisa ser maior que o custo.`, "invalid_margin");
        }
        const stockControlEnabled = option.stockControlEnabled === true;
        const stockQuantity = stockControlEnabled
          ? integerBetween(option.stockQuantity ?? 0, 0, 10_000_000, "Estoque da variação")
          : null;
        return {
          name: requiredString(option.name, `${name} · variação ${optionIndex + 1}`, 1, 100),
          priceDeltaCents: 0,
          costDeltaCents: 0,
          finalPriceCents,
          finalCostCents,
          available,
          stockControlEnabled,
          stockQuantity,
        };
      }
      return {
        name: requiredString(option.name, `${name} · opção ${optionIndex + 1}`, 1, 100),
        priceDeltaCents: integerBetween(option.priceDeltaCents ?? 0, 0, 1_000_000, "Acréscimo de preço"),
        costDeltaCents: integerBetween(option.costDeltaCents ?? 0, 0, 1_000_000, "Acréscimo de custo"),
        finalPriceCents: null,
        finalCostCents: null,
        available,
        stockControlEnabled: false,
        stockQuantity: null,
      };
    });

    if (kind !== "variant" && minSelect > options.filter((option) => option.available).length) {
      throw new HttpError(400, `${name}: não há escolhas disponíveis suficientes para cumprir o mínimo.`, "validation_error");
    }
    return { kind, name, minSelect, maxSelect, pricingStrategy, options };
  });

  if (normalized.filter((group) => group.kind === "variant").length > 1) {
    throw new HttpError(400, "Cada produto pode ter um único grupo de variações estruturais.", "validation_error", { field: "groups" });
  }
  return normalized;
}

function integerBetween(value: unknown, min: number, max: number, label: string) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > max) {
    throw new HttpError(400, `${label} inválido.`, "validation_error");
  }
  return number;
}

function normalizeKind(value: unknown): GroupKind {
  const kind = String(value || "modifier");
  if (!["modifier", "variant"].includes(kind)) throw new HttpError(400, "Tipo de grupo inválido.", "validation_error");
  return kind as GroupKind;
}

function normalizeStrategy(value: unknown): PricingStrategy {
  const strategy = String(value || "sum");
  if (!["sum", "highest", "average", "included"].includes(strategy)) {
    throw new HttpError(400, "Estratégia de preço inválida.", "validation_error");
  }
  return strategy as PricingStrategy;
}
