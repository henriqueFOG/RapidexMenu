"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useState } from "react";
import styles from "../commercial.module.css";

function ResetForm() {
  const query = useSearchParams();
  const token = query.get("token") || "";
  const returnTo = query.get("return_to") === "/central/entrar" ? "/central/entrar" : "/entrar";
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [firstAccess, setFirstAccess] = useState(false);
  const [checking, setChecking] = useState(Boolean(token));
  const [error, setError] = useState(token ? "" : "Este link não contém um token válido.");
  useEffect(() => {
    if (!token) return;
    let active = true;
    void fetch(`/api/auth/reset-password?token=${encodeURIComponent(token)}`, { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json() as { firstAccess?: boolean; error?: { message?: string } };
        if (!response.ok) throw new Error(payload.error?.message || "Este link é inválido ou expirou.");
        if (active) setFirstAccess(Boolean(payload.firstAccess));
      })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "Este link é inválido ou expirou."); })
      .finally(() => { if (active) setChecking(false); });
    return () => { active = false; };
  }, [token]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") || "");
    const confirmation = String(form.get("confirmation") || "");
    if (password !== confirmation) { setError("As senhas não coincidem."); setBusy(false); return; }
    try {
      const response = await fetch("/api/auth/reset-password", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, password, termsAccepted: form.get("terms") === "on", privacyAccepted: form.get("privacy") === "on" }) });
      const payload = await response.json() as { error?: { message?: string } };
      if (!response.ok) throw new Error(payload.error?.message || "Não foi possível redefinir a senha.");
      setDone(true);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível redefinir a senha."); } finally { setBusy(false); }
  }
  return <main className={styles.shell}><section className={styles.card} style={{ maxWidth: 520 }}>
    <Link className={styles.brand} href="/"><span>⚡</span><b>Rapidex<i>Menu</i></b></Link>
    <small className={styles.kicker}>NOVA SENHA</small>
    <h1 className={styles.title}>Crie uma nova senha.</h1>
    <p className={styles.intro}>Use pelo menos 10 caracteres, incluindo letra e número. Ao trocar a senha, as sessões anteriores deixam de ser válidas.</p>
    {error && <p className={styles.error}>{error}</p>}
    {done ? <><p className={styles.success}>Senha alterada com sucesso.</p><Link className={styles.button} style={{ display: "block", textAlign: "center", textDecoration: "none" }} href={`${returnTo}?senha=alterada`}>Entrar na minha conta →</Link></> : <form onSubmit={submit} className={styles.grid}>
      <label className={`${styles.field} ${styles.wide}`}>Nova senha<input name="password" type="password" minLength={10} maxLength={128} required autoComplete="new-password" /></label>
      <label className={`${styles.field} ${styles.wide}`}>Confirme a senha<input name="confirmation" type="password" minLength={10} maxLength={128} required autoComplete="new-password" /></label>
      {firstAccess ? <><label className={`${styles.check} ${styles.wide}`}><input name="terms" type="checkbox" required /><span>Li e aceito os <Link href="/termos" target="_blank">Termos de Uso</Link>.</span></label><label className={`${styles.check} ${styles.wide}`}><input name="privacy" type="checkbox" required /><span>Li e aceito a <Link href="/privacidade" target="_blank">Política de Privacidade</Link>.</span></label></> : null}
      <button className={`${styles.button} ${styles.wide}`} disabled={busy || checking || !token}>{checking ? "Validando convite…" : busy ? "Alterando…" : firstAccess ? "Ativar meu acesso →" : "Salvar nova senha →"}</button>
    </form>}
  </section></main>;
}

export default function ResetPasswordPage() {
  return <Suspense fallback={<main className={styles.shell}><section className={styles.card}>Carregando…</section></main>}><ResetForm /></Suspense>;
}
