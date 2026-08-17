import { hashPassword } from "@/lib/commercial-auth";
import { apiError, assertSameOrigin, HttpError, json, readJson } from "@/lib/http";
import { RAPIDEX_PRIVACY_VERSION, RAPIDEX_TERMS_VERSION } from "@/lib/legal";
import { PENDING_PASSWORD_HASH } from "@/lib/password-recovery";
import { consumeRateLimit, rateLimitKey } from "@/lib/rate-limit";
import { getDatabase } from "@/lib/runtime";
import { sha256Hex } from "@/lib/security";
import { requiredString } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const token = requiredString(new URL(request.url).searchParams.get("token"), "Token", 20, 200);
    const tokenHash = await sha256Hex(token);
    const row = await getDatabase().prepare(
      `SELECT u.password_hash,
              EXISTS (SELECT 1 FROM members m WHERE lower(m.email) = lower(u.email) AND m.active = 1) AS has_membership
       FROM password_reset_tokens prt
       JOIN app_users u ON u.id = prt.user_id
       WHERE prt.token_hash = ? AND prt.used_at IS NULL AND prt.expires_at > ? AND u.status = 'active'
       LIMIT 1`,
    ).bind(tokenHash, Date.now()).first<{ password_hash: string; has_membership: number }>();
    if (!row) throw new HttpError(400, "Este link é inválido ou expirou. Solicite outro.", "reset_token_invalid");
    return json({ ok: true, firstAccess: row.password_hash === PENDING_PASSWORD_HASH && Boolean(row.has_membership) });
  } catch (error) {
    return apiError(error, request);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const db = getDatabase();
    const limit = await consumeRateLimit(db, await rateLimitKey(request, "reset-password"), 10, 30 * 60 * 1000);
    if (!limit.allowed) throw new HttpError(429, "Muitas tentativas. Solicite um novo link mais tarde.", "rate_limited");
    const body = await readJson<{ token?: unknown; password?: unknown; termsAccepted?: unknown; privacyAccepted?: unknown }>(request, 12_000);
    const token = requiredString(body.token, "Token", 20, 200);
    const password = validatePassword(body.password);
    const tokenHash = await sha256Hex(token);
    const now = Date.now();
    const pending = await db.prepare(
      `SELECT prt.user_id, u.password_hash,
              EXISTS (SELECT 1 FROM members m WHERE lower(m.email) = lower(u.email) AND m.active = 1) AS has_membership
       FROM password_reset_tokens prt
       JOIN app_users u ON u.id = prt.user_id
       WHERE prt.token_hash = ? AND prt.used_at IS NULL AND prt.expires_at > ? AND u.status = 'active'
       LIMIT 1`,
    ).bind(tokenHash, now).first<{ user_id: string; password_hash: string; has_membership: number }>();
    if (!pending) throw new HttpError(400, "Este link é inválido ou expirou. Solicite outro.", "reset_token_invalid");
    const isFirstRestaurantAccess = pending.password_hash === PENDING_PASSWORD_HASH && Boolean(pending.has_membership);
    if (isFirstRestaurantAccess && (body.termsAccepted !== true || body.privacyAccepted !== true)) {
      throw new HttpError(400, "Aceite os Termos de Uso e a Política de Privacidade para ativar o acesso.", "consent_required");
    }
    const passwordHash = await hashPassword(password);
    const statements: D1PreparedStatement[] = [db.prepare(
      `UPDATE app_users SET password_hash = ?, auth_version = auth_version + 1, updated_at = ?
       WHERE id = ? AND status = 'active'
         AND EXISTS (
           SELECT 1 FROM password_reset_tokens
           WHERE token_hash = ? AND used_at IS NULL AND expires_at > ? AND user_id = app_users.id
         )`,
    ).bind(passwordHash, now, pending.user_id, tokenHash, now), db.prepare(
      `UPDATE password_reset_tokens SET used_at = ?
       WHERE token_hash = ? AND used_at IS NULL AND expires_at > ? AND user_id = ?`,
    ).bind(now, tokenHash, now, pending.user_id)];
    if (isFirstRestaurantAccess) {
      const memberships = await db.prepare(
        `SELECT restaurant_id FROM members m JOIN app_users u ON lower(u.email) = lower(m.email)
         WHERE u.id = ? AND m.active = 1`,
      ).bind(pending.user_id).all<{ restaurant_id: string }>();
      for (const membership of memberships.results) {
        statements.push(
          db.prepare(
            `INSERT INTO legal_acceptances
             (id, user_id, restaurant_id, document_type, document_version, source, accepted_at, created_at)
             VALUES (?, ?, ?, 'terms', ?, 'platform_invite', ?, ?)
             ON CONFLICT (user_id, restaurant_id, document_type, document_version) DO NOTHING`,
          ).bind(crypto.randomUUID(), pending.user_id, membership.restaurant_id, RAPIDEX_TERMS_VERSION, now, now),
          db.prepare(
            `INSERT INTO legal_acceptances
             (id, user_id, restaurant_id, document_type, document_version, source, accepted_at, created_at)
             VALUES (?, ?, ?, 'privacy', ?, 'platform_invite', ?, ?)
             ON CONFLICT (user_id, restaurant_id, document_type, document_version) DO NOTHING`,
          ).bind(crypto.randomUUID(), pending.user_id, membership.restaurant_id, RAPIDEX_PRIVACY_VERSION, now, now),
          db.prepare(
            `UPDATE restaurants SET terms_accepted_at = ?, privacy_accepted_at = ?, updated_at = ?
             WHERE id = ?`,
          ).bind(now, now, now, membership.restaurant_id),
        );
      }
    }
    const results = await db.batch(statements);
    if (Number(results[0]?.meta?.changes || 0) !== 1) {
      throw new HttpError(400, "Este link já foi utilizado. Solicite outro.", "reset_token_invalid");
    }
    return json({ ok: true, next: "/entrar?senha=alterada" });
  } catch (error) {
    return apiError(error);
  }
}

function validatePassword(value: unknown) {
  const password = requiredString(value, "Senha", 10, 128);
  if (!/[A-Za-zÀ-ÿ]/.test(password) || !/\d/.test(password)) {
    throw new HttpError(400, "A senha deve ter pelo menos 10 caracteres, incluindo letra e número.", "validation_error", { field: "password" });
  }
  return password;
}
