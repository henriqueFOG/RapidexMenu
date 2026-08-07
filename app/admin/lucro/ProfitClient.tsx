"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import styles from "../../commercial.module.css";

type ProfitData = {
  restaurant: { plan: string; status: string; planPriceCents: number };
  today: { orders: number; revenueCents: number; costCents: number; contributionCents: number; contributionMarginPercent: number };
  profitEngine: { shown: number; accepted: number; conversionPercent: number; addedRevenueCents: number; addedContributionCents: number; recoveredMonthCents: number; recoveredContributionMonthCents: number; monthlyRoi: number };
  operation: { delivered: number; onTime: number; promiseAccuracyPercent: number | null; customers: number; returningCustomers: number; returningPercent: number };
  products: Array<{ id: string; name: string; priceCents: number; costCents: number; marginPercent: number }>;
};

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export default function ProfitClient() {
  const [data, setData] = useState<ProfitData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/profit")
      .then(async (response) => {
        const payload = await response.json() as ProfitData & { error?: { message?: string } };
        if (!response.ok) throw new Error(payload.error?.message || "Não foi possível calcular o lucro.");
        return payload;
      })
      .then(setData)
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Não foi possível calcular o lucro."));
  }, []);

  if (error) return <main className={styles.shell}><section className={styles.card}><p className={styles.error}>{error}</p><Link href="/admin">← Voltar</Link></section></main>;
  if (!data) return <main className={styles.shell}><section className={styles.card}>Calculando o que realmente deu resultado…</section></main>;

  const lowMargin = data.products.filter((product) => product.marginPercent < 25);
  return <main className={styles.shell}><section className={styles.card}>
    <Link className={styles.brand} href="/admin"><span>⚡</span><b>Rapidex<i>Menu</i></b></Link>
    <small className={styles.kicker}>PROFIT ENGINE</small>
    <h1 className={styles.title}>Venda é bom. Saber o que sobrou é melhor.</h1>
    <p className={styles.intro}>O Rapidex mede contribuição, upsells aceitos, recompra e quanto de receita incremental ajudou a gerar. Sem confundir faturamento com lucro.</p>

    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 12, marginTop: 24 }}>
      <Metric label="Vendas hoje" value={money.format(data.today.revenueCents / 100)} detail={`${data.today.orders} pedidos`} />
      <Metric label="Contribuição hoje" value={money.format(data.today.contributionCents / 100)} detail={`${data.today.contributionMarginPercent}% das vendas`} />
      <Metric label="Receita via Profit Engine" value={money.format(data.profitEngine.addedRevenueCents / 100)} detail={`${data.profitEngine.accepted} upsells aceitos`} />
      <Metric label="ROI atribuído no mês" value={`${data.profitEngine.monthlyRoi.toFixed(2)}x`} detail={`${money.format(data.profitEngine.recoveredMonthCents / 100)} recuperados/adicionados`} />
    </div>

    <section className={styles.panel} style={{ marginTop: 18 }}>
      <h2>O Rapidex está se pagando?</h2>
      <p style={{ lineHeight: 1.6 }}>Plano atual: <b>{planName(data.restaurant.plan)}</b> · {money.format(data.restaurant.planPriceCents / 100)}/mês. O ROI acima usa somente receita que conseguimos atribuir a upsells/recompra, não o faturamento inteiro da loja.</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 12 }}>
        <Mini label="Sugestões exibidas" value={String(data.profitEngine.shown)} />
        <Mini label="Conversão de upsell" value={`${data.profitEngine.conversionPercent}%`} />
        <Mini label="Contribuição adicionada" value={money.format(data.profitEngine.addedContributionCents / 100)} />
        <Mini label="Clientes recorrentes" value={`${data.operation.returningPercent}%`} />
        <Mini label="Promessas no prazo" value={data.operation.promiseAccuracyPercent === null ? "Sem dados" : `${data.operation.promiseAccuracyPercent}%`} />
      </div>
    </section>

    <section className={styles.panel} style={{ marginTop: 18 }}>
      <h2>Guardião de margem</h2>
      <p>Produtos abaixo de 25% de margem merecem revisão antes de receber desconto ou entrar em campanha automática.</p>
      <div className={styles.productList}>
        {lowMargin.length ? lowMargin.map((product) => <div className={styles.product} key={product.id}>
          <span><b>{product.name}</b><small style={{ display: "block", color: "#777c72" }}>{money.format(product.priceCents / 100)} · custo {money.format(product.costCents / 100)}</small></span>
          <strong>{product.marginPercent}%</strong>
        </div>) : <p>✓ Nenhum produto ativo abaixo de 25% de margem.</p>}
      </div>
    </section>

    <div className={styles.footerActions}>
      <Link className={styles.linkButton} href="/admin">← Operação</Link>
      <Link className={styles.linkButton} href="/admin/categorias">Cardápio</Link>
      <Link className={styles.linkButton} href="/assinatura">Assinatura</Link>
    </div>
  </section></main>;
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <article style={{ padding: 18, border: "1px solid #e1e5dc", borderRadius: 18, background: "#f9faf6" }}><small style={{ fontWeight: 800, color: "#656a61" }}>{label}</small><div style={{ fontSize: 27, fontWeight: 950, marginTop: 8 }}>{value}</div><span style={{ fontSize: 12, color: "#777c72" }}>{detail}</span></article>;
}
function Mini({ label, value }: { label: string; value: string }) { return <div style={{ padding: 12, borderRadius: 14, background: "#f4f6ef" }}><small>{label}</small><div style={{ fontSize: 20, fontWeight: 900, marginTop: 4 }}>{value}</div></div>; }
function planName(plan: string) { return ({ start: "Começo", growth: "Crescimento", scale: "Escala" } as Record<string, string>)[plan] || plan; }
