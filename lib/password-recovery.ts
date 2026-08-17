import { sendPasswordResetEmail, transactionalEmailConfigured } from "./transactional-email";
import { sha256Hex } from "./security";

export const PENDING_PASSWORD_HASH = "pending_first_access_v1";

export async function issuePasswordReset(input: {
  db: D1Database;
  user: { id: string; email: string; fullName: string };
  baseUrl: string;
  returnTo?: "/entrar" | "/central/entrar";
  expiresInMs?: number;
}) {
  const token = randomToken();
  const tokenHash = await sha256Hex(token);
  const now = Date.now();
  const expiresAt = now + (input.expiresInMs ?? 30 * 60 * 1000);
  await input.db.batch([
    input.db.prepare(
      "UPDATE password_reset_tokens SET used_at = ? WHERE user_id = ? AND used_at IS NULL",
    ).bind(now, input.user.id),
    input.db.prepare(
      `INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?)`,
    ).bind(crypto.randomUUID(), input.user.id, tokenHash, expiresAt, now),
  ]);

  const returnTo = input.returnTo ?? "/entrar";
  const resetUrl = `${input.baseUrl}/redefinir-senha?token=${encodeURIComponent(token)}&return_to=${encodeURIComponent(returnTo)}`;
  const emailSent = transactionalEmailConfigured()
    ? await sendPasswordResetEmail({ to: input.user.email, name: input.user.fullName, resetUrl })
    : false;

  return { resetUrl, emailSent, expiresAt };
}

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
