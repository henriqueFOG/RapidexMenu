"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import styles from "../commercial.module.css";

type BillingData = {
  configured: boolean;
  restaurant: { plan: "start" | "growth" | "scale"; status: string; trialEndsAt: number | null; trialActive: boolean };
  subscription?: { status?: string; next_payment_at?: number | null; plan?: string } | null;
  prices: Record<string, number>;
};

function Billing() {
  const query = useSearchParams();
  const [data, setData] = useState<BillingData | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const response = await fetch(`/api/admin/billing${query.get("retorno") === "1" ? "?sync=1" : ""}`);
      const payload = await response.json() as BillingData & { error?: { message?: string } };
      if (!response.ok) throw new Error(payload.error?.message || "Não foi possível consultar sua assinatura.");
      setData(payload);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível consultar sua assinatura."); }
  }, [query]);

  useEffect(() => { void load(); }, [load]);

  async function subscribe(plan: "start" | "growth" | "scale") {
    setBusy(plan); setError("");
    try {
      const response = await fetch("/api/admin/billing", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ plan }) });
      const payload = await response.json() as { checkoutUrl?: string; error?: { message?: string } };
      if (!response.ok || !payload.checkoutUrl) throw new Error(payload.error?.message || "Não foi possível iniciar a assinatura.");
      window.location.assign(payload.checkoutUrl);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível iniciar a assinatura."); setBusy(""); }
  }

  const active = data?.restaurant.status === "active" || data?.subscription?.status === "authorized";
  const trialText = data?.restaurant.trialEndsAt ? new Intl.DateTimeFormat("pt-BR").format(new Date(data.restaurant.trialEndsAt)) : null;

  return <main className={styles.shell}><section className={styles.card}>
    <Link className={styles.brand} href="/"><span>⚡</span><b>Rapidex<i>Menu</i></b></Link>
    <small className={styles.kicker}>ASSINATURA RAPIDEX</small>
    <h1 className={styles.title}>{active ? "Sua assinatura está ativa." : "Escolha como quer crescer."}</h1>
    <p className={styles.intro}>{active ? "Seu restaurante está liberado para continuar recebendo pedidos." : `Seu teste continua${trialText ? ` até ${trialText}` : " por 14 dias"}. Você pode ativar um plano agora ou seguir testando sem cartão.`}</p>
    {error && <p className={styles.error}>{error}</p>}
    {data && !data.configured && <p className={styles.success}>A cobrança recorrente ainda não está conectada neste ambiente. Seu teste continua normalmente; nenhum pagamento será solicitado até a integração ser ativada.</p>}
    {active ? <section className={styles.panel}><h2>Plano {planName(data!.restaurant.plan)}</h2><p>Status: ativo{data?.subscription?.next_payment_at ? ` · próxima cobrança em ${new Intl.DateTimeFormat("pt-BR").format(new Date(Number(data.subscription.next_payment_at)))}` : ""}.</p><Link className={styles.button} style={{ display: "block", textAlign: "center", textDecoration: "none" }} href="/admin">Ir para o painel →</Link></section> : <>
      <div className={styles.steps}>
        <Plan name="Começo" price="97" text="Cardápio, link, pedidos e operação essencial." selected={data?.restaurant.plan === "start"} disabled={!data?.configured || Boolean(busy)} onClick={() => subscribe("start")} busy={busy === "start"} />
        <Plan name="Crescimento" price="297" text="WhatsApp, memória, recompra e guardião de margem." selected={data?.restaurant.plan === "growth"} disabled={!data?.configured || Boolean(busy)} onClick={() => subscribe("growth")} busy={busy === "growth"} />
        <Plan name="Escala" price="597" text="Mais unidades, permissões, fila e prioridade." selected={data?.restaurant.plan === "scale"} disabled={!data?.configured || Boolean(busy)} onClick={() => subscribe("scale")} busy={busy === "scale"} />
      </div>
      <div className={styles.footerActions}><Link className={styles.linkButton} href="/admin">Continuar meu teste →</Link></div>
    </>}
    <p className={styles.note}>A mensalidade Rapidex é separada do pagamento dos pedidos dos seus clientes. O Rapidex não usa a credencial de recebimento do restaurante para cobrar o SaaS.</p>
  </section></main>;
}

function Plan({ name, price, text, selected, disabled, onClick, busy }: { name: string; price: string; text: string; selected: boolean; disabled: boolean; onClick: () => void; busy: boolean }) {
  return <article className={`${styles.step} ${selected ? styles.done : ""}`} style={{ minHeight: 170 }}><small>{selected ? "PLANO ESCOLHIDO" : "MENSAL"}</small><strong>{name}</strong><div style={{ fontSize: 26, fontWeight: 900, margin: "9px 0" }}>R$ {price}<small>/mês</small></div><p style={{ fontSize: 12, lineHeight: 1.4 }}>{text}</p><button className={styles.button} style={{ padding: 10 }} disabled={disabled} onClick={onClick}>{busy ? "Abrindo…" : "Ativar"}</button></article>;
}

function planName(value: string) { return ({ start: "Começo", growth: "Crescimento", scale: "Escala" } as Record<string, string>)[value] || value; }

export default function BillingClient() {
  return <Suspense fallback={<main className={styles.shell}><section className={styles.card}>Carregando…</section></main>}><Billing /></Suspense>;
}
