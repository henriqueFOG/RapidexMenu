import { apiError, assertSameOrigin, HttpError, json, readJson } from "@/lib/http";
import { isNativeAuthMode, nativeAuthConfigured, setCommercialSession, verifyPassword } from "@/lib/commercial-auth";
import { consumeRateLimit, rateLimitKey } from "@/lib/rate-limit";
import { getDatabase } from "@/lib/runtime";
import { platformMfaRequired } from "@/lib/platform-mfa";
import { requiredString } from "@/lib/validation";

export const dynamic = "force-dynamic";

type LoginBody = { email?: unknown; password?: unknown };

export async function POST(request: Request) {
  try {
    if (!isNativeAuthMode() || !nativeAuthConfigured()) {
      throw new HttpError(503, "O acesso comercial ainda não está habilitado neste ambiente.", "login_unavailable");
    }
    assertSameOrigin(request);
    const db = getDatabase();
    const limit = await consumeRateLimit(db, await rateLimitKey(request, "login"), 10, 15 * 60 * 1000);
    if (!limit.allowed) throw new HttpError(429, "Muitas tentativas de acesso. Tente novamente em alguns minutos.", "rate_limited");

    const body = await readJson<LoginBody>(request, 20_000);
    const email = requiredString(body.email, "E-mail", 5, 160).trim().toLowerCase();
    const password = requiredString(body.password, "Senha", 1, 128);
    const user = await db.prepare(
      `SELECT id, email, password_hash, full_name, auth_version
       FROM app_users WHERE lower(email) = ? AND status = 'active' LIMIT 1`,
    ).bind(email).first<{ id: string; email: string; password_hash: string; full_name: string; auth_version: number }>();

    const valid = user ? await verifyPassword(password, user.password_hash) : false;
    if (!user || !valid) throw new HttpError(401, "E-mail ou senha inválidos.", "invalid_credentials");

    await db.prepare("UPDATE app_users SET last_login_at = ?, updated_at = ? WHERE id = ?")
      .bind(Date.now(), Date.now(), user.id).run();
    await setCommercialSession({ id: user.id, email: user.email, authVersion: Number(user.auth_version) });

    const platformAdmin = await db.prepare(
      "SELECT id FROM platform_admins WHERE user_id = ? AND status = 'active' LIMIT 1",
    ).bind(user.id).first<{ id: string }>();
    const next = platformAdmin ? (platformMfaRequired() ? "/central/mfa" : "/central") : "/admin";

    return json({ ok: true, next, user: { name: user.full_name, email: user.email } });
  } catch (error) {
    return apiError(error);
  }
}
