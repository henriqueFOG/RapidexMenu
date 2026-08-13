import { audit, requireAdminContext, requireRole } from "@/lib/admin-auth";
import { deliveryCoverageRestricted, normalizeNeighborhood, normalizePostalCode, withDeliveryCoverageSetting } from "@/lib/delivery-zones";
import { apiError, assertSameOrigin, HttpError, json, readJson } from "@/lib/http";
import { getDatabase } from "@/lib/runtime";
import { requiredString } from "@/lib/validation";

export const dynamic = "force-dynamic";

type ZoneInput = {
  name?: unknown;
  matchType?: unknown;
  matchValue?: unknown;
  feeCents?: unknown;
  minimumOrderCents?: unknown;
  extraMinutes?: unknown;
  active?: unknown;
};

export async function GET() {
  try {
    const context = await requireAdminContext();
    const db = getDatabase();
    const [restaurant, zones] = await Promise.all([
      db.prepare("SELECT settings_json FROM restaurants WHERE id = ? LIMIT 1")
        .bind(context.restaurantId)
        .first<{ settings_json: string }>(),
      db.prepare(
        `SELECT id, name, match_type, match_value, fee_cents, minimum_order_cents, extra_minutes, active, position
         FROM delivery_zones WHERE restaurant_id = ? ORDER BY position, created_at`,
      ).bind(context.restaurantId).all<{
        id: string; name: string; match_type: string; match_value: string; fee_cents: number;
        minimum_order_cents: number; extra_minutes: number; active: number; position: number;
      }>(),
    ]);
    return json({
      ok: true,
      restrictToZones: deliveryCoverageRestricted(restaurant?.settings_json),
      zones: zones.results.map((zone) => ({
        id: zone.id,
        name: zone.name,
        matchType: zone.match_type,
        matchValue: zone.match_value,
        feeCents: Number(zone.fee_cents),
        minimumOrderCents: Number(zone.minimum_order_cents),
        extraMinutes: Number(zone.extra_minutes),
        active: Boolean(zone.active),
      })),
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function PUT(request: Request) {
  try {
    assertSameOrigin(request);
    const context = await requireAdminContext();
    requireRole(context, ["owner", "manager"]);
    const body = await readJson<{ restrictToZones?: unknown; zones?: ZoneInput[] }>(request, 80_000);
    const zones = normalizeZones(body.zones);
    const restrictToZones = body.restrictToZones === true;
    if (restrictToZones && !zones.some((zone) => zone.active)) {
      throw new HttpError(400, "Para restringir a cobertura, mantenha pelo menos uma zona ativa.", "validation_error");
    }
    const db = getDatabase();
    const restaurant = await db.prepare("SELECT settings_json FROM restaurants WHERE id = ? LIMIT 1")
      .bind(context.restaurantId)
      .first<{ settings_json: string }>();
    if (!restaurant) throw new HttpError(404, "Loja não encontrada.", "store_not_found");
    const settings = withDeliveryCoverageSetting(restaurant.settings_json, restrictToZones);
    const now = Date.now();
    const statements: D1PreparedStatement[] = [
      db.prepare("DELETE FROM delivery_zones WHERE restaurant_id = ?").bind(context.restaurantId),
      db.prepare("UPDATE restaurants SET settings_json = ?, updated_at = ? WHERE id = ?")
        .bind(JSON.stringify(settings), now, context.restaurantId),
    ];
    zones.forEach((zone, index) => statements.push(
      db.prepare(
        `INSERT INTO delivery_zones
         (id, restaurant_id, name, match_type, match_value, fee_cents, minimum_order_cents,
          extra_minutes, active, position, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        crypto.randomUUID(), context.restaurantId, zone.name, zone.matchType, zone.matchValue,
        zone.feeCents, zone.minimumOrderCents, zone.extraMinutes, zone.active ? 1 : 0,
        index, now, now,
      ),
    ));
    await db.batch(statements);
    await audit(context, "delivery.zones_replaced", "restaurant", context.restaurantId, {
      count: zones.length,
      active: zones.filter((zone) => zone.active).length,
      restrictToZones,
    });
    return json({ ok: true, count: zones.length, restrictToZones });
  } catch (error) {
    return apiError(error);
  }
}

function normalizeZones(value: unknown) {
  if (value === undefined) return [] as Array<{
    name: string; matchType: "postal_prefix" | "neighborhood"; matchValue: string;
    feeCents: number; minimumOrderCents: number; extraMinutes: number; active: boolean;
  }>;
  if (!Array.isArray(value) || value.length > 100) {
    throw new HttpError(400, "Configure no máximo 100 zonas de entrega.", "validation_error");
  }
  const unique = new Set<string>();
  return value.map((raw, index) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      throw new HttpError(400, `Zona ${index + 1} inválida.`, "validation_error");
    }
    const zone = raw as ZoneInput;
    const name = requiredString(zone.name, `Zona ${index + 1}`, 2, 80);
    const matchType = String(zone.matchType || "");
    if (matchType !== "postal_prefix" && matchType !== "neighborhood") {
      throw new HttpError(400, `${name}: tipo de cobertura inválido.`, "validation_error");
    }
    const rawMatch = requiredString(zone.matchValue, `${name} · cobertura`, 2, 100);
    const matchValue = matchType === "postal_prefix" ? normalizePostalCode(rawMatch) : normalizeNeighborhood(rawMatch);
    if (matchType === "postal_prefix" && (matchValue.length < 3 || matchValue.length > 8)) {
      throw new HttpError(400, `${name}: use de 3 a 8 dígitos do CEP.`, "validation_error");
    }
    if (matchType === "neighborhood" && matchValue.length < 2) {
      throw new HttpError(400, `${name}: bairro inválido.`, "validation_error");
    }
    const key = `${matchType}:${matchValue}`;
    if (unique.has(key)) throw new HttpError(409, `${name}: cobertura duplicada.`, "duplicate_delivery_zone");
    unique.add(key);
    return {
      name,
      matchType: matchType as "postal_prefix" | "neighborhood",
      matchValue,
      feeCents: integer(zone.feeCents ?? 0, 0, 100_000, `${name} · frete`),
      minimumOrderCents: integer(zone.minimumOrderCents ?? 0, 0, 1_000_000, `${name} · pedido mínimo`),
      extraMinutes: integer(zone.extraMinutes ?? 0, 0, 240, `${name} · minutos extras`),
      active: zone.active === undefined ? true : zone.active === true,
    };
  });
}

function integer(value: unknown, min: number, max: number, label: string) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > max) {
    throw new HttpError(400, `${label} inválido.`, "validation_error");
  }
  return number;
}
