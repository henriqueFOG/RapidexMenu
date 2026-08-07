import { env } from "cloudflare:workers";
import { getPostgresDatabase } from "./postgres-d1";

export type RapidexBindings = {
  DB?: D1Database;
  BUCKET?: R2Bucket;
  DATABASE_URL?: string;
  POSTGRES_URL?: string;
  RAPIDEX_ENV?: string;
  RAPIDEX_AUTH_MODE?: string;
  RAPIDEX_SESSION_SECRET?: string;
  RAPIDEX_SIGNUP_ENABLED?: string;
  RAPIDEX_HMG_OWNER_EMAIL?: string;
  RAPIDEX_HMG_OWNER_NAME?: string;
  RAPIDEX_HMG_ACCESS_CODE?: string;
  RAPIDEX_OWNER_EMAIL?: string;
  RAPIDEX_PUBLIC_URL?: string;
  RAPIDEX_BILLING_MP_ACCESS_TOKEN?: string;
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
  const bindings = getBindings();
  if (bindings.DB) return bindings.DB;

  const connectionString = bindings.DATABASE_URL || bindings.POSTGRES_URL;
  if (connectionString) return getPostgresDatabase(connectionString);

  throw new Error("Banco indisponivel. Configure DATABASE_URL para Postgres ou o binding DB para D1.");
}

export function integrationReadiness() {
  const bindings = getBindings();
  return {
    environment: bindings.RAPIDEX_ENV || "development",
    database: Boolean(bindings.DB || bindings.DATABASE_URL || bindings.POSTGRES_URL),
    databaseEngine: bindings.DB ? "d1" : bindings.DATABASE_URL || bindings.POSTGRES_URL ? "postgres" : null,
    nativeAuth: Boolean(bindings.RAPIDEX_SESSION_SECRET && bindings.RAPIDEX_SESSION_SECRET.length >= 32),
    billing: Boolean(bindings.RAPIDEX_BILLING_MP_ACCESS_TOKEN),
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
