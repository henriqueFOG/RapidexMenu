"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import styles from "./ProfitClient.module.css";

type SalesPeriod = {
  orders: number;
  revenueCents: number;
  costCents: number;
  contributionCents: number;
  contributionMarginPercent: number;
};

type ProfitData = {
  period: { dayStart: number; monthStart: number; now: number };
  restaurant: { plan: string; status: string; planPriceCents: number };
  today: SalesPeriod;
  month: SalesPeriod;
  profitEngine: {
    shown: number;
    accepted: number;
    conversionPercent: number;
    addedRevenueCents: number;
    addedContributionCents: number;
    recoveredMonthCents: number;
    recoveredContributionMonthCents: number;
    monthlyRoi: number;
  };
  operation: {
    delivered: number;
    onTime: number;
    promiseAccuracyPercent: number | null;
    customers: number;
    returningCustomers: number;
    returningPercent: number;
  };
  products: Array<{ id: string; name: string; priceCents: number; costCents: number; marginPercent: number }>;
};

type ActionCard = {
  tone: "neutral" | "warning" | "positive";
  icon: string;
  title: string;
  detail: string;
  href: string;
};

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const monthName = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "America/Sao_Paulo" });

export default function ProfitClient() {
  const [data, setData] = useState<ProfitData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/profit", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json() as ProfitData & { error?: { message?: string } };
        if (!response.ok) throw new Error(payload.error?.message || "Não foi possível carregar os resultados.");
        return payload;
      })
      .then(setData)
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Não foi possível carregar os resultados."));
  }, []);

  if (error) {
    return <main className={styles.shell}><section className={styles.errorCard}>
      <b>Não conseguimos abrir seus resultados.</b>
      <p>{error}</p>
      <Link href="/admin">← Voltar ao painel</Link>
    </section></main>;
  }

  if (!data) {
    return <main className={styles.shell}><section className={styles.loadingCard}>
      <b>Organizando vendas, margem e crescimento…</b>
      <div className={styles.loadingBar} />
    </section></main>;
  }

  return <Report data={data} />;
}

