import { HttpError } from "./http";

export type DeliveryAddress = {
  neighborhood: string;
  postalCode: string;
};

export type DeliveryZoneRow = {
  id: string;
  name: string;
  match_type: "postal_prefix" | "neighborhood";
  match_value: string;
  fee_cents: number;
  minimum_order_cents: number;
  extra_minutes: number;
};

export type DeliveryTerms = {
  zoneId: string | null;
  zoneName: string | null;
  feeCents: number;
  minimumOrderCents: number;
  extraMinutes: number;
  matched: boolean;
  coverageRestricted: boolean;
};

export function deliveryCoverageRestricted(settingsValue: unknown) {
  const settings = parseSettings(settingsValue);
  const delivery = asRecord(settings.delivery);
  return delivery.restrictToZones === true;
}

export function withDeliveryCoverageSetting(settingsValue: unknown, restrictToZones: boolean) {
  const settings = parseSettings(settingsValue);
  const delivery = asRecord(settings.delivery);
  settings.delivery = { ...delivery, restrictToZones };
  return settings;
}

export async function resolveDeliveryTerms(
  db: D1Database,
  input: {
    restaurantId: string;
    settingsValue: unknown;
    address: DeliveryAddress;
    defaultFeeCents: number;
    defaultMinimumOrderCents: number;
  },
): Promise<DeliveryTerms> {
  const zones = await db.prepare(
    `SELECT id, name, match_type, match_value, fee_cents, minimum_order_cents, extra_minutes
     FROM delivery_zones
     WHERE restaurant_id = ? AND active = 1
     ORDER BY position, created_at`,
  ).bind(input.restaurantId).all<DeliveryZoneRow>();
  return matchDeliveryTerms(zones.results, input);
}

export function matchDeliveryTerms(
  zones: DeliveryZoneRow[],
  input: {
    settingsValue: unknown;
    address: DeliveryAddress;
    defaultFeeCents: number;
    defaultMinimumOrderCents: number;
  },
): DeliveryTerms {
  const restricted = deliveryCoverageRestricted(input.settingsValue);
  const postalCode = normalizePostalCode(input.address.postalCode);
  const neighborhood = normalizeNeighborhood(input.address.neighborhood);
  const matching = zones.filter((zone) => {
    if (zone.match_type === "postal_prefix") {
      return postalCode.startsWith(normalizePostalCode(zone.match_value));
    }
    return neighborhood === normalizeNeighborhood(zone.match_value);
  });
  matching.sort((left, right) => {
    if (left.match_type !== right.match_type) return left.match_type === "postal_prefix" ? -1 : 1;
    if (left.match_type === "postal_prefix") return right.match_value.length - left.match_value.length;
    return 0;
  });
  const zone = matching[0] || null;
  if (!zone && restricted && zones.length > 0) {
    throw new HttpError(
      409,
      "Este endereço está fora da área de entrega da loja.",
      "delivery_outside_area",
      { postalCode: postalCode.slice(0, 5), neighborhood: input.address.neighborhood.slice(0, 80) },
    );
  }
  if (!zone) {
    return {
      zoneId: null,
      zoneName: null,
      feeCents: input.defaultFeeCents,
      minimumOrderCents: input.defaultMinimumOrderCents,
      extraMinutes: 0,
      matched: false,
      coverageRestricted: restricted,
    };
  }
  return {
    zoneId: zone.id,
    zoneName: zone.name,
    feeCents: Number(zone.fee_cents),
    minimumOrderCents: Number(zone.minimum_order_cents),
    extraMinutes: Number(zone.extra_minutes),
    matched: true,
    coverageRestricted: restricted,
  };
}

export function normalizePostalCode(value: unknown) {
  return String(value || "").replace(/\D/g, "").slice(0, 8);
}

export function normalizeNeighborhood(value: unknown) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
    .slice(0, 100);
}

function parseSettings(value: unknown): Record<string, unknown> {
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      return asRecord(parsed);
    } catch {
      return {};
    }
  }
  return asRecord(value);
}
function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
