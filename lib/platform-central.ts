import { HttpError } from "./http";
import { requiredString } from "./validation";

export type ManagedRestaurantStatus = "trial" | "active" | "paused" | "canceled";
export type ManagedRestaurantAction = "pause" | "reactivate" | "block" | "unblock";

export function normalizeManagedEmail(value: unknown) {
  const email = requiredString(value, "E-mail", 5, 160).trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpError(400, "E-mail inválido.", "validation_error", { field: "email" });
  }
  return email;
}

export function normalizeManagedPlan(value: unknown): "start" | "growth" | "scale" {
  if (value === "start" || value === "growth" || value === "scale") return value;
  throw new HttpError(400, "Plano inválido.", "validation_error", { field: "plan" });
}

export function normalizeManagedStatus(value: unknown): ManagedRestaurantStatus {
  if (value === "trial" || value === "active" || value === "paused" || value === "canceled") return value;
  throw new HttpError(400, "Status inválido.", "validation_error", { field: "status" });
}

export function restaurantControlTransition(
  current: { status: ManagedRestaurantStatus; blockedAt: number | null; previousStatus: string | null },
  action: ManagedRestaurantAction,
  now: number,
) {
  if (action === "block") {
    if (current.blockedAt) throw new HttpError(409, "O estabelecimento já está bloqueado.", "already_blocked");
    return { status: "paused" as const, blockedAt: now, previousStatus: current.status };
  }
  if (action === "unblock") {
    if (!current.blockedAt) throw new HttpError(409, "O estabelecimento não está bloqueado.", "not_blocked");
    const restored = current.previousStatus === "trial" || current.previousStatus === "paused"
      ? current.previousStatus
      : "active";
    return { status: restored, blockedAt: null, previousStatus: null };
  }
  if (current.blockedAt) {
    throw new HttpError(409, "Desbloqueie o estabelecimento antes de alterar seu estado.", "restaurant_blocked");
  }
  if (action === "pause") return { status: "paused" as const, blockedAt: null, previousStatus: null };
  return { status: "active" as const, blockedAt: null, previousStatus: null };
}

export function slugifyManagedRestaurant(value: string) {
  const slug = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70);
  return slug.length >= 2 ? slug : `loja-${crypto.randomUUID().slice(0, 8)}`;
}

export function optionalTimestamp(value: unknown, field: string) {
  if (value === null || value === undefined || value === "") return null;
  const timestamp = typeof value === "number" ? value : Date.parse(String(value));
  if (!Number.isSafeInteger(timestamp) || timestamp < 0) {
    throw new HttpError(400, `${field} inválido.`, "validation_error", { field });
  }
  return timestamp;
}
