"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import Link from "next/link";

type Section = "overview" | "orders" | "menu" | "customers" | "automations" | "settings";
type Overview = {
  user: { name: string; email: string; role: string };
  restaurant: {
    id: string;
    name: string;
    slug: string;
    city: string;
    state: string;
    plan: string;
    status: string;
    isOpen: boolean;
    activeOrders: number;
  };
  metrics: {
    revenueCents: number;
    orderCount: number;
    averageTicketCents: number;
    contributionMarginCents: number;
    recoveredRevenueCents: number;
    rapidexRoi: number;
  };
  orders: Order[];
  channels: Array<{ name: string; revenueCents: number; orders: number; share: number }>;
  opportunity: Automation | null;
  returningCustomers: Array<{
    id: string;
    name: string;
    phoneSuffix: string;
    orderCount: number;
    lifetimeValueCents: number;
    lastOrderAt: number;
  }>;
  integrations: Record<string, boolean>;
};
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
type Automation = {
  id: string;
  kind: string;
  status: string;
  reason: string;
  expectedRevenueCents: number;
  recoveredRevenueCents: number;
  marginPercent: number;
  metadata?: Record<string, unknown>;
};

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const statusLabel: Record<string, string> = {
  received: "Recebido",
  confirmed: "Confirmado",
  preparing: "Na cozinha",
  ready: "Pronto",
  out_for_delivery: "Em rota",
  delivered: "Entregue",
  canceled: "Cancelado",
};
const nextStatus: Record<string, { status: string; label: string } | undefined> = {
  received: { status: "confirmed", label: "Confirmar" },
  confirmed: { status: "preparing", label: "Iniciar preparo" },
  preparing: { status: "ready", label: "Marcar pronto" },
  ready: { status: "out_for_delivery", label: "Saiu para entrega" },
  out_for_delivery: { status: "delivered", label: "Concluir" },
};

