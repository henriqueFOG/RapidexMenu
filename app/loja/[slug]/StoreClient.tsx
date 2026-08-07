"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import Image from "next/image";

type Product = {
  id: string;
  name: string;
  description: string;
  priceCents: number;
  emoji: string;
  tag: string | null;
  imageUrl: string | null;
  available: boolean;
  prepMinutes: number;
};
type SmartUpsell = {
  id: string;
  name: string;
  description: string;
  priceCents: number;
  emoji: string;
  tag: string | null;
  prepMinutes: number;
  reason: string;
};
type MenuData = {
  restaurant: {
    slug: string;
    name: string;
    city: string;
    state: string;
    whatsapp: string;
    isOpen: boolean;
    pixAvailable: boolean;
    deliveryFeeCents: number;
    minimumOrderCents: number;
    estimatedMinutes: number;
    brandColor: string;
    cuisine: string;
  };
  categories: Array<{ id: string; name: string; products: Product[] }>;
  uncategorized: Product[];
};
type CartEntry = Product & { quantity: number };
type OrderResult = {
  order: {
    id: string;
    trackingToken: string;
    number: number;
    restaurantName: string;
    totalCents: number;
    status: string;
    promisedFromMinutes: number;
    promisedToMinutes: number;
  };
  payment: {
    providerConfigured: boolean;
    status: string;
    pixCode?: string | null;
    ticketUrl?: string | null;
    qrCodeBase64?: string | null;
    expiresAt?: number;
    error?: string;
  };
};

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export default function StoreClient({ slug }: { slug: string }) {
  const [menu, setMenu] = useState<MenuData | null>(null);
  const [cart, setCart] = useState<Record<string, CartEntry>>({});
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cartOpen, setCartOpen] = useState(false);
  const [checkout, setCheckout] = useState(false);
  const [result, setResult] = useState<OrderResult | null>(null);
  const [recommendations, setRecommendations] = useState<SmartUpsell[]>([]);
  const [clientOrderId] = useState(() => typeof crypto !== "undefined" ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

  useEffect(() => {
    fetch(`/api/public/menu/${encodeURIComponent(slug)}`)
      .then(async (response) => {
        const payload = await response.json() as MenuData & { error?: { message?: string } };
        if (!response.ok) throw new Error(payload.error?.message || "Loja não encontrada.");
        return payload as MenuData;
      })
      .then(setMenu)
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Não foi possível abrir a loja."))
      .finally(() => setLoading(false));
  }, [slug]);

  const allProducts = useMemo(
    () => menu ? [...menu.categories.flatMap((item) => item.products), ...menu.uncategorized] : [],
    [menu],
  );
  const visibleProducts = allProducts.filter((product) => {
    const inCategory = category === "all" || menu?.categories.find((item) => item.id === category)?.products.some((item) => item.id === product.id);
    const term = search.trim().toLowerCase();
    return inCategory && (!term || `${product.name} ${product.description}`.toLowerCase().includes(term));
  });
  const entries = Object.values(cart);
  const selectedProductIds = useMemo(() => Object.keys(cart).sort(), [cart]);
  const selectedKey = selectedProductIds.join(",");
  const itemCount = entries.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = entries.reduce((sum, item) => sum + item.priceCents * item.quantity, 0);
  const total = subtotal + (menu?.restaurant.deliveryFeeCents || 0);

  useEffect(() => {
    if (!menu || !selectedProductIds.length) {
      setRecommendations([]);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      fetch("/api/public/recommendations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          restaurantSlug: menu.restaurant.slug,
          clientOrderId,
          productIds: selectedProductIds,
        }),
      })
        .then(async (response) => {
          const payload = await response.json() as { recommendations?: SmartUpsell[] };
          if (!response.ok) return [];
          return payload.recommendations || [];
        })
        .then(setRecommendations)
        .catch((reason) => { if (reason?.name !== "AbortError") setRecommendations([]); });
    }, 350);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [menu, clientOrderId, selectedKey, selectedProductIds]);

  const add = (product: Product) => setCart((current) => ({
    ...current,
    [product.id]: { ...product, quantity: Math.min(20, (current[product.id]?.quantity || 0) + 1) },
  }));
  const addUpsell = (product: SmartUpsell) => add({
    id: product.id,
    name: product.name,
    description: product.description,
    priceCents: product.priceCents,
    emoji: product.emoji,
    tag: product.tag,
    imageUrl: null,
    available: true,
    prepMinutes: product.prepMinutes,
  });
  const change = (product: Product, delta: number) => setCart((current) => {
    const quantity = (current[product.id]?.quantity || 0) + delta;
    const next = { ...current };
    if (quantity <= 0) delete next[product.id]; else next[product.id] = { ...product, quantity };
    return next;
  });

  if (loading) return <StoreLoading />;
  if (error || !menu) return <StoreError message={error || "Loja não encontrada."} />;

  return <main className="rm-store" style={{ "--store-accent": menu.restaurant.brandColor } as React.CSSProperties}>
    <header className="rm-store-top"><Link href="/" className="rm-store-powered"><span>⚡</span><b>Rapidex<i>Menu</i></b></Link><div><button onClick={() => document.getElementById("rm-search")?.focus()}>⌕ <span>Buscar</span></button>{menu.restaurant.whatsapp && <a href={`https://wa.me/${menu.restaurant.whatsapp}`} target="_blank" rel="noreferrer">💬 <span>WhatsApp</span></a>}</div></header>
    <section className="rm-store-cover"><div><span>🍔</span><i>⚡</i></div></section>
    <section className="rm-store-info"><div className="rm-store-logo">⚡</div><div><small>{menu.restaurant.cuisine}</small><h1>{menu.restaurant.name}</h1><p><span className={menu.restaurant.isOpen ? "open" : "closed"}>{menu.restaurant.isOpen ? "● Aberto" : "● Fechado"}</span> · {menu.restaurant.city}, {menu.restaurant.state}</p></div><div className="rm-store-facts"><span>◷ <b>{menu.restaurant.estimatedMinutes}–{menu.restaurant.estimatedMinutes + 8} min</b><small>Entrega estimada</small></span><span>🛵 <b>{currency.format(menu.restaurant.deliveryFeeCents / 100)}</b><small>Taxa de entrega</small></span><span>▣ <b>{currency.format(menu.restaurant.minimumOrderCents / 100)}</b><small>Pedido mínimo</small></span></div></section>

    <div className="rm-store-layout">
      <section className="rm-store-catalog">
        <div className="rm-store-tools"><label>⌕<input id="rm-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar no cardápio" /></label><nav><button className={category === "all" ? "active" : ""} onClick={() => setCategory("all")}>Todos</button>{menu.categories.map((item) => <button className={category === item.id ? "active" : ""} onClick={() => setCategory(item.id)} key={item.id}>{item.name}</button>)}</nav></div>
        <div className="rm-store-section-title"><div><small>FEITO NA HORA</small><h2>{category === "all" ? "Cardápio completo" : menu.categories.find((item) => item.id === category)?.name}</h2></div><span>{visibleProducts.length} opções</span></div>
        <div className="rm-store-products">{visibleProducts.map((product) => <article className={!product.available ? "unavailable" : ""} key={product.id}><div className="rm-store-product-image">{product.imageUrl ? <Image src={product.imageUrl} width={320} height={320} unoptimized alt="" /> : <span>{product.emoji}</span>}{product.tag && <small>{product.tag}</small>}</div><div className="rm-store-product-copy"><div><h3>{product.name}</h3><p>{product.description}</p></div><footer><strong>{currency.format(product.priceCents / 100)}</strong>{product.available ? cart[product.id] ? <div className="rm-qty"><button onClick={() => change(product, -1)}>−</button><b>{cart[product.id].quantity}</b><button onClick={() => add(product)}>+</button></div> : <button onClick={() => add(product)}>Adicionar +</button> : <em>Esgotado</em>}</footer></div></article>)}</div>
        {!visibleProducts.length && <div className="rm-store-empty">Nenhum item encontrado nessa busca.</div>}
      </section>

      <aside className={`rm-cart ${cartOpen ? "open" : ""}`}><header><div><small>SEU PEDIDO</small><h2>Sacola</h2></div><button onClick={() => setCartOpen(false)}>✕</button></header>{entries.length ? <><div className="rm-cart-items">{entries.map((item) => <article key={item.id}><span>{item.emoji}</span><div><b>{item.name}</b><small>{currency.format(item.priceCents / 100)} cada</small><div className="rm-qty"><button onClick={() => change(item, -1)}>−</button><strong>{item.quantity}</strong><button onClick={() => add(item)}>+</button></div></div><em>{currency.format(item.priceCents * item.quantity / 100)}</em></article>)}</div>{recommendations.length > 0 && <div style={{ margin: "8px 16px 14px", padding: 14, borderRadius: 16, background: "#f2f8df", border: "1px solid #dbe9b5" }}><small style={{ fontWeight: 900, letterSpacing: ".08em" }}>✦ RAPIDEX SUGERE</small>{recommendations.slice(0, 1).map((product) => <div key={product.id} style={{ display: "grid", gridTemplateColumns: "42px 1fr auto", gap: 10, alignItems: "center", marginTop: 10 }}><span style={{ fontSize: 26 }}>{product.emoji}</span><div><b style={{ display: "block" }}>{product.name}</b><small>{product.reason} · {currency.format(product.priceCents / 100)}</small></div><button onClick={() => addUpsell(product)} style={{ border: 0, borderRadius: 999, padding: "8px 11px", fontWeight: 900, cursor: "pointer" }}>+ Adicionar</button></div>)}</div>}<div className="rm-cart-summary"><p><span>Subtotal</span><b>{currency.format(subtotal / 100)}</b></p><p><span>Entrega</span><b>{currency.format(menu.restaurant.deliveryFeeCents / 100)}</b></p><p className="total"><span>Total</span><b>{currency.format(total / 100)}</b></p></div><button className="rm-checkout-button" disabled={!menu.restaurant.isOpen || subtotal < menu.restaurant.minimumOrderCents} onClick={() => setCheckout(true)}>{!menu.restaurant.isOpen ? "Loja fechada" : subtotal < menu.restaurant.minimumOrderCents ? `Faltam ${currency.format((menu.restaurant.minimumOrderCents - subtotal) / 100)}` : "Finalizar pedido →"}</button><small className="rm-cart-promise">🔒 Preço recalculado com segurança no servidor</small></> : <div className="rm-cart-empty"><span>🛍️</span><h3>Sua sacola está vazia</h3><p>Adicione seus favoritos para começar.</p></div>}</aside>
    </div>

    {itemCount > 0 && <button className="rm-mobile-cart" onClick={() => setCartOpen(true)}><span><b>{itemCount}</b> Ver sacola</span><strong>{currency.format(total / 100)}</strong></button>}
    {cartOpen && <button className="rm-cart-backdrop" onClick={() => setCartOpen(false)} aria-label="Fechar sacola" />}
    {checkout && <Checkout menu={menu} entries={entries} total={total} clientOrderId={clientOrderId} close={() => setCheckout(false)} done={(order) => { setCheckout(false); setResult(order); setCart({}); setRecommendations([]); setCartOpen(false); }} />}
    {result && <OrderSuccess result={result} close={() => setResult(null)} />}
  </main>;
}

