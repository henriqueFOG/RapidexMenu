import { HttpError } from "./http";
import { isRestaurantAcceptingOrders } from "./store-availability";

export const SCHEDULE_MIN_LEAD_MS = 30 * 60_000;
export const SCHEDULE_MAX_AHEAD_MS = 14 * 24 * 60 * 60_000;
export const SCHEDULE_SLOT_MS = 15 * 60_000;

type ScheduledAvailabilityInput = {
  scheduledFor: number;
  isOpen: number | boolean;
  timezone?: string | null;
  settingsJson?: unknown;
};

export function normalizeScheduledFor(value: unknown, now = Date.now()): number | null {
  if (value === undefined || value === null || value === "") return null;

  let parsed: number;
  if (typeof value === "number") parsed = value;
  else if (typeof value === "string" && /^\d+$/.test(value.trim())) parsed = Number(value.trim());
  else if (typeof value === "string") parsed = Date.parse(value);
  else parsed = Number.NaN;

  if (!Number.isFinite(parsed)) {
    throw new HttpError(400, "Data do agendamento inválida.", "invalid_schedule", { field: "scheduledFor" });
  }

  const timestamp = Math.floor(parsed / 60_000) * 60_000;
  if (timestamp < now + SCHEDULE_MIN_LEAD_MS) {
    throw new HttpError(
      409,
      "Escolha um horário com pelo menos 30 minutos de antecedência.",
      "schedule_too_soon",
      { minimumLeadMinutes: SCHEDULE_MIN_LEAD_MS / 60_000 },
    );
  }
  if (timestamp > now + SCHEDULE_MAX_AHEAD_MS) {
    throw new HttpError(
      409,
      "O agendamento pode ser feito com no máximo 14 dias de antecedência.",
      "schedule_too_far",
      { maximumAheadDays: SCHEDULE_MAX_AHEAD_MS / (24 * 60 * 60_000) },
    );
  }

  return timestamp;
}

export function scheduleSlotStart(timestamp: number) {
  return Math.floor(timestamp / SCHEDULE_SLOT_MS) * SCHEDULE_SLOT_MS;
}

export function assertScheduledAvailability(input: ScheduledAvailabilityInput) {
  if (!isRestaurantAcceptingOrders({
    isOpen: input.isOpen,
    timezone: input.timezone,
    settingsJson: input.settingsJson,
    now: input.scheduledFor,
  })) {
    throw new HttpError(
      409,
      "A loja não atende no horário escolhido. Selecione outro horário.",
      "scheduled_store_closed",
      { scheduledFor: input.scheduledFor },
    );
  }
}
