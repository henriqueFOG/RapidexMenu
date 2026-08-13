"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import styles from "../../commercial.module.css";

type Overview = {
  metrics: {
    restaurants: number;
    published: number;
    activated: number;
    activationRate: number;
    activation48hRate: number;
    trials: number;
    trialsExpiring72h: number;
    payingRestaurants: number;
    mrrCents: number;
    arrRunRateCents: number;
  };
  restaurants: Array<{
    id: string;
    name: string;
    slug: string;
    plan: string;
    status: string;
    published: boolean;
    createdAt: number;
    firstOrderAt: number | null;
    activatedWithin48h: boolean;
    trialEndsAt: number | null;
    accessEndsAt: number | null;
    subscription: { plan: string; amountCents: number; status: string } | null;
    integrations: Array<{ provider: string; status: string }>;
  }>;
};

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const dateTime = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

export default function PlatformOverviewClient() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/internal/platform/overview")
      .then(async (response) => {
        const payload = await response.json() as Overview & { error?: { message?: string } };
        if (!response.ok) throw new Error(payload.error?.message || "Não foi possível carregar a plataforma.");
        return payload;
      })
      .then(setData)
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Não foi possível carregar a plataforma."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <main className={styles.shell}><section className={styles.card}>Carregando métricas da plataforma…</section></main>;
  if (error || !data) return <main className={styles.shell}><section className={styles.card}><p className={styles.error}>{error || "Dados indisponíveis."}</p></section></main>;

  const m = data.metrics;
  return <main className={styles.shell}><section className={styles.card} style={{ maxWidth: 1180 }}>
    <Link className={styles.brand} href="/"><span>⚡</span><b>Rapidex<i>Menu</i></b></Link>
    <small className={styles.kicker}>BACKOFFICE DA PLATAFORMA</small>
    <h1 className={styles.title}>Saúde comercial do ativo</h1>
    <p className={styles.intro}>Métricas operacionais calculadas a partir dos dados reais da plataforma. MRR considera a assinatura mais recente autorizada de cada restaurante.</p>

    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12, margin: "22px 0" }}>
      <Metric label="Restaurantes" value={String(m.restaurants)} note={`${m.published} publicados`} />
      <Metric label="Ativados" value={`${m.activationRate}%`} note={`${m.activated} com pedido real`} />
      <Metric label="Ativação ≤48h" value={`${m.activation48hRate}%`} note="entre os ativados" />
      <Metric label="Trials" value={String(m.trials)} note={`${m.trialsExpiring72h} vencem em 72h`} />
      <Metric label="Pagantes" value={String(m.payingRestaurants)} note="assinatura autorizada" />
      <Metric label="MRR contratado" value={currency.format(m.mrrCents / 100)} note={`ARR run-rate ${currency.format(m.arrRunRateCents / 100)}`} />
    </div>

    <section className={styles.panel}>
      <h2>Restaurantes</h2>
      <p>Use esta visão para priorizar onboarding, risco de churn e integrações antes de ampliar aquisição.</p>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
          <thead><tr><Th>Loja</Th><Th>Plano/status</Th><Th>Ativação</Th><Th>Assinatura</Th><Th>Integrações</Th><Th>Criada</Th></tr></thead>
          <tbody>{data.restaurants.map((restaurant) => <tr key={restaurant.id} style={{ borderTop: "1px solid #e7e7e7" }}>
            <Td><b>{restaurant.name}</b><small style={{ display: "block" }}>/loja/{restaurant.slug} · {restaurant.published ? "publicada" : "não publicada"}</small></Td>
            <Td><b>{restaurant.plan}</b><small style={{ display: "block" }}>{restaurant.status}</small></Td>
            <Td>{restaurant.firstOrderAt ? <><b>{restaurant.activatedWithin48h ? "≤48h" : ">48h"}</b><small style={{ display: "block" }}>{dateTime.format(new Date(restaurant.firstOrderAt))}</small></> : <b>Sem pedido</b>}</Td>
            <Td>{restaurant.subscription ? <><b>{currency.format(restaurant.subscription.amountCents / 100)}/mês</b><small style={{ display: "block" }}>{restaurant.subscription.status}</small></> : <span>Sem assinatura</span>}</Td>
            <Td>{restaurant.integrations.length ? restaurant.integrations.map((integration) => <small key={`${restaurant.id}-${integration.provider}`} style={{ display: "block" }}>{integration.provider}: <b>{integration.status}</b></small>) : <span>—</span>}</Td>
            <Td>{dateTime.format(new Date(restaurant.createdAt))}</Td>
          </tr>)}</tbody>
        </table>
      </div>
    </section>
    <div className={styles.footerActions}><Link className={styles.linkButton} href="/admin">← Painel da loja</Link><Link className={styles.linkButton} href="/assinatura">Assinaturas</Link></div>
  </section></main>;
}

function Metric({ label, value, note }: { label: string; value: string; note: string }) {
  return <div style={{ border: "1px solid #e5e5e5", borderRadius: 14, padding: 16, background: "#fff" }}><small style={{ fontWeight: 900 }}>{label}</small><strong style={{ display: "block", fontSize: 25, margin: "5px 0" }}>{value}</strong><span style={{ fontSize: 12, color: "#6d716a" }}>{note}</span></div>;
}
function Th({ children }: { children: React.ReactNode }) { return <th style={{ textAlign: "left", padding: "10px 8px", fontSize: 12 }}>{children}</th>; }
function Td({ children }: { children: React.ReactNode }) { return <td style={{ padding: "12px 8px", verticalAlign: "top", fontSize: 13 }}>{children}</td>; }
