import { getBindings } from "./runtime";

export function transactionalEmailConfigured() {
  const env = getBindings();
  return Boolean(env.RESEND_API_KEY && env.RAPIDEX_EMAIL_FROM);
}

export async function sendPasswordResetEmail(input: { to: string; name: string; resetUrl: string }) {
  const env = getBindings();
  if (!env.RESEND_API_KEY || !env.RAPIDEX_EMAIL_FROM) return false;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.RESEND_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: env.RAPIDEX_EMAIL_FROM,
      to: [input.to],
      subject: "Redefina sua senha do RapidexMenu",
      html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#171915"><h1>Redefinir senha</h1><p>Olá, ${escapeHtml(input.name)}.</p><p>Recebemos uma solicitação para redefinir a senha da sua conta RapidexMenu. O link abaixo expira em 30 minutos e só pode ser usado uma vez.</p><p><a href="${escapeHtml(input.resetUrl)}" style="display:inline-block;background:#171915;color:#c9ff4a;padding:13px 18px;border-radius:10px;text-decoration:none;font-weight:700">Criar nova senha</a></p><p>Se você não fez essa solicitação, ignore este e-mail.</p></div>`,
    }),
  });
  if (!response.ok) {
    console.error("Password reset email failed", response.status);
    return false;
  }
  return true;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char] || char);
}