function Report({ data }: { data: ProfitData }) {
  const lowMargin = data.products.filter((product) => product.marginPercent < 25);
  const actions = useMemo(() => buildActions(data, lowMargin), [data, lowMargin]);
  const executive = buildExecutive(data, lowMargin);
  const planGap = Math.max(0, data.restaurant.planPriceCents - data.profitEngine.recoveredMonthCents);
  const period = capitalize(monthName.format(new Date(data.period.now)));

  return <main className={styles.shell}>
    <div className={styles.wrap}>
      <header className={styles.topbar}>
        <Link className={styles.brand} href="/admin" aria-label="Voltar para o painel RapidexMenu">
          <span className={styles.brandMark} aria-hidden="true" />
          <b>Rapidex<i>Menu</i></b>
        </Link>
        <Link className={styles.back} href="/admin"><b>←</b><span>Voltar ao painel</span></Link>
      </header>

      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <small className={styles.kicker}>RESULTADOS DO NEGÓCIO</small>
          <h1 className={styles.title}>Números claros. Próxima ação clara.</h1>
          <p className={styles.intro}>Acompanhe faturamento, margem de contribuição, recompra e a receita que o Rapidex conseguiu atribuir às suas ações de crescimento.</p>
        </div>
        <span className={styles.period}><i />{period}</span>
      </section>

      <section className={styles.executive} data-testid="report-executive">
        <div>
          <small>LEITURA RÁPIDA</small>
          <strong>{executive.title}</strong>
          <p>{executive.detail}</p>
        </div>
        <Link className={styles.executiveAction} href={executive.href}>{executive.action} →</Link>
      </section>

      <section className={styles.metrics} aria-label="Principais indicadores">
        <Metric icon="H" label="Vendas hoje" value={money.format(data.today.revenueCents / 100)} detail={`${data.today.orders} ${data.today.orders === 1 ? "pedido" : "pedidos"} hoje`} />
        <Metric icon="M" label="Vendas no mês" value={money.format(data.month.revenueCents / 100)} detail={`${data.month.orders} ${data.month.orders === 1 ? "pedido" : "pedidos"} no período`} />
        <Metric icon="%" label="Margem de contribuição" value={money.format(data.month.contributionCents / 100)} detail={`${data.month.contributionMarginPercent}% do faturamento do mês`} />
        <Metric accent icon="R" label="Receita via Rapidex" value={money.format(data.profitEngine.recoveredMonthCents / 100)} detail={`ROI atribuído de ${data.profitEngine.monthlyRoi.toFixed(2)}x`} />
      </section>

      <div className={styles.sectionGrid}>
        <section className={styles.panel}>
          <div className={styles.panelHead}>
            <div><h2>Vendas e margem</h2><p>O que entrou e quanto ficou como contribuição antes das demais despesas fixas.</p></div>
            <span className={styles.badge}>Mês atual</span>
          </div>
          <div className={styles.financeRows}>
            <FinanceRow label="Faturamento" value={money.format(data.month.revenueCents / 100)} primary />
            <FinanceRow label="Custo dos produtos" value={money.format(data.month.costCents / 100)} />
            <FinanceRow label="Margem de contribuição" value={money.format(data.month.contributionCents / 100)} good={data.month.contributionCents > 0} />
            <FinanceRow label="Margem sobre vendas" value={`${data.month.contributionMarginPercent}%`} primary />
          </div>
          <p className={styles.financeHint}>Margem de contribuição não é lucro líquido: aluguel, impostos, folha, taxas e outras despesas ainda precisam ser considerados.</p>
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHead}>
            <div><h2>Crescimento gerado</h2><p>Somente receita que conseguimos atribuir a ações do Rapidex.</p></div>
            <span className={styles.badge}>Profit Engine</span>
          </div>
          <div className={styles.growthHero}>
            <small>RECEITA RECUPERADA / ADICIONADA NO MÊS</small>
            <strong>{money.format(data.profitEngine.recoveredMonthCents / 100)}</strong>
            <span>{data.profitEngine.monthlyRoi >= 1 ? `Retorno de ${data.profitEngine.monthlyRoi.toFixed(2)}x sobre o plano` : `${money.format(planGap / 100)} para atingir 1x do valor do plano`}</span>
          </div>
          <div className={styles.miniGrid}>
            <Mini label="Upsells exibidos" value={String(data.profitEngine.shown)} />
            <Mini label="Upsells aceitos" value={String(data.profitEngine.accepted)} />
            <Mini label="Conversão" value={`${data.profitEngine.conversionPercent}%`} />
            <Mini label="Contribuição adicionada" value={money.format(data.profitEngine.recoveredContributionMonthCents / 100)} />
          </div>
        </section>
      </div>

      <section className={`${styles.panel} ${styles.actionPanel}`}>
        <div className={styles.panelHead}>
          <div><h2>O que fazer agora</h2><p>O Rapidex transforma os indicadores em prioridades práticas para vender melhor.</p></div>
          <span className={styles.badge}>{actions.length} prioridades</span>
        </div>
        <div className={styles.actions}>
          {actions.map((item) => <Link className={`${styles.action} ${styles[item.tone]}`} href={item.href} key={item.title}>
            <span className={styles.actionIcon}>{item.icon}</span>
            <span><b>{item.title}</b><p>{item.detail}</p></span>
          </Link>)}
        </div>
      </section>

      <section className={`${styles.panel} ${styles.productPanel}`}>
        <div className={styles.panelHead}>
          <div><h2>Guardião de margem</h2><p>Produtos ordenados da menor para a maior margem. Use isso antes de dar desconto ou montar campanhas.</p></div>
          <span className={styles.badge}>{lowMargin.length ? `${lowMargin.length} para revisar` : "Margens saudáveis"}</span>
        </div>
        <div className={styles.products}>
          {data.products.length ? data.products.map((product) => <ProductRow product={product} key={product.id} />) : <div className={styles.empty}>Cadastre custo e preço dos produtos para o Rapidex acompanhar sua margem.</div>}
        </div>
      </section>

      <footer className={styles.footer}>
        <span>Plano {planName(data.restaurant.plan)} · {money.format(data.restaurant.planPriceCents / 100)}/mês</span>
        <div className={styles.footerLinks}><Link href="/admin">Operação</Link><Link href="/admin/categorias">Cardápio</Link><Link href="/assinatura">Assinatura</Link></div>
      </footer>
    </div>
  </main>;
}

function Metric({ label, value, detail, icon, accent = false }: { label: string; value: string; detail: string; icon: string; accent?: boolean }) {
  return <article className={`${styles.metric} ${accent ? styles.metricAccent : ""}`}>
    <span className={styles.metricLabel}>{label}<b>{icon}</b></span>
    <strong className={styles.metricValue}>{value}</strong>
    <small className={styles.metricDetail}>{detail}</small>
  </article>;
}

function Mini({ label, value }: { label: string; value: string }) {
  return <div className={styles.mini}><small>{label}</small><strong>{value}</strong></div>;
}

function FinanceRow({ label, value, primary = false, good = false }: { label: string; value: string; primary?: boolean; good?: boolean }) {
  return <div className={`${styles.financeRow} ${primary ? styles.primary : ""} ${good ? styles.good : ""}`}><span>{label}</span><strong>{value}</strong></div>;
}

