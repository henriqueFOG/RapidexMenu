"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import styles from "../../../commercial.module.css";

type Job = {
  id: string;
  restaurantId: string | null;
  restaurantName: string | null;
  type: string;
  status: "retry" | "running" | "dead";
  attemptCount: number;
  maxAttempts: number;
  availableAt: number;
  lockedAt: number | null;
  errorCode: string | null;
  createdAt: number;
  updatedAt: number;
};

const dateTime = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "medium" });

export default function JobsClient() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [reason, setReason] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const response = await fetch("/api/internal/platform/jobs");
      const payload = await response.json() as { jobs?: Job[]; error?: { message?: string } };
      if (!response.ok) throw new Error(payload.error?.message || "Não foi possível carregar a fila.");
      setJobs(payload.jobs || []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível carregar a fila.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function requeue(id: string) {
    setBusy(id); setError("");
    try {
      const response = await fetch("/api/internal/platform/jobs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, action: "requeue", reason }),
      });
      const payload = await response.json() as { error?: { message?: string } };
      if (!response.ok) throw new Error(payload.error?.message || "Não foi possível reenfileirar.");
      setReason("");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível reenfileirar.");
    } finally { setBusy(""); }
  }

  return <main className={styles.shell}><section className={styles.card} style={{ maxWidth: 1080 }}>
    <Link className={styles.brand} href="/"><span>⚡</span><b>Rapidex<i>Menu</i></b></Link>
    <small className={styles.kicker}>OPERAÇÃO DA PLATAFORMA</small>
    <h1 className={styles.title}>Fila, retries e dead-letter</h1>
    <p className={styles.intro}>Apenas metadados operacionais aparecem aqui. Payloads de e-mail ou integrações não são exibidos no navegador.</p>
    {error && <p className={styles.error}>{error}</p>}
    {loading ? <p>Carregando jobs…</p> : <section className={styles.panel}>
      <h2>Jobs que exigem observação</h2>
      <label className={styles.field} style={{ marginBottom: 16 }}>Motivo da intervenção
        <input value={reason} onChange={(event) => setReason(event.target.value)} minLength={10} maxLength={500} placeholder="Ex.: falha transitória confirmada no provedor" />
      </label>
      {!jobs.length ? <p>Nenhum job em retry, execução ou DLQ.</p> : <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", minWidth: 850 }}>
        <thead><tr><Th>Status</Th><Th>Tipo / loja</Th><Th>Tentativas</Th><Th>Erro</Th><Th>Atualizado</Th><Th>Ação</Th></tr></thead>
        <tbody>{jobs.map((job) => <tr key={job.id} style={{ borderTop: "1px solid #e7e7e7" }}>
          <Td><b>{job.status.toUpperCase()}</b></Td>
          <Td><b>{job.type}</b><small style={{ display: "block" }}>{job.restaurantName || "Plataforma"}</small></Td>
          <Td>{job.attemptCount}/{job.maxAttempts}</Td>
          <Td><code>{job.errorCode || "—"}</code></Td>
          <Td>{dateTime.format(new Date(job.updatedAt))}</Td>
          <Td>{job.status === "dead" || job.status === "retry" ? <button disabled={busy === job.id || reason.trim().length < 10} onClick={() => void requeue(job.id)}>{busy === job.id ? "Reenfileirando…" : "Reenfileirar"}</button> : <span>Em execução</span>}</Td>
        </tr>)}</tbody>
      </table></div>}
    </section>}
    <div className={styles.footerActions}><Link className={styles.linkButton} href="/central">← Saúde da plataforma</Link></div>
  </section></main>;
}

function Th({ children }: { children: React.ReactNode }) { return <th style={{ textAlign: "left", padding: "10px 8px", fontSize: 12 }}>{children}</th>; }
function Td({ children }: { children: React.ReactNode }) { return <td style={{ padding: "12px 8px", verticalAlign: "top", fontSize: 13 }}>{children}</td>; }
