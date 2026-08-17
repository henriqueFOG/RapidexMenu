import { normalizeRapidexEnvironment } from "./environment";
import { redactLogValue, structuredLog } from "./observability";
import type { RapidexBindings } from "./runtime";

type AlertSeverity = "warning" | "critical";

export type OperationalAlert = {
  event: string;
  severity: AlertSeverity;
  summary: string;
  metadata?: Record<string, unknown>;
};

type AlertDelivery = {
  configured: boolean;
  delivered: boolean;
  reason?: "invalid_url" | "request_failed" | "provider_rejected";
};

export async function notifyOperationalAlert(input: OperationalAlert): Promise<AlertDelivery> {
  const { getBindings } = await import("./runtime");
  return deliverOperationalAlert(getBindings(), input);
}

export async function deliverOperationalAlert(
  bindings: RapidexBindings,
  input: OperationalAlert,
  fetcher: typeof fetch = fetch,
): Promise<AlertDelivery> {
  const rawUrl = String(bindings.RAPIDEX_ALERT_WEBHOOK_URL || "").trim();
  if (!rawUrl) return { configured: false, delivered: false };

  const url = safeWebhookUrl(rawUrl);
  if (!url) {
    structuredLog("error", "alerts.invalid_configuration", { event: input.event });
    return { configured: true, delivered: false, reason: "invalid_url" };
  }

  const event = normalizeEvent(input.event);
  const payload = {
    service: "rapidexmenu",
    environment: normalizeRapidexEnvironment(bindings.RAPIDEX_ENV),
    severity: input.severity,
    event,
    summary: String(redactLogValue(input.summary)).slice(0, 240),
    metadata: redactLogValue(input.metadata || {}),
    occurredAt: new Date().toISOString(),
  };
  const headers: Record<string, string> = { "content-type": "application/json" };
  const secret = String(bindings.RAPIDEX_ALERT_WEBHOOK_SECRET || "").trim();
  if (secret) headers.authorization = `Bearer ${secret}`;

  try {
    const response = await fetcher(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) {
      structuredLog("error", "alerts.provider_rejected", { event, status: response.status });
      return { configured: true, delivered: false, reason: "provider_rejected" };
    }
    return { configured: true, delivered: true };
  } catch (error) {
    structuredLog("error", "alerts.delivery_failed", { event, error });
    return { configured: true, delivered: false, reason: "request_failed" };
  }
}

function safeWebhookUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function normalizeEvent(value: string) {
  const normalized = value.trim().replace(/[^a-zA-Z0-9._:-]/g, "_").slice(0, 120);
  return normalized || "operational.alert";
}
