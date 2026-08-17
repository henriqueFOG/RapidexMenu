"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";
import styles from "../commercial.module.css";

type ErrorPayload = { error?: { message?: string } };

function ForgotPasswordForm() {
  const query = useSearchParams();
  const returnTo = query.get("return_to") === "/central/entrar" ? "/central/entrar" : "/entrar";
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/auth/forgot-password", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: form.get("email"), returnTo }) });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({})) as ErrorPayload;
        throw new Error(payload.error?.message || "Não foi possível enviar agora.");
      }
      setSent(true);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível enviar agora."); } finally { setBusy(false); }
  }
  return <main className={styles.shell}><section className={styles.card} style={{ maxWidth: 520 }}>
    <Link className={styles.brand} href="/"><span>⚡</span><b>Rapidex<i>Menu</i></b></Link>
    <small className={styles.kicker}>RECUPERAR ACESSO</small>
    <h1 className={styles.title}>Esqueceu sua senha?</h1>
    <p className={styles.intro}>Informe o e-mail da conta. Se ele estiver cadastrado, enviaremos um link válido por 30 minutos.</p>
    {error && <p className={styles.error}>{error}</p>}
    {sent ? <><p className={styles.success}>Se existir uma conta com esse e-mail, as instruções foram enviadas.</p><Link className={styles.secondary} href={returnTo}>Voltar para entrar</Link></> : <form onSubmit={submit} className={styles.grid}><label className={`${styles.field} ${styles.wide}`}>E-mail<input name="email" type="email" required autoComplete="email" /></label><button className={`${styles.button} ${styles.wide}`} disabled={busy}>{busy ? "Enviando…" : "Enviar instruções →"}</button></form>}
  </section></main>;
}

export default function ForgotPasswordPage() {
  return <Suspense fallback={<main className={styles.shell}><section className={styles.card}>Carregando…</section></main>}><ForgotPasswordForm /></Suspense>;
}
