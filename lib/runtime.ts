import { env } from "cloudflare:workers";

export type RapidexBindings = {
  DB: D1Database;
  BUCKET?: R2Bucket;
  RAPIDEX_OWNER_EMAIL?: string;
  RAPIDEX_PUBLIC_URL?: string;
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
  OPENAI_TRANSCRIBE_MODEL?: string;
  WHATSAPP_ACCESS_TOKEN?: string;
  WHATSAPP_PHONE_NUMBER_ID?: string;
  WHATSAPP_BUSINESS_ACCOUNT_ID?: string;
  WHATSAPP_VERIFY_TOKEN?: string;
  WHATSAPP_APP_SECRET?: string;
  WHATSAPP_GRAPH_VERSION?: string;
  MERCADO_PAGO_ACCESS_TOKEN?: string;
  MERCADO_PAGO_WEBHOOK_SECRET?: string;
};

export function getBindings(): RapidexBindings {
  return env as unknown as RapidexBindings;
}

export function getDatabase(): D1Database {
  const database = getBindings().DB;
  if (!database) throw new Error("Binding D1 DB indisponível.");
  return database;
}

export function integrationReadiness() {
  const bindings = getBindings();
  return {
    database: Boolean(bindings.DB),
    uploads: Boolean(bindings.BUCKET),
    openai: Boolean(bindings.OPENAI_API_KEY),
    whatsapp: Boolean(
      bindings.WHATSAPP_ACCESS_TOKEN &&
        bindings.WHATSAPP_PHONE_NUMBER_ID &&
        bindings.WHATSAPP_VERIFY_TOKEN &&
        bindings.WHATSAPP_APP_SECRET,
    ),
    pix: Boolean(bindings.MERCADO_PAGO_ACCESS_TOKEN),
  };
}