function Checkout({ menu, entries, total, clientOrderId, close, done }: { menu: MenuData; entries: CartEntry[]; total: number; clientOrderId: string; close: () => void; done: (result: OrderResult) => void }) {
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [payment, setPayment] = useState(menu.restaurant.pixAvailable ? "pix" : "card_on_delivery");
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setError(""); const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/public/orders", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ restaurantSlug: menu.restaurant.slug, clientOrderId, source: "menu", customer: { name: form.get("name"), phone: form.get("phone"), email: form.get("email") || null, whatsappConsent: form.get("consent") === "on", address: { street: form.get("street"), number: form.get("number"), neighborhood: form.get("neighborhood"), city: form.get("city"), state: form.get("state"), postalCode: form.get("postalCode"), complement: form.get("complement") || null } }, items: entries.map((item) => ({ productId: item.id, quantity: item.quantity })), paymentMethod: payment }) });
      const payload = await response.json() as OrderResult & { error?: { message?: string } }; if (!response.ok) throw new Error(payload.error?.message || "Não foi possível enviar o pedido."); done(payload);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível enviar o pedido."); } finally { setBusy(false); }
  };
  return <div className="rm-modal-backdrop" onMouseDown={close}><div className="rm-checkout" onMouseDown={(event) => event.stopPropagation()}><header><div><small>ÚLTIMO PASSO</small><h2>Finalizar pedido</h2><p>Total de {currency.format(total / 100)}</p></div><button onClick={close}>✕</button></header><form onSubmit={submit}><fieldset><legend>Seus dados</legend><label>Nome<input name="name" required minLength={2} autoComplete="name" /></label><label>WhatsApp<input name="phone" required inputMode="tel" autoComplete="tel" placeholder="(24) 99999-9999" /></label><label className="wide">E-mail <small>{payment === "pix" ? "necessário para gerar o Pix" : "opcional"}</small><input name="email" required={payment === "pix"} type="email" autoComplete="email" /></label></fieldset><fieldset><legend>Endereço de entrega</legend><label className="wide">Rua<input name="street" required autoComplete="address-line1" /></label><label>Número<input name="number" required /></label><label>Complemento<input name="complement" autoComplete="address-line2" /></label><label>Bairro<input name="neighborhood" required /></label><label>CEP<input name="postalCode" required inputMode="numeric" pattern="[0-9.\- ]{8,10}" autoComplete="postal-code" /></label><label>Cidade<input name="city" required defaultValue={menu.restaurant.city} autoComplete="address-level2" /></label><label>UF<input name="state" required minLength={2} maxLength={2} defaultValue={menu.restaurant.state} autoComplete="address-level1" /></label></fieldset><fieldset><legend>Pagamento</legend><div className="rm-payment-options">{menu.restaurant.pixAvailable && <label className={payment === "pix" ? "active" : ""}><input type="radio" name="payment" value="pix" checked={payment === "pix"} onChange={() => setPayment("pix")} /><span>▦</span><b>Pix</b><small>QR Code ou copia e cola</small></label>}<label className={payment === "cash" ? "active" : ""}><input type="radio" name="payment" value="cash" checked={payment === "cash"} onChange={() => setPayment("cash")} /><span>💵</span><b>Dinheiro</b><small>Na entrega</small></label><label className={payment === "card_on_delivery" ? "active" : ""}><input type="radio" name="payment" value="card_on_delivery" checked={payment === "card_on_delivery"} onChange={() => setPayment("card_on_delivery")} /><span>▣</span><b>Cartão</b><small>Na entrega</small></label></div></fieldset><label className="rm-consent"><input name="consent" type="checkbox" /><span>Quero receber novidades e lembretes de recompra pelo WhatsApp. Posso cancelar quando quiser.</span></label>{error && <p className="rm-checkout-error">{error}</p>}<button className="rm-submit-order" disabled={busy}>{busy ? "Criando pedido seguro…" : `Confirmar · ${currency.format(total / 100)}`}</button></form></div></div>;
}

