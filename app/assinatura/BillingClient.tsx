"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import styles from "../commercial.module.css";

type BillingData = {
  configured: boolean;
  restaurant: { plan: "start" | "growth" | "scale"; status: string; trialEndsAt: number | null; accessEndsAt: number | null; trialActive: boolean };
  subscription?: { status?: string; next_payment_at?: number | null; plan?: string; amount_cents?: number } | null;
  prices: Record<string, number>;
};

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function Billing() {
  const query = useSearchParams();
  const [data, setData] = useState<BillingData | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [referenceTime, setReferenceTime] = useState(() => Date.now());

  const load = useCallback(async () => {
    setError("");
    try {
      const response = await fetch(`/api/admin/billing${query.get("retorno") === "1" ? "?sync=1" : ""}`);
      const payload = await response.json() as BillingData & { error?: { message?: string } };
      if (!response.ok) throw new Error(payload.error?.message || "Não foi possível consultar sua assinatura.");
      setData(payload);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível consultar sua assinatura."); }
  }, [query]);

  useEffect(() => {
    const initial = window.setTimeout(() => { void load(); }, 0);
    const clock = window.setInterval(() => setReferenceTime(Date.now()), 60_000);
    return () => { window.clearTimeout(initial); window.clearInterval(clock); };
  }, [load]);

  async function subscribe(plan: "start" | "growth" | "scale") {
    setBusy(plan); setError(""); setMessage("");
    try {
      const response = await fetch("/api/admin/billing", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ plan }) });
      const payload = await response.json() as { checkoutUrl?: string; error?: { message?: string } };
      if (!response.ok || !payload.checkoutUrl) throw new Error(payload.error?.message || "Não foi possível iniciar a assinatura.");
      window.location.assign(payload.checkoutUrl);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível iniciar a assinatura."); setBusy(""); }
  }

  async function cancelRenewal() {
    if (!window.confirm("Cancelar a renovação automática? O acesso continua até o fim do período já pago.")) return;
    setBusy("cancel"); setError(""); setMessage("");
    try {
      const response = await fetch("/api/admin/billing", { method: "DELETE" });
      const payload = await response.json() as { accessEndsAt?: number | null; error?: { message?: string } };
      if (!response.ok) throw new Error(payload.error?.message || "Não foi possível cancelar a renovação.");
      setMessage(payload.accessEndsAt ? `Renovação cancelada. Seu acesso continua até ${formatDate(payload.accessEndsAt)}.` : "Renovação cancelada.");
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível cancelar a renovação."); }
    finally { setBusy(""); }
  }

  const cancelled = data?.subscription?.status === "cancelled";
  const hasPaidAccess = data?.restaurant.status === "active" && (!data.restaurant.accessEndsAt || data.restaurant.accessEndsAt > referenceTime);
  const active = hasPaidAccess || data?.subscription?.status === "authorized";
  const trialText = data?.restaurant.trialEndsAt ? formatDate(data.restaurant.trialEndsAt) : null;
  const accessText = data?.restaurant.accessEndsAt ? formatDate(data.restaurant.accessEndsAt) : null;
  const title = cancelled && active ? "Renovação cancelada." : active ? "Sua assinatura está ativa." : "Escolha como quer crescer.";
  const intro = cancelled && active
    ? `Não haverá nova renovação automática. Seu acesso continua até ${accessText || "o fim do período já pago"}.`
    : active
      ? "Seu restaurante está liberado para continuar recebendo pedidos. Você pode cancelar a renovação pelo próprio painel."
      : `Seu teste continua${trialText ? ` até ${trialText}` : " por 14 dias"}. Você pode ativar um plano agora ou seguir testando sem cartão.`;

  return <main className={styles.shell}><section className={styles.card}>
    <Link className={styles.brand} href="/"><span>⚡</span><b>Rapidex<i>Menu</i></b></Link>
    <small className={styles.kicker}>ASSINATURA RAPIDEX</small>
    <h1 className={styles.title}>{title}</h1>
    <p className={styles.intro}>{intro}</p>
    {error && <p className={styles.error}>{error}</p>}
    {message && <p className={styles.success}>{message}</p>}
    {data && !data.configured && <p className={styles.success}>A cobrança recorrente ainda não está conectada neste ambiente. Seu teste continua normalmente; nenhum pagamento será solicitado até a integração ser ativada.</p>}
    {active ? <section className={styles.panel}><h2>Plano {planName(data!.restaurant.plan)}</h2><p>Status: {cancelled ? "renovação cancelada" : "ativo"}{data?.subscription?.next_payment_at && !cancelled ? ` · próxima cobrança em ${formatDate(Number(data.subscription.next_payment_at))}` : accessText ? ` · acesso até ${accessText}` : ""}.</p><div style={{ display: "grid", gap: 10 }}><Link className={styles.button} style={{ display: "block", textAlign: "center", textDecoration: "none" }} href="/admin">Ir para o painel →</Link>{!cancelled && data?.subscription?.status === "authorized" && data.configured && <button className={styles.linkButton} disabled={busy === "cancel"} onClick={() => void cancelRenewal()}>{busy === "cancel" ? "Cancelando…" : "Cancelar renovação automática"}</button>}</div></section> : <>
      <div className={styles.steps}>
        <Plan name="Começo" priceCents={data?.prices.start || 9700} text="Cardápio, link, pedidos, Profit Engine e operação essencial." selected={data?.restaurant.plan === "start"} disabled={!data?.configured || Boolean(busy)} onClick={() => subscribe("start")} busy={busy === "start"} />
        <Plan name="Crescimento" priceCents={data?.prices.growth || 29700} text="Tudo do Começo + WhatsApp e IA após ativação, memória, recompra e automações de margem." selected={data?.restaurant.plan === "growth"} disabled={!data?.configured || Boolean(busy)} onClick={() => subscribe("growth")} busy={busy === "growth"} />
        <Plan name="Escala" priceCents={data?.prices.scale || 59700} text="Mais unidades, permissões, fila inteligente e prioridade." selected={data?.restaurant.plan === "scale"} disabled={!data?.configured || Boolean(busy)} onClick={() => subscribe("scale")} busy={busy === "scale"} />
      </div>
      <div className={styles.footerActions}><Link className={styles.linkButton} href="/admin">Continuar meu teste →</Link></div>
    </>}
    <p className={styles.note}>Sem comissão Rapidex por pedido. A mensalidade Rapidex é separada do dinheiro dos pedidos. O cancelamento da renovação fica disponível no próprio painel quando a assinatura está ativa.</p>
  </section></main>;
}

function Plan({ name, priceCents, text, selected, disabled, onClick, busy }: { name: string; priceCents: number; text: string; selected: boolean; disabled: boolean; onClick: () => void; busy: boolean }) {
  return <article className={`${styles.step} ${selected ? styles.done : ""}`} style={{ minHeight: 170 }}><small>{selected ? "PLANO ESCOLHIDO" : "MENSAL"}</small><strong>{name}</strong><div style={{ fontSize: 26, fontWeight: 900, margin: "9px 0" }}>{money.format(priceCents / 100)}<small>/mês</small></div><p style={{ fontSize: 12, lineHeight: 1.4 }}>{text}</p><button className={styles.button} style={{ padding: 10 }} disabled={disabled} onClick={onClick}>{busy ? "Abrindo…" : "Ativar"}</button></article>;
}

function planName(value: string) { return ({ start: "Começo", growth: "Crescimento", scale: "Escala" } as Record<string, string>)[value] || value; }
function formatDate(value: number) { return new Intl.DateTimeFormat("pt-BR").format(new Date(value)); }

export default function BillingClient() {
  return <Suspense fallback={<main className={styles.shell}><section className={styles.card}>Carregando…</section></main>}><Billing /></Suspense>;
}
