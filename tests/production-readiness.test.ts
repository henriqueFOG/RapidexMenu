import assert from "node:assert/strict";
import test from "node:test";
import { productionReadinessChecks } from "../lib/production-readiness";

const safe = {
  RAPIDEX_ENV: "production",
  RAPIDEX_PUBLIC_URL: "https://rapidexmenu.com.br",
  RAPIDEX_DOMAIN_VERIFIED: "true",
  DATABASE_URL: "postgresql://app@prod/db",
  RAPIDEX_DATABASE_ISOLATED: "true",
  RAPIDEX_DATABASE_APP_ROLE_VERIFIED: "true",
  RAPIDEX_AUTH_MODE: "native",
  RAPIDEX_SESSION_SECRET: "s".repeat(32),
  RAPIDEX_ADMIN_MFA_SECRET: "m".repeat(32),
  RAPIDEX_ADMIN_MFA_REQUIRED: "true",
  RAPIDEX_OWNER_EMAIL: "henry.francisco31@hotmail.com",
  RAPIDEX_SIGNUP_MODE: "invite_only",
  RAPIDEX_INTEGRATION_SECRET: "i".repeat(32),
  CRON_SECRET: "c".repeat(32),
  RAPIDEX_SCHEDULER_READY: "true",
  RESEND_API_KEY: "resend",
  RAPIDEX_EMAIL_FROM: "suporte@rapidexmenu.com.br",
  RAPIDEX_EMAIL_DELIVERY_VERIFIED: "true",
  BLOB_READ_WRITE_TOKEN: "vercel_blob_rw_token",
  RAPIDEX_STORAGE_VALIDATED: "true",
  RAPIDEX_BILLING_MP_ACCESS_TOKEN: "billing",
  RAPIDEX_BILLING_VALIDATED: "true",
  RAPIDEX_MP_CLIENT_ID: "client",
  RAPIDEX_MP_CLIENT_SECRET: "secret",
  RAPIDEX_SELLER_PAYMENTS_VALIDATED: "true",
  RAPIDEX_BACKUP_RESTORE_VERIFIED: "true",
  RAPIDEX_MONITORING_READY: "true",
  RAPIDEX_LEGAL_READY: "true",
  RAPIDEX_SUPPORT_READY: "true",
  RAPIDEX_CRITICAL_ACCOUNTS_MFA_VERIFIED: "true",
};

test("gate de produção fica verde somente com configuração obrigatória", () => {
  assert.equal(productionReadinessChecks(safe).every((item) => item.ok), true);
});

test("gate denuncia proprietário incorreto, cadastro aberto e infraestrutura ausente", () => {
  const failed = productionReadinessChecks({
    ...safe,
    RAPIDEX_OWNER_EMAIL: "heloisa.gall@gmail.com",
    RAPIDEX_SIGNUP_MODE: "open",
    DATABASE_URL: undefined,
    BLOB_READ_WRITE_TOKEN: undefined,
  });
  const broken = new Set(failed.filter((item) => !item.ok).map((item) => item.id));
  assert.deepEqual([...broken].sort(), ["database", "owner", "signup", "storage"]);
});
