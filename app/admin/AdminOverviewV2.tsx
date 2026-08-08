"use client";

import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
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
  channels: Array<{ name: string; revenueCents: number; orders: number; share: number }>;
  statusCounts?: Record<string, number>;
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
const nextStatus: Record<string, { status: string; label: string } | undefined> = {
  received: { status: "confirmed", label: "Confirmar" },
  confirmed: { status: "preparing", label: "Iniciar preparo" },
  preparing: { status: "ready", label: "Marcar pronto" },
  ready: { status: "out_for_delivery", label: "Saiu para entrega" },
  out_for_delivery: { status: "delivered", label: "Concluir" },
};

export default function AdminOverviewV2({ data, refresh, onOpenOrders }: Props) {
  const analytics = data.analytics ?? emptyAnalytics();
  const orderGroups = useMemo(
    () => [
      {
        key: "received",
        title: "Recebidos",
        tone: "orange",
        items: data.orders.filter((order) => ["received", "confirmed"].includes(order.status)),
      },
      {
        key: "kitchen",
        title: "Na cozinha",
        tone: "yellow",
        items: data.orders.filter((order) => ["preparing", "ready"].includes(order.status)),
      },
      {
        key: "route",
        title: "Em rota",
        tone: "green",
        items: data.orders.filter((order) => order.status === "out_for_delivery"),
      },
    ],
    [data.orders],
  );

  const topProduct = analytics.topProducts[0] ?? null;
  const peak = analytics.peakHour;

  return (
    <div className={styles.dashboard}>
      <section className={styles.kpis} aria-label="Indicadores de hoje">
        <KpiCard
          icon="$"
          tone="green"
          label="Vendas hoje"
          value={currency.format(data.metrics.revenueCents / 100)}
          foot={deltaCopy(analytics.revenueDeltaPct, "vs ontem")}
          positive={analytics.revenueDeltaPct !== null ? analytics.revenueDeltaPct >= 0 : undefined}
        />
        <KpiCard
          icon="▤"
          tone="orange"
          label="Pedidos hoje"
          value={String(data.metrics.orderCount)}
          foot={deltaCopy(analytics.ordersDeltaPct, "vs ontem")}
          positive={analytics.ordersDeltaPct !== null ? analytics.ordersDeltaPct >= 0 : undefined}
        />
        <KpiCard
          icon="◇"
          tone="amber"
          label="Ticket médio"
          value={currency.format(data.metrics.averageTicketCents / 100)}
          foot={deltaCopy(analytics.ticketDeltaPct, "vs ontem")}
          positive={analytics.ticketDeltaPct !== null ? analytics.ticketDeltaPct >= 0 : undefined}
        />
        <KpiCard
          icon="◷"
          tone="blue"
          label="Tempo de preparo"
          value={analytics.averagePrepMinutes ? `${analytics.averagePrepMinutes} min` : "—"}
          foot="Meta operacional configurada"
        />
        <KpiCard
          icon="!"
          tone={analytics.lateOrders ? "red" : "green"}
          label="Atrasados"
          value={String(analytics.lateOrders)}
          foot={analytics.lateOrders ? "Requer atenção agora" : "Tudo dentro do prazo"}
          positive={!analytics.lateOrders}
        />
      </section>

      <section className={styles.analyticsGrid}>
        <article className={`${styles.panel} ${styles.salesPanel}`}>
          <header className={styles.panelHead}>
            <div>
              <h2>Vendas por hora</h2>
              <p>Hoje comparado com ontem</p>
            </div>
            <span className={styles.livePill}>Hoje</span>
          </header>
          <SalesLineChart today={analytics.hourlySales} yesterday={analytics.yesterdayHourlySales} peak={peak} />
        </article>

        <article className={`${styles.panel} ${styles.channelPanel}`}>
          <header className={styles.panelHead}>
            <div>
              <h2>Canais de venda</h2>
              <p>Participação nos últimos 7 dias</p>
            </div>
          </header>
          <ChannelBars channels={data.channels} />
        </article>

        <article className={`${styles.panel} ${styles.statusPanel}`}>
          <header className={styles.panelHead}>
            <div>
              <h2>Status dos pedidos</h2>
              <p>Movimento de hoje</p>
            </div>
          </header>
          <StatusDonut counts={analytics.todayStatusCounts} />
        </article>

        <article className={`${styles.panel} ${styles.productsPanel}`}>
          <header className={styles.panelHead}>
            <div>
              <h2>Top produtos</h2>
              <p>Mais vendidos hoje</p>
            </div>
          </header>
          <TopProducts products={analytics.topProducts} />
        </article>
      </section>

      <section className={styles.operationGrid}>
        <article className={`${styles.panel} ${styles.ordersPanel}`}>
          <header className={styles.ordersHead}>
            <div>
              <h2>Pedidos agora</h2>
              <p>Acompanhe em tempo real e gerencie cada etapa do pedido.</p>
            </div>
            <button type="button" onClick={onOpenOrders}>Ver todos os pedidos</button>
          </header>
          <div className={styles.kanban}>
            {orderGroups.map((group) => {
              const totalCents = group.items.reduce((sum, order) => sum + Number(order.totalCents), 0);
              return (
                <section className={styles.kanbanColumn} key={group.key}>
                  <header>
                    <span className={`${styles.statusDot} ${styles[group.tone]}`} />
                    <b>{group.title}</b>
                    <em>{group.items.length}</em>
                    <small>{currency.format(totalCents / 100)}</small>
                  </header>
                  <div className={styles.orderStack}>
                    {group.items.length ? (
                      group.items.slice(0, 3).map((order) => (
                        <LiveOrderCard key={order.id} order={order} refresh={refresh} />
                      ))
                    ) : (
                      <div className={styles.freeQueue}>
                        <span>✓</span>
                        <b>Fila livre</b>
                        <small>Nenhum pedido nesta etapa.</small>
                      </div>
                    )}
                  </div>
                  {group.items.length > 3 && (
                    <button type="button" className={styles.moreOrders} onClick={onOpenOrders}>
                      + {group.items.length - 3} {group.items.length - 3 === 1 ? "pedido" : "pedidos"}
                    </button>
                  )}
                </section>
              );
            })}
          </div>
        </article>

        <aside className={`${styles.panel} ${styles.insightsPanel}`}>
          <header className={styles.insightsHead}>
            <span>↗</span>
            <div>
              <h2>Insights de hoje</h2>
              <p>Sinais úteis, sem números inventados.</p>
            </div>
          </header>

          <Insight
            icon="↗"
            tone="green"
            label="Vendas"
            value={
              analytics.revenueDeltaPct === null
                ? "Comparação disponível amanhã"
                : `${Math.abs(analytics.revenueDeltaPct)}% ${analytics.revenueDeltaPct >= 0 ? "a mais" : "a menos"} que ontem`
            }
            text={
              analytics.revenueDeltaPct === null
                ? "Precisamos de um dia anterior com vendas para comparar."
                : analytics.revenueDeltaPct >= 0
                  ? "Seu canal próprio ganhou tração hoje."
                  : "Vale revisar horário, oferta e canais com mais conversão."
            }
          />
          <Insight
            icon="◷"
            tone="orange"
            label="Pico de pedidos"
            value={peak ? `${String(peak.hour).padStart(2, "0")}h` : "Ainda sem pico"}
            text={peak ? `${peak.orders} pedidos e ${currency.format(peak.revenueCents / 100)} nessa hora.` : "O horário de pico aparece conforme os pedidos entram."}
          />
          <Insight
            icon="★"
            tone="amber"
            label="Produto campeão"
            value={topProduct?.name ?? "Aguardando vendas"}
            text={topProduct ? `${topProduct.quantity} ${topProduct.quantity === 1 ? "unidade vendida" : "unidades vendidas"} hoje.` : "O ranking nasce automaticamente a partir dos pedidos reais."}
          />

          <div className={styles.insightFooter}>
            <div>
              <small>Receita recuperada</small>
              <b>{currency.format(data.metrics.recoveredRevenueCents / 100)}</b>
            </div>
            <div>
              <small>ROI Rapidex</small>
              <b>{data.metrics.rapidexRoi}x</b>
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}

function KpiCard({
  icon,
  tone,
  label,
  value,
  foot,
  positive,
}: {
  icon: string;
  tone: "green" | "orange" | "amber" | "blue" | "red";
  label: string;
  value: string;
  foot: string;
  positive?: boolean;
}) {
  return (
    <article className={styles.kpiCard}>
      <span className={`${styles.kpiIcon} ${styles[tone]}`}>{icon}</span>
      <div>
        <small>{label}</small>
        <b>{value}</b>
        <em className={positive === undefined ? styles.neutral : positive ? styles.positive : styles.negative}>{foot}</em>
      </div>
    </article>
  );
}

function SalesLineChart({ today, yesterday, peak }: { today: HourBucket[]; yesterday: HourBucket[]; peak: HourBucket | null }) {
  const width = 640;
  const height = 206;
  const padX = 18;
  const padY = 20;
  const max = Math.max(1, ...today.map((row) => row.revenueCents), ...yesterday.map((row) => row.revenueCents));
  const todayPoints = chartPoints(today, width, height, padX, padY, max);
  const yesterdayPoints = chartPoints(yesterday, width, height, padX, padY, max);
  const peakPoint = peak ? pointFor(peak, width, height, padX, padY, max) : null;
  const labels = [0, 6, 12, 18, 23];

  return (
    <div className={styles.chartWrap}>
      <div className={styles.chartLegend}><span><i className={styles.todayLegend} />Hoje</span><span><i className={styles.yesterdayLegend} />Ontem</span></div>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Gráfico de vendas por hora">
        {[0.25, 0.5, 0.75, 1].map((ratio) => (
          <line key={ratio} x1={padX} x2={width - padX} y1={height - padY - ratio * (height - padY * 2)} y2={height - padY - ratio * (height - padY * 2)} className={styles.gridLine} />
        ))}
        <polyline points={yesterdayPoints} className={styles.yesterdayLine} />
        <polyline points={todayPoints} className={styles.todayLine} />
        {peakPoint && (
          <>
            <circle cx={peakPoint.x} cy={peakPoint.y} r="7" className={styles.peakHalo} />
            <circle cx={peakPoint.x} cy={peakPoint.y} r="4" className={styles.peakPoint} />
          </>
        )}
        {labels.map((hour) => {
          const x = padX + (hour / 23) * (width - padX * 2);
          return <text key={hour} x={x} y={height - 2} textAnchor={hour === 0 ? "start" : hour === 23 ? "end" : "middle"} className={styles.axisLabel}>{String(hour).padStart(2, "0")}h</text>;
        })}
      </svg>
      {peak && <div className={styles.chartPeak}><small>Pico</small><b>{String(peak.hour).padStart(2, "0")}h · {currency.format(peak.revenueCents / 100)}</b></div>}
    </div>
  );
}

function ChannelBars({ channels }: { channels: DashboardOverviewData["channels"] }) {
  const visible = channels.slice(0, 4);
  if (!visible.length) return <EmptyMini text="Os canais aparecem depois do primeiro pedido." />;
  return (
    <div className={styles.channelChart}>
      {visible.map((channel, index) => (
        <div className={styles.channelItem} key={channel.name}>
          <strong>{channel.share}%</strong>
          <div className={styles.channelTrack}><span className={styles[`bar${index}`]} style={{ height: `${Math.max(6, channel.share)}%` }} /></div>
          <b>{channelName(channel.name)}</b>
          <small>{channel.orders} pedidos</small>
        </div>
      ))}
    </div>
  );
}

function StatusDonut({ counts }: { counts: Record<string, number> }) {
  const rows = [
    { key: "delivered", label: "Concluídos", color: "#20b26b", count: Number(counts.delivered || 0) },
    { key: "kitchen", label: "Em preparo", color: "#ff650b", count: Number(counts.preparing || 0) + Number(counts.ready || 0) },
    { key: "route", label: "Em rota", color: "#4d7fe5", count: Number(counts.out_for_delivery || 0) },
    { key: "waiting", label: "Aguardando", color: "#f0ad1d", count: Number(counts.received || 0) + Number(counts.confirmed || 0) },
    { key: "canceled", label: "Cancelados", color: "#e74b4b", count: Number(counts.canceled || 0) },
  ].filter((row) => row.count > 0);
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  const style = donutStyle(rows, total);
  if (!total) return <EmptyMini text="O status aparece conforme os pedidos entram." />;
  return (
    <div className={styles.donutLayout}>
      <div className={styles.donut} style={style}><span><small>Total</small><b>{total}</b></span></div>
      <div className={styles.donutLegend}>
        {rows.map((row) => <div key={row.key}><i style={{ background: row.color }} /><span>{row.label}</span><b>{row.count} <small>({Math.round((row.count / total) * 100)}%)</small></b></div>)}
      </div>
    </div>
  );
}

function TopProducts({ products }: { products: Array<{ name: string; quantity: number }> }) {
  if (!products.length) return <EmptyMini text="O ranking aparece após as primeiras vendas do dia." />;
  return (
    <div className={styles.topProducts}>
      {products.slice(0, 4).map((product, index) => (
        <div key={product.name}>
          <span>{index + 1}</span>
          <p><b>{product.name}</b><small>{product.quantity} {product.quantity === 1 ? "vendido" : "vendidos"}</small></p>
        </div>
      ))}
    </div>
  );
}

function LiveOrderCard({ order, refresh }: { order: Order; refresh: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const next = nextStatus[order.status];
  const itemCount = order.items.reduce((sum, item) => sum + Number(item.quantity), 0);
  const overdue = Date.now() > Number(order.createdAt) + Number(order.promisedToMinutes || 0) * 60_000;
  const advance = async () => {
    if (!next) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/orders/${order.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: next.status }),
      });
      if (!response.ok) throw new Error("Não foi possível avançar o pedido.");
      await refresh();
    } finally {
      setBusy(false);
    }
  };
  return (
    <article className={`${styles.liveOrder} ${overdue ? styles.overdue : ""}`}>
      <header><b>#{order.number}</b><small>{overdue ? "Atrasado · " : ""}{relativeTime(order.createdAt)}</small></header>
      <div className={styles.orderMain}><h3>{order.customerName}</h3><strong>{currency.format(order.totalCents / 100)}</strong></div>
      <p>{itemCount} {itemCount === 1 ? "item" : "itens"} <i>•</i> {channelName(order.source)}</p>
      <div className={styles.orderFooter}>
        <span className={styles.orderProgress}><i style={{ width: progressWidth(order.status) }} /></span>
        {next ? <button type="button" disabled={busy} onClick={advance}>{busy ? "Atualizando…" : next.label}<span>›</span></button> : <em>Concluído</em>}
      </div>
    </article>
  );
}

