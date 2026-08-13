import { env } from "cloudflare:workers";
import { assertEnvironmentConfiguration, normalizeRapidexEnvironment, validateEnvironmentConfiguration } from "./environment";
import { getPostgresDatabase } from "./postgres-d1";

export type RapidexBindings = {
  DB?: D1Database;
  BUCKET?: R2Bucket;
  DATABASE_URL?: string;
  POSTGRES_URL?: string;
  RAPIDEX_ENV?: string;
  RAPIDEX_AUTH_MODE?: string;
  RAPIDEX_SESSION_SECRET?: string;
  RAPIDEX_INTEGRATION_SECRET?: string;
  CRON_SECRET?: string;
  RAPIDEX_CRON_SECRET?: string;
  RAPIDEX_SIGNUP_ENABLED?: string;
  RAPIDEX_HMG_OWNER_EMAIL?: string;
  RAPIDEX_HMG_OWNER_NAME?: string;
  RAPIDEX_HMG_ACCESS_CODE?: string;
  RAPIDEX_OWNER_EMAIL?: string;
  RAPIDEX_PUBLIC_URL?: string;
  RAPIDEX_BILLING_MP_ACCESS_TOKEN?: string;
  RAPIDEX_MP_CLIENT_ID?: string;
  RAPIDEX_MP_CLIENT_SECRET?: string;
  RAPIDEX_META_APP_ID?: string;
  RAPIDEX_META_APP_SECRET?: string;
  RAPIDEX_META_EMBEDDED_SIGNUP_CONFIG_ID?: string;
  RAPIDEX_META_SOLUTION_ID?: string;
  RESEND_API_KEY?: string;
  RAPIDEX_EMAIL_FROM?: string;
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

export function getRapidexEnvironment() {
  return normalizeRapidexEnvironment(getBindings().RAPIDEX_ENV);
}

export function reconciliationSecret() {
  const bindings = getBindings();
  // CRON_SECRET is the native Vercel convention. Keep RAPIDEX_CRON_SECRET
  // as a compatibility alias for non-Vercel/local environments.
  return String(bindings.CRON_SECRET || bindings.RAPIDEX_CRON_SECRET || "").trim();
}

export function getDatabase(): D1Database {
  const bindings = getBindings();
  assertEnvironmentConfiguration({
    environment: bindings.RAPIDEX_ENV,
    publicUrl: bindings.RAPIDEX_PUBLIC_URL,
    billingToken: bindings.RAPIDEX_BILLING_MP_ACCESS_TOKEN,
  });

  if (bindings.DB) return bindings.DB;

  const connectionString = bindings.DATABASE_URL || bindings.POSTGRES_URL;
  if (connectionString) return getPostgresDatabase(connectionString);

  throw new Error("Banco indisponivel. Configure DATABASE_URL para Postgres ou o binding DB para D1.");
}

export function integrationReadiness() {
  const bindings = getBindings();
  const environmentCheck = validateEnvironmentConfiguration({
    environment: bindings.RAPIDEX_ENV,
    publicUrl: bindings.RAPIDEX_PUBLIC_URL,
    billingToken: bindings.RAPIDEX_BILLING_MP_ACCESS_TOKEN,
  });
  const whatsappLegacy = Boolean(
    bindings.WHATSAPP_ACCESS_TOKEN &&
      bindings.WHATSAPP_PHONE_NUMBER_ID &&
      bindings.WHATSAPP_VERIFY_TOKEN &&
      bindings.WHATSAPP_APP_SECRET,
  );
  const metaEmbeddedSignup = Boolean(
    bindings.RAPIDEX_META_APP_ID &&
      bindings.RAPIDEX_META_APP_SECRET &&
      bindings.RAPIDEX_META_EMBEDDED_SIGNUP_CONFIG_ID &&
      bindings.RAPIDEX_INTEGRATION_SECRET &&
      bindings.RAPIDEX_INTEGRATION_SECRET.length >= 32 &&
      bindings.WHATSAPP_VERIFY_TOKEN &&
      bindings.WHATSAPP_APP_SECRET,
  );
  const postgresConfigured = Boolean(bindings.DATABASE_URL || bindings.POSTGRES_URL);
  const cronSecret = reconciliationSecret();
  return {
    environment: environmentCheck.environment,
    environmentSafe: environmentCheck.issues.length === 0,
    environmentIssues: environmentCheck.issues,
    database: Boolean(bindings.DB || postgresConfigured),
    databaseEngine: bindings.DB ? "d1" : postgresConfigured ? "postgres" : null,
    nativeAuth: Boolean(bindings.RAPIDEX_SESSION_SECRET && bindings.RAPIDEX_SESSION_SECRET.length >= 32),
    billing: environmentCheck.environment === "production" && Boolean(bindings.RAPIDEX_BILLING_MP_ACCESS_TOKEN),
    email: Boolean(bindings.RESEND_API_KEY && bindings.RAPIDEX_EMAIL_FROM),
    sellerPayments: Boolean(
      bindings.RAPIDEX_MP_CLIENT_ID &&
        bindings.RAPIDEX_MP_CLIENT_SECRET &&
        bindings.RAPIDEX_INTEGRATION_SECRET &&
        bindings.RAPIDEX_INTEGRATION_SECRET.length >= 32,
    ),
    reconciliation: cronSecret.length >= 32,
    metaEmbeddedSignup,
    uploads: Boolean(bindings.BUCKET || postgresConfigured),
    openai: Boolean(bindings.OPENAI_API_KEY),
    whatsapp: whatsappLegacy || metaEmbeddedSignup,
    whatsappLegacy,
    pixLegacy: Boolean(bindings.MERCADO_PAGO_ACCESS_TOKEN),
  };
}
