"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./NewOrderNotifier.module.css";

type NotifierOrder = {
  id: string;
  number: number;
  customerName: string;
  status: string;
  totalCents: number;
  createdAt: number;
};

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const storageKey = "rapidex-order-alerts-enabled";

export default function NewOrderNotifier({ orders, restaurantName }: { orders: NotifierOrder[]; restaurantName: string }) {
  const [enabled, setEnabled] = useState(false);
  const [toast, setToast] = useState<NotifierOrder | null>(null);
  const knownIds = useRef<Set<string> | null>(null);
  const mountedAt = useRef(Date.now());

  useEffect(() => {
    setEnabled(window.localStorage.getItem(storageKey) === "1");
  }, []);

  useEffect(() => {
    const eligible = orders.filter((order) => order.status === "received" || order.status === "confirmed");
    if (!knownIds.current) {
      knownIds.current = new Set(eligible.map((order) => order.id));
      return;
    }

    const fresh = eligible
      .filter((order) => !knownIds.current!.has(order.id) && order.createdAt >= mountedAt.current - 5_000)
      .sort((a, b) => b.createdAt - a.createdAt);
    eligible.forEach((order) => knownIds.current!.add(order.id));
    if (!enabled || !fresh.length) return;

    const order = fresh[0];
    setToast(order);
    window.setTimeout(() => setToast((current) => current?.id === order.id ? null : current), 9_000);
    document.title = `🔔 Pedido #${order.number} • RapidexMenu`;
    window.setTimeout(() => { document.title = "RapidexMenu — Cardápio online, pedidos e entrega"; }, 12_000);
    playOrderChime();

    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(`Novo pedido #${order.number}`, {
        body: `${order.customerName} · ${currency.format(order.totalCents / 100)}`,
        icon: "/favicon.svg",
        tag: `rapidex-order-${order.id}`,
      });
    }
  }, [orders, enabled]);

  const activate = async () => {
    if ("Notification" in window && Notification.permission === "default") {
      try { await Notification.requestPermission(); } catch { /* visual/audio alerts still work */ }
    }
    setEnabled(true);
    window.localStorage.setItem(storageKey, "1");
    playOrderChime();
  };

  const deactivate = () => {
    setEnabled(false);
    window.localStorage.setItem(storageKey, "0");
  };

  return <>
    <button
      type="button"
      className={`${styles.control} ${enabled ? styles.active : ""}`}
      onClick={() => enabled ? deactivate() : void activate()}
      aria-label={enabled ? "Desativar alertas de novos pedidos" : "Ativar alertas de novos pedidos"}
      title={enabled ? "Alertas de novos pedidos ativos" : "Ativar som e notificação para novos pedidos"}
    >
      <span aria-hidden="true">{enabled ? "🔔" : "🔕"}</span><b>{enabled ? "Alertas ativos" : "Ativar alertas"}</b>
    </button>
    <div className={styles.liveRegion} aria-live="assertive" aria-atomic="true">
      {toast && <button className={styles.toast} type="button" onClick={() => setToast(null)}>
        <span>🔔</span><div><small>NOVO PEDIDO</small><b>#{toast.number} · {toast.customerName}</b><strong>{currency.format(toast.totalCents / 100)}</strong><em>{restaurantName}</em></div>
      </button>}
    </div>
  </>;
}

function playOrderChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    const now = context.currentTime;
    [740, 980].forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, now + index * 0.16);
      gain.gain.exponentialRampToValueAtTime(0.16, now + index * 0.16 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + index * 0.16 + 0.28);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(now + index * 0.16);
      oscillator.stop(now + index * 0.16 + 0.3);
    });
    window.setTimeout(() => void context.close(), 900);
  } catch { /* browser may block audio until a user gesture */ }
}