function Insight({ icon, tone, label, value, text }: { icon: string; tone: "green" | "orange" | "amber"; label: string; value: string; text: string }) {
  return <article className={styles.insight}><span className={`${styles.insightIcon} ${styles[tone]}`}>{icon}</span><div><small>{label}</small><b>{value}</b><p>{text}</p></div></article>;
}

function EmptyMini({ text }: { text: string }) {
  return <div className={styles.emptyMini}><span>◎</span><p>{text}</p></div>;
}

function chartPoints(rows: HourBucket[], width: number, height: number, padX: number, padY: number, max: number) {
  const normalized = rows.length === 24 ? rows : Array.from({ length: 24 }, (_, hour) => rows.find((row) => row.hour === hour) ?? { hour, revenueCents: 0, orders: 0 });
  return normalized.map((row) => {
    const point = pointFor(row, width, height, padX, padY, max);
    return `${point.x.toFixed(2)},${point.y.toFixed(2)}`;
  }).join(" ");
}

function pointFor(row: HourBucket, width: number, height: number, padX: number, padY: number, max: number) {
  return {
    x: padX + (row.hour / 23) * (width - padX * 2),
    y: height - padY - (row.revenueCents / max) * (height - padY * 2),
  };
}

function donutStyle(rows: Array<{ color: string; count: number }>, total: number): CSSProperties {
  let cursor = 0;
  const stops = rows.map((row) => {
    const start = cursor;
    cursor += (row.count / total) * 100;
    return `${row.color} ${start.toFixed(2)}% ${cursor.toFixed(2)}%`;
  });
  return { background: `conic-gradient(${stops.join(",")})` };
}

