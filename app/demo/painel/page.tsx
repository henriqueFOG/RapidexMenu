"use client";

import { useState } from "react";
import Link from "next/link";
import AdminOverviewV2 from "../../admin/AdminOverviewV2";
import shellStyles from "../../admin/AdminShellV2.module.css";
import topbarStyles from "../../admin/AdminTopbarV2.module.css";

const now = Date.now();

const demoData = {
  user: { name: "Marina Braga", email: "marina@serraburger.demo", role: "Administrador" },
  restaurant: { name: "Serra Burger", slug: "serra-burger", plan: "Profissional", isOpen: true, activeOrders: 10 },
  metrics: {
    revenueCents: 184200,
    orderCount: 38,
    averageTicketCents: 4847,
    recoveredRevenueCents: 28640,
    rapidexRoi: 7.4,
  },
  analytics: {
    hourlySales: [
      { hour: 6, revenueCents: 6200, orders: 2 }, { hour: 7, revenueCents: 13800, orders: 3 }, { hour: 8, revenueCents: 12400, orders: 2 },
      { hour: 9, revenueCents: 9600, orders: 2 }, { hour: 10, revenueCents: 14800, orders: 3 }, { hour: 11, revenueCents: 21800, orders: 4 },
      { hour: 12, revenueCents: 19600, orders: 4 }, { hour: 13, revenueCents: 23100, orders: 4 }, { hour: 14, revenueCents: 17400, orders: 3 },
      { hour: 15, revenueCents: 14200, orders: 3 }, { hour: 16, revenueCents: 25800, orders: 4 }, { hour: 17, revenueCents: 31000, orders: 5 },
      { hour: 18, revenueCents: 39800, orders: 6 }, { hour: 19, revenueCents: 61400, orders: 9 }, { hour: 20, revenueCents: 46800, orders: 7 },
      { hour: 21, revenueCents: 31400, orders: 5 }, { hour: 22, revenueCents: 12600, orders: 2 },
    ],
    yesterdayHourlySales: [
      { hour: 6, revenueCents: 4200, orders: 1 }, { hour: 7, revenueCents: 8600, orders: 2 }, { hour: 8, revenueCents: 7900, orders: 2 },
      { hour: 9, revenueCents: 6500, orders: 1 }, { hour: 10, revenueCents: 11800, orders: 2 }, { hour: 11, revenueCents: 15400, orders: 3 },
      { hour: 12, revenueCents: 13900, orders: 3 }, { hour: 13, revenueCents: 16200, orders: 3 }, { hour: 14, revenueCents: 10600, orders: 2 },
      { hour: 15, revenueCents: 9900, orders: 2 }, { hour: 16, revenueCents: 16400, orders: 3 }, { hour: 17, revenueCents: 18300, orders: 3 },
      { hour: 18, revenueCents: 20400, orders: 4 }, { hour: 19, revenueCents: 32100, orders: 6 }, { hour: 20, revenueCents: 25800, orders: 5 },
      { hour: 21, revenueCents: 19200, orders: 4 }, { hour: 22, revenueCents: 9800, orders: 2 },
    ],
    revenueDeltaPct: 18,
    ordersDeltaPct: 12,
    ticketDeltaPct: 5,
    yesterdayRevenueCents: 156100,
    yesterdayOrderCount: 34,
    averagePrepMinutes: 27,
    lateOrders: 3,
    peakHour: { hour: 19, revenueCents: 61400, orders: 9 },
    todayStatusCounts: { received: 5, confirmed: 4, preparing: 9, ready: 3, out_for_delivery: 5, delivered: 12, canceled: 0 },
    topProducts: [
      { name: "Smash da Serra", quantity: 87 },
      { name: "Batata Rústica", quantity: 64 },
      { name: "Milkshake Ovomaltine", quantity: 41 },
    ],
  },
  orders: [
    { id: "demo-1285", number: 1285, customerName: "Carla Mendes", status: "received", source: "whatsapp", totalCents: 5680, createdAt: now - 60_000, promisedFromMinutes: 25, promisedToMinutes: 40, items: [{ name: "Smash da Serra", quantity: 1 }, { name: "Batata Rústica", quantity: 1 }] },
    { id: "demo-1284", number: 1284, customerName: "João Martins", status: "preparing", source: "whatsapp", totalCents: 6480, createdAt: now - 12 * 60_000, promisedFromMinutes: 25, promisedToMinutes: 40, items: [{ name: "Smash da Serra", quantity: 2 }] },
    { id: "demo-1283", number: 1283, customerName: "Ana Lima", status: "out_for_delivery", source: "menu", totalCents: 8270, createdAt: now - 19 * 60_000, promisedFromMinutes: 30, promisedToMinutes: 50, items: [{ name: "Combo Serra", quantity: 1 }, { name: "Milkshake Ovomaltine", quantity: 1 }] },
    { id: "demo-1282", number: 1282, customerName: "Rafael Costa", status: "confirmed", source: "menu", totalCents: 3890, createdAt: now - 27 * 60_000, promisedFromMinutes: 25, promisedToMinutes: 40, items: [{ name: "Smash Clássico", quantity: 1 }] },
    { id: "demo-1281", number: 1281, customerName: "Bia Moreira", status: "preparing", source: "link", totalCents: 11240, createdAt: now - 34 * 60_000, promisedFromMinutes: 25, promisedToMinutes: 45, items: [{ name: "Smash da Serra", quantity: 2 }, { name: "Batata Rústica", quantity: 2 }] },
    { id: "demo-1279", number: 1279, customerName: "Pedro Nunes", status: "delivered", source: "link", totalCents: 4890, createdAt: now - 51 * 60_000, promisedFromMinutes: 25, promisedToMinutes: 40, items: [{ name: "Smash Bacon", quantity: 1 }] },
  ],
};

