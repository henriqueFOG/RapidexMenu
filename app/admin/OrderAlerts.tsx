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
  const seen = useRef<Set<string> | null>(null);
  const audio = useRef<AudioContext | null>(null);

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
        if (!enabled || disposed) return;
        for (const order of fresh.reverse()) announce(order);
      } catch {
        // O painel principal continua operando mesmo se o alerta auxiliar falhar.
      }
    }
    void poll();
    const interval = window.setInterval(() => void poll(), 8_000);
    return () => { disposed = true; window.clearInterval(interval); };
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
      // Som é complementar; a notificação visual continua funcionando.
    }
  }

  function announce(order: OrderRow) {
    beep();
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      const total = Number(order.total_cents || 0) / 100;
      const notification = new Notification(`Novo pedido #${order.order_number || ""}`.trim(), {
        body: total > 0
          ? `Valor: ${total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}. Abra o painel para conferir.`
          : "Abra o painel para conferir.",
        tag: `rapidex-order-${order.id}`,
      });
      notification.onclick = () => {
        window.focus();
        window.location.assign("/admin");
        notification.close();
      };
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

  if (pathname === "/admin/login" || permission === "denied" || permission === "unsupported") return null;
  if (enabled) return <div style={badgeStyle} role="status">🔔 Alertas ativos</div>;
  return <button type="button" onClick={() => void enableAlerts()} style={buttonStyle} title="Receber alerta quando chegar pedido novo">
    🔔 Ativar alertas
  </button>;
}

const buttonStyle: React.CSSProperties = {
  position: "fixed", right: 18, bottom: 18, zIndex: 85, border: "1px solid #e3e3df", borderRadius: 999,
  padding: "10px 13px", background: "white", color: "#333", fontSize: 11, fontWeight: 850, cursor: "pointer",
  boxShadow: "0 10px 28px rgba(0,0,0,.08)",
};
const badgeStyle: React.CSSProperties = {
  ...buttonStyle, background: "#111", borderColor: "#222", color: "#ff7a1a", cursor: "default",
};
