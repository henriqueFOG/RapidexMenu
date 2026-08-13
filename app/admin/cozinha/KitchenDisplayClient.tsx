"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import styles from "../../commercial.module.css";

type KdsItem = {
  id: string;
  name: string;
  quantity: number;
  notes?: string | null;
  options: Array<{ group: string; name: string }>;
};
type KdsOrder = {
  id: string;
  number: number;
  source: string;
  fulfillmentType: string;
  tableCode?: string | null;
  status: "received" | "confirmed" | "preparing" | "ready";
  paymentStatus: string;
  notes?: string | null;
  createdAt: number;
  ageMinutes: number;
  promisedFromMinutes: number;
  promisedToMinutes: number;
  dueAt: number;
  late: boolean;
  items: KdsItem[];
};

const columns: Array<{ status: KdsOrder["status"]; label: string; action?: string; next?: string }> = [
  { status: "received", label: "Novos", action: "Confirmar", next: "confirmed" },
  { status: "confirmed", label: "Confirmados", action: "Começar preparo", next: "preparing" },
  { status: "preparing", label: "Em preparo", action: "Marcar pronto", next: "ready" },
  { status: "ready", label: "Prontos", action: "Concluir", next: "delivered" },
];

export default function KitchenDisplayClient() {
  const [orders, setOrders] = useState<KdsOrder[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [lastUpdate, setLastUpdate] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/kds", { cache: "no-store" });
      const payload = await response.json() as { orders?: KdsOrder[]; generatedAt?: number; error?: { message?: string } };
      if (!response.ok) throw new Error(payload.error?.message || "Não foi possível carregar a cozinha.");
      setOrders(payload.orders || []);
      setLastUpdate(payload.generatedAt || Date.now());
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível carregar a cozinha.");
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 4_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const counts = useMemo(() => Object.fromEntries(columns.map((column) => [column.status, orders.filter((order) => order.status === column.status).length])), [orders]);

  async function advance(order: KdsOrder, next: string) {
    setBusy(order.id); setError("");
    try {
      const response = await fetch(`/api/admin/orders/${encodeURIComponent(order.id)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const payload = await response.json().catch(() => ({})) as { error?: { message?: string; code?: string } };
      if (!response.ok) {
        if (payload.error?.code === "order_state_conflict") {
          await load();
          throw new Error("O pedido mudou em outro dispositivo. A fila foi atualizada.");
        }
        throw new Error(payload.error?.message || "Não foi possível avançar o pedido.");
      }
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível avançar o pedido.");
    } finally { setBusy(""); }
  }

  return <main style={{ minHeight: "100vh", background: "#11120f", color: "#f7f7f2", padding: 18 }}>
    <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
      <div><Link href="/admin" style={{ color: "#c9ff4a", textDecoration: "none", fontWeight: 900 }}>⚡ RapidexMenu</Link><h1 style={{ margin: "6px 0 0", fontSize: 28 }}>Cozinha · KDS</h1><small style={{ color: "#a6aa9c" }}>Atualiza automaticamente a cada 4s{lastUpdate ? ` · ${new Date(lastUpdate).toLocaleTimeString("pt-BR")}` : ""}</small></div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{columns.map((column) => <span key={column.status} style={{ padding: "8px 12px", borderRadius: 999, background: "#22241e", fontWeight: 900 }}>{column.label}: {counts[column.status] || 0}</span>)}</div>
    </header>
    {error && <div style={{ marginBottom: 14, padding: 12, background: "#4f1e1e", borderRadius: 12 }}>{error}</div>}

    <section style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(260px,1fr))", gap: 12, overflowX: "auto", alignItems: "start" }}>
      {columns.map((column) => <div key={column.status} style={{ minWidth: 260, background: "#191a16", borderRadius: 16, padding: 12 }}>
        <h2 style={{ margin: "2px 4px 12px", fontSize: 17 }}>{column.label} <small style={{ color: "#8e9385" }}>({counts[column.status] || 0})</small></h2>
        <div style={{ display: "grid", gap: 10 }}>
          {orders.filter((order) => order.status === column.status).map((order) => <article key={order.id} style={{ border: order.late ? "2px solid #ff6b57" : "1px solid #34362f", borderRadius: 14, padding: 13, background: order.late ? "#321b17" : "#22241e" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}><div><small style={{ color: "#a6aa9c" }}>{fulfillment(order)}</small><h3 style={{ margin: "3px 0", fontSize: 22 }}>#{order.number}</h3></div><span style={{ fontWeight: 900, color: order.late ? "#ff8a78" : order.ageMinutes > order.promisedFromMinutes ? "#ffd769" : "#c9ff4a" }}>{order.ageMinutes} min</span></div>
            <div style={{ display: "grid", gap: 8, margin: "12px 0" }}>{order.items.map((item) => <div key={item.id}><b>{item.quantity}× {item.name}</b>{item.options.map((option, index) => <small key={`${item.id}-${index}`} style={{ display: "block", color: "#c7cabf", paddingLeft: 14 }}>{option.group}: {option.name}</small>)}{item.notes && <small style={{ display: "block", color: "#ffd769", paddingLeft: 14 }}>Obs.: {item.notes}</small>}</div>)}</div>
            {order.notes && <p style={{ fontSize: 12, padding: 8, borderRadius: 8, background: "#2d2f28" }}>Pedido: {order.notes}</p>}
            <small style={{ display: "block", color: "#969b8e", marginBottom: 8 }}>Promessa: {order.promisedFromMinutes}–{order.promisedToMinutes} min · pagamento {order.paymentStatus}</small>
            {column.next && <button disabled={busy === order.id} onClick={() => void advance(order, column.next!)} style={{ width: "100%", border: 0, borderRadius: 10, padding: "11px 12px", fontWeight: 900, cursor: "pointer", background: "#c9ff4a", color: "#151610" }}>{busy === order.id ? "Atualizando…" : column.action}</button>}
          </article>)}
          {!orders.some((order) => order.status === column.status) && <div style={{ padding: 18, textAlign: "center", color: "#777c70", border: "1px dashed #363930", borderRadius: 12 }}>Sem pedidos</div>}
        </div>
      </div>)}
    </section>
    <footer style={{ marginTop: 16 }}><Link className={styles.linkButton} href="/admin" style={{ color: "#c9ff4a" }}>← Voltar ao painel</Link></footer>
  </main>;
}

function fulfillment(order: KdsOrder) {
  if (order.fulfillmentType === "pickup") return "🛍️ RETIRADA";
  if (order.fulfillmentType === "dine_in") return `🍽️ MESA ${order.tableCode || "?"}`;
  return "🛵 ENTREGA";
}