export default function AdminClient({
  initialUser,
  signOutHref,
}: {
  initialUser: { name: string; email: string };
  signOutHref: string;
}) {
  const [section, setSection] = useState<Section>("overview");
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [mobileNav, setMobileNav] = useState(false);

  const refresh = useCallback(async () => {
    setError("");
    try {
      const payload = await api<Overview & { ok: boolean }>("/api/admin/overview");
      setData(payload);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível carregar o painel.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(() => void refresh(), 0);
    const interval = window.setInterval(refresh, 30_000);
    return () => { window.clearTimeout(initial); window.clearInterval(interval); };
  }, [refresh]);

  const navigate = (next: Section) => {
    setSection(next);
    setMobileNav(false);
  };

  return (
    <main className="rm-admin-shell">
      <aside className={`rm-admin-sidebar ${mobileNav ? "open" : ""}`}>
        <Link className="rm-admin-brand" href="/" aria-label="RapidexMenu">
          <span>⚡</span>
          <b>Rapidex<i>Menu</i></b>
        </Link>
        <nav>
          <Nav active={section === "overview"} icon="▦" onClick={() => navigate("overview")}>Visão geral</Nav>
          <Nav active={section === "orders"} icon="▤" count={data?.restaurant.activeOrders} onClick={() => navigate("orders")}>Pedidos</Nav>
          <Nav active={section === "menu"} icon="▣" onClick={() => navigate("menu")}>Cardápio</Nav>
          <Nav active={section === "automations"} icon="✦" badge="IA" onClick={() => navigate("automations")}>Automações</Nav>
          <Nav active={section === "customers"} icon="♙" onClick={() => navigate("customers")}>Clientes</Nav>
          <Nav active={section === "settings"} icon="⚙" onClick={() => navigate("settings")}>Configurações</Nav>
        </nav>
        <div className="rm-sidebar-growth">
          <span>↗</span>
          <b>Canal próprio</b>
          <p>Venda direta, dados próprios e nenhuma comissão por pedido.</p>
        </div>
        <div className="rm-sidebar-user">
          <span>{initials(initialUser.name)}</span>
          <div><b>{initialUser.name}</b><small>{data?.restaurant.name || initialUser.email}</small></div>
          <a href={signOutHref} title="Sair">↪</a>
        </div>
      </aside>

      <section className="rm-admin-main">
        <header className="rm-admin-topbar">
          <button className="rm-mobile-trigger" onClick={() => setMobileNav(!mobileNav)}>☰</button>
          <div>
            <span className="rm-live"><i /> Dados reais</span>
            <button onClick={refresh} title="Atualizar">↻</button>
            <a className="rm-view-store" href={`/loja/${data?.restaurant.slug || "serra-burger"}`}>Ver loja ↗</a>
          </div>
        </header>

        <div className="rm-admin-content">
          {loading && <Loading />}
          {error && <ErrorState message={error} retry={refresh} />}
          {!loading && !error && data && section === "overview" && <OverviewView data={data} refresh={refresh} />}
          {!loading && !error && data && section === "orders" && <OrdersView orders={data.orders} refresh={refresh} />}
          {!loading && !error && section === "menu" && <ProductManager />}
          {!loading && !error && section === "customers" && <CustomersView />}
          {!loading && !error && data && section === "automations" && <AutomationsView initial={data.opportunity} refresh={refresh} />}
          {!loading && !error && data && section === "settings" && <SettingsView data={data} refresh={refresh} />}
        </div>
      </section>
      {mobileNav && <button className="rm-nav-backdrop" onClick={() => setMobileNav(false)} aria-label="Fechar menu" />}
    </main>
  );
}

function Nav({ active, icon, count, badge, onClick, children }: { active: boolean; icon: string; count?: number; badge?: string; onClick: () => void; children: ReactNode }) {
  return <button className={active ? "active" : ""} onClick={onClick}><span>{icon}</span><b>{children}</b>{count ? <em>{count}</em> : badge ? <i>{badge}</i> : null}</button>;
}

function OverviewView({ data, refresh }: { data: Overview; refresh: () => Promise<void> }) {
  const firstName = data.user.name.split(" ")[0];
  const orderGroups = useMemo(() => [
    { key: "received", title: "Recebidos", tone: "coral", items: data.orders.filter((order) => ["received", "confirmed"].includes(order.status)) },
    { key: "preparing", title: "Na cozinha", tone: "yellow", items: data.orders.filter((order) => ["preparing", "ready"].includes(order.status)) },
    { key: "route", title: "Em rota", tone: "green", items: data.orders.filter((order) => order.status === "out_for_delivery") },
  ], [data.orders]);
  return <>
    <div className="rm-page-title">
      <div><small>{new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long" }).format(new Date()).toUpperCase()}</small><h1>Boa tarde, {firstName}.</h1><p>Sua operação em uma tela, com lucro e recompra visíveis.</p></div>
      <span className={data.restaurant.isOpen ? "open" : "closed"}><i /> {data.restaurant.isOpen ? "Loja aberta" : "Loja fechada"}</span>
    </div>
    <section className="rm-metrics">
      <Metric icon="◉" label="Vendas hoje" value={currency.format(data.metrics.revenueCents / 100)} foot={`${data.metrics.orderCount} pedidos`} tone="lime" />
      <Metric icon="▤" label="Pedidos ativos" value={String(data.restaurant.activeOrders)} foot={`${data.metrics.orderCount} recebidos hoje`} />
      <Metric icon="▣" label="Ticket médio" value={currency.format(data.metrics.averageTicketCents / 100)} foot="Calculado pelos pedidos reais" />
      <Metric icon="✦" label="Receita recuperada" value={currency.format(data.metrics.recoveredRevenueCents / 100)} foot={`${data.metrics.rapidexRoi}x de ROI`} tone="dark" />
    </section>
    <div className="rm-overview-grid">
      <section className="rm-panel rm-live-orders">
        <PanelTitle title="Pedidos agora" text="Atualização automática a cada 30 segundos." />
        <div className="rm-kanban">
          {orderGroups.map((group) => <div className="rm-kanban-col" key={group.key}><header><i className={group.tone} /><b>{group.title}</b><span>{group.items.length}</span></header>{group.items.length ? group.items.slice(0, 4).map((order) => <OrderCard key={order.id} order={order} refresh={refresh} />) : <div className="rm-empty-small">Fila livre</div>}</div>)}
        </div>
      </section>
      <OpportunityCard opportunity={data.opportunity} refresh={refresh} roi={data.metrics.rapidexRoi} recovered={data.metrics.recoveredRevenueCents} />
    </div>
    <div className="rm-bottom-grid">
      <section className="rm-panel"><PanelTitle title="Origem das vendas" text="Participação por canal nos últimos 7 dias." /><div className="rm-channels">{data.channels.length ? data.channels.map((channel) => <div key={channel.name}><span><i /><b>{channelName(channel.name)}</b><small>{channel.orders} pedidos · {currency.format(channel.revenueCents / 100)}</small></span><strong>{channel.share}%</strong></div>) : <Empty text="Os canais aparecem após o primeiro pedido." />}</div></section>
      <section className="rm-panel"><PanelTitle title="Clientes que voltaram" text="Recompras que constroem seu ativo." />{data.returningCustomers.length ? data.returningCustomers.map((customer) => <div className="rm-returning" key={customer.id}><span>{initials(customer.name)}</span><p><b>{customer.name}</b><small>{customer.orderCount} pedidos · final {customer.phoneSuffix}</small></p><strong>{currency.format(customer.lifetimeValueCents / 100)}</strong></div>) : <Empty text="As recompras aparecerão aqui." />}</section>
    </div>
  </>;
}

function Metric({ icon, label, value, foot, tone = "" }: { icon: string; label: string; value: string; foot: string; tone?: string }) {
  return <article className={`rm-metric ${tone}`}><span>{icon}</span><small>{label}</small><b>{value}</b><em>{foot}</em></article>;
}

function PanelTitle({ title, text }: { title: string; text: string }) { return <header className="rm-panel-title"><div><h2>{title}</h2><p>{text}</p></div></header>; }

function OrderCard({ order, refresh }: { order: Order; refresh: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const advance = async () => {
    const next = nextStatus[order.status];
    if (!next) return;
    setBusy(true);
    try { await api(`/api/admin/orders/${order.id}`, { method: "PATCH", body: JSON.stringify({ status: next.status }) }); await refresh(); } finally { setBusy(false); }
  };
  return <article className="rm-order-card"><div><small>#{order.number}</small><em>{relativeTime(order.createdAt)}</em></div><h3>{order.customerName}</h3><p>{order.items.map((item) => `${item.quantity}× ${item.name}`).join(" · ") || channelName(order.source)}</p><footer><strong>{currency.format(order.totalCents / 100)}</strong>{nextStatus[order.status] && <button disabled={busy} onClick={advance}>{busy ? "…" : nextStatus[order.status]!.label}</button>}</footer></article>;
}

function OpportunityCard({ opportunity, refresh, roi, recovered }: { opportunity: Automation | null; refresh: () => Promise<void>; roi: number; recovered: number }) {
  const [busy, setBusy] = useState(false);
  const act = async (action: "approve" | "dismiss") => { if (!opportunity) return; setBusy(true); try { await api(`/api/admin/automations/${opportunity.id}`, { method: "PATCH", body: JSON.stringify({ action }) }); await refresh(); } finally { setBusy(false); } };
  return <aside className="rm-ai-card"><header><span>✦</span><div><small>RAPIDEX IA</small><b>Oportunidade agora</b></div></header>{opportunity ? <div className="rm-ai-insight"><span>🔥 {opportunity.status === "draft" ? "Aguardando sua revisão" : statusAutomation(opportunity.status)}</span><h3>{opportunity.reason}</h3><p>Potencial de <b>{currency.format(opportunity.expectedRevenueCents / 100)}</b> com margem estimada de {opportunity.marginPercent}%.</p>{opportunity.status === "draft" && <div className="rm-ai-actions"><button disabled={busy} onClick={() => act("approve")}>Aprovar campanha</button><button disabled={busy} onClick={() => act("dismiss")}>Descartar</button></div>}<em>Nenhuma campanha é enviada sem aprovação e consentimento.</em></div> : <Empty text="Nenhuma oportunidade pendente agora." />}<div className="rm-ai-roi"><div><small>Recuperado no mês</small><b>{currency.format(recovered / 100)}</b></div><span><b>{roi}x</b><small>ROI</small></span></div></aside>;
}

function OrdersView({ orders, refresh }: { orders: Order[]; refresh: () => Promise<void> }) {
  return <div><PageHead kicker="OPERAÇÃO" title="Pedidos" text="Avance a fila com um clique. Transições inválidas são bloqueadas pelo servidor." /><div className="rm-order-list">{orders.length ? orders.map((order) => <div className="rm-order-row" key={order.id}><span className={`rm-order-status ${order.status}`}>{statusLabel[order.status]}</span><div><b>#{order.number} · {order.customerName}</b><small>{order.items.map((item) => `${item.quantity}× ${item.name}`).join(" · ") || channelName(order.source)}</small></div><strong>{currency.format(order.totalCents / 100)}</strong><OrderAction order={order} refresh={refresh} /></div>) : <Empty text="Nenhum pedido encontrado." />}</div></div>;
}

function OrderAction({ order, refresh }: { order: Order; refresh: () => Promise<void> }) {
  const [busy, setBusy] = useState(false); const next = nextStatus[order.status];
  if (!next) return <span className="rm-done">✓</span>;
  return <button className="rm-row-action" disabled={busy} onClick={async () => { setBusy(true); try { await api(`/api/admin/orders/${order.id}`, { method: "PATCH", body: JSON.stringify({ status: next.status }) }); await refresh(); } finally { setBusy(false); } }}>{busy ? "…" : next.label}</button>;
}

function ProductManager() {
  const [products, setProducts] = useState<Array<Record<string, unknown>>>([]);
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  const load = useCallback(async () => { try { const result = await api<{ products: Array<Record<string, unknown>>; categories: Array<{ id: string; name: string }> }>("/api/admin/products"); setProducts(result.products); setCategories(result.categories); } catch (reason) { setError(reason instanceof Error ? reason.message : "Falha ao carregar cardápio."); } finally { setLoading(false); } }, []);
  useEffect(() => { const initial = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(initial); }, [load]);
  const toggle = async (product: Record<string, unknown>) => { await api(`/api/admin/products/${product.id}`, { method: "PATCH", body: JSON.stringify({ available: !product.available }) }); await load(); };
  return <div><PageHead kicker="CARDÁPIO E MARGEM" title="Seu cardápio" text="Preço, custo e disponibilidade centralizados. A margem é calculada automaticamente." action={<button className="rm-primary-action" onClick={() => setAdding(!adding)}>{adding ? "Fechar" : "+ Novo produto"}</button>} />{adding && <NewProduct categories={categories} onCreated={async () => { setAdding(false); await load(); }} />}{error && <p className="rm-inline-error">{error}</p>}{loading ? <Loading /> : <div className="rm-products-table"><header><span>Produto</span><span>Preço</span><span>Custo</span><span>Margem</span><span>Disponível</span></header>{products.map((product) => <article key={String(product.id)}><div><span>{String(product.emoji)}</span><p><b>{String(product.name)}</b><small>{String(product.categoryName || "Sem categoria")}</small></p></div><strong>{currency.format(Number(product.priceCents) / 100)}</strong><span>{currency.format(Number(product.costCents) / 100)}</span><em className={String(product.marginHealth)}>{String(product.marginPercent)}%</em><button className={`rm-switch ${product.available ? "on" : ""}`} onClick={() => toggle(product)}><i /></button></article>)}</div>}</div>;
}

function NewProduct({ categories, onCreated }: { categories: Array<{ id: string; name: string }>; onCreated: () => Promise<void> }) {
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const submit = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); setBusy(true); setError(""); const form = new FormData(event.currentTarget); try { await api("/api/admin/products", { method: "POST", body: JSON.stringify({ name: form.get("name"), description: form.get("description"), emoji: form.get("emoji"), categoryId: form.get("categoryId") || null, priceCents: Math.round(Number(form.get("price")) * 100), costCents: Math.round(Number(form.get("cost")) * 100), prepMinutes: Number(form.get("prep")) }) }); await onCreated(); } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível criar."); } finally { setBusy(false); } };
  return <form className="rm-product-form" onSubmit={submit}><label>Emoji<input name="emoji" defaultValue="🍽️" maxLength={8} /></label><label>Nome<input name="name" required minLength={2} placeholder="Ex.: Smash clássico" /></label><label>Categoria<select name="categoryId"><option value="">Sem categoria</option>{categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select></label><label>Preço (R$)<input name="price" type="number" min="1" step="0.01" required /></label><label>Custo (R$)<input name="cost" type="number" min="0" step="0.01" required /></label><label>Preparo (min)<input name="prep" type="number" min="1" max="180" defaultValue="10" required /></label><label className="wide">Descrição<input name="description" maxLength={500} placeholder="Ingredientes e diferenciais" /></label><button disabled={busy}>{busy ? "Salvando…" : "Salvar produto"}</button>{error && <p>{error}</p>}</form>;
}

function CustomersView() {
  const [customers, setCustomers] = useState<Array<Record<string, unknown>>>([]); const [loading, setLoading] = useState(true);
  useEffect(() => { api<{ customers: Array<Record<string, unknown>> }>("/api/admin/customers").then((result) => setCustomers(result.customers)).finally(() => setLoading(false)); }, []);
  return <div><PageHead kicker="CRM PRÓPRIO" title="Clientes" text="Histórico e consentimento pertencem ao restaurante, com uso responsável para recompra." />{loading ? <Loading /> : <div className="rm-customer-grid">{customers.map((customer) => <article key={String(customer.id)}><span>{initials(String(customer.name))}</span><div><h3>{String(customer.name)}</h3><p>•••• {String(customer.phone).slice(-4)} {customer.email ? `· ${customer.email}` : ""}</p><small>{customer.whatsappConsent ? "✓ Consentimento WhatsApp" : "Sem consentimento de campanha"}</small></div><strong>{currency.format(Number(customer.lifetimeValueCents) / 100)}<small>{String(customer.orderCount)} pedidos</small></strong></article>)}</div>}</div>;
}

function AutomationsView({ initial, refresh }: { initial: Automation | null; refresh: () => Promise<void> }) {
  return <div><PageHead kicker="CRESCIMENTO CONTROLADO" title="Automações" text="A IA propõe; você aprova. Somente clientes com consentimento entram nas campanhas." /><div className="rm-automation-layout"><OpportunityCard opportunity={initial} refresh={refresh} roi={0} recovered={initial?.recoveredRevenueCents || 0} /><section className="rm-panel rm-guardrails"><h2>Regras do Guardião</h2><div><span>01</span><p><b>Margem mínima</b><small>Campanhas evitam ofertas que destroem contribuição.</small></p></div><div><span>02</span><p><b>Capacidade da cozinha</b><small>O envio respeita fila e tempo real de preparo.</small></p></div><div><span>03</span><p><b>Consentimento e horário</b><small>Nada é enviado sem autorização e janela válida.</small></p></div><div><span>04</span><p><b>Humano no controle</b><small>Reclamações, alergias e exceções saem do automático.</small></p></div></section></div></div>;
}

function SettingsView({ data, refresh }: { data: Overview; refresh: () => Promise<void> }) {
  const [busy, setBusy] = useState(false); const toggle = async () => { setBusy(true); try { await api("/api/admin/settings", { method: "PATCH", body: JSON.stringify({ isOpen: !data.restaurant.isOpen }) }); await refresh(); } finally { setBusy(false); } };
  return <div><PageHead kicker="CONFIGURAÇÃO" title="Operação e integrações" text="Credenciais permanecem no servidor e nunca são exibidas no navegador." /><div className="rm-settings-grid"><section className="rm-panel rm-store-config"><h2>Loja</h2><div><p><b>{data.restaurant.name}</b><small>{data.restaurant.city}, {data.restaurant.state} · /{data.restaurant.slug}</small></p><button className={`rm-store-toggle ${data.restaurant.isOpen ? "open" : ""}`} disabled={busy} onClick={toggle}>{data.restaurant.isOpen ? "Fechar loja" : "Abrir loja"}</button></div><a href={`/loja/${data.restaurant.slug}`}>Abrir cardápio público ↗</a></section><section className="rm-panel rm-integrations"><h2>Status técnico</h2>{Object.entries(data.integrations).map(([name, ready]) => <div key={name}><span className={ready ? "ready" : "pending"}>{ready ? "✓" : "!"}</span><p><b>{integrationName(name)}</b><small>{ready ? "Ativo e disponível" : "Implementado, aguardando credencial"}</small></p><em>{ready ? "Conectado" : "Pendente"}</em></div>)}</section></div><section className="rm-panel rm-activation"><span>🔐</span><div><h2>Ativação de produção</h2><p>WhatsApp Cloud API, OpenAI e Mercado Pago já têm endpoints, assinatura e idempotência implementados. A ativação final acontece pela configuração segura das credenciais no ambiente de hospedagem.</p></div></section></div>;
}

function PageHead({ kicker, title, text, action }: { kicker: string; title: string; text: string; action?: ReactNode }) { return <div className="rm-section-head"><div><small>{kicker}</small><h1>{title}</h1><p>{text}</p></div>{action}</div>; }
function Loading() { return <div className="rm-loading"><i /><span>Carregando operação…</span></div>; }
function ErrorState({ message, retry }: { message: string; retry: () => Promise<void> }) { return <div className="rm-error-state"><span>!</span><h2>O painel não carregou.</h2><p>{message}</p><button onClick={retry}>Tentar novamente</button></div>; }
function Empty({ text }: { text: string }) { return <div className="rm-empty">{text}</div>; }

async function api<T = Record<string, unknown>>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { "content-type": "application/json", ...init?.headers } });
  const payload = await response.json().catch(() => ({})) as { error?: { message?: string } };
  if (!response.ok) throw new Error(payload.error?.message || "Não foi possível concluir.");
  return payload as T;
}
function initials(name: string) { return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "RM"; }
function relativeTime(value: number) { const minutes = Math.max(0, Math.round((Date.now() - value) / 60_000)); return minutes < 1 ? "agora" : minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h`; }
function channelName(value: string) { return ({ menu: "Cardápio", whatsapp: "WhatsApp", link: "Link próprio", counter: "Balcão", admin: "Gestão" } as Record<string, string>)[value] || value; }
function statusAutomation(value: string) { return ({ approved: "Aprovada", sent: "Enviada", converted: "Convertida", failed: "Descartada" } as Record<string, string>)[value] || value; }
function integrationName(value: string) { return ({ database: "Banco multiempresa", uploads: "Fotos e arquivos", openai: "Vendedor com IA", whatsapp: "WhatsApp oficial", pix: "Pix Mercado Pago" } as Record<string, string>)[value] || value; }
