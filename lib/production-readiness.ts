import type { RapidexBindings } from "./runtime";
import { CANONICAL_PLATFORM_OWNER_EMAIL, FORBIDDEN_PLATFORM_ADMIN_EMAIL } from "./platform-identity-policy";
import { normalizeRapidexEnvironment } from "./environment";

export type ReadinessCheck = { id: string; label: string; ok: boolean; detail: string };

export function productionReadinessChecks(bindings: RapidexBindings): ReadinessCheck[] {
  const environment = normalizeRapidexEnvironment(bindings.RAPIDEX_ENV);
  const checks: ReadinessCheck[] = [
    check("environment", "Ambiente de produção", environment === "production", `RAPIDEX_ENV=${environment}`),
    check("public_url", "URL oficial com HTTPS", /^https:\/\/rapidexmenu\.com\.br\/?$/i.test(String(bindings.RAPIDEX_PUBLIC_URL || "")), "Use https://rapidexmenu.com.br"),
    check("domain_verified", "Domínio validado", bindings.RAPIDEX_DOMAIN_VERIFIED === "true", "DNS, TLS e domínio oficial testados externamente"),
    check("database", "Banco exclusivo configurado", Boolean(bindings.DATABASE_URL || bindings.POSTGRES_URL), "DATABASE_URL da credencial limitada de produção"),
    check("database_isolated", "Banco isolado de HMG", bindings.RAPIDEX_DATABASE_ISOLATED === "true", "Projeto/banco exclusivo de produção comprovado"),
    check("database_app_role", "Credencial limitada do banco", bindings.RAPIDEX_DATABASE_APP_ROLE_VERIFIED === "true", "Runtime sem CREATE de schema e com DML estritamente necessário"),
    check("native_auth", "Autenticação nativa", bindings.RAPIDEX_AUTH_MODE === "native", "RAPIDEX_AUTH_MODE=native"),
    check("session_secret", "Segredo de sessão forte", String(bindings.RAPIDEX_SESSION_SECRET || "").length >= 32, "Mínimo de 32 caracteres e exclusivo de produção"),
    check("mfa_secret", "MFA administrativo configurado", String(bindings.RAPIDEX_ADMIN_MFA_SECRET || "").length >= 32, "Mínimo de 32 caracteres e exclusivo de produção"),
    check("mfa_required", "MFA administrativo obrigatório", bindings.RAPIDEX_ADMIN_MFA_REQUIRED === "true", "RAPIDEX_ADMIN_MFA_REQUIRED=true"),
    check("owner", "Proprietário canônico", String(bindings.RAPIDEX_OWNER_EMAIL || "").trim().toLowerCase() === CANONICAL_PLATFORM_OWNER_EMAIL, CANONICAL_PLATFORM_OWNER_EMAIL),
    check("signup", "Cadastro somente por convite", bindings.RAPIDEX_SIGNUP_MODE === "invite_only", "RAPIDEX_SIGNUP_MODE=invite_only"),
    check("integration_secret", "Criptografia de integrações", String(bindings.RAPIDEX_INTEGRATION_SECRET || "").length >= 32, "Mínimo de 32 caracteres"),
    check("cron", "Processamento agendado", String(bindings.CRON_SECRET || bindings.RAPIDEX_CRON_SECRET || "").length >= 32, "CRON_SECRET com pelo menos 32 caracteres"),
    check("scheduler_capacity", "Agendador compatível", bindings.RAPIDEX_SCHEDULER_READY === "true", "Vercel Pro ou agendador externo validado para o ciclo de 5 minutos"),
    check("email", "E-mail transacional", Boolean(bindings.RESEND_API_KEY && bindings.RAPIDEX_EMAIL_FROM), "Resend e remetente verificado"),
    check("email_delivery", "Entrega de e-mail validada", bindings.RAPIDEX_EMAIL_DELIVERY_VERIFIED === "true", "Recuperação/convite, SPF, DKIM, DMARC e bounce testados"),
    check("storage", "Object storage", Boolean(bindings.BUCKET || bindings.BLOB_READ_WRITE_TOKEN), "Vercel Blob ou bucket/CDN obrigatório; banco não armazena mídia em produção"),
    check("storage_validated", "Storage validado", bindings.RAPIDEX_STORAGE_VALIDATED === "true", "Upload, leitura por CDN, exclusão e limpeza órfã comprovados"),
    check("platform_billing", "Cobrança da RapidexMenu", Boolean(bindings.RAPIDEX_BILLING_MP_ACCESS_TOKEN), "Credencial real de cobrança da plataforma"),
    check("billing_cycle", "Ciclo de cobrança validado", bindings.RAPIDEX_BILLING_VALIDATED === "true", "Pagamento, renovação, recusa, grace, cancelamento e reativação comprovados"),
    check("seller_payments", "OAuth Mercado Pago por loja", Boolean(bindings.RAPIDEX_MP_CLIENT_ID && bindings.RAPIDEX_MP_CLIENT_SECRET), "Aplicação OAuth de produção"),
    check("seller_payments_validated", "Pagamentos das lojas validados", bindings.RAPIDEX_SELLER_PAYMENTS_VALIDATED === "true", "OAuth, Pix, webhook repetido/perdido, expiração e erro comprovados"),
    check("backup_restore", "Backup e restauração", bindings.RAPIDEX_BACKUP_RESTORE_VERIFIED === "true", "Política contratada, RPO/RTO e restore da release comprovados"),
    check("monitoring", "Monitoramento e alertas", bindings.RAPIDEX_MONITORING_READY === "true", "Uptime, erros, 5xx, pagamentos, webhooks e filas com responsável"),
    check("legal", "Jurídico e LGPD", bindings.RAPIDEX_LEGAL_READY === "true", "Entidade, Termos, Privacidade, DPA, retenção e canal do titular aprovados"),
    check("support", "Operação de suporte", bindings.RAPIDEX_SUPPORT_READY === "true", "Canal, responsáveis, janela e processo de incidente definidos"),
    check("critical_accounts_mfa", "MFA das contas críticas", bindings.RAPIDEX_CRITICAL_ACCOUNTS_MFA_VERIFIED === "true", "Vercel, GitHub, Neon, DNS, e-mail, Meta, Mercado Pago e OpenAI"),
  ];
  return checks;
}

