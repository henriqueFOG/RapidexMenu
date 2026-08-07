export type RapidexEnvironment = "development" | "ci" | "hmg" | "production";

export function normalizeRapidexEnvironment(value: unknown): RapidexEnvironment {
  return parseRapidexEnvironment(value) || "development";
}

export function isProductionEnvironment(value: unknown) {
  return normalizeRapidexEnvironment(value) === "production";
}

export function validateEnvironmentConfiguration(input: {
  environment: unknown;
  publicUrl?: string | null;
  billingToken?: string | null;
}) {
  const parsed = parseRapidexEnvironment(input.environment);
  const environment = parsed || "development";
  const publicUrl = String(input.publicUrl || "").trim();
  const rawEnvironment = String(input.environment || "").trim();
  const issues: string[] = [];

  if (rawEnvironment && !parsed) {
    issues.push("RAPIDEX_ENV inválido. Use development, ci, hmg ou production.");
  }

  if (environment === "production") {
    if (!publicUrl.startsWith("https://")) issues.push("Produção exige RAPIDEX_PUBLIC_URL com HTTPS.");
    if (/hmg|homolog|staging/i.test(publicUrl)) issues.push("Produção não pode usar URL identificada como HMG/staging.");
  }

  if (environment === "hmg") {
    if (publicUrl && /(^|\.)rapidexmenu\.com\.br\/?$/i.test(publicUrl.replace(/^https?:\/\//i, ""))) {
      issues.push("HMG não pode usar o domínio oficial de produção.");
    }
    if (input.billingToken) {
      issues.push("HMG não deve configurar RAPIDEX_BILLING_MP_ACCESS_TOKEN; cobrança da mensalidade deve ficar desativada.");
    }
  }

  return { environment, issues };
}

export function assertEnvironmentConfiguration(input: {
  environment: unknown;
  publicUrl?: string | null;
  billingToken?: string | null;
}) {
  const result = validateEnvironmentConfiguration(input);
  if (result.issues.length) throw new Error(`Configuração de ambiente inválida: ${result.issues.join(" ")}`);
  return result.environment;
}

function parseRapidexEnvironment(value: unknown): RapidexEnvironment | null {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized || normalized === "development" || normalized === "dev") return "development";
  if (["prod", "production"].includes(normalized)) return "production";
  if (["hmg", "homologation", "homolog", "staging", "stage"].includes(normalized)) return "hmg";
  if (["ci", "test"].includes(normalized)) return "ci";
  return null;
}
