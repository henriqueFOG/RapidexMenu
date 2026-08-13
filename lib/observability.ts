const sensitiveKey = /(authorization|cookie|password|secret|token|access[_-]?token|refresh[_-]?token|api[_-]?key|pix[_-]?code|address|phone|email|document|cpf|cnpj)/i;
const bearerLike = /(?:bearer\s+)?[A-Za-z0-9_-]{24,}(?:\.[A-Za-z0-9_-]{10,})*/gi;
const emailLike = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const phoneLike = /\b(?:\+?55)?\s*\(?\d{2}\)?[\s.-]*9?\d{4}[\s.-]*\d{4}\b/g;

export type LogLevel = "info" | "warn" | "error";

export function correlationId(value?: string | null) {
  const candidate = String(value || "").trim();
  if (/^[A-Za-z0-9._:-]{8,100}$/.test(candidate)) return candidate;
  return crypto.randomUUID();
}

export function requestCorrelationId(request?: Request | null) {
  return correlationId(request?.headers.get("x-request-id"));
}

export function redactLogValue(value: unknown, depth = 0): unknown {
  if (depth > 6) return "[MAX_DEPTH]";
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return redactString(value);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (value instanceof Error) {
    return {
      name: value.name,
      message: redactString(value.message).slice(0, 500),
    };
  }
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => redactLogValue(item, depth + 1));
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).slice(0, 100);
    return Object.fromEntries(entries.map(([key, item]) => [
      key,
      sensitiveKey.test(key) ? "[REDACTED]" : redactLogValue(item, depth + 1),
    ]));
  }
  return String(value).slice(0, 500);
}

export function structuredLog(
  level: LogLevel,
  event: string,
  metadata: Record<string, unknown> = {},
) {
  const payload = {
    ts: new Date().toISOString(),
    level,
    event: event.slice(0, 120),
    ...redactLogValue(metadata) as Record<string, unknown>,
  };
  const line = JSON.stringify(payload);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}

function redactString(value: string) {
  return value
    .replace(emailLike, "[EMAIL]")
    .replace(phoneLike, "[PHONE]")
    .replace(bearerLike, (match) => match.length >= 24 ? "[TOKEN]" : match)
    .slice(0, 2000);
}
