"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import styles from "../../commercial.module.css";

type DayKey = "sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat";
type Window = { open: string; close: string };
type WeeklyHours = Partial<Record<DayKey, Window[]>>;

type SettingsPayload = {
  restaurant?: { is_open?: number; timezone?: string };
  settings?: { weeklyHours?: WeeklyHours | null };
  error?: { message?: string };
};

const days: Array<{ key: DayKey; label: string }> = [
  { key: "mon", label: "Segunda" },
  { key: "tue", label: "Terça" },
  { key: "wed", label: "Quarta" },
  { key: "thu", label: "Quinta" },
  { key: "fri", label: "Sexta" },
  { key: "sat", label: "Sábado" },
  { key: "sun", label: "Domingo" },
];

const defaultHours: WeeklyHours = Object.fromEntries(days.map(({ key }) => [key, [{ open: "11:00", close: "23:00" }]])) as WeeklyHours;

export default function HoursClient() {
  const [enabled, setEnabled] = useState(false);
  const [manualOpen, setManualOpen] = useState(true);
  const [hours, setHours] = useState<WeeklyHours>(defaultHours);
  const [timezone, setTimezone] = useState("America/Sao_Paulo");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/admin/settings")
      .then(async (response) => {
        const payload = await response.json() as SettingsPayload;
        if (!response.ok) throw new Error(payload.error?.message || "Não foi possível carregar os horários.");
        const saved = payload.settings?.weeklyHours;
        setEnabled(Boolean(saved));
        if (saved) setHours({ ...defaultHours, ...saved });
        setManualOpen(Boolean(payload.restaurant?.is_open));
        setTimezone(payload.restaurant?.timezone || "America/Sao_Paulo");
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Não foi possível carregar os horários."))
      .finally(() => setLoading(false));
  }, []);

  function toggleDay(day: DayKey, active: boolean) {
    setHours((current) => ({ ...current, [day]: active ? (current[day]?.length ? current[day] : [{ open: "11:00", close: "23:00" }]) : [] }));
  }
  function changeTime(day: DayKey, field: "open" | "close", value: string) {
    setHours((current) => {
      const currentWindow = current[day]?.[0] || { open: "11:00", close: "23:00" };
      return { ...current, [day]: [{ ...currentWindow, [field]: value }] };
    });
  }

  async function save() {
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ isOpen: manualOpen, weeklyHours: enabled ? hours : null }),
      });
      const payload = await response.json().catch(() => ({})) as { error?: { message?: string } };
      if (!response.ok) throw new Error(payload.error?.message || "Não foi possível salvar os horários.");
      setMessage(enabled ? "Agenda semanal salva. O backend já está usando esses horários." : "Agenda automática desativada. O botão manual controla a loja.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível salvar os horários.");
    } finally { setBusy(false); }
  }

  if (loading) return <main className={styles.shell}><section className={styles.card}>Carregando horários…</section></main>;

  return <main className={styles.shell}><section className={styles.card} style={{ maxWidth: 900 }}>
    <Link className={styles.brand} href="/"><span>⚡</span><b>Rapidex<i>Menu</i></b></Link>
    <small className={styles.kicker}>OPERAÇÃO</small>
    <h1 className={styles.title}>Horários de funcionamento</h1>
    <p className={styles.intro}>O cardápio e a API de pedidos usam a mesma agenda. Horários que cruzam meia-noite, como 18:00–02:00, são aceitos.</p>

    {error && <p className={styles.error}>{error}</p>}
    {message && <p className={styles.success}>{message}</p>}

    <section className={styles.panel}>
      <h2>Pausa emergencial</h2>
      <p>Use se a cozinha lotar, faltar energia ou você precisar interromper pedidos. A pausa manual sempre vence a agenda.</p>
      <label className={styles.field} style={{ maxWidth: 340 }}>Receber pedidos manualmente
        <select value={manualOpen ? "open" : "paused"} onChange={(event) => setManualOpen(event.target.value === "open")}>
          <option value="open">Ativo</option>
          <option value="paused">Pausado agora</option>
        </select>
      </label>
    </section>

    <section className={styles.panel}>
      <h2>Agenda semanal</h2>
      <p>Fuso horário: <b>{timezone}</b>.</p>
      <label className={styles.field} style={{ maxWidth: 340 }}>Controle automático
        <select value={enabled ? "enabled" : "disabled"} onChange={(event) => setEnabled(event.target.value === "enabled")}>
          <option value="disabled">Desativado</option>
          <option value="enabled">Ativado</option>
        </select>
      </label>
      {enabled && <div style={{ display: "grid", gap: 10, marginTop: 18 }}>
        {days.map(({ key, label }) => {
          const active = Boolean(hours[key]?.length);
          const window = hours[key]?.[0] || { open: "11:00", close: "23:00" };
          return <div key={key} style={{ display: "grid", gridTemplateColumns: "minmax(120px,1fr) 110px 120px 24px 120px", gap: 10, alignItems: "center" }}>
            <b>{label}</b>
            <label style={{ display: "flex", gap: 6, alignItems: "center" }}><input type="checkbox" checked={active} onChange={(event) => toggleDay(key, event.target.checked)} /> Aberto</label>
            <input aria-label={`Abre ${label}`} type="time" disabled={!active} value={window.open} onChange={(event) => changeTime(key, "open", event.target.value)} />
            <span>até</span>
            <input aria-label={`Fecha ${label}`} type="time" disabled={!active} value={window.close} onChange={(event) => changeTime(key, "close", event.target.value)} />
          </div>;
        })}
      </div>}
    </section>

    <button className={styles.button} disabled={busy} onClick={() => void save()}>{busy ? "Salvando…" : "Salvar horários"}</button>
    <div className={styles.footerActions}><Link className={styles.linkButton} href="/admin">← Voltar ao painel</Link></div>
  </section></main>;
}
