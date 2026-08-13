"use client";

import Link from "next/link";
import { FormEvent, Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import styles from "../../commercial.module.css";

function CentralLoginForm() {
  const query = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const restricted = query.get("erro") === "acesso-restrito";

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
      const payload = await response.json() as { error?: { message?: string } };
      if (!response.ok) throw new Error(payload.error?.message || "Não foi possível entrar na Central.");
      window.location.assign("/central");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível entrar na Central.");
      setBusy(false);
    }
  }

  return <main className={styles.shell}>
    <section className={styles.card} style={{ maxWidth: 520 }}>
      <Link className={styles.brand} href="/"><span>⚡</span><b>Rapidex<i>Menu</i></b></Link>
      <small className={styles.kicker}>CENTRAL RAPIDEXMENU · ACESSO INTERNO</small>
      <h1 className={styles.title}>Administração geral da plataforma.</h1>
      <p className={styles.intro}>Este acesso é exclusivo da equipe responsável pela RapidexMenu e não é o painel do estabelecimento.</p>
      {restricted && <p className={styles.error}>Esta conta não possui permissão de administrador geral da RapidexMenu.</p>}
      {error && <p className={styles.error}>{error}</p>}
      <form onSubmit={submit} className={styles.grid}>
        <label className={`${styles.field} ${styles.wide}`}>E-mail administrativo<input name="email" type="email" required autoComplete="email" /></label>
        <label className={`${styles.field} ${styles.wide}`}>Senha<input name="password" type="password" required autoComplete="current-password" /></label>
        <button className={`${styles.button} ${styles.wide}`} disabled={busy}>{busy ? "Entrando…" : "Entrar na Central →"}</button>
      </form>
      <Link className={styles.secondary} href="/entrar">Sou dono de estabelecimento · Ir para o painel do restaurante</Link>
    </section>
  </main>;
}

export default function CentralLoginPage() {
  return <Suspense fallback={<main className={styles.shell}><section className={styles.card}>Carregando…</section></main>}><CentralLoginForm /></Suspense>;
}
