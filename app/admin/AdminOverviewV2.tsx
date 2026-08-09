"use client";

import styles from "./AdminOverviewV2.module.css";

type Order = {
  id: string;
  number: number;
  customerName: string;
  status: string;
  source: string;
  totalCents: number;
  createdAt: number;
  promisedFromMinutes: number;
  promisedToMinutes: number;
  items: Array<{ name: string; quantity: number }>;
};

type HourBucket = { hour: number; revenueCents: number; orders: number };

type DashboardOverviewData = {
  user?: { name: string; email: string; role: string };
  restaurant: {
    name: string;
    slug: string;
    plan: string;
    isOpen: boolean;
    activeOrders: number;
  };
  metrics: {
    revenueCents: number;
    orderCount: number;
    averageTicketCents: number;
    recoveredRevenueCents: number;
    rapidexRoi: number;
  };
  orders: Order[];
  analytics?: {
    hourlySales: HourBucket[];
    yesterdayHourlySales: HourBucket[];
    revenueDeltaPct: number | null;
    ordersDeltaPct: number | null;
    ticketDeltaPct: number | null;
    yesterdayRevenueCents: number;
    yesterdayOrderCount: number;
    averagePrepMinutes: number;
    lateOrders: number;
    peakHour: HourBucket | null;
    todayStatusCounts: Record<string, number>;
    topProducts: Array<{ name: string; quantity: number }>;
  };
};

type Props = {
  data: DashboardOverviewData;
  refresh: () => Promise<void>;
  onOpenOrders: () => void;
};

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const compactCurrency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const statusMap: Record<string, { label: string; tone: string }> = {
  received: { label: "Recebido", tone: "orange" },
  confirmed: { label: "Confirmado", tone: "blue" },
  preparing: { label: "Em preparo", tone: "amber" },
  ready: { label: "Pronto", tone: "purple" },
  out_for_delivery: { label: "Em entrega", tone: "green" },
  delivered: { label: "Entregue", tone: "green" },
  canceled: { label: "Cancelado", tone: "red" },
};

export default function AdminOverviewV2({ data, refresh, onOpenOrders }: Props) {
  const analytics = data.analytics ?? emptyAnalytics();
  const firstName = (data.user?.name || "").trim().split(/\s+/)[0] || "Olá";
  const activeStatuses = statusRows(analytics.todayStatusCounts);
  const recentOrders = [...data.orders].sort((a, b) => b.createdAt - a.createdAt).slice(0, 6);

  return (
    <div className={styles.dashboard}>
      <header className={styles.hero}>
        <div>
          <h1>{firstName === "Olá" ? "Olá!" : `Olá, ${firstName}!`} <span aria-hidden="true">👋</span></h1>
          <p>Aqui está o resumo da sua operação hoje.</p>
        </div>
        <div className={styles.heroActions}>
          <span className={`${styles.storeState} ${data.restaurant.isOpen ? styles.open : styles.closed}`}><i />{data.restaurant.isOpen ? "Loja online" : "Loja fechada"}</span>
          <button type="button" onClick={() => void refresh()} aria-label="Atualizar dashboard">↻ Atualizar</button>
        </div>
      </header>

      <section className={styles.kpis} aria-label="Resumo de hoje">
        <MetricCard icon="bag" label="Pedidos hoje" value={String(data.metrics.orderCount)} delta={analytics.ordersDeltaPct} suffix="vs. ontem" />
        <MetricCard icon="wallet" label="Faturamento" value={currency.format(data.metrics.revenueCents / 100)} delta={analytics.revenueDeltaPct} suffix="vs. ontem" />
        <MetricCard icon="ticket" label="Ticket médio" value={currency.format(data.metrics.averageTicketCents / 100)} delta={analytics.ticketDeltaPct} suffix="vs. ontem" />
        <MetricCard icon="clock" label="Tempo médio" value={analytics.averagePrepMinutes ? `${analytics.averagePrepMinutes} min` : "—"} note={analytics.averagePrepMinutes ? "preparo dos pedidos" : "aguardando pedidos concluídos"} />
      </section>

      <section className={styles.analyticsGrid}>
        <article className={`${styles.card} ${styles.salesCard}`}>
          <header className={styles.cardHeader}>
            <div>
              <h2>Vendas hoje</h2>
              <p>Faturamento ao longo do dia</p>
            </div>
            <div className={styles.salesSummary}><b>{currency.format(data.metrics.revenueCents / 100)}</b><span className={deltaClass(analytics.revenueDeltaPct)}>{deltaLabel(analytics.revenueDeltaPct)}</span></div>
          </header>
          <SalesChart today={analytics.hourlySales} yesterday={analytics.yesterdayHourlySales} />
        </article>

        <article className={`${styles.card} ${styles.statusCard}`}>
          <header className={styles.cardHeader}>
            <div>
              <h2>Pedidos por status</h2>
              <p>Distribuição da operação de hoje</p>
            </div>
            <button className={styles.linkButton} type="button" onClick={onOpenOrders}>Ver pedidos →</button>
          </header>
          <StatusDonut rows={activeStatuses} total={data.metrics.orderCount} />
        </article>
      </section>

      <article className={`${styles.card} ${styles.ordersCard}`}>
        <header className={styles.cardHeader}>
          <div>
            <h2>Pedidos recentes</h2>
            <p>Últimos pedidos recebidos pela sua loja</p>
          </div>
          <button className={styles.linkButton} type="button" onClick={onOpenOrders}>Ver todos →</button>
        </header>

        {recentOrders.length ? (
          <div className={styles.tableWrap}>
            <table>
              <thead><tr><th>Pedido</th><th>Cliente</th><th>Status</th><th>Valor</th><th>Horário</th></tr></thead>
              <tbody>{recentOrders.map((order) => {
                const status = statusMap[order.status] ?? { label: order.status, tone: "neutral" };
                return <tr key={order.id}>
                  <td><b>#{order.number}</b><small>{order.items.slice(0, 2).map((item) => `${item.quantity}× ${item.name}`).join(" · ") || "Pedido"}</small></td>
                  <td>{order.customerName}</td>
                  <td><span className={`${styles.statusPill} ${styles[status.tone]}`}>{status.label}</span></td>
                  <td><strong>{currency.format(order.totalCents / 100)}</strong></td>
                  <td>{formatTime(order.createdAt)}</td>
                </tr>;
              })}</tbody>
            </table>
          </div>
        ) : (
          <div className={styles.emptyState}><span>▤</span><b>Os pedidos vão aparecer aqui</b><p>Assim que a primeira venda entrar, este painel passa a mostrar a operação em tempo real.</p></div>
        )}
      </article>
    </div>
  );
}

