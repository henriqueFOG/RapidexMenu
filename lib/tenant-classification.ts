import { DEMO_RESTAURANT_ID, PENDING_OWNER_EMAIL } from "./demo-data";

export type TenantKind = "live" | "demo" | "test";

type TenantIdentity = {
  id: string;
  name?: string | null;
  ownerEmail?: string | null;
};

const TEST_EMAIL_DOMAIN = "@rapidex-hmg.test";

export function classifyTenant(tenant: TenantIdentity): TenantKind {
  const email = String(tenant.ownerEmail || "").trim().toLowerCase();
  const name = String(tenant.name || "").trim();

  if (tenant.id === DEMO_RESTAURANT_ID || email === PENDING_OWNER_EMAIL) return "demo";
  if (email.endsWith(TEST_EMAIL_DOMAIN) || /^rapidex(?:menu)?\s+(?:e2e|platform admin e2e)\b/i.test(name)) return "test";
  return "live";
}

export function isSyntheticEmail(email: unknown) {
  return String(email || "").trim().toLowerCase().endsWith(TEST_EMAIL_DOMAIN);
}
