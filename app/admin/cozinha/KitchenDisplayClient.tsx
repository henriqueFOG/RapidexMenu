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
  const [online, setOnline] = useState(true);

  const load = useCallback(async () => {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setOnline(false);
      return;
    }
    try {
      const response = await fetch("/api/admin/kds", { cache: "no-store" });
      const payload = await response.json() as { orders?: KdsOrder[]; generatedAt?: number; error?: { message?: string } };
      if (!response.ok) throw new Error(payload.error?.message || "Não foi possível carregar a cozinha.");
      setOrders(payload.orders || []);
      setLastUpdate(payload.generatedAt || Date.now());
      setOnline(true);
      setError("");
    } catch (reason) {
      const disconnected = typeof navigator !== "undefined" && !navigator.onLine;
      setOnline(!disconnected);
      setError(disconnected ? "Sem conexão. A fila permanece visível, mas nenhuma ação será enviada até a internet voltar." : reason instanceof Error ? reason.message : "Não foi possível carregar a cozinha.");
    }
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      setOnline(true);
      void load();
    };
    const handleOffline = () => {
      setOnline(false);
      setError("Sem conexão. A fila permanece visível, mas nenhuma ação será enviada até a internet voltar.");
    };
    const handleVisibility = () => {
      if (document.visibilityState === "visible" && navigator.onLine) void load();
    };

    const initialLoad = window.setTimeout(() => {
      setOnline(navigator.onLine);
      void load();
    }, 0);
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible" && navigator.onLine) void load();
    }, 4_000);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("rapidex:online", handleOnline);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(timer);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("rapidex:online", handleOnline);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [load]);

  const counts = useMemo(() => Object.fromEntries(columns.map((column) => [column.status, orders.filter((order) => order.status === column.status).length])), [orders]);

  async function advance(order: KdsOrder, next: string) {
    if (!navigator.onLine) {
      setOnline(false);
      setError("Sem conexão. A ação não foi enviada; tente novamente quando a internet voltar.");
      return;
    }
    if (busy) return;
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
      const disconnected = !navigator.onLine;
      setOnline(!disconnected);
      setError(disconnected ? "A conexão caiu antes da confirmação. O RapidexMenu não repetirá a ação automaticamente; reconecte e confira o estado do pedido." : reason instanceof Error ? reason.message : "Não foi possível avançar o pedido.");
    } finally { setBusy(""); }
  }

  return <main style={{ minHeight: "100vh", background: "#11120f", color: "#f7f7f2", padding: "max(14px, env(safe-area-inset-top)) max(14px, env(safe-area-inset-right)) max(18px, env(safe-area-inset-bottom)) max(14px, env(safe-area-inset-left))" }}>
    <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
      <div>
        <Link href="/admin" style={{ color: "#c9ff4a", textDecoration: "none", fontWeight: 900 }}>⚡ RapidexMenu</Link>
        <h1 style={{ margin: "6px 0 0", fontSize: "clamp(25px, 4vw, 34px)" }}>Cozinha · KDS</h1>
        <small style={{ color: "#a6aa9c" }}>Atualiza automaticamente a cada 4s{lastUpdate ? ` · ${new Date(lastUpdate).toLocaleTimeString("pt-BR")}` : ""}</small>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <span role="status" style={{ padding: "8px 12px", borderRadius: 999, background: online ? "#22331c" : "#4f1e1e", color: online ? "#c9ff4a" : "#ff9b8f", fontWeight: 900 }}>{online ? "● Online" : "● Sem conexão"}</span>
        {columns.map((column) => <span key={column.status} style={{ padding: "8px 12px", borderRadius: 999, background: "#22241e", fontWeight: 900 }}>{column.label}: {counts[column.status] || 0}</span>)}
      </div>
    </header>
    {error && <div role="alert" style={{ marginBottom: 14, padding: 12, background: online ? "#4f1e1e" : "#4a3814", border: online ? "1px solid #7a3333" : "1px solid #80651e", borderRadius: 12 }}>{error}</div>}

    <section aria-label="Fila da cozinha" style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(280px,1fr))", gap: 12, overflowX: "auto", overscrollBehaviorInline: "contain", scrollSnapType: "x proximity", alignItems: "start", paddingBottom: 8 }}>
      {columns.map((column) => <div key={column.status} style={{ minWidth: 280, background: "#191a16", borderRadius: 16, padding: 12, scrollSnapAlign: "start" }}>
        <h2 style={{ margin: "2px 4px 12px", fontSize: 18 }}>{column.label} <small style={{ color: "#8e9385" }}>({counts[column.status] || 0})</small></h2>
        <div style={{ display: "grid", gap: 10 }}>
          {orders.filter((order) => order.status === column.status).map((order) => <article key={order.id} style={{ border: order.late ? "2px solid #ff6b57" : "1px solid #34362f", borderRadius: 14, padding: 13, background: order.late ? "#321b17" : "#22241e" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}><div><small style={{ color: "#a6aa9c" }}>{fulfillment(order)}</small><h3 style={{ margin: "3px 0", fontSize: 24 }}>#{order.number}</h3></div><span style={{ fontWeight: 900, color: order.late ? "#ff8a78" : order.ageMinutes > order.promisedFromMinutes ? "#ffd769" : "#c9ff4a" }}>{order.ageMinutes} min</span></div>
            <div style={{ display: "grid", gap: 9, margin: "12px 0", fontSize: 16 }}>{order.items.map((item) => <div key={item.id}><b>{item.quantity}× {item.name}</b>{item.options.map((option, index) => <small key={`${item.id}-${index}`} style={{ display: "block", color: "#c7cabf", paddingLeft: 14, fontSize: 13 }}>{option.group}: {option.name}</small>)}{item.notes && <small style={{ display: "block", color: "#ffd769", paddingLeft: 14, fontSize: 13 }}>Obs.: {item.notes}</small>}</div>)}</div>
            {order.notes && <p style={{ fontSize: 13, padding: 8, borderRadius: 8, background: "#2d2f28" }}>Pedido: {order.notes}</p>}
            <small style={{ display: "block", color: "#969b8e", marginBottom: 8 }}>Promessa: {order.promisedFromMinutes}–{order.promisedToMinutes} min · pagamento {order.paymentStatus}</small>
            {column.next && <button disabled={busy !== "" || !online} onClick={() => void advance(order, column.next!)} style={{ width: "100%", minHeight: 48, border: 0, borderRadius: 11, padding: "12px 14px", fontSize: 15, fontWeight: 900, cursor: busy || !online ? "not-allowed" : "pointer", background: online ? "#c9ff4a" : "#5b5e55", color: online ? "#151610" : "#c7cabf", opacity: busy && busy !== order.id ? 0.62 : 1, touchAction: "manipulation" }}>{busy === order.id ? "Atualizando…" : !online ? "Aguardando conexão" : column.action}</button>}
          </article>)}
          {!orders.some((order) => order.status === column.status) && <div style={{ padding: 18, textAlign: "center", color: "#777c70", border: "1px dashed #363930", borderRadius: 12 }}>Sem pedidos</div>}
        </div>
      </div>)}
    </section>
    <footer style={{ marginTop: 16 }}><Link className={styles.linkButton} href="/admin" style={{ color: "#c9ff4a", minHeight: 44, display: "inline-flex", alignItems: "center" }}>← Voltar ao painel</Link></footer>
  </main>;
}

function fulfillment(order: KdsOrder) {
  if (order.fulfillmentType === "pickup") return "🛍️ RETIRADA";
  if (order.fulfillmentType === "dine_in") return `🍽️ MESA ${order.tableCode || "?"}`;
  return "🛵 ENTREGA";
}
