import { HttpError } from "./http";
import type { FulfillmentType } from "./order-service";

export type FulfillmentSettings = {
  deliveryEnabled: boolean;
  pickupEnabled: boolean;
  dineInEnabled: boolean;
};

export function fulfillmentSettingsFrom(value: unknown): FulfillmentSettings {
  const settings = asRecord(value);
  const fulfillment = asRecord(settings.fulfillment);
  // Backward-compatible rule: existing restaurants remain delivery-only until the owner opts in.
  return {
    deliveryEnabled: fulfillment.deliveryEnabled === undefined ? true : fulfillment.deliveryEnabled === true,
    pickupEnabled: fulfillment.pickupEnabled === true,
    dineInEnabled: fulfillment.dineInEnabled === true,
  };
}

export function normalizeFulfillmentSettings(value: unknown, current?: FulfillmentSettings): FulfillmentSettings {
  const record = asRecord(value);
  const next: FulfillmentSettings = {
    deliveryEnabled: booleanOr(record.deliveryEnabled, current?.deliveryEnabled ?? true),
    pickupEnabled: booleanOr(record.pickupEnabled, current?.pickupEnabled ?? false),
    dineInEnabled: booleanOr(record.dineInEnabled, current?.dineInEnabled ?? false),
  };
  if (!next.deliveryEnabled && !next.pickupEnabled && !next.dineInEnabled) {
    throw new HttpError(400, "Mantenha pelo menos uma modalidade de atendimento ativa.", "validation_error", {
      field: "fulfillment",
    });
  }
  return next;
}

export function assertFulfillmentEnabled(settingsValue: unknown, type: FulfillmentType) {
  const settings = fulfillmentSettingsFrom(settingsValue);
  const enabled =
    type === "delivery" ? settings.deliveryEnabled :
      type === "pickup" ? settings.pickupEnabled : settings.dineInEnabled;
  if (!enabled) {
    throw new HttpError(409, "Esta modalidade de atendimento não está disponível nesta loja.", "fulfillment_unavailable", {
      fulfillmentType: type,
    });
  }
  return settings;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
    } catch {
      return {};
    }
  }
  return typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function booleanOr(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}
