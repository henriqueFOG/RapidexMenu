"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type OrderRow = {
  id: string;
  order_number?: number;
  total_cents?: number;
  created_at?: number;
};

type OrdersPayload = { orders?: OrderRow[] };

const preferenceKey = "rapidex-order-alerts";

export default function OrderAlerts() {
  const pathname = usePathname();
  const [enabled, setEnabled] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const [latest, setLatest] = useState<OrderRow | null>(null);
  const seen = useRef<Set<string> | null>(null);
  const audio = useRef<AudioContext | null>(null);
  const dismissTimer = useRef<number | null>(null);

  useEffect(() => {
    if (typeof Notification === "undefined") {
      setPermission("unsupported");
      return;
    }
    setPermission(Notification.permission);
    setEnabled(Notification.permission === "granted" && window.localStorage.getItem(preferenceKey) === "1");
  }, []);

  useEffect(() => {
    if (pathname === "/admin/login") return;
    let disposed = false;
    async function poll() {
      if (!navigator.onLine || document.visibilityState !== "visible") return;
      try {
        const response = await fetch("/api/admin/orders?status=received", { cache: "no-store" });
        if (!response.ok) return;
        const payload = await response.json() as OrdersPayload;
        const orders = payload.orders || [];
        if (!seen.current) {
          seen.current = new Set(orders.map((order) => order.id));
          return;
        }
        const fresh = orders.filter((order) => !seen.current!.has(order.id));
        for (const order of orders) seen.current.add(order.id);
        if (!fresh.length || disposed) return;

        setLatest(fresh[0]);
        if (dismissTimer.current) window.clearTimeout(dismissTimer.current);
        dismissTimer.current = window.setTimeout(() => setLatest(null), 12_000);
        if (enabled) for (const order of fresh.reverse()) void announce(order);
      } catch {
        // O painel principal continua operando mesmo se o alerta auxiliar falhar.
      }
    }
    const resume = () => void poll();
    void poll();
    const interval = window.setInterval(() => void poll(), 8_000);
    window.addEventListener("online", resume);
    document.addEventListener("visibilitychange", resume);
    return () => {
      disposed = true;
      window.clearInterval(interval);
      window.removeEventListener("online", resume);
      document.removeEventListener("visibilitychange", resume);
      if (dismissTimer.current) window.clearTimeout(dismissTimer.current);
    };
  }, [enabled, pathname]);

  async function enableAlerts() {
    if (typeof Notification === "undefined") {
      setPermission("unsupported");
      return;
    }
    const next = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
    setPermission(next);
    if (next !== "granted") return;
    window.localStorage.setItem(preferenceKey, "1");
    setEnabled(true);
    try {
      audio.current = audio.current || new AudioContext();
      if (audio.current.state === "suspended") await audio.current.resume();
      beep();
    } catch {
      // Som é complementar; o alerta dentro do painel continua funcionando.
    }
  }

  async function announce(order: OrderRow) {
    beep();
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;

    const total = Number(order.total_cents || 0) / 100;
    const options: NotificationOptions = {
      body: total > 0
        ? `Valor: ${total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}. Abra o painel para conferir.`
        : "Abra o painel para conferir.",
      tag: `rapidex-order-${order.id}`,
      icon: "/api/pwa/icon/192",
      badge: "/api/pwa/icon/192",
      data: { url: "/admin" },
    };
    const title = `Novo pedido #${order.order_number || ""}`.trim();

    if ("serviceWorker" in navigator) {
      try {
        const registration = await navigator.serviceWorker.ready;
        await registration.showNotification(title, options);
        return;
      } catch {
        // Alguns navegadores desktop ainda aceitam a notificação direta; tentamos abaixo.
      }
    }

    try {
      const notification = new Notification(title, options);
      notification.onclick = () => {
        window.focus();
        window.location.assign("/admin");
        notification.close();
      };
    } catch {
      // O toast visual permanece como fallback obrigatório.
    }
  }

  function beep() {
    const context = audio.current;
    if (!context || context.state !== "running") return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.12, context.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.22);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.23);
  }

  if (pathname === "/admin/login") return null;
  const canEnable = permission !== "denied" && permission !== "unsupported";

  return <>
    {latest && <div role="alert" aria-live="assertive" style={toastStyle}>
      <span style={toastIconStyle}>✓</span>
      <div><b>{`Novo pedido #${latest.order_number || ""}`.trim()}</b><small>{Number(latest.total_cents || 0) > 0 ? `${(Number(latest.total_cents) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} · recebido agora` : "Recebido agora"}</small></div>
      <a href="/admin" style={toastLinkStyle}>Ver pedido →</a>
    </div>}
    {canEnable && (enabled
      ? <div style={badgeStyle} role="status">🔔 Alertas ativos</div>
      : <button type="button" onClick={() => void enableAlerts()} style={buttonStyle} title="Ativar som e notificação do navegador para novos pedidos">🔔 Ativar alertas</button>)}
  </>;
}

const buttonStyle: React.CSSProperties = {
  position: "fixed", right: 18, bottom: "max(18px, env(safe-area-inset-bottom))", zIndex: 85, border: "1px solid #e3e3df", borderRadius: 999,
  minHeight: 44, padding: "10px 13px", background: "white", color: "#333", fontSize: 11, fontWeight: 850, cursor: "pointer",
  boxShadow: "0 10px 28px rgba(0,0,0,.08)", touchAction: "manipulation",
};
const badgeStyle: React.CSSProperties = {
  ...buttonStyle, background: "#111", borderColor: "#222", color: "#ff7a1a", cursor: "default",
};
const toastStyle: React.CSSProperties = {
  position: "fixed", right: 18, bottom: "max(70px, calc(env(safe-area-inset-bottom) + 58px))", zIndex: 90, width: "min(370px, calc(100vw - 36px))",
  display: "grid", gridTemplateColumns: "38px 1fr auto", alignItems: "center", gap: 10,
  padding: 14, borderRadius: 16, background: "#111", color: "white", border: "1px solid #2b2b2b",
  boxShadow: "0 18px 42px rgba(0,0,0,.22)",
};
const toastIconStyle: React.CSSProperties = {
  width: 34, height: 34, borderRadius: 999, display: "grid", placeItems: "center",
  background: "#ff6b0a", color: "white", fontWeight: 950,
};
const toastLinkStyle: React.CSSProperties = { color: "#ff8a3d", fontSize: 11, fontWeight: 900, textDecoration: "none" };
