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
    has30dSubscriptionHistory: boolean;
    newMrr30dCents: number;
    expansionMrr30dCents: number;
    contractionMrr30dCents: number;
    churnMrr30dCents: number;
    nrr30d: number | null;
    logoChurn30d: number | null;
  };
  operations: {
    jobsQueued: number;
    jobsRunning: number;
    jobsRetry: number;
    jobsDead: number;
    failedWebhooks24h: number;
    stalePendingPayments: number;
    dunningFailed: number;
    dunningSending: number;
    aiResponsesToday: number;
    aiTranscriptionsToday: number;
    aiInputTokensToday: number;
    aiOutputTokensToday: number;
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
const number = new Intl.NumberFormat("pt-BR");
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
  const o = data.operations;
  const riskCount = o.jobsDead + o.failedWebhooks24h + o.stalePendingPayments + o.dunningFailed;
  return <main className={styles.shell}><section className={styles.card} style={{ maxWidth: 1180 }}>
    <Link className={styles.brand} href="/"><span>⚡</span><b>Rapidex<i>Menu</i></b></Link>
    <small className={styles.kicker}>BACKOFFICE DA PLATAFORMA</small>
    <h1 className={styles.title}>Saúde comercial do ativo</h1>
    <p className={styles.intro}>Receita, ativação e sinais operacionais calculados a partir dos dados reais. Métricas de retenção só aparecem quando existe uma janela observada completa.</p>

    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12, margin: "22px 0" }}>
      <Metric label="Restaurantes" value={String(m.restaurants)} note={`${m.published} publicados`} />
      <Metric label="Ativados" value={`${m.activationRate}%`} note={`${m.activated} com pedido real`} />
      <Metric label="Ativação ≤48h" value={`${m.activation48hRate}%`} note="entre os ativados" />
      <Metric label="Trials" value={String(m.trials)} note={`${m.trialsExpiring72h} vencem em 72h`} />
      <Metric label="Pagantes" value={String(m.payingRestaurants)} note="assinatura autorizada" />
      <Metric label="MRR contratado" value={currency.format(m.mrrCents / 100)} note={`ARR run-rate ${currency.format(m.arrRunRateCents / 100)}`} />
    </div>

    <section className={styles.panel}>
      <h2>Qualidade da receita · 30 dias</h2>
      <p>{m.has30dSubscriptionHistory ? "Movimentos observados no ledger de assinaturas." : "A janela de 30 dias ainda está sendo formada. NRR e churn ficam indisponíveis até haver histórico real suficiente."}</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(165px,1fr))", gap: 10 }}>
        <Metric label="New MRR" value={currency.format(m.newMrr30dCents / 100)} note="receita que entrou" />
        <Metric label="Expansion MRR" value={currency.format(m.expansionMrr30dCents / 100)} note="expansão observada" />
        <Metric label="Contraction MRR" value={currency.format(m.contractionMrr30dCents / 100)} note="redução observada" />
        <Metric label="Churned MRR" value={currency.format(m.churnMrr30dCents / 100)} note="receita perdida" />
        <Metric label="NRR" value={m.nrr30d === null ? "Formando janela" : `${m.nrr30d}%`} note="exclui new MRR" />
        <Metric label="Logo churn" value={m.logoChurn30d === null ? "Formando janela" : `${m.logoChurn30d}%`} note="restaurantes perdidos" />
      </div>
    </section>

    <section className={styles.panel}>
      <h2>Saúde operacional</h2>
      <p>{riskCount ? <><b>{riskCount} sinal(is) exigem atenção.</b> Use esta área antes de ampliar aquisição.</> : <>Nenhum sinal crítico registrado nas filas, webhooks, pagamentos ou cobrança.</>}</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 10 }}>
        <Metric label="Jobs" value={number.format(o.jobsQueued + o.jobsRunning)} note={`${o.jobsRetry} retry · ${o.jobsDead} DLQ`} />
        <Metric label="Webhooks falhos" value={String(o.failedWebhooks24h)} note="últimas 24h" />
        <Metric label="Pagamentos pendentes" value={String(o.stalePendingPayments)} note="há mais de 30 min" />
        <Metric label="Dunning" value={String(o.dunningSending)} note={`${o.dunningFailed} falho(s)`} />
        <Metric label="IA hoje" value={number.format(o.aiResponsesToday)} note={`${number.format(o.aiTranscriptionsToday)} transcrições`} />
        <Metric label="Tokens IA hoje" value={number.format(o.aiInputTokensToday + o.aiOutputTokensToday)} note={`${number.format(o.aiInputTokensToday)} in · ${number.format(o.aiOutputTokensToday)} out`} />
      </div>
      <div className={styles.footerActions}><Link className={styles.linkButton} href="/admin/plataforma/jobs">Abrir fila e DLQ →</Link></div>
    </section>

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
