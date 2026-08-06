import { HttpError } from "./http";

export function requiredString(value: unknown, field: string, min = 1, max = 120) {
  if (typeof value !== "string") {
    throw new HttpError(400, `${field} é obrigatório.`, "validation_error", { field });
  }
  const normalized = value.trim();
  if (normalized.length < min || normalized.length > max) {
    throw new HttpError(400, `${field} deve ter entre ${min} e ${max} caracteres.`, "validation_error", {
      field,
    });
  }
  return normalized;
}

export function optionalString(value: unknown, field: string, max = 500) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || value.trim().length > max) {
    throw new HttpError(400, `${field} é inválido.`, "validation_error", { field });
  }
  return value.trim();
}

export function normalizePhone(value: unknown) {
  const raw = requiredString(value, "Telefone", 10, 24);
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15) {
    throw new HttpError(400, "Telefone inválido.", "validation_error", { field: "phone" });
  }
  return digits;
}

export function positiveInteger(value: unknown, field: string, maximum = 100) {
  if (!Number.isInteger(value) || Number(value) < 1 || Number(value) > maximum) {
    throw new HttpError(400, `${field} é inválido.`, "validation_error", { field });
  }
  return Number(value);
}

export function cents(value: unknown, field: string, minimum = 0, maximum = 10_000_000) {
  if (!Number.isInteger(value) || Number(value) < minimum || Number(value) > maximum) {
    throw new HttpError(400, `${field} é inválido.`, "validation_error", { field });
  }
  return Number(value);
}

export function booleanValue(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

export function safeSlug(value: unknown) {
  const slug = requiredString(value, "Identificador da loja", 2, 80).toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new HttpError(400, "Identificador da loja inválido.", "validation_error", { field: "slug" });
  }
  return slug;
}
