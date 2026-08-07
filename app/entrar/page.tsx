"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";
import styles from "../commercial.module.css";

function LoginForm() {
  const query = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: form.get("email"), password: form.get("password") }),
      });
      const payload = await response.json() as { next?: string; error?: { message?: string } };
      if (!response.ok) throw new Error(payload.error?.message || "Não foi possível entrar.");
      const returnTo = query.get("return_to");
      window.location.assign(returnTo?.startsWith("/") && !returnTo.startsWith("//") ? returnTo : payload.next || "/admin");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível entrar.");
      setBusy(false);
    }
  }

  return <main className={styles.shell}>
    <section className={styles.card} style={{ maxWidth: 520 }}>
      <Link className={styles.brand} href="/"><span>⚡</span><b>Rapidex<i>Menu</i></b></Link>
      <small className={styles.kicker}>PAINEL DO RESTAURANTE</small>
      <h1 className={styles.title}>Bem-vindo de volta.</h1>
      <p className={styles.intro}>Entre para acompanhar pedidos, editar seu cardápio e cuidar da operação.</p>
      {error && <p className={styles.error}>{error}</p>}
      <form onSubmit={submit} className={styles.grid}>
        <label className={`${styles.field} ${styles.wide}`}>E-mail<input name="email" type="email" required autoComplete="email" /></label>
        <label className={`${styles.field} ${styles.wide}`}>Senha<input name="password" type="password" required autoComplete="current-password" /></label>
        <button className={`${styles.button} ${styles.wide}`} disabled={busy}>{busy ? "Entrando…" : "Entrar →"}</button>
      </form>
      <Link className={styles.secondary} href="/cadastro">Ainda não tenho conta · Testar por 14 dias</Link>
    </section>
  </main>;
}

export default function LoginPage() {
  return <Suspense fallback={<main className={styles.shell}><section className={styles.card}>Carregando…</section></main>}><LoginForm /></Suspense>;
}
