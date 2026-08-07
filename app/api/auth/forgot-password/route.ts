import { apiError, assertSameOrigin, json, readJson } from "@/lib/http";
import { consumeRateLimit, rateLimitKey } from "@/lib/rate-limit";
import { getBindings, getDatabase } from "@/lib/runtime";
import { sha256Hex } from "@/lib/security";
import { sendPasswordResetEmail, transactionalEmailConfigured } from "@/lib/transactional-email";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const db = getDatabase();
    const limit = await consumeRateLimit(db, await rateLimitKey(request, "forgot-password"), 5, 30 * 60 * 1000);
    if (!limit.allowed) return json({ ok: true });
    const body = await readJson<{ email?: unknown }>(request, 10_000);
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase().slice(0, 160) : "";
    const user = email ? await db.prepare(
      "SELECT id, email, full_name FROM app_users WHERE lower(email) = ? AND status = 'active' LIMIT 1",
    ).bind(email).first<{ id: string; email: string; full_name: string }>() : null;

    if (user && transactionalEmailConfigured()) {
      const token = randomToken();
      const tokenHash = await sha256Hex(token);
      const now = Date.now();
      await db.batch([
        db.prepare("UPDATE password_reset_tokens SET used_at = ? WHERE user_id = ? AND used_at IS NULL").bind(now, user.id),
        db.prepare(
          `INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, created_at)
           VALUES (?, ?, ?, ?, ?)`,
        ).bind(crypto.randomUUID(), user.id, tokenHash, now + 30 * 60 * 1000, now),
      ]);
      const base = getBindings().RAPIDEX_PUBLIC_URL || new URL(request.url).origin;
      const resetUrl = `${base}/redefinir-senha?token=${encodeURIComponent(token)}`;
      await sendPasswordResetEmail({ to: user.email, name: user.full_name, resetUrl });
    }

    // Resposta idêntica independentemente de o e-mail existir, evitando enumeração de contas.
    return json({ ok: true, message: "Se existir uma conta com esse e-mail, enviaremos as instruções." });
  } catch (error) {
    return apiError(error);
  }
}

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
