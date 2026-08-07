"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import styles from "../commercial.module.css";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export default function CalculatorPage() {
  const [orders, setOrders] = useState(600);
  const [ticket, setTicket] = useState(52);
  const [margin, setMargin] = useState(35);
  const [upsellRate, setUpsellRate] = useState(8);
  const [upsellValue, setUpsellValue] = useState(12);
  const [repeatLift, setRepeatLift] = useState(4);
  const [plan, setPlan] = useState<"start" | "growth" | "scale">("growth");

  const result = useMemo(() => {
    const safeOrders = clamp(orders, 0, 100000);
    const safeTicket = clamp(ticket, 0, 10000);
    const safeMargin = clamp(margin, 0, 100) / 100;
    const upsellOrders = safeOrders * (clamp(upsellRate, 0, 100) / 100);
    const upsellRevenue = upsellOrders * clamp(upsellValue, 0, 10000);
    const repeatOrders = safeOrders * (clamp(repeatLift, 0, 100) / 100);
    const repeatRevenue = repeatOrders * safeTicket;
    const addedRevenue = upsellRevenue + repeatRevenue;
    const addedContribution = addedRevenue * safeMargin;
    const price = ({ start: 97, growth: 297, scale: 597 } as const)[plan];
    return {
      baseRevenue: safeOrders * safeTicket,
      upsellRevenue,
      repeatRevenue,
      addedRevenue,
      addedContribution,
      price,
      roi: price > 0 ? addedContribution / price : 0,
      netContribution: addedContribution - price,
    };
  }, [orders, ticket, margin, upsellRate, upsellValue, repeatLift, plan]);

  return <main className={styles.shell}><section className={styles.card} style={{ maxWidth: 1040 }}>
    <Link className={styles.brand} href="/"><span>⚡</span><b>Rapidex<i>Menu</i></b></Link>
    <small className={styles.kicker}>CALCULADORA DE OPORTUNIDADE</small>
    <h1 className={styles.title}>Quanto vale melhorar ticket e recompra?</h1>
    <p className={styles.intro}>Use números do seu restaurante. A simulação não é promessa de resultado: ela mostra o que precisaria acontecer para a mensalidade se pagar em contribuição adicional.</p>

    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))", gap: 24, marginTop: 24 }}>
      <section className={styles.panel}>
        <h2>Seu cenário mensal</h2>
        <div className={styles.grid}>
          <NumberField label="Pedidos por mês" value={orders} min={0} max={100000} step={10} set={setOrders} />
          <NumberField label="Ticket médio (R$)" value={ticket} min={0} max={10000} step={1} set={setTicket} />
          <NumberField label="Margem de contribuição (%)" value={margin} min={0} max={100} step={1} set={setMargin} />
          <NumberField label="Pedidos que aceitam upsell (%)" value={upsellRate} min={0} max={100} step={1} set={setUpsellRate} />
          <NumberField label="Valor médio do upsell (R$)" value={upsellValue} min={0} max={10000} step={1} set={setUpsellValue} />
          <NumberField label="Aumento de recompra (%)" value={repeatLift} min={0} max={100} step={1} set={setRepeatLift} />
          <label className={`${styles.field} ${styles.wide}`}>Plano para comparar<select value={plan} onChange={(event) => setPlan(event.target.value as typeof plan)}><option value="start">Começo · R$ 97/mês</option><option value="growth">Crescimento · R$ 297/mês</option><option value="scale">Escala · R$ 597/mês</option></select></label>
        </div>
      </section>

      <section className={styles.panel} style={{ background: "#171915", color: "white" }}>
        <small style={{ color: "#c9ff4a", fontWeight: 900, letterSpacing: ".09em" }}>CENÁRIO SIMULADO</small>
        <h2 style={{ fontSize: 28, marginBottom: 6 }}>{money.format(result.addedContribution)} de contribuição adicional</h2>
        <p style={{ opacity: .72, lineHeight: 1.55 }}>após aplicar sua margem informada sobre o ganho estimado de ticket + recompra.</p>
        <div style={{ display: "grid", gap: 10, marginTop: 20 }}>
          <Result label="Faturamento atual estimado" value={money.format(result.baseRevenue)} />
          <Result label="Receita adicional por upsell" value={money.format(result.upsellRevenue)} />
          <Result label="Receita adicional por recompra" value={money.format(result.repeatRevenue)} />
          <Result label="Receita adicional total" value={money.format(result.addedRevenue)} />
          <Result label="Mensalidade comparada" value={money.format(result.price)} />
          <Result label="Contribuição após mensalidade" value={money.format(result.netContribution)} strong />
          <Result label="ROI sobre a mensalidade" value={`${result.roi.toFixed(2)}x`} strong />
        </div>
        <Link href="/cadastro" style={{ display: "block", marginTop: 22, borderRadius: 14, background: "#c9ff4a", color: "#171915", textDecoration: "none", textAlign: "center", padding: 14, fontWeight: 950 }}>Testar por 14 dias →</Link>
      </section>
    </div>

    <section className={styles.panel} style={{ marginTop: 20 }}>
      <h2>Como o Rapidex tenta chegar lá</h2>
      <div className={styles.steps}>
        <article className={styles.step}><small>01</small><strong>Profit Engine</strong><p>Sugere complementos considerando margem, histórico de compra conjunta e pressão da cozinha.</p></article>
        <article className={styles.step}><small>02</small><strong>Recompra</strong><p>Usa o canal direto e consentimento para facilitar a volta do cliente sem depender de desconto em toda campanha.</p></article>
        <article className={styles.step}><small>03</small><strong>Prova de ROI</strong><p>Separa vendas totais de receita realmente atribuída às ações do Rapidex.</p></article>
      </div>
    </section>

    <p className={styles.note}>Premissas são ajustadas por você e os resultados são apenas uma simulação matemática. O desempenho real depende de demanda, mix de produtos, margem, operação, adesão dos clientes e execução.</p>
  </section></main>;
}

function NumberField({ label, value, min, max, step, set }: { label: string; value: number; min: number; max: number; step: number; set: (value: number) => void }) {
  return <label className={styles.field}>{label}<input type="number" min={min} max={max} step={step} value={value} onChange={(event) => set(Number(event.target.value) || 0)} /></label>;
}
function Result({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) { return <div style={{ display: "flex", justifyContent: "space-between", gap: 18, padding: "9px 0", borderBottom: "1px solid rgba(255,255,255,.1)" }}><span style={{ opacity: .72 }}>{label}</span><b style={{ color: strong ? "#c9ff4a" : "white", fontSize: strong ? 18 : 14 }}>{value}</b></div>; }
function clamp(value: number, min: number, max: number) { return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min)); }