function MetricCard({ icon, label, value, delta, suffix, note }: { icon: "bag" | "wallet" | "ticket" | "clock"; label: string; value: string; delta?: number | null; suffix?: string; note?: string }) {
  return <article className={styles.metricCard}>
    <div className={styles.metricTop}><MetricIcon name={icon} /><span className={styles.metricMenu}>•••</span></div>
    <small>{label}</small>
    <b>{value}</b>
    {delta !== undefined ? <p><span className={deltaClass(delta)}>{deltaLabel(delta)}</span>{suffix && <em>{suffix}</em>}</p> : <p><em>{note}</em></p>}
  </article>;
}

function MetricIcon({ name }: { name: "bag" | "wallet" | "ticket" | "clock" }) {
  if (name === "bag") return <span className={styles.metricIcon}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 8h12l-1 11H7L6 8Z"/><path d="M9 9V6a3 3 0 0 1 6 0v3"/></svg></span>;
  if (name === "wallet") return <span className={styles.metricIcon}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h15a2 2 0 0 1 2 2v9H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h13"/><path d="M16 11h5v4h-5a2 2 0 1 1 0-4Z"/></svg></span>;
  if (name === "ticket") return <span className={styles.metricIcon}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5h14v4a2 2 0 0 0 0 4v6H5v-6a2 2 0 0 0 0-4V5Z"/><path d="M12 8v8"/></svg></span>;
  return <span className={styles.metricIcon}><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 8v5l3 2"/></svg></span>;
}