export function productionReady(bindings: RapidexBindings) {
  return productionReadinessChecks(bindings).every((item) => item.ok);
}

export async function platformDataReadinessChecks(db: D1Database): Promise<ReadinessCheck[]> {
  const state = await db.prepare(
    `SELECT
       SUM(CASE WHEN pa.status = 'active' THEN 1 ELSE 0 END) AS active_admins,
       SUM(CASE WHEN pa.status = 'active' AND (m.enabled_at IS NULL) THEN 1 ELSE 0 END) AS admins_without_mfa,
       SUM(CASE WHEN pa.status = 'active' AND lower(u.email) = ? THEN 1 ELSE 0 END) AS forbidden_admins,
       SUM(CASE WHEN pa.status = 'active' AND pa.role = 'owner' AND lower(u.email) = ? THEN 1 ELSE 0 END) AS canonical_owners,
       SUM(CASE WHEN pa.status = 'active' AND pa.role = 'owner' AND lower(u.email) <> ? THEN 1 ELSE 0 END) AS noncanonical_owners
     FROM platform_admins pa
     JOIN app_users u ON u.id = pa.user_id
     LEFT JOIN platform_admin_mfa m ON m.admin_id = pa.id`,
  ).bind(FORBIDDEN_PLATFORM_ADMIN_EMAIL, CANONICAL_PLATFORM_OWNER_EMAIL, CANONICAL_PLATFORM_OWNER_EMAIL).first<{
    active_admins: number | null;
    admins_without_mfa: number | null;
    forbidden_admins: number | null;
    canonical_owners: number | null;
    noncanonical_owners: number | null;
  }>();
  const active = Number(state?.active_admins || 0);
  const withoutMfa = Number(state?.admins_without_mfa || 0);
  return [
    check("active_platform_admin", "Equipe da Central", active > 0, `${active} superadmin(s) ativo(s)`),
    check("canonical_owner_active", "Proprietário canônico ativo", Number(state?.canonical_owners || 0) === 1, CANONICAL_PLATFORM_OWNER_EMAIL),
    check("canonical_owner_exclusive", "Proprietário canônico exclusivo", Number(state?.noncanonical_owners || 0) === 0, "Outros acessos devem usar admin, suporte ou leitura"),
    check("forbidden_admin_absent", "Identidade administrativa proibida ausente", Number(state?.forbidden_admins || 0) === 0, "A conta da Heloisa pode existir em loja, mas não na Central"),
    check("admin_mfa_enrollment", "MFA ativado por todos os superadmins", active > 0 && withoutMfa === 0, withoutMfa ? `${withoutMfa} acesso(s) ainda sem TOTP` : "Todos os acessos ativos possuem TOTP"),
  ];
}

function check(id: string, label: string, ok: boolean, detail: string): ReadinessCheck {
  return { id, label, ok, detail };
}
