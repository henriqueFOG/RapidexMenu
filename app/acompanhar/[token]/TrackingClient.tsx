"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type Tracking = {
  order: {
    number: number;
    restaurantName: string;
    status: string;
    paymentStatus: string;
    paymentMethod: string;
    totalCents: number;
    promisedFromMinutes: number;
    promisedToMinutes: number;
    createdAt: number;
    updatedAt: number;
    items: Array<{ name: string; quantity: number; unitPriceCents: number }>;
  };
  payment: { status: string; pixCode?: string; ticketUrl?: string; expiresAt?: number } | null;
};

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const steps = [
  ["received", "Pedido recebido", "A loja já recebeu os detalhes."],
  ["confirmed", "Confirmado", "Pagamento e disponibilidade conferidos."],
  ["preparing", "Na cozinha", "Seu pedido está sendo preparado."],
  ["ready", "Pronto", "Tudo embalado para sair."],
  ["out_for_delivery", "Em rota", "O pedido está a caminho."],
  ["delivered", "Entregue", "Bom apetite!"],
] as const;

const wait = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

export default function TrackingClient({ token }: { token: string }) {
  const [data, setData] = useState<Tracking | null>(null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/public/orders/${encodeURIComponent(token)}`, { cache: "no-store" });
      const payload = await response.json() as Tracking & { error?: { message?: string } };
      if (!response.ok) throw new Error(payload.error?.message || "Pedido não encontrado.");
      setData(payload as Tracking);
      setError("");
      return payload as Tracking;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível acompanhar.");
      return null;
    }
  }, [token]);

  const manualRefresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      const first = await load();
      // A status transition may be finishing at the exact instant the customer
      // requests a refresh. Re-check once after a short delay so one tap does
      // not leave the customer looking at a just-stale state.
      if (first) {
        await wait(650);
        await load();
      }
    } finally {
      setRefreshing(false);
    }
  }, [load, refreshing]);

  useEffect(() => {
    const initial = window.setTimeout(() => void load(), 0);
    const interval = window.setInterval(() => void load(), 20_000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
    };
  }, [load]);

  if (error) return <main className="rm-track-state"><span>!</span><h1>Pedido não encontrado</h1><p>{error}</p><Link href="/">Ir para o RapidexMenu</Link></main>;
  if (!data) return <main className="rm-track-state"><span>⚡</span><i /><p>Consultando o pedido…</p></main>;

  const current = steps.findIndex((step) => step[0] === data.order.status);
  const canceled = data.order.status === "canceled";
  return <main className="rm-tracking"><header><Link href="/"><span>⚡</span><b>Rapidex<i>Menu</i></b></Link><span className="rm-tracking-live"><i /> Atualiza automaticamente</span></header><section className="rm-tracking-card"><div className="rm-tracking-head"><small>{data.order.restaurantName.toUpperCase()}</small><h1>Pedido #{data.order.number}</h1><p>{canceled ? "Este pedido foi cancelado." : `Previsão inicial: ${data.order.promisedFromMinutes}–${data.order.promisedToMinutes} minutos.`}</p></div>{canceled ? <div className="rm-canceled"><span>×</span><div><b>Pedido cancelado</b><p>Entre em contato com a loja se precisar de ajuda.</p></div></div> : <div className="rm-timeline">{steps.map((step, index) => <div className={index < current ? "done" : index === current ? "current" : ""} key={step[0]}><span>{index < current ? "✓" : index === current ? "●" : index + 1}</span><p><b>{step[1]}</b><small>{step[2]}</small></p>{index === current && <em>Agora</em>}</div>)}</div>}<div className="rm-track-order"><h2>Resumo</h2>{data.order.items.map((item, index) => <p key={`${item.name}-${index}`}><span>{item.quantity}× {item.name}</span><b>{currency.format(item.quantity * item.unitPriceCents / 100)}</b></p>)}<p className="total"><span>Total</span><b>{currency.format(data.order.totalCents / 100)}</b></p></div>{data.payment?.status === "pending" && data.payment.pixCode && <div className="rm-track-pix"><span>▦</span><div><b>Pix aguardando pagamento</b><p>Conclua para a loja confirmar mais rápido.</p></div><button onClick={() => navigator.clipboard.writeText(data.payment!.pixCode!)}>Copiar Pix</button></div>}<button className="rm-refresh-track" disabled={refreshing} aria-busy={refreshing} onClick={() => void manualRefresh()}>{refreshing ? "… Atualizando" : "↻ Atualizar agora"}</button></section></main>;
}