function SalesChart({ today, yesterday }: { today: HourBucket[]; yesterday: HourBucket[] }) {
  const width = 760;
  const height = 250;
  const padX = 34;
  const padTop = 18;
  const padBottom = 34;
  const normalizedToday = normalizeHours(today);
  const normalizedYesterday = normalizeHours(yesterday);
  const max = Math.max(1, ...normalizedToday.map((row) => row.revenueCents), ...normalizedYesterday.map((row) => row.revenueCents));
  const points = normalizedToday.map((row, index) => point(index, row.revenueCents, width, height, padX, padTop, padBottom, max));
  const yesterdayPoints = normalizedYesterday.map((row, index) => point(index, row.revenueCents, width, height, padX, padTop, padBottom, max));
  const line = points.map((p) => `${p.x},${p.y}`).join(" ");
  const previous = yesterdayPoints.map((p) => `${p.x},${p.y}`).join(" ");
  const area = `${padX},${height - padBottom} ${line} ${width - padX},${height - padBottom}`;
  const yLabels = [1, .66, .33, 0];
  const xLabels = [0, 6, 12, 18, 23];

  return <div className={styles.chart}>
    <div className={styles.chartLegend}><span><i className={styles.todayDot}/>Hoje</span><span><i className={styles.previousDot}/>Ontem</span></div>
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Faturamento por hora de hoje comparado com ontem">
      <defs><linearGradient id="rapidexSalesArea" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#ff6b0a" stopOpacity=".22"/><stop offset="100%" stopColor="#ff6b0a" stopOpacity="0"/></linearGradient></defs>
      {yLabels.map((ratio) => {
        const y = padTop + (1 - ratio) * (height - padTop - padBottom);
        return <g key={ratio}><line x1={padX} x2={width - padX} y1={y} y2={y} className={styles.gridLine}/><text x="0" y={y + 4} className={styles.axisText}>{compactCurrency.format((max * ratio) / 100)}</text></g>;
      })}
      <polygon points={area} fill="url(#rapidexSalesArea)"/>
      <polyline points={previous} className={styles.previousLine}/>
      <polyline points={line} className={styles.todayLine}/>
      {points.filter((_, index) => [6, 12, 18].includes(index)).map((p) => <circle key={p.x} cx={p.x} cy={p.y} r="4" className={styles.chartPoint}/>)}
      {xLabels.map((hour) => {
        const x = padX + (hour / 23) * (width - padX * 2);
        return <text key={hour} x={x} y={height - 8} textAnchor={hour === 0 ? "start" : hour === 23 ? "end" : "middle"} className={styles.axisText}>{String(hour).padStart(2, "0")}h</text>;
      })}
    </svg>
  </div>;
}

function StatusDonut({ rows, total }: { rows: Array<{ label: string; count: number; color: string }>; total: number }) {
  const sum = rows.reduce((acc, row) => acc + row.count, 0);
  let cursor = 0;
  const segments = rows.map((row) => {
    const start = sum ? (cursor / sum) * 360 : 0;
    cursor += row.count;
    const end = sum ? (cursor / sum) * 360 : 0;
    return `${row.color} ${start}deg ${end}deg`;
  });
  const background = sum ? `conic-gradient(${segments.join(",")})` : "#ededeb";

  return <div className={styles.donutArea}>
    <div className={styles.donut} style={{ background }}><div><b>{total}</b><span>pedidos</span></div></div>
    <div className={styles.donutLegend}>{rows.map((row) => <div key={row.label}><i style={{ background: row.color }}/><span>{row.label}</span><b>{row.count}</b></div>)}</div>
  </div>;
}

function statusRows(counts: Record<string, number>) {
  return [
    { label: "Recebidos", count: Number(counts.received || 0) + Number(counts.confirmed || 0), color: "#ff6b0a" },
    { label: "Em preparo", count: Number(counts.preparing || 0), color: "#f4b23d" },
    { label: "Prontos", count: Number(counts.ready || 0), color: "#8b6ce8" },
    { label: "Em entrega", count: Number(counts.out_for_delivery || 0), color: "#2fb36f" },
    { label: "Entregues", count: Number(counts.delivered || 0), color: "#24324a" },
  ];
}

function normalizeHours(rows: HourBucket[]) {
  const map = new Map(rows.map((row) => [row.hour, row]));
  return Array.from({ length: 24 }, (_, hour) => map.get(hour) ?? { hour, revenueCents: 0, orders: 0 });
}

function point(index: number, value: number, width: number, height: number, padX: number, padTop: number, padBottom: number, max: number) {
  return { x: padX + (index / 23) * (width - padX * 2), y: padTop + (1 - value / max) * (height - padTop - padBottom) };
}

function deltaLabel(value: number | null | undefined) {
  if (value === null || value === undefined) return "Sem comparação";
  if (value === 0) return "0%";
  return `${value > 0 ? "+" : ""}${value}%`;
}

function deltaClass(value: number | null | undefined) {
  if (value === null || value === undefined || value === 0) return styles.neutralDelta;
  return value > 0 ? styles.positiveDelta : styles.negativeDelta;
}

function formatTime(value: number) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function emptyAnalytics(): NonNullable<DashboardOverviewData["analytics"]> {
  return {
    hourlySales: [],
    yesterdayHourlySales: [],
    revenueDeltaPct: null,
    ordersDeltaPct: null,
    ticketDeltaPct: null,
    yesterdayRevenueCents: 0,
    yesterdayOrderCount: 0,
    averagePrepMinutes: 0,
    lateOrders: 0,
    peakHour: null,
    todayStatusCounts: {},
    topProducts: [],
  };
}
