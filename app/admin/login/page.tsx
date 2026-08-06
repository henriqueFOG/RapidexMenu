import Link from "next/link";
import { redirect } from "next/navigation";
import {
  getChatGPTUser,
  isHmgAccessCodeAuth,
  safeAuthReturnPath,
} from "@/app/chatgpt-auth";

export const dynamic = "force-dynamic";

export default async function HmgLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; return_to?: string }>;
}) {
  if (!isHmgAccessCodeAuth()) redirect("/admin");
  if (await getChatGPTUser()) redirect("/admin");

  const query = await searchParams;
  const returnTo = safeAuthReturnPath(query.return_to);
  const message =
    query.error === "invalid"
      ? "Codigo de acesso invalido. Confira e tente novamente."
      : query.error === "rate_limited"
        ? "Muitas tentativas. Aguarde alguns minutos."
        : query.error === "not_configured"
          ? "O acesso da HMG ainda nao foi configurado."
          : null;

  return (
    <main className="rm-hmg-login">
      <section>
        <Link className="rm-hmg-brand" href="/">
          <span>⚡</span>
          <b>Rapidex<i>Menu</i></b>
        </Link>
        <small>AMBIENTE DE HOMOLOGACAO</small>
        <h1>Acesse o painel de testes.</h1>
        <p>Use o codigo privado da HMG. A sessao expira automaticamente em 8 horas.</p>
        <form action="/api/auth/hmg/login" method="post">
          <input type="hidden" name="returnTo" value={returnTo} />
          <label>
            Codigo de acesso
            <input
              name="accessCode"
              type="password"
              minLength={16}
              autoComplete="current-password"
              required
              autoFocus
            />
          </label>
          {message && <p className="rm-hmg-login-error">{message}</p>}
          <button type="submit">Entrar na homologacao →</button>
        </form>
        <Link className="rm-hmg-back" href="/">← Voltar ao site</Link>
      </section>
    </main>
  );
}
