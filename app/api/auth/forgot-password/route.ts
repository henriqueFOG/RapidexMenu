import { apiError, assertSameOrigin, json, readJson } from "@/lib/http";
import { issuePasswordReset } from "@/lib/password-recovery";
import { consumeRateLimit, rateLimitKey } from "@/lib/rate-limit";
import { getBindings, getDatabase } from "@/lib/runtime";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const db = getDatabase();
    const limit = await consumeRateLimit(db, await rateLimitKey(request, "forgot-password"), 5, 30 * 60 * 1000);
    if (!limit.allowed) return json({ ok: true });
    const body = await readJson<{ email?: unknown; returnTo?: unknown }>(request, 10_000);
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase().slice(0, 160) : "";
    const returnTo = body.returnTo === "/central/entrar" ? "/central/entrar" : "/entrar";
    const user = email ? await db.prepare(
      "SELECT id, email, full_name FROM app_users WHERE lower(email) = ? AND status = 'active' LIMIT 1",
    ).bind(email).first<{ id: string; email: string; full_name: string }>() : null;

    if (user) {
      const base = getBindings().RAPIDEX_PUBLIC_URL || new URL(request.url).origin;
      await issuePasswordReset({
        db,
        user: { id: user.id, email: user.email, fullName: user.full_name },
        baseUrl: base,
        returnTo,
      });
    }

    // Resposta idêntica independentemente de o e-mail existir, evitando enumeração de contas.
    return json({ ok: true, message: "Se existir uma conta com esse e-mail, enviaremos as instruções." });
  } catch (error) {
    return apiError(error);
  }
}
