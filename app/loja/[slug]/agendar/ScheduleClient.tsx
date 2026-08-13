"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";

type FulfillmentType = "delivery" | "pickup" | "dine_in";
type PricingStrategy = "sum" | "highest" | "average" | "included";
type Option = { id: string; name: string; priceDeltaCents: number };
type OptionGroup = { id: string; name: string; minSelect: number; maxSelect: number; pricingStrategy: PricingStrategy; options: Option[] };
type Product = { id: string; name: string; description: string; priceCents: number; emoji: string; available: boolean; optionGroups: OptionGroup[] };
type Menu = {
  restaurant: {
    slug: string;
    name: string;
    city: string;
    state: string;
    isOpen: boolean;
    deliveryFeeCents: number;
    minimumOrderCents: number;
    brandColor: string;
    fulfillment: { deliveryEnabled: boolean; pickupEnabled: boolean; dineInEnabled: boolean };
  };
  categories: Array<{ id: string; name: string; products: Product[] }>;
  uncategorized: Product[];
};
type Choice = { quantity: number; selected: Record<string, string[]> };
type Quote = { zoneName: string | null; feeCents: number; minimumOrderCents: number; deliveryMinutes: number };
type Result = { order: { number: number; trackingToken: string; scheduledFor: number; totalCents: number } };

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export default function ScheduleClient({ slug }: { slug: string }) {
  const [menu, setMenu] = useState<Menu | null>(null);
  const [choices, setChoices] = useState<Record<string, Choice>>({});
  const [mode, setMode] = useState<FulfillmentType>("pickup");
  const [schedule, setSchedule] = useState(() => localDateTime(Date.now() + 60 * 60_000));
  const [postalCode, setPostalCode] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteError, setQuoteError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [clientOrderId] = useState(() => crypto.randomUUID());

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/public/menu/${encodeURIComponent(slug)}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json() as Menu & { error?: { message?: string } };
        if (!response.ok) throw new Error(payload.error?.message || "Loja não encontrada.");
        return payload;
      })
      .then((payload) => {
        setMenu(payload);
        const f = payload.restaurant.fulfillment;
        if (f.pickupEnabled) setMode("pickup");
        else if (f.deliveryEnabled) setMode("delivery");
        else if (f.dineInEnabled) setMode("dine_in");
      })
      .catch((reason) => {
        if (reason?.name !== "AbortError") setError(reason instanceof Error ? reason.message : "Não foi possível abrir o agendamento.");
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [slug]);

  useEffect(() => {
    if (mode !== "delivery") {
      setQuote(null);
      setQuoteError("");
      return;
    }
    const cep = postalCode.replace(/\D/g, "");
    if (cep.length !== 8 || neighborhood.trim().length < 2) {
      setQuote(null);
      setQuoteError("");
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      fetch("/api/public/delivery-quote", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ restaurantSlug: slug, postalCode: cep, neighborhood }),
        signal: controller.signal,
      })
        .then(async (response) => {
          const payload = await response.json() as { quote?: Quote; error?: { message?: string } };
          if (!response.ok || !payload.quote) throw new Error(payload.error?.message || "Área de entrega não confirmada.");
          return payload.quote;
        })
        .then((value) => { setQuote(value); setQuoteError(""); })
        .catch((reason) => {
          if (reason?.name === "AbortError") return;
          setQuote(null);
          setQuoteError(reason instanceof Error ? reason.message : "Área de entrega não confirmada.");
        });
    }, 300);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [mode, neighborhood, postalCode, slug]);

  const products = useMemo(() => menu ? [...menu.categories.flatMap((category) => category.products), ...menu.uncategorized] : [], [menu]);
  const selectedItems = products.filter((product) => (choices[product.id]?.quantity || 0) > 0);
  const subtotal = selectedItems.reduce((sum, product) => sum + configuredPrice(product, choices[product.id]?.selected || {}) * choices[product.id].quantity, 0);
  const deliveryFee = mode === "delivery" ? (quote?.feeCents ?? menu?.restaurant.deliveryFeeCents ?? 0) : 0;
  const total = subtotal + deliveryFee;
  const minimum = mode === "delivery" ? (quote?.minimumOrderCents ?? menu?.restaurant.minimumOrderCents ?? 0) : 0;
  const selectionsValid = selectedItems.every((product) => validSelection(product, choices[product.id]?.selected || {}));
  const deliveryReady = mode !== "delivery" || Boolean(quote && !quoteError);

  const changeQuantity = (product: Product, delta: number) => setChoices((current) => {
    const existing = current[product.id] || { quantity: 0, selected: {} };
    return { ...current, [product.id]: { ...existing, quantity: Math.max(0, Math.min(20, existing.quantity + delta)) } };
  });
  const toggleOption = (product: Product, group: OptionGroup, optionId: string) => setChoices((current) => {
    const item = current[product.id] || { quantity: 0, selected: {} };
    const values = item.selected[group.id] || [];
    let next: string[];
    if (values.includes(optionId)) next = values.filter((id) => id !== optionId);
    else if (group.maxSelect === 1) next = [optionId];
    else if (values.length >= group.maxSelect) next = values;
    else next = [...values, optionId];
    return { ...current, [product.id]: { ...item, selected: { ...item.selected, [group.id]: next } } };
  });

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!selectedItems.length) return setError("Adicione pelo menos um item ao pedido.");
    if (!selectionsValid) return setError("Complete as escolhas obrigatórias dos produtos selecionados.");
    if (subtotal < minimum) return setError(`O pedido mínimo é ${money.format(minimum / 100)}.`);
    if (!deliveryReady) return setError("Confirme CEP e bairro antes de agendar a entrega.");
    const scheduledFor = new Date(schedule).getTime();
    if (!Number.isFinite(scheduledFor)) return setError("Informe uma data e hora válidas.");

    const form = new FormData(event.currentTarget);
    setBusy(true);
    try {
      const address = mode === "delivery" ? {
        street: form.get("street"),
        number: form.get("number"),
        complement: form.get("complement") || null,
        neighborhood: form.get("neighborhood"),
        city: form.get("city"),
        state: form.get("state"),
        postalCode: form.get("postalCode"),
      } : null;
      const response = await fetch("/api/public/scheduled-orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          restaurantSlug: slug,
          clientOrderId,
          source: "menu",
          scheduledFor,
          fulfillmentType: mode,
          tableCode: mode === "dine_in" ? form.get("tableCode") : null,
          customer: {
            name: form.get("name"),
            phone: form.get("phone"),
            email: form.get("email") || null,
            whatsappConsent: form.get("consent") === "on",
            address,
          },
          items: selectedItems.map((product) => ({
            productId: product.id,
            quantity: choices[product.id].quantity,
            optionIds: Object.values(choices[product.id].selected).flat(),
          })),
          paymentMethod: form.get("payment"),
          notes: form.get("notes") || null,
        }),
      });
      const payload = await response.json() as Result & { error?: { message?: string } };
      if (!response.ok) throw new Error(payload.error?.message || "Não foi possível agendar o pedido.");
      setResult(payload);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível agendar o pedido.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <main style={stateStyle}><b>⚡ RapidexMenu</b><p>Carregando agendamento…</p></main>;
  if (!menu) return <main style={stateStyle}><b>Não foi possível abrir o agendamento.</b><p>{error}</p><Link href={`/loja/${slug}`}>Voltar ao cardápio</Link></main>;
  if (result) return <main style={stateStyle}><span style={{ fontSize: 48 }}>✓</span><h1>Pedido #{result.order.number} agendado</h1><p>Horário reservado para {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(result.order.scheduledFor))}.</p><strong>Total: {money.format(result.order.totalCents / 100)}</strong><Link href={`/acompanhar/${result.order.trackingToken}`} style={primaryLink}>Acompanhar pedido</Link><Link href={`/loja/${slug}`}>Voltar ao cardápio</Link></main>;

  const f = menu.restaurant.fulfillment;
  return <main style={{ minHeight: "100vh", background: "#f6f5f2", padding: "24px 14px 60px", color: "#171717" }}>
    <div style={{ maxWidth: 940, margin: "0 auto" }}>
      <header style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", marginBottom: 20 }}><div><small style={{ fontWeight: 900, color: menu.restaurant.brandColor }}>⚡ RAPIDEXMENU</small><h1 style={{ margin: "4px 0" }}>Agendar pedido · {menu.restaurant.name}</h1><p style={{ margin: 0, color: "#666" }}>Reserve um horário com antecedência e acompanhe pelo mesmo link de um pedido comum.</p></div><Link href={`/loja/${slug}`}>← Cardápio normal</Link></header>

      {!menu.restaurant.isOpen && <div style={warningStyle}><b>Agendamento temporariamente indisponível.</b><br/><small>A loja está pausada ou fora do horário de recebimento neste momento. Tente novamente quando o atendimento online estiver ativo.</small></div>}

      <form onSubmit={submit} style={{ display: "grid", gap: 18 }}>
        <section style={cardStyle}><h2>1. Escolha o horário</h2><label style={labelStyle}>Data e hora<input type="datetime-local" value={schedule} onChange={(event) => setSchedule(event.target.value)} min={localDateTime(Date.now() + 30 * 60_000)} max={localDateTime(Date.now() + 14 * 24 * 60 * 60_000)} required style={inputStyle} /></label><small>Antecedência mínima de 30 minutos e máxima de 14 dias. A disponibilidade do horário é validada no servidor.</small></section>

        <section style={cardStyle}><h2>2. Como receber</h2><div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>{f.deliveryEnabled && <ModeButton active={mode === "delivery"} onClick={() => setMode("delivery")}>🛵 Entrega</ModeButton>}{f.pickupEnabled && <ModeButton active={mode === "pickup"} onClick={() => setMode("pickup")}>🛍️ Retirada</ModeButton>}{f.dineInEnabled && <ModeButton active={mode === "dine_in"} onClick={() => setMode("dine_in")}>🍽️ Mesa</ModeButton>}</div></section>

        <section style={cardStyle}><h2>3. Itens</h2><div style={{ display: "grid", gap: 12 }}>{products.map((product) => {
          const choice = choices[product.id] || { quantity: 0, selected: {} };
          const active = choice.quantity > 0;
          return <article key={product.id} style={{ border: active ? `2px solid ${menu.restaurant.brandColor}` : "1px solid #e3e3e3", borderRadius: 14, padding: 14, opacity: product.available ? 1 : .55 }}><div style={{ display: "grid", gridTemplateColumns: "44px 1fr auto", gap: 12, alignItems: "center" }}><span style={{ fontSize: 30 }}>{product.emoji}</span><div><b>{product.name}</b><p style={{ margin: "3px 0", color: "#666", fontSize: 13 }}>{product.description}</p><strong>{money.format(configuredPrice(product, choice.selected) / 100)}</strong></div><div style={{ display: "flex", alignItems: "center", gap: 8 }}><button type="button" onClick={() => changeQuantity(product, -1)} disabled={!active}>−</button><b>{choice.quantity}</b><button type="button" onClick={() => changeQuantity(product, 1)} disabled={!product.available}>+</button></div></div>{active && product.optionGroups.map((group) => <fieldset key={group.id} style={{ border: 0, borderTop: "1px solid #eee", margin: "12px 0 0", padding: "12px 0 0" }}><legend style={{ fontWeight: 800 }}>{group.name} <small>({rule(group)})</small></legend><div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>{group.options.map((option) => {
            const checked = (choice.selected[group.id] || []).includes(option.id);
            return <label key={option.id} style={{ border: checked ? `2px solid ${menu.restaurant.brandColor}` : "1px solid #ddd", borderRadius: 999, padding: "7px 10px", cursor: "pointer" }}><input type={group.maxSelect === 1 ? "radio" : "checkbox"} name={`p-${product.id}-g-${group.id}`} checked={checked} onChange={() => toggleOption(product, group, option.id)} /> {option.name}{option.priceDeltaCents > 0 ? ` +${money.format(option.priceDeltaCents / 100)}` : ""}</label>;
          })}</div></fieldset>)}</article>;
        })}</div></section>

        <section style={cardStyle}><h2>4. Seus dados</h2><div style={gridStyle}><label style={labelStyle}>Nome<input name="name" minLength={2} required style={inputStyle} /></label><label style={labelStyle}>WhatsApp<input name="phone" required inputMode="tel" style={inputStyle} /></label><label style={labelStyle}>E-mail<input name="email" type="email" style={inputStyle} /></label>{mode === "dine_in" && <label style={labelStyle}>Mesa<input name="tableCode" required maxLength={30} style={inputStyle} /></label>}</div>
          {mode === "delivery" && <div style={{ ...gridStyle, marginTop: 14 }}><label style={{ ...labelStyle, gridColumn: "1 / -1" }}>Rua<input name="street" required style={inputStyle} /></label><label style={labelStyle}>Número<input name="number" required style={inputStyle} /></label><label style={labelStyle}>Complemento<input name="complement" style={inputStyle} /></label><label style={labelStyle}>Bairro<input name="neighborhood" required value={neighborhood} onChange={(event) => setNeighborhood(event.target.value)} style={inputStyle} /></label><label style={labelStyle}>CEP<input name="postalCode" required value={postalCode} onChange={(event) => setPostalCode(event.target.value)} inputMode="numeric" style={inputStyle} /></label><label style={labelStyle}>Cidade<input name="city" defaultValue={menu.restaurant.city} required style={inputStyle} /></label><label style={labelStyle}>UF<input name="state" defaultValue={menu.restaurant.state} required maxLength={2} style={inputStyle} /></label><div style={{ gridColumn: "1 / -1", ...(quoteError ? warningStyle : infoStyle) }}>{quoteError ? quoteError : quote ? `${quote.zoneName ? `${quote.zoneName} · ` : ""}frete ${money.format(quote.feeCents / 100)} · mínimo ${quote.minimumOrderCents ? money.format(quote.minimumOrderCents / 100) : "sem mínimo"}` : "Informe CEP e bairro para validar a entrega."}</div></div>}
          <label style={{ ...labelStyle, marginTop: 14 }}>Observações<textarea name="notes" maxLength={500} rows={3} style={inputStyle} /></label><label style={{ display: "flex", gap: 8, marginTop: 12 }}><input type="checkbox" name="consent" /> Quero receber novidades e lembretes pelo WhatsApp.</label>
        </section>

        <section style={cardStyle}><h2>5. Pagamento no atendimento</h2><p style={{ color: "#666" }}>O Pix de pedidos agendados fica desabilitado até concluirmos a homologação financeira desse fluxo.</p><label style={{ display: "block", margin: "8px 0" }}><input type="radio" name="payment" value="card_on_delivery" defaultChecked /> Cartão {mode === "delivery" ? "na entrega" : mode === "pickup" ? "na retirada" : "no atendimento"}</label><label style={{ display: "block" }}><input type="radio" name="payment" value="cash" /> Dinheiro {mode === "delivery" ? "na entrega" : mode === "pickup" ? "na retirada" : "no atendimento"}</label></section>

        <section style={{ ...cardStyle, position: "sticky", bottom: 12, boxShadow: "0 8px 30px rgba(0,0,0,.12)" }}><div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center" }}><div><small>Subtotal {money.format(subtotal / 100)}{mode === "delivery" ? ` · entrega ${money.format(deliveryFee / 100)}` : ""}</small><h2 style={{ margin: "3px 0" }}>{money.format(total / 100)}</h2>{minimum > subtotal && <small style={{ color: "#b23b2c" }}>Faltam {money.format((minimum - subtotal) / 100)} para o mínimo.</small>}</div><button disabled={busy || !menu.restaurant.isOpen || !selectedItems.length || !selectionsValid || !deliveryReady || subtotal < minimum} style={{ border: 0, borderRadius: 999, padding: "14px 20px", background: menu.restaurant.brandColor, color: "#fff", fontWeight: 900, cursor: "pointer", opacity: busy ? .6 : 1 }}>{busy ? "Reservando…" : "Agendar pedido"}</button></div>{error && <p style={{ color: "#b23b2c", marginBottom: 0 }}>{error}</p>}</section>
      </form>
    </div>
  </main>;
}

