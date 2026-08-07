import { hashPassword } from "@/lib/commercial-auth";
import { apiError, assertSameOrigin, HttpError, json, readJson } from "@/lib/http";
import { consumeRateLimit, rateLimitKey } from "@/lib/rate-limit";
import { getDatabase } from "@/lib/runtime";
import { sha256Hex } from "@/lib/security";
import { requiredString } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const db = getDatabase();
    const limit = await consumeRateLimit(db, await rateLimitKey(request, "reset-password"), 10, 30 * 60 * 1000);
    if (!limit.allowed) throw new HttpError(429, "Muitas tentativas. Solicite um novo link mais tarde.", "rate_limited");
    const body = await readJson<{ token?: unknown; password?: unknown }>(request, 12_000);
    const token = requiredString(body.token, "Token", 20, 200);
    const password = validatePassword(body.password);
    const tokenHash = await sha256Hex(token);
    const now = Date.now();
    const consumed = await db.prepare(
      `UPDATE password_reset_tokens SET used_at = ?
       WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?
       RETURNING user_id`,
    ).bind(now, tokenHash, now).first<{ user_id: string }>();
    if (!consumed) throw new HttpError(400, "Este link é inválido ou expirou. Solicite outro.", "reset_token_invalid");

    const passwordHash = await hashPassword(password);
    await db.prepare(
      `UPDATE app_users SET password_hash = ?, auth_version = auth_version + 1, updated_at = ?
       WHERE id = ? AND status = 'active'`,
    ).bind(passwordHash, now, consumed.user_id).run();
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