export default function DemoDashboardPage() {
  const [mobileNav, setMobileNav] = useState(false);
  const access = () => window.location.assign("/entrar?return_to=/admin");
  const share = async () => {
    const url = `${window.location.origin}/loja/serra-burger`;
    if (navigator.share) {
      try { await navigator.share({ title: "Serra Burger", text: "Experimente um pedido real no RapidexMenu", url }); } catch { /* cancelado pelo usuário */ }
      return;
    }
    if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(url);
  };

  return (
    <main className={`rm-admin-shell ${shellStyles.shell}`}>
      <aside className={`rm-admin-sidebar ${mobileNav ? "open" : ""}`}>
        <Link className="rm-admin-brand" href="/" aria-label="RapidexMenu"><span aria-hidden="true"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 17h16M6 15a6 6 0 0 1 12 0H6ZM12 9V6M10 6h4M3 20h18"/></svg></span><b>Rapidex<i>Menu</i></b></Link>
        <nav>
          <button className="active" aria-current="page"><span>▦</span><b>Dashboard</b></button>
          <button onClick={access}><span>▤</span><b>Pedidos</b><em>10</em></button>
          <button onClick={access}><span>▣</span><b>Cardápio</b></button>
          <button onClick={access}><span>♙</span><b>Clientes</b></button>
          <button onClick={access}><span>▥</span><b>Relatórios</b></button>
          <button onClick={access}><span>✦</span><b>Automações</b><i>IA</i></button>
          <button onClick={access}><span>⚙</span><b>Configurações</b></button>
        </nav>

        <a className="rm-sidebar-store" href="/loja/serra-burger"><span className="online"><i /></span><div><b>Loja online</b><small>Serra Burger</small></div><em>↗</em></a>
        <div className="rm-sidebar-user"><span>MB</span><div><b>Marina Braga</b><small>Serra Burger · demonstração</small></div><a href="/entrar?return_to=/admin" title="Acessar painel">↗</a></div>
      </aside>

      <section className="rm-admin-main">
        <header className={`rm-admin-topbar ${topbarStyles.topbar}`}>
          <button className="rm-mobile-trigger" onClick={() => setMobileNav(!mobileNav)} aria-label="Abrir navegação">☰</button>
          <div className={topbarStyles.actions}>
            <span className={topbarStyles.hmg}>DEMO</span>
            <button className={topbarStyles.share} onClick={() => void share()} aria-label="Compartilhar cardápio"><b aria-hidden="true">↗</b><span>Compartilhar cardápio</span></button>
            <a className={topbarStyles.store} href="/loja/serra-burger"><b aria-hidden="true">▣</b><span>Experimentar pedido real</span></a>
            <a className={topbarStyles.store} href="/entrar?return_to=/admin"><b aria-hidden="true">→</b><span>Acessar painel</span></a>
          </div>
        </header>

        <div className="rm-admin-content">
          <AdminOverviewV2 data={demoData} refresh={async () => undefined} onOpenOrders={access} />
        </div>
      </section>

      {mobileNav && <button className="rm-nav-backdrop" onClick={() => setMobileNav(false)} aria-label="Fechar menu" />}
    </main>
  );
}
