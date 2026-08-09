"use client";

import { useCallback, useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import Link from "next/link";
import AdminOverviewV2 from "./AdminOverviewV2";
import ProductImageUpload from "./ProductImageUpload";
import shellStyles from "./AdminShellV2.module.css";
import topbarStyles from "./AdminTopbarV2.module.css";

type Section = "overview" | "orders" | "menu" | "customers" | "automations" | "settings";
type Overview = {
  user: { name: string; email: string; role: string };
  restaurant: { id: string; name: string; slug: string; city: string; state: string; plan: string; status: string; isOpen: boolean; activeOrders: number };
  metrics: { revenueCents: number; orderCount: number; averageTicketCents: number; contributionMarginCents: number; recoveredRevenueCents: number; rapidexRoi: number };
  analytics?: { hourlySales: Array<{ hour: number; revenueCents: number; orders: number }>; yesterdayHourlySales: Array<{ hour: number; revenueCents: number; orders: number }>; revenueDeltaPct: number | null; ordersDeltaPct: number | null; ticketDeltaPct: number | null; yesterdayRevenueCents: number; yesterdayOrderCount: number; averagePrepMinutes: number; lateOrders: number; peakHour: { hour: number; revenueCents: number; orders: number } | null; todayStatusCounts: Record<string, number>; topProducts: Array<{ name: string; quantity: number }> };
  orders: Order[];
  channels: Array<{ name: string; revenueCents: number; orders: number; share: number }>;
  opportunity: Automation | null;
  integrations: Record<string, boolean>;
};
type Order = { id: string; number: number; customerName: string; status: string; source: string; totalCents: number; createdAt: number; promisedFromMinutes: number; promisedToMinutes: number; items: Array<{ name: string; quantity: number }> };
type Automation = { id: string; kind: string; status: string; reason: string; expectedRevenueCents: number; recoveredRevenueCents: number; marginPercent: number; metadata?: Record<string, unknown> };

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const statusLabel: Record<string, string> = { received: "Recebido", confirmed: "Confirmado", preparing: "Na cozinha", ready: "Pronto", out_for_delivery: "Em rota", delivered: "Entregue", canceled: "Cancelado" };
const nextStatus: Record<string, { status: string; label: string } | undefined> = {
  received: { status: "confirmed", label: "Confirmar" }, confirmed: { status: "preparing", label: "Iniciar preparo" }, preparing: { status: "ready", label: "Marcar pronto" }, ready: { status: "out_for_delivery", label: "Saiu para entrega" }, out_for_delivery: { status: "delivered", label: "Concluir" },
};

export default function AdminClient({ initialUser, signOutHref, environment }: { initialUser: { name: string; email: string }; signOutHref: string; environment: string }) {
  const [section, setSection] = useState<Section>("overview");
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [mobileNav, setMobileNav] = useState(false);
  const [shareFeedback, setShareFeedback] = useState(false);

  const refresh = useCallback(async () => {
    setError("");
    try { setData(await api<Overview>("/api/admin/overview")); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível carregar o painel."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(() => void refresh(), 0);
    const interval = window.setInterval(refresh, 30_000);
    return () => { window.clearTimeout(initial); window.clearInterval(interval); };
  }, [refresh]);

  const navigate = (next: Section) => { setSection(next); setMobileNav(false); };
  const storeHref = `/loja/${data?.restaurant.slug || "serra-burger"}`;

  const shareStore = async () => {
    if (!data?.restaurant.slug) return;
    const url = `${window.location.origin}/loja/${data.restaurant.slug}`;
    try {
      if (navigator.share) await navigator.share({ title: data.restaurant.name, text: `Peça direto pelo cardápio do ${data.restaurant.name}`, url });
      else if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(url);
      else window.prompt("Copie o link do seu cardápio", url);
      setShareFeedback(true);
      window.setTimeout(() => setShareFeedback(false), 1800);
    } catch (reason) { if (!(reason instanceof DOMException && reason.name === "AbortError")) setShareFeedback(false); }
  };

  return <main className={`rm-admin-shell ${shellStyles.shell}`}>
    <aside className={`rm-admin-sidebar ${mobileNav ? "open" : ""}`}>
      <Link className="rm-admin-brand" href="/" aria-label="RapidexMenu"><span aria-hidden="true"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 17h16M6 15a6 6 0 0 1 12 0H6ZM12 9V6M10 6h4M3 20h18"/></svg></span><b>Rapidex<i>Menu</i></b></Link>
      <nav>
        <Nav active={section === "overview"} icon="▦" ariaLabel="Visão geral" onClick={() => navigate("overview")}>Dashboard</Nav>
        <Nav active={section === "orders"} icon="▤" count={data?.restaurant.activeOrders} onClick={() => navigate("orders")}>Pedidos</Nav>
        <Nav active={section === "menu"} icon="▣" onClick={() => navigate("menu")}>Cardápio</Nav>
        <Nav active={section === "customers"} icon="♙" onClick={() => navigate("customers")}>Clientes</Nav>
        <a className="rm-admin-nav-link" href="/admin/lucro"><span>▥</span><b>Relatórios</b></a>
        <Nav active={section === "automations"} icon="✦" badge="IA" onClick={() => navigate("automations")}>Automações</Nav>
        <Nav active={section === "settings"} icon="⚙" onClick={() => navigate("settings")}>Configurações</Nav>
      </nav>

      <a className="rm-sidebar-store" href={storeHref}><span className={data?.restaurant.isOpen ? "online" : "offline"}><i /></span><div><b>{data?.restaurant.isOpen ? "Loja online" : "Loja fechada"}</b><small>{data?.restaurant.name || "Seu cardápio"}</small></div><em>↗</em></a>
      <div className="rm-sidebar-user"><span>{initials(initialUser.name)}</span><div><b>{initialUser.name}</b><small>{data?.restaurant.name || initialUser.email}</small></div><a href={signOutHref} title="Sair">↪</a></div>
    </aside>

    <section className="rm-admin-main">
      <header className={`rm-admin-topbar ${topbarStyles.topbar}`}>
        <button className="rm-mobile-trigger" onClick={() => setMobileNav(!mobileNav)} aria-label="Abrir navegação">☰</button>
        <div className={topbarStyles.actions}>
          {(environment === "hmg" || environment === "homologation") && <span className={topbarStyles.hmg}>HMG</span>}
          <button className={topbarStyles.refresh} onClick={() => void refresh()} title="Atualizar dados" aria-label="Atualizar dados">↻</button>
          <button className={`${topbarStyles.share} ${shareFeedback ? topbarStyles.shareFeedback : ""}`} onClick={() => void shareStore()} aria-label="Compartilhar cardápio"><b aria-hidden="true">↗</b><span>{shareFeedback ? "Link pronto" : "Compartilhar cardápio"}</span></button>
          <a className={topbarStyles.store} href={storeHref}><b aria-hidden="true">▣</b><span>Abrir loja</span></a>
        </div>
      </header>

      <div className="rm-admin-content">
        {loading && <Loading />}
        {error && <ErrorState message={error} retry={refresh} />}
        {!loading && !error && data && section === "overview" && <AdminOverviewV2 data={data} refresh={refresh} onOpenOrders={() => navigate("orders")} />}
        {!loading && !error && data && section === "orders" && <OrdersView orders={data.orders} refresh={refresh} />}
        {!loading && !error && section === "menu" && <ProductManager />}
        {!loading && !error && section === "customers" && <CustomersView />}
        {!loading && !error && data && section === "automations" && <AutomationsView initial={data.opportunity} refresh={refresh} />}
        {!loading && !error && data && section === "settings" && <SettingsView data={data} refresh={refresh} />}
      </div>
    </section>
    {mobileNav && <button className="rm-nav-backdrop" onClick={() => setMobileNav(false)} aria-label="Fechar menu" />}
  </main>;
}

function Nav({ active, icon, count, badge, ariaLabel, onClick, children }: { active: boolean; icon: string; count?: number; badge?: string; ariaLabel?: string; onClick: () => void; children: ReactNode }) {
  return <button aria-label={ariaLabel} className={active ? "active" : ""} onClick={onClick}><span>{icon}</span><b>{children}</b>{count ? <em>{count}</em> : badge ? <i>{badge}</i> : null}</button>;
}

function OrdersView({ orders, refresh }: { orders: Order[]; refresh: () => Promise<void> }) {
  return <div><PageHead kicker="OPERAÇÃO" title="Pedidos" text="Avance a fila com um clique e acompanhe cada pedido em tempo real." /><div className="rm-order-list">{orders.length ? orders.map((order) => <div className="rm-order-row" key={order.id}><span className={`rm-order-status ${order.status}`}>{statusLabel[order.status]}</span><div><b>#{order.number} · {order.customerName}</b><small>{order.items.map((item) => `${item.quantity}× ${item.name}`).join(" · ") || channelName(order.source)}</small></div><strong>{currency.format(order.totalCents / 100)}</strong><OrderAction order={order} refresh={refresh} /></div>) : <Empty text="Nenhum pedido encontrado." />}</div></div>;
}

function OrderAction({ order, refresh }: { order: Order; refresh: () => Promise<void> }) {
  const [busy, setBusy] = useState(false); const next = nextStatus[order.status];
  if (!next) return <span className="rm-done">✓</span>;
  return <button className="rm-row-action" disabled={busy} onClick={async () => { setBusy(true); try { await api(`/api/admin/orders/${order.id}`, { method: "PATCH", body: JSON.stringify({ status: next.status }) }); await refresh(); } finally { setBusy(false); } }}>{busy ? "…" : next.label}</button>;
}

function ProductManager() {
  const [products, setProducts] = useState<Array<Record<string, unknown>>>([]);
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [adding, setAdding] = useState(false);
  const load = useCallback(async () => { try { const result = await api<{ products: Array<Record<string, unknown>>; categories: Array<{ id: string; name: string }> }>("/api/admin/products"); setProducts(result.products); setCategories(result.categories); } catch (reason) { setError(reason instanceof Error ? reason.message : "Falha ao carregar cardápio."); } finally { setLoading(false); } }, []);
  useEffect(() => { const initial = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(initial); }, [load]);
  const toggle = async (product: Record<string, unknown>) => { await api(`/api/admin/products/${product.id}`, { method: "PATCH", body: JSON.stringify({ available: !product.available }) }); await load(); };
  return <div><PageHead kicker="CARDÁPIO" title="Seu cardápio" text="Preço, custo, margem, fotos e disponibilidade em um só lugar." action={<div className="rm-head-actions"><a href="/admin/importar">Importar</a><a href="/admin/categorias">Categorias</a><button className="rm-primary-action" onClick={() => setAdding(!adding)}>{adding ? "Fechar" : "+ Novo produto"}</button></div>} />{adding && <NewProduct categories={categories} onCreated={async () => { setAdding(false); await load(); }} />}{error && <p className="rm-inline-error">{error}</p>}{loading ? <Loading /> : <div className="rm-products-table"><header><span>Produto</span><span>Preço</span><span>Custo</span><span>Margem</span><span>Disponível</span></header>{products.map((product) => <article key={String(product.id)}><div><ProductImageUpload product={product} onDone={load}/><p><b>{String(product.name)}</b><small>{String(product.categoryName || "Sem categoria")} · {product.imageUrl ? "Foto publicada" : "Adicionar foto"}</small></p></div><strong>{currency.format(Number(product.priceCents) / 100)}</strong><span>{currency.format(Number(product.costCents) / 100)}</span><em className={String(product.marginHealth)}>{String(product.marginPercent)}%</em><button className={`rm-switch ${product.available ? "on" : ""}`} onClick={() => void toggle(product)}><i /></button></article>)}</div>}</div>;
}

function NewProduct({ categories, onCreated }: { categories: Array<{ id: string; name: string }>; onCreated: () => Promise<void> }) {
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const submit = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); setBusy(true); setError(""); const form = new FormData(event.currentTarget); try { await api("/api/admin/products", { method: "POST", body: JSON.stringify({ name: form.get("name"), description: form.get("description"), emoji: form.get("emoji"), categoryId: form.get("categoryId") || null, priceCents: Math.round(Number(form.get("price")) * 100), costCents: Math.round(Number(form.get("cost")) * 100), prepMinutes: Number(form.get("prep")) }) }); await onCreated(); } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível criar."); } finally { setBusy(false); } };
  return <form className="rm-product-form" onSubmit={submit}><label>Emoji<input name="emoji" defaultValue="🍽️" maxLength={8} /></label><label>Nome<input name="name" required minLength={2} placeholder="Ex.: Smash clássico" /></label><label>Categoria<select name="categoryId"><option value="">Sem categoria</option>{categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select></label><label>Preço (R$)<input name="price" type="number" min="1" step="0.01" required /></label><label>Custo (R$)<input name="cost" type="number" min="0" step="0.01" required /></label><label>Preparo (min)<input name="prep" type="number" min="1" max="180" defaultValue="10" required /></label><label className="wide">Descrição<input name="description" maxLength={500} placeholder="Ingredientes e diferenciais" /></label><button disabled={busy}>{busy ? "Salvando…" : "Salvar produto"}</button>{error && <p>{error}</p>}</form>;
}

function CustomersView() {
  const [customers, setCustomers] = useState<Array<Record<string, unknown>>>([]); const [loading, setLoading] = useState(true);
  useEffect(() => { api<{ customers: Array<Record<string, unknown>> }>("/api/admin/customers").then((result) => setCustomers(result.customers)).finally(() => setLoading(false)); }, []);
  return <div><PageHead kicker="CLIENTES" title="Sua base própria" text="Histórico, recorrência e consentimento pertencem ao restaurante." />{loading ? <Loading /> : <div className="rm-customer-grid">{customers.map((customer) => <article key={String(customer.id)}><span>{initials(String(customer.name))}</span><div><h3>{String(customer.name)}</h3><p>•••• {String(customer.phone).slice(-4)} {customer.email ? `· ${customer.email}` : ""}</p><small>{customer.whatsappConsent ? "✓ Consentimento WhatsApp" : "Sem consentimento de campanha"}</small></div><strong>{currency.format(Number(customer.lifetimeValueCents) / 100)}<small>{String(customer.orderCount)} pedidos</small></strong></article>)}</div>}</div>;
}

function AutomationsView({ initial, refresh }: { initial: Automation | null; refresh: () => Promise<void> }) {
  return <div><PageHead kicker="AUTOMAÇÕES" title="Crescimento com controle" text="A IA encontra oportunidades; você mantém o controle das ações." /><div className="rm-automation-layout"><OpportunityCard opportunity={initial} refresh={refresh} /><section className="rm-panel rm-guardrails"><h2>Regras de segurança</h2><div><span>01</span><p><b>Margem protegida</b><small>Ofertas evitam destruir contribuição.</small></p></div><div><span>02</span><p><b>Capacidade da cozinha</b><small>Campanhas respeitam a operação.</small></p></div><div><span>03</span><p><b>Consentimento</b><small>Nada é enviado fora das permissões.</small></p></div><div><span>04</span><p><b>Humano no controle</b><small>Você aprova as ações relevantes.</small></p></div></section></div></div>;
}

function OpportunityCard({ opportunity, refresh }: { opportunity: Automation | null; refresh: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const act = async (action: "approve" | "dismiss") => { if (!opportunity) return; setBusy(true); try { await api(`/api/admin/automations/${opportunity.id}`, { method: "PATCH", body: JSON.stringify({ action }) }); await refresh(); } finally { setBusy(false); } };
  return <aside className="rm-ai-card"><header><span>✦</span><div><small>RAPIDEX IA</small><b>Oportunidade agora</b></div></header>{opportunity ? <div className="rm-ai-insight"><span>Oportunidade detectada</span><h3>{opportunity.reason}</h3><p>Potencial de <b>{currency.format(opportunity.expectedRevenueCents / 100)}</b> com margem estimada de {opportunity.marginPercent}%.</p>{opportunity.status === "draft" && <div className="rm-ai-actions"><button disabled={busy} onClick={() => void act("approve")}>Aprovar campanha</button><button disabled={busy} onClick={() => void act("dismiss")}>Descartar</button></div>}<em>Nenhuma campanha é enviada sem aprovação e consentimento.</em></div> : <Empty text="Nenhuma oportunidade pendente agora." />}</aside>;
}

function SettingsView({ data, refresh }: { data: Overview; refresh: () => Promise<void> }) {
  const [busy, setBusy] = useState(false); const toggle = async () => { setBusy(true); try { await api("/api/admin/settings", { method: "PATCH", body: JSON.stringify({ isOpen: !data.restaurant.isOpen }) }); await refresh(); } finally { setBusy(false); } };
  const links = [["/admin/horarios","Horários"],["/admin/pagamentos","Pagamentos"],["/admin/whatsapp","WhatsApp"],["/admin/categorias","Categorias"],["/admin/importar","Importar cardápio"],["/assinatura","Assinatura"]];
  return <div><PageHead kicker="CONFIGURAÇÕES" title="Operação e integrações" text="Tudo que é menos frequente fica organizado aqui, sem poluir o dashboard." /><div className="rm-settings-links">{links.map(([href,label]) => <a href={href} key={href}><span>{label}</span><b>→</b></a>)}</div><div className="rm-settings-grid"><section className="rm-panel rm-store-config"><h2>Loja</h2><div><p><b>{data.restaurant.name}</b><small>{data.restaurant.city}, {data.restaurant.state} · /{data.restaurant.slug}</small></p><button className={`rm-store-toggle ${data.restaurant.isOpen ? "open" : ""}`} disabled={busy} onClick={() => void toggle()}>{data.restaurant.isOpen ? "Fechar loja" : "Abrir loja"}</button></div><a href={`/loja/${data.restaurant.slug}`}>Abrir cardápio público ↗</a></section><section className="rm-panel rm-integrations"><h2>Status técnico</h2>{Object.entries(data.integrations).map(([name, ready]) => <div key={name}><span className={ready ? "ready" : "pending"}>{ready ? "✓" : "!"}</span><p><b>{integrationName(name)}</b><small>{ready ? "Ativo e disponível" : "Aguardando configuração"}</small></p><em>{ready ? "Conectado" : "Pendente"}</em></div>)}</section></div></div>;
}

function PageHead({ kicker, title, text, action }: { kicker: string; title: string; text: string; action?: ReactNode }) { return <div className="rm-section-head"><div><small>{kicker}</small><h1>{title}</h1><p>{text}</p></div>{action}</div>; }
function Loading() { return <div className="rm-loading"><i /><span>Carregando operação…</span></div>; }
function ErrorState({ message, retry }: { message: string; retry: () => Promise<void> }) { return <div className="rm-error-state"><span>!</span><h2>O painel não carregou.</h2><p>{message}</p><button onClick={() => void retry()}>Tentar novamente</button></div>; }
function Empty({ text }: { text: string }) { return <div className="rm-empty">{text}</div>; }

async function api<T = Record<string, unknown>>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { "content-type": "application/json", ...init?.headers } });
  const payload = await response.json().catch(() => ({})) as { error?: { message?: string } };
  if (!response.ok) throw new Error(payload.error?.message || "Não foi possível concluir.");
  return payload as T;
}
function initials(name: string) { return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "RM"; }
function channelName(value: string) { return ({ menu: "Cardápio", whatsapp: "WhatsApp", link: "Link próprio", counter: "Balcão", admin: "Gestão" } as Record<string, string>)[value] || value; }
function integrationName(value: string) { return ({ database: "Banco de dados", uploads: "Fotos e arquivos", openai: "IA", whatsapp: "WhatsApp oficial", sellerPayments: "Pagamentos", billing: "Assinatura" } as Record<string, string>)[value] || value; }