function deltaCopy(value: number | null, suffix: string) {
  if (value === null) return "Comparação disponível amanhã";
  if (value === 0) return `Mesmo resultado ${suffix}`;
  return `${value > 0 ? "+" : ""}${value}% ${suffix} ${value > 0 ? "↗" : "↘"}`;
}

function relativeTime(value: number) {
  const minutes = Math.max(0, Math.round((Date.now() - Number(value)) / 60_000));
  return minutes < 1 ? "agora" : minutes < 60 ? `há ${minutes} min` : `há ${Math.floor(minutes / 60)} h`;
}

function channelName(value: string) {
  return ({ menu: "Cardápio", whatsapp: "WhatsApp", link: "Link", counter: "Balcão", admin: "Gestão" } as Record<string, string>)[value] || value;
}

function progressWidth(status: string) {
  return ({ received: "16%", confirmed: "32%", preparing: "52%", ready: "68%", out_for_delivery: "88%", delivered: "100%" } as Record<string, string>)[status] || "8%";
}

function emptyAnalytics(): NonNullable<DashboardOverviewData["analytics"]> {
  return {
    hourlySales: Array.from({ length: 24 }, (_, hour) => ({ hour, revenueCents: 0, orders: 0 })),
    yesterdayHourlySales: Array.from({ length: 24 }, (_, hour) => ({ hour, revenueCents: 0, orders: 0 })),
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