function validSelection(product: Product, selected: Record<string, string[]>) {
  return product.optionGroups.every((group) => {
    const count = (selected[group.id] || []).length;
    return count >= group.minSelect && count <= group.maxSelect;
  });
}

function configuredPrice(product: Product, selected: Record<string, string[]>) {
  return product.priceCents + product.optionGroups.reduce((total, group) => {
    const values = group.options.filter((option) => (selected[group.id] || []).includes(option.id)).map((option) => option.priceDeltaCents);
    if (!values.length || group.pricingStrategy === "included") return total;
    if (group.pricingStrategy === "highest") return total + Math.max(...values);
    if (group.pricingStrategy === "average") return total + Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
    return total + values.reduce((sum, value) => sum + value, 0);
  }, 0);
}

function rule(group: OptionGroup) {
  if (group.minSelect === group.maxSelect) return `escolha ${group.minSelect}`;
  if (group.minSelect === 0) return `até ${group.maxSelect}`;
  return `${group.minSelect} a ${group.maxSelect}`;
}

function localDateTime(timestamp: number) {
  const date = new Date(timestamp - new Date(timestamp).getTimezoneOffset() * 60_000);
  return date.toISOString().slice(0, 16);
}

function ModeButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" aria-pressed={active} onClick={onClick} style={{ border: active ? "2px solid #171717" : "1px solid #ddd", borderRadius: 999, background: active ? "#fff1df" : "#fff", padding: "9px 13px", fontWeight: 800, cursor: "pointer" }}>{children}</button>;
}

const cardStyle: React.CSSProperties = { background: "#fff", border: "1px solid #e5e3df", borderRadius: 18, padding: 18 };
const stateStyle: React.CSSProperties = { minHeight: "100vh", display: "grid", placeContent: "center", textAlign: "center", gap: 12, padding: 24 };
const gridStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12 };
const labelStyle: React.CSSProperties = { display: "grid", gap: 6, fontWeight: 800 };
const inputStyle: React.CSSProperties = { width: "100%", boxSizing: "border-box", border: "1px solid #ccc", borderRadius: 10, padding: "10px 11px", font: "inherit" };
const warningStyle: React.CSSProperties = { background: "#fff0ed", border: "1px solid #efb9ae", borderRadius: 12, padding: 12, color: "#7f2e20" };
const infoStyle: React.CSSProperties = { background: "#f4f7ef", border: "1px solid #d9e1cf", borderRadius: 12, padding: 12 };
const primaryLink: React.CSSProperties = { display: "inline-block", borderRadius: 999, padding: "11px 16px", background: "#171717", color: "#fff", textDecoration: "none", fontWeight: 900 };