function OrderSuccess({ result, close }: { result: OrderResult; close: () => void }) {
  const [copied, setCopied] = useState(false); const pix = result.payment?.pixCode;
  return <div className="rm-modal-backdrop"><div className="rm-success-modal"><span>✓</span><small>PEDIDO RECEBIDO</small><h2>Pedido #{result.order.number}</h2><p>{result.order.restaurantName} recebeu seu pedido. Promessa segura: {result.order.promisedFromMinutes}–{result.order.promisedToMinutes} minutos.</p>{result.payment?.qrCodeBase64 && <Image className="rm-pix-qr" src={`data:image/png;base64,${result.payment.qrCodeBase64}`} width={180} height={180} unoptimized alt="QR Code Pix" />}{pix && <div className="rm-pix-code"><input readOnly value={pix} /><button onClick={async () => { await navigator.clipboard.writeText(pix); setCopied(true); }}>{copied ? "Copiado!" : "Copiar Pix"}</button></div>}{result.payment?.ticketUrl && <a className="rm-pix-link" href={result.payment.ticketUrl} target="_blank" rel="noreferrer">Abrir página de pagamento ↗</a>}{result.payment?.error && <p className="rm-payment-warning">{result.payment.error}</p>}{!result.payment?.providerConfigured && <p className="rm-payment-warning">O pedido foi criado. O Pix do restaurante ainda não está conectado; combine o pagamento diretamente com a loja.</p>}<a className="rm-track-link" href={`/acompanhar/${result.order.trackingToken}`}>Acompanhar pedido →</a><button className="rm-success-close" onClick={close}>Voltar ao cardápio</button></div></div>;
}

function StoreLoading() { return <main className="rm-store-state"><span className="rm-state-logo">⚡</span><i /><p>Abrindo cardápio…</p></main>; }
function StoreError({ message }: { message: string }) { return <main className="rm-store-state"><span className="rm-state-logo">!</span><h1>Não encontramos essa loja.</h1><p>{message}</p><Link href="/">Voltar ao RapidexMenu</Link></main>; }
