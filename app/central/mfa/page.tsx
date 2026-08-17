"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "../../commercial.module.css";

type MfaStatus = { configured: boolean; enabled: boolean; sessionValid: boolean };

export default function CentralMfaPage() {
  const router = useRouter();
  const [status, setStatus] = useState<MfaStatus | null>(null);
  const [secret, setSecret] = useState("");
  const [otpauthUrl, setOtpauthUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void fetch("/api/internal/platform/mfa", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json() as MfaStatus & { error?: { message?: string } };
        if (!response.ok) throw new Error(payload.error?.message || "Não foi possível verificar o MFA.");
        if (!active) return;
        if (payload.sessionValid) { router.replace("/central"); return; }
        setStatus(payload);
      })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "Falha ao verificar o MFA."); });
    return () => { active = false; };
  }, [router]);

  async function begin() {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/internal/platform/mfa", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "begin" }) });
      const payload = await response.json() as { secret?: string; otpauthUrl?: string; error?: { message?: string } };
      if (!response.ok) throw new Error(payload.error?.message || "Não foi possível iniciar o MFA.");
      setSecret(payload.secret || ""); setOtpauthUrl(payload.otpauthUrl || "");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível iniciar o MFA."); } finally { setBusy(false); }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/internal/platform/mfa", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: status?.enabled ? "verify" : "confirm", code: form.get("code") }) });
      const payload = await response.json() as { error?: { message?: string } };
      if (!response.ok) throw new Error(payload.error?.message || "Código inválido.");
      router.replace("/central"); router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Código inválido."); setBusy(false); }
  }

  return <main className={styles.shell}><section className={styles.card} style={{ maxWidth: 540 }}>
    <Link className={styles.brand} href="/"><span>⚡</span><b>Rapidex<i>Menu</i></b></Link>
    <small className={styles.kicker}>SEGUNDO FATOR · CENTRAL</small><h1 className={styles.title}>Proteja a administração geral.</h1>
    <p className={styles.intro}>{status?.enabled ? "Digite o código de 6 dígitos do seu aplicativo autenticador." : "Ative um autenticador antes de acessar dados e controles de todos os clientes."}</p>
    {error ? <p className={styles.error}>{error}</p> : null}
    {status && !status.configured ? <p className={styles.error}>A chave de MFA do ambiente ainda não foi configurada. A Central permanece bloqueada.</p> : null}
    {status && !status.enabled && !secret ? <button className={`${styles.button} ${styles.wide}`} disabled={busy || !status.configured} onClick={() => void begin()}>{busy ? "Preparando…" : "Configurar aplicativo autenticador →"}</button> : null}
    {secret ? <div className={styles.success}><b>Chave de configuração</b><br/><code style={{ overflowWrap: "anywhere" }}>{secret}</code><br/><small>Adicione manualmente no Google Authenticator, Microsoft Authenticator, 1Password ou equivalente.</small>{otpauthUrl ? <><br/><a href={otpauthUrl}>Abrir no autenticador deste dispositivo</a></> : null}</div> : null}
    {status?.enabled || secret ? <form onSubmit={submit} className={styles.grid}><label className={`${styles.field} ${styles.wide}`}>Código de 6 dígitos<input name="code" inputMode="numeric" pattern="[0-9]{6}" minLength={6} maxLength={6} autoComplete="one-time-code" required autoFocus /></label><button className={`${styles.button} ${styles.wide}`} disabled={busy}>{busy ? "Verificando…" : status?.enabled ? "Confirmar e entrar →" : "Ativar MFA e entrar →"}</button></form> : null}
    <Link className={styles.secondary} href="/api/auth/logout?return_to=/central/entrar">Sair e usar outra conta</Link>
  </section></main>;
}
