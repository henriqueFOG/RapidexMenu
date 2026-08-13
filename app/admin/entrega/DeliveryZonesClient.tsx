"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import styles from "../../commercial.module.css";

type Zone = {
  name: string;
  matchType: "postal_prefix" | "neighborhood";
  matchValue: string;
  feeCents: number;
  minimumOrderCents: number;
  extraMinutes: number;
  active: boolean;
};

export default function DeliveryZonesClient() {
  const [zones, setZones] = useState<Zone[]>([]);
  const [restrictToZones, setRestrictToZones] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/admin/delivery-zones")
      .then(async (response) => {
        const payload = await response.json() as { zones?: Zone[]; restrictToZones?: boolean; error?: { message?: string } };
        if (!response.ok) throw new Error(payload.error?.message || "Não foi possível carregar as zonas.");
        setZones(payload.zones || []);
        setRestrictToZones(Boolean(payload.restrictToZones));
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Não foi possível carregar as zonas."))
      .finally(() => setLoading(false));
  }, []);

  function addZone() {
    setZones((current) => [...current, {
      name: `Zona ${current.length + 1}`,
      matchType: "postal_prefix",
      matchValue: "",
      feeCents: 0,
      minimumOrderCents: 0,
      extraMinutes: 0,
      active: true,
    }]);
  }
  function patchZone(index: number, patch: Partial<Zone>) {
    setZones((current) => current.map((zone, position) => position === index ? { ...zone, ...patch } : zone));
  }
  function removeZone(index: number) {
    setZones((current) => current.filter((_, position) => position !== index));
  }

  async function save() {
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/admin/delivery-zones", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ restrictToZones, zones }),
      });
      const payload = await response.json().catch(() => ({})) as { error?: { message?: string } };
      if (!response.ok) throw new Error(payload.error?.message || "Não foi possível salvar as zonas.");
      setMessage("Cobertura salva. O servidor usará essas regras para cotar e validar pedidos de entrega.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível salvar as zonas.");
    } finally { setBusy(false); }
  }

  if (loading) return <main className={styles.shell}><section className={styles.card}>Carregando cobertura…</section></main>;

  return <main className={styles.shell}><section className={styles.card} style={{ maxWidth: 1080 }}>
    <Link className={styles.brand} href="/admin"><span>⚡</span><b>Rapidex<i>Menu</i></b></Link>
    <small className={styles.kicker}>DELIVERY</small>
    <h1 className={styles.title}>Cobertura, frete e pedido mínimo</h1>
    <p className={styles.intro}>Crie regras por prefixo de CEP ou bairro. CEP tem prioridade sobre bairro; quanto mais específico o prefixo, maior a prioridade.</p>

    {error && <p className={styles.error}>{error}</p>}
    {message && <p className={styles.success}>{message}</p>}

    <section className={styles.panel}>
      <h2>Política de cobertura</h2>
      <label style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        <input type="checkbox" checked={restrictToZones} onChange={(event) => setRestrictToZones(event.target.checked)} />
        <span><b>Entregar somente nas zonas cadastradas</b><small style={{ display: "block" }}>Se desligado, zonas encontradas substituem frete/mínimo; endereços sem zona usam a configuração geral da loja.</small></span>
      </label>
    </section>

    {zones.map((zone, index) => <section className={styles.panel} key={index}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
        <div><small>ZONA {index + 1}</small><h2 style={{ margin: "4px 0" }}>{zone.name}</h2></div>
        <button type="button" onClick={() => removeZone(index)}>Excluir</button>
      </div>
      <div className={styles.grid}>
        <label className={styles.field}>Nome<input value={zone.name} onChange={(event) => patchZone(index, { name: event.target.value })} /></label>
        <label className={styles.field}>Como identificar
          <select value={zone.matchType} onChange={(event) => patchZone(index, { matchType: event.target.value as Zone["matchType"], matchValue: "" })}>
            <option value="postal_prefix">Prefixo do CEP</option>
            <option value="neighborhood">Bairro exato</option>
          </select>
        </label>
        <label className={styles.field}>{zone.matchType === "postal_prefix" ? "CEP / prefixo" : "Bairro"}<input value={zone.matchValue} onChange={(event) => patchZone(index, { matchValue: event.target.value })} placeholder={zone.matchType === "postal_prefix" ? "Ex.: 25640 ou 25640000" : "Ex.: Centro"} /></label>
        <label className={styles.field}>Frete (R$)<input type="number" step="0.01" min="0" value={(zone.feeCents / 100).toFixed(2)} onChange={(event) => patchZone(index, { feeCents: money(event.target.value) })} /></label>
        <label className={styles.field}>Pedido mínimo (R$)<input type="number" step="0.01" min="0" value={(zone.minimumOrderCents / 100).toFixed(2)} onChange={(event) => patchZone(index, { minimumOrderCents: money(event.target.value) })} /></label>
        <label className={styles.field}>Minutos extras<input type="number" min="0" max="240" value={zone.extraMinutes} onChange={(event) => patchZone(index, { extraMinutes: Math.max(0, Number(event.target.value) || 0) })} /></label>
      </div>
      <label style={{ display: "flex", gap: 8, marginTop: 14 }}><input type="checkbox" checked={zone.active} onChange={(event) => patchZone(index, { active: event.target.checked })} /> Zona ativa</label>
    </section>)}

    <section className={styles.panel}>
      <h2>Adicionar cobertura</h2>
      <p>Exemplo: CEP <b>25640</b> cobre qualquer CEP iniciado por esses cinco dígitos. Para exceções, adicione um prefixo mais longo.</p>
      <button type="button" onClick={addZone}>+ Nova zona</button>
    </section>

    <button className={styles.button} disabled={busy} onClick={() => void save()}>{busy ? "Salvando…" : "Salvar cobertura de entrega"}</button>
    <div className={styles.footerActions}><Link className={styles.linkButton} href="/admin/horarios">← Horários e modalidades</Link><Link className={styles.linkButton} href="/admin">Voltar ao painel</Link></div>
  </section></main>;
}

function money(value: string) { return Math.max(0, Math.round(Number(value || 0) * 100)); }