function ProductRow({ product }: { product: ProfitData["products"][number] }) {
  const health = product.marginPercent < 15 ? "critical" : product.marginPercent < 25 ? "warning" : "";
  return <article className={styles.product}>
    <div className={styles.productInfo}><b>{product.name}</b><small>Preço e custo cadastrados</small></div>
    <span className={styles.productData}><small className={styles.productLabel}>Preço</small>{money.format(product.priceCents / 100)}</span>
    <span className={styles.productData}><small className={styles.productLabel}>Custo</small>{money.format(product.costCents / 100)}</span>
    <strong className={`${styles.margin} ${health ? styles[health] : ""}`}>{product.marginPercent}%</strong>
  </article>;
}

function buildExecutive(data: ProfitData, lowMargin: ProfitData["products"]) {
  if (data.month.orders === 0) {
    return { title: "Ainda não há vendas registradas neste mês.", detail: "Publique e compartilhe o cardápio. Assim que os pedidos entrarem, esta tela começa a mostrar margem e oportunidades reais.", action: "Abrir operação", href: "/admin" };
  }
  if (lowMargin.length > 0) {
    const first = lowMargin[0];
    return { title: `${lowMargin.length} ${lowMargin.length === 1 ? "produto merece" : "produtos merecem"} revisão de margem.`, detail: `${first.name} está em ${first.marginPercent}%. Revise custo/preço antes de aplicar descontos ou campanhas.`, action: "Revisar cardápio", href: "/admin/categorias" };
  }
  if (data.profitEngine.monthlyRoi >= 1) {
    return { title: `O Rapidex já atribuiu ${data.profitEngine.monthlyRoi.toFixed(2)}x o valor do plano em receita.`, detail: `${money.format(data.profitEngine.recoveredMonthCents / 100)} foram recuperados ou adicionados por ações mensuráveis neste mês.`, action: "Ver crescimento", href: "#crescimento" };
  }
  if (data.operation.returningPercent < 30 && data.operation.customers >= 3) {
    return { title: `Só ${data.operation.returningPercent}% dos seus clientes são recorrentes.`, detail: "Há espaço para aumentar recompra sem depender apenas de novos clientes. Priorize clientes que já conhecem sua loja.", action: "Ver clientes", href: "/admin" };
  }
  return { title: `${data.month.orders} pedidos e ${money.format(data.month.revenueCents / 100)} vendidos no mês.`, detail: `Sua margem de contribuição está em ${data.month.contributionMarginPercent}%. Continue acompanhando preço, custo, recompra e execução.`, action: "Ver operação", href: "/admin" };
}

function buildActions(data: ProfitData, lowMargin: ProfitData["products"]): ActionCard[] {
  const actions: ActionCard[] = [];
  if (lowMargin.length) {
    actions.push({ tone: "warning", icon: "%", title: "Proteja sua margem", detail: `${lowMargin.length} ${lowMargin.length === 1 ? "produto está" : "produtos estão"} abaixo de 25% de margem. Revise antes de oferecer desconto.`, href: "/admin/categorias" });
  } else {
    actions.push({ tone: "positive", icon: "✓", title: "Margens sob controle", detail: "Nenhum produto analisado está abaixo do limite de atenção de 25%.", href: "/admin/categorias" });
  }

  if (data.operation.customers > 0 && data.operation.returningPercent < 35) {
    actions.push({ tone: "warning", icon: "↻", title: "Aumente a recompra", detail: `${data.operation.returningCustomers} de ${data.operation.customers} clientes já compraram mais de uma vez. Trabalhe a base antes de pagar por mais alcance.`, href: "/admin" });
  } else {
    actions.push({ tone: "positive", icon: "↻", title: "Recompra em acompanhamento", detail: `${data.operation.returningPercent}% da base é recorrente. Continue medindo para proteger essa receita.`, href: "/admin" });
  }

  if (data.operation.promiseAccuracyPercent !== null && data.operation.promiseAccuracyPercent < 90) {
    actions.push({ tone: "warning", icon: "!", title: "Prazo precisa de atenção", detail: `${data.operation.promiseAccuracyPercent}% das entregas do mês ficaram dentro da promessa. Ajuste capacidade ou tempo prometido.`, href: "/admin" });
  } else {
    actions.push({ tone: "neutral", icon: "R", title: "Faça o Rapidex trabalhar mais", detail: `${money.format(data.profitEngine.recoveredMonthCents / 100)} de receita já foi atribuída a crescimento. Use automações e upsell com margem saudável.`, href: "/admin" });
  }
  return actions.slice(0, 3);
}

function planName(plan: string) {
  return ({ start: "Começo", growth: "Crescimento", scale: "Escala" } as Record<string, string>)[plan] || plan;
}

function capitalize(value: string) {
  return value ? value[0].toUpperCase() + value.slice(1) : value;
}
