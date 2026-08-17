"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";
import styles from "../commercial.module.css";

function ResetForm() {
  const query = useSearchParams();
  const token = query.get("token") || "";
  const returnTo = query.get("return_to") === "/central/entrar" ? "/central/entrar" : "/entrar";
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(token ? "" : "Este link não contém um token válido.");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") || "");
    const confirmation = String(form.get("confirmation") || "");
    if (password !== confirmation) { setError("As senhas não coincidem."); setBusy(false); return; }
    try {
      const response = await fetch("/api/auth/reset-password", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, password }) });
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
      <button className={`${styles.button} ${styles.wide}`} disabled={busy || !token}>{busy ? "Alterando…" : "Salvar nova senha →"}</button>
    </form>}
  </section></main>;
}

export default function ResetPasswordPage() {
  return <Suspense fallback={<main className={styles.shell}><section className={styles.card}>Carregando…</section></main>}><ResetForm /></Suspense>;
}
