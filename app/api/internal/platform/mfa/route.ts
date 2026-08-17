import { getChatGPTUser } from "@/app/chatgpt-auth";
import { apiError, assertSameOrigin, HttpError, json, readJson } from "@/lib/http";
import { auditPlatformAction, getPlatformAdmin } from "@/lib/platform-admin";
import {
  decryptMfaSecret,
  encryptMfaSecret,
  generateTotpSecret,
  hasValidPlatformMfaSession,
  platformMfaConfigured,
  platformMfaRequired,
  setPlatformMfaSession,
  verifyTotp,
} from "@/lib/platform-mfa";
import { consumeRateLimit, rateLimitKey } from "@/lib/rate-limit";
import { getDatabase } from "@/lib/runtime";
import { requiredString } from "@/lib/validation";

export const dynamic = "force-dynamic";

type MfaRow = { secret_ciphertext: string; enabled_at: number | null };

export async function GET(request: Request) {
  try {
    const admin = await firstFactorAdmin();
    const row = await getDatabase().prepare(
      "SELECT enabled_at FROM platform_admin_mfa WHERE admin_id = ? LIMIT 1",
    ).bind(admin.adminId).first<{ enabled_at: number | null }>();
    return json({
      ok: true,
      required: platformMfaRequired(),
      configured: platformMfaConfigured(),
      enabled: Boolean(row?.enabled_at),
      sessionValid: await hasValidPlatformMfaSession(admin),
    });
  } catch (error) {
    return apiError(error, request);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const admin = await firstFactorAdmin();
    if (!platformMfaConfigured()) {
      throw new HttpError(503, "A chave de MFA da plataforma ainda não foi configurada.", "platform_mfa_not_configured");
    }
    const db = getDatabase();
    const limit = await consumeRateLimit(db, await rateLimitKey(request, `platform-mfa:${admin.adminId}`), 12, 15 * 60 * 1000);
    if (!limit.allowed) throw new HttpError(429, "Muitas tentativas de segundo fator. Aguarde alguns minutos.", "rate_limited");
    const body = await readJson<Record<string, unknown>>(request, 10_000);
    const current = await db.prepare(
      "SELECT secret_ciphertext, enabled_at FROM platform_admin_mfa WHERE admin_id = ? LIMIT 1",
    ).bind(admin.adminId).first<MfaRow>();

    if (body.action === "begin") {
      if (current?.enabled_at) throw new HttpError(409, "O MFA já está ativo nesta conta.", "mfa_already_enabled");
      const secret = generateTotpSecret();
      const encrypted = await encryptMfaSecret(secret);
      const now = Date.now();
      await db.prepare(
        `INSERT INTO platform_admin_mfa (admin_id, secret_ciphertext, enabled_at, created_at, updated_at)
         VALUES (?, ?, NULL, ?, ?)
         ON CONFLICT (admin_id) DO UPDATE SET secret_ciphertext = excluded.secret_ciphertext,
           enabled_at = NULL, updated_at = excluded.updated_at`,
      ).bind(admin.adminId, encrypted, now, now).run();
      const label = encodeURIComponent(`RapidexMenu:${admin.email}`);
      const issuer = encodeURIComponent("RapidexMenu");
      return json({ ok: true, secret, otpauthUrl: `otpauth://totp/${label}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30` });
    }

    if (body.action !== "confirm" && body.action !== "verify") {
      throw new HttpError(400, "Ação de MFA inválida.", "invalid_mfa_action");
    }
    if (!current) throw new HttpError(409, "Inicie a configuração do autenticador.", "mfa_setup_required");
    if (body.action === "confirm" && current.enabled_at) throw new HttpError(409, "O MFA já está ativo.", "mfa_already_enabled");
    if (body.action === "verify" && !current.enabled_at) throw new HttpError(409, "Conclua a configuração do MFA.", "mfa_setup_incomplete");
    const code = requiredString(body.code, "Código", 6, 6);
    const secret = await decryptMfaSecret(current.secret_ciphertext);
    if (!(await verifyTotp(secret, code))) throw new HttpError(401, "Código inválido ou expirado.", "invalid_mfa_code");

    const now = Date.now();
    await db.prepare(
      "UPDATE platform_admin_mfa SET enabled_at = COALESCE(enabled_at, ?), last_verified_at = ?, updated_at = ? WHERE admin_id = ?",
    ).bind(now, now, now, admin.adminId).run();
    await setPlatformMfaSession(admin);
    await auditPlatformAction(admin, {
      action: body.action === "confirm" ? "platform_mfa.enabled" : "platform_mfa.verified",
      targetType: "platform_admin",
      targetId: admin.adminId,
      reason: body.action === "confirm" ? "Ativação de segundo fator pelo titular" : "Nova sessão administrativa confirmada",
      requestId: request.headers.get("x-request-id"),
    });
    return json({ ok: true, next: "/central" });
  } catch (error) {
    return apiError(error, request);
  }
}

async function firstFactorAdmin() {
  const user = await getChatGPTUser();
  if (!user) throw new HttpError(401, "Entre com e-mail e senha primeiro.", "authentication_required");
  const admin = await getPlatformAdmin(user);
  if (!admin) throw new HttpError(403, "Acesso restrito à administração da plataforma.", "platform_admin_required");
  return admin;
}
