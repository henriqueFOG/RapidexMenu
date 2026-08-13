"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import Image from "next/image";

type FulfillmentType = "delivery" | "pickup" | "dine_in";
type PricingStrategy = "sum" | "highest" | "average" | "included";
type ProductOption = { id: string; name: string; priceDeltaCents: number };
type ProductOptionGroup = {
  id: string;
  name: string;
  minSelect: number;
  maxSelect: number;
  pricingStrategy: PricingStrategy;
  options: ProductOption[];
};
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
  optionGroups: ProductOptionGroup[];
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
    prepMinutes: number;
    deliveryMinutes: number;
    estimatedMinutes: number;
    brandColor: string;
    cuisine: string;
    fulfillment: {
      deliveryEnabled: boolean;
      pickupEnabled: boolean;
      dineInEnabled: boolean;
    };
  };
  categories: Array<{ id: string; name: string; products: Product[] }>;
  uncategorized: Product[];
};
type DeliveryQuote = {
  zoneName: string | null;
  matched: boolean;
  coverageRestricted: boolean;
  feeCents: number;
  minimumOrderCents: number;
  deliveryMinutes: number;
};
type CartEntry = Product & {
  cartKey: string;
  quantity: number;
  optionIds: string[];
  optionSummary: string;
  unitPriceCents: number;
};
type OrderResult = {
  order: {
    id: string;
    trackingToken: string;
    number: number;
    restaurantName: string;
    totalCents: number;
    status: string;
    fulfillmentType: FulfillmentType;
    tableCode?: string | null;
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
  const [fulfillmentType, setFulfillmentType] = useState<FulfillmentType>("delivery");
  const [tableCode, setTableCode] = useState("");
  const [customizing, setCustomizing] = useState<Product | null>(null);
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

  useEffect(() => {
    if (!menu) return;
    const params = new URLSearchParams(window.location.search);
    const requestedTable = (params.get("mesa") || "").trim().slice(0, 30);
    if (requestedTable && menu.restaurant.fulfillment.dineInEnabled) {
      setTableCode(requestedTable);
      setFulfillmentType("dine_in");
      return;
    }
    if (menu.restaurant.fulfillment.deliveryEnabled) setFulfillmentType("delivery");
    else if (menu.restaurant.fulfillment.pickupEnabled) setFulfillmentType("pickup");
    else if (menu.restaurant.fulfillment.dineInEnabled) setFulfillmentType("dine_in");
  }, [menu]);

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
  const selectedProductIds = useMemo(() => Array.from(new Set(entries.map((entry) => entry.id))).sort(), [entries]);
  const selectedKey = selectedProductIds.join(",");
  const itemCount = entries.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = entries.reduce((sum, item) => sum + item.unitPriceCents * item.quantity, 0);
  const deliveryActive = fulfillmentType === "delivery";
  const deliveryFee = deliveryActive ? (menu?.restaurant.deliveryFeeCents || 0) : 0;
  const total = subtotal + deliveryFee;
  const minimumRequired = deliveryActive ? (menu?.restaurant.minimumOrderCents || 0) : 0;
  const estimatedMinutes = menu
    ? menu.restaurant.prepMinutes + (deliveryActive ? menu.restaurant.deliveryMinutes : 0)
    : 0;

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

  const addConfigured = (product: Product, optionIds: string[]) => {
    const normalizedIds = Array.from(new Set(optionIds)).sort();
    const cartKey = `${product.id}|${normalizedIds.join(",")}`;
    const unitPriceCents = configuredPrice(product, normalizedIds);
    const optionSummary = configuredSummary(product, normalizedIds);
    setCart((current) => ({
      ...current,
      [cartKey]: {
        ...product,
        cartKey,
        optionIds: normalizedIds,
        optionSummary,
        unitPriceCents,
        quantity: Math.min(20, (current[cartKey]?.quantity || 0) + 1),
      },
    }));
  };
  const addProduct = (product: Product) => {
    if (product.optionGroups?.length) setCustomizing(product);
    else addConfigured(product, []);
  };
  const addUpsell = (product: SmartUpsell) => {
    const actual = allProducts.find((item) => item.id === product.id);
    if (actual) addProduct(actual);
  };
  const change = (entry: CartEntry, delta: number) => setCart((current) => {
    const quantity = (current[entry.cartKey]?.quantity || 0) + delta;
    const next = { ...current };
    if (quantity <= 0) delete next[entry.cartKey];
    else next[entry.cartKey] = { ...entry, quantity: Math.min(20, quantity) };
    return next;
  });

  if (loading) return <StoreLoading />;
  if (error || !menu) return <StoreError message={error || "Loja não encontrada."} />;

  const fulfillment = menu.restaurant.fulfillment;
  const modeCount = Number(fulfillment.deliveryEnabled) + Number(fulfillment.pickupEnabled) + Number(fulfillment.dineInEnabled);
  const fulfillmentLabel = fulfillmentType === "delivery" ? "Entrega" : fulfillmentType === "pickup" ? "Retirada" : `Mesa${tableCode ? ` ${tableCode}` : ""}`;

  return <main className="rm-store" style={{ "--store-accent": menu.restaurant.brandColor } as React.CSSProperties}>
    <header className="rm-store-top"><Link href="/" className="rm-store-powered"><span>⚡</span><b>Rapidex<i>Menu</i></b></Link><div><button onClick={() => document.getElementById("rm-search")?.focus()}>⌕ <span>Buscar</span></button>{menu.restaurant.whatsapp && <a href={`https://wa.me/${menu.restaurant.whatsapp}`} target="_blank" rel="noreferrer">💬 <span>WhatsApp</span></a>}</div></header>
    <section className="rm-store-cover"><div><span>🍔</span><i>⚡</i></div></section>
    <section className="rm-store-info"><div className="rm-store-logo">⚡</div><div><small>{menu.restaurant.cuisine}</small><h1>{menu.restaurant.name}</h1><p><span className={menu.restaurant.isOpen ? "open" : "closed"}>{menu.restaurant.isOpen ? "● Aberto" : "● Fechado"}</span> · {menu.restaurant.city}, {menu.restaurant.state}</p></div><div className="rm-store-facts"><span>◷ <b>{estimatedMinutes}–{estimatedMinutes + 8} min</b><small>{deliveryActive ? "Entrega estimada" : "Preparo estimado"}</small></span><span>{deliveryActive ? "🛵" : fulfillmentType === "pickup" ? "🛍️" : "🍽️"} <b>{deliveryActive ? currency.format(deliveryFee / 100) : fulfillmentLabel}</b><small>{deliveryActive ? "Taxa de entrega" : "Modalidade"}</small></span><span>▣ <b>{minimumRequired ? currency.format(minimumRequired / 100) : "Sem mínimo"}</b><small>Pedido mínimo</small></span></div></section>

    <div className="rm-store-layout">
      <section className="rm-store-catalog">
        {modeCount > 1 && <div aria-label="Como você quer receber o pedido?" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14, padding: 12, border: "1px solid #e4e4e4", borderRadius: 16, background: "#fff" }}>
          <strong style={{ width: "100%", fontSize: 13 }}>Como você quer receber?</strong>
          {fulfillment.deliveryEnabled && <button type="button" aria-pressed={fulfillmentType === "delivery"} onClick={() => setFulfillmentType("delivery")} style={modeButton(fulfillmentType === "delivery")}>🛵 Entrega</button>}
          {fulfillment.pickupEnabled && <button type="button" aria-pressed={fulfillmentType === "pickup"} onClick={() => setFulfillmentType("pickup")} style={modeButton(fulfillmentType === "pickup")}>🛍️ Retirada</button>}
          {fulfillment.dineInEnabled && <button type="button" aria-pressed={fulfillmentType === "dine_in"} onClick={() => setFulfillmentType("dine_in")} style={modeButton(fulfillmentType === "dine_in")}>🍽️ Consumir no local</button>}
          {fulfillmentType === "dine_in" && <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 800 }}>Mesa <input aria-label="Número ou identificação da mesa" value={tableCode} onChange={(event) => setTableCode(event.target.value.slice(0, 30))} placeholder="Ex.: 12" style={{ width: 90, padding: "8px 10px", border: "1px solid #ccc", borderRadius: 10 }} /></label>}
        </div>}
        <div className="rm-store-tools"><label>⌕<input id="rm-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar no cardápio" /></label><nav><button className={category === "all" ? "active" : ""} onClick={() => setCategory("all")}>Todos</button>{menu.categories.map((item) => <button className={category === item.id ? "active" : ""} onClick={() => setCategory(item.id)} key={item.id}>{item.name}</button>)}</nav></div>
        <div className="rm-store-section-title"><div><small>FEITO NA HORA</small><h2>{category === "all" ? "Cardápio completo" : menu.categories.find((item) => item.id === category)?.name}</h2></div><span>{visibleProducts.length} opções</span></div>
        <div className="rm-store-products">{visibleProducts.map((product) => <article className={!product.available ? "unavailable" : ""} key={product.id}><div className="rm-store-product-image">{product.imageUrl ? <Image src={product.imageUrl} width={320} height={320} unoptimized alt="" /> : <span>{product.emoji}</span>}{product.tag && <small>{product.tag}</small>}</div><div className="rm-store-product-copy"><div><h3>{product.name}</h3><p>{product.description}</p>{product.optionGroups?.length > 0 && <small style={{ fontWeight: 800 }}>{product.optionGroups.map((group) => group.name).join(" · ")}</small>}</div><footer><strong>{product.optionGroups?.length ? `A partir de ${currency.format(product.priceCents / 100)}` : currency.format(product.priceCents / 100)}</strong>{product.available ? <button onClick={() => addProduct(product)}>{product.optionGroups?.length ? "Personalizar" : "Adicionar +"}</button> : <em>Esgotado</em>}</footer></div></article>)}</div>
        {!visibleProducts.length && <div className="rm-store-empty">Nenhum item encontrado nessa busca.</div>}
      </section>

      <aside className={`rm-cart ${cartOpen ? "open" : ""}`}><header><div><small>SEU PEDIDO · {fulfillmentLabel.toUpperCase()}</small><h2>Sacola</h2></div><button onClick={() => setCartOpen(false)}>✕</button></header>{entries.length ? <><div className="rm-cart-items">{entries.map((item) => <article key={item.cartKey}><span>{item.emoji}</span><div><b>{item.name}</b>{item.optionSummary && <small>{item.optionSummary}</small>}<small>{currency.format(item.unitPriceCents / 100)} cada</small><div className="rm-qty"><button onClick={() => change(item, -1)}>−</button><strong>{item.quantity}</strong><button onClick={() => change(item, 1)}>+</button></div></div><em>{currency.format(item.unitPriceCents * item.quantity / 100)}</em></article>)}</div>{recommendations.length > 0 && <div style={{ margin: "8px 16px 14px", padding: 14, borderRadius: 16, background: "#f2f8df", border: "1px solid #dbe9b5" }}><small style={{ fontWeight: 900, letterSpacing: ".08em" }}>✦ RAPIDEX SUGERE</small>{recommendations.slice(0, 1).map((product) => <div key={product.id} style={{ display: "grid", gridTemplateColumns: "42px 1fr auto", gap: 10, alignItems: "center", marginTop: 10 }}><span style={{ fontSize: 26 }}>{product.emoji}</span><div><b style={{ display: "block" }}>{product.name}</b><small>{product.reason} · {currency.format(product.priceCents / 100)}</small></div><button onClick={() => addUpsell(product)} style={{ border: 0, borderRadius: 999, padding: "8px 11px", fontWeight: 900, cursor: "pointer" }}>+ Adicionar</button></div>)}</div>}<div className="rm-cart-summary"><p><span>Subtotal</span><b>{currency.format(subtotal / 100)}</b></p><p><span>{deliveryActive ? "Entrega" : fulfillmentType === "pickup" ? "Retirada" : "Atendimento no local"}</span><b>{deliveryActive ? currency.format(deliveryFee / 100) : "R$ 0,00"}</b></p><p className="total"><span>Total</span><b>{currency.format(total / 100)}</b></p></div><button className="rm-checkout-button" disabled={!menu.restaurant.isOpen || subtotal < minimumRequired || (fulfillmentType === "dine_in" && !tableCode.trim())} onClick={() => setCheckout(true)}>{!menu.restaurant.isOpen ? "Loja fechada" : fulfillmentType === "dine_in" && !tableCode.trim() ? "Informe a mesa" : subtotal < minimumRequired ? `Faltam ${currency.format((minimumRequired - subtotal) / 100)}` : "Finalizar pedido →"}</button><small className="rm-cart-promise">🔒 Preço, opções e modalidade validados novamente no servidor</small></> : <div className="rm-cart-empty"><span>🛍️</span><h3>Sua sacola está vazia</h3><p>Adicione seus favoritos para começar.</p></div>}</aside>
    </div>

    {itemCount > 0 && <button className="rm-mobile-cart" onClick={() => setCartOpen(true)}><span><b>{itemCount}</b> Ver sacola</span><strong>{currency.format(total / 100)}</strong></button>}
    {cartOpen && <button className="rm-cart-backdrop" onClick={() => setCartOpen(false)} aria-label="Fechar sacola" />}
    {customizing && <ProductCustomizer product={customizing} close={() => setCustomizing(null)} add={(optionIds) => { addConfigured(customizing, optionIds); setCustomizing(null); }} />}
    {checkout && <Checkout menu={menu} entries={entries} total={total} clientOrderId={clientOrderId} fulfillmentType={fulfillmentType} tableCode={tableCode.trim()} close={() => setCheckout(false)} done={(order) => { setCheckout(false); setResult(order); setCart({}); setRecommendations([]); setCartOpen(false); }} />}
    {result && <OrderSuccess result={result} close={() => setResult(null)} />}
  </main>;
}

function ProductCustomizer({ product, close, add }: { product: Product; close: () => void; add: (optionIds: string[]) => void }) {
  const [selected, setSelected] = useState<Record<string, string[]>>({});
  const selectedIds = product.optionGroups.flatMap((group) => selected[group.id] || []);
  const valid = product.optionGroups.every((group) => {
    const count = (selected[group.id] || []).length;
    return count >= group.minSelect && count <= group.maxSelect;
  });
  const price = configuredPrice(product, selectedIds);

  const toggle = (group: ProductOptionGroup, optionId: string) => {
    setSelected((current) => {
      const values = current[group.id] || [];
      if (values.includes(optionId)) return { ...current, [group.id]: values.filter((id) => id !== optionId) };
      if (group.maxSelect === 1) return { ...current, [group.id]: [optionId] };
      if (values.length >= group.maxSelect) return current;
      return { ...current, [group.id]: [...values, optionId] };
    });
  };

  return <div className="rm-modal-backdrop" onMouseDown={close}><div className="rm-checkout" onMouseDown={(event) => event.stopPropagation()} style={{ maxWidth: 640 }}>
    <header><div><small>PERSONALIZE SEU PEDIDO</small><h2>{product.emoji} {product.name}</h2><p>{product.description}</p></div><button onClick={close}>✕</button></header>
    <div style={{ padding: "0 20px 20px", display: "grid", gap: 14 }}>
      {product.optionGroups.map((group) => {
        const chosen = selected[group.id] || [];
        return <fieldset key={group.id} style={{ border: "1px solid #e5e5e5", borderRadius: 14, padding: 14 }}><legend style={{ fontWeight: 900 }}>{group.name}</legend><small style={{ display: "block", marginBottom: 10 }}>{selectionRule(group)}</small><div style={{ display: "grid", gap: 8 }}>{group.options.map((option) => {
          const checked = chosen.includes(option.id);
          return <label key={option.id} style={{ display: "grid", gridTemplateColumns: "24px 1fr auto", gap: 10, alignItems: "center", padding: 10, border: checked ? "2px solid var(--store-accent)" : "1px solid #ddd", borderRadius: 12, cursor: "pointer" }}><input type={group.maxSelect === 1 ? "radio" : "checkbox"} name={`option-${group.id}`} checked={checked} onChange={() => toggle(group, option.id)} /><b>{option.name}</b><span>{option.priceDeltaCents > 0 ? `+ ${currency.format(option.priceDeltaCents / 100)}` : "Incluído"}</span></label>;
        })}</div></fieldset>;
      })}
      <button className="rm-submit-order" disabled={!valid} onClick={() => add(selectedIds)}>{valid ? `Adicionar · ${currency.format(price / 100)}` : "Complete as escolhas obrigatórias"}</button>
    </div>
  </div></div>;
}

function Checkout({ menu, entries, total, clientOrderId, fulfillmentType, tableCode, close, done }: { menu: MenuData; entries: CartEntry[]; total: number; clientOrderId: string; fulfillmentType: FulfillmentType; tableCode: string; close: () => void; done: (result: OrderResult) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [payment, setPayment] = useState(menu.restaurant.pixAvailable ? "pix" : "card_on_delivery");
  const [postalCode, setPostalCode] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [deliveryQuote, setDeliveryQuote] = useState<DeliveryQuote | null>(null);
  const [quoteBusy, setQuoteBusy] = useState(false);
  const [quoteError, setQuoteError] = useState("");
  const subtotal = entries.reduce((sum, item) => sum + item.unitPriceCents * item.quantity, 0);

  useEffect(() => {
    if (fulfillmentType !== "delivery") {
      setDeliveryQuote(null);
      setQuoteError("");
      setQuoteBusy(false);
      return;
    }
    const normalizedPostalCode = postalCode.replace(/\D/g, "");
    if (normalizedPostalCode.length !== 8 || neighborhood.trim().length < 2) {
      setDeliveryQuote(null);
      setQuoteError("");
      setQuoteBusy(false);
      return;
    }

    setDeliveryQuote(null);
    setQuoteError("");
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setQuoteBusy(true);
      fetch("/api/public/delivery-quote", {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          restaurantSlug: menu.restaurant.slug,
          postalCode: normalizedPostalCode,
          neighborhood: neighborhood.trim(),
        }),
      })
        .then(async (response) => {
          const payload = await response.json() as {
            quote?: DeliveryQuote;
            error?: { code?: string; message?: string };
          };
          if (!response.ok || !payload.quote) {
            throw new Error(payload.error?.message || "Não foi possível confirmar a entrega para este endereço.");
          }
          return payload.quote;
        })
        .then((quote) => {
          setDeliveryQuote(quote);
          setQuoteError("");
        })
        .catch((reason) => {
          if (reason instanceof DOMException && reason.name === "AbortError") return;
          setDeliveryQuote(null);
          setQuoteError(reason instanceof Error ? reason.message : "Não foi possível confirmar a entrega.");
        })
        .finally(() => {
          if (!controller.signal.aborted) setQuoteBusy(false);
        });
    }, 350);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [fulfillmentType, menu.restaurant.slug, neighborhood, postalCode]);

  const deliveryFeeCents = fulfillmentType === "delivery"
    ? (deliveryQuote?.feeCents ?? menu.restaurant.deliveryFeeCents)
    : 0;
  const minimumOrderCents = fulfillmentType === "delivery"
    ? (deliveryQuote?.minimumOrderCents ?? menu.restaurant.minimumOrderCents)
    : 0;
  const checkoutTotal = fulfillmentType === "delivery" ? subtotal + deliveryFeeCents : total;
  const deliveryReady = fulfillmentType !== "delivery" || Boolean(deliveryQuote && !quoteError);
  const minimumMet = fulfillmentType !== "delivery" || subtotal >= minimumOrderCents;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    if (fulfillmentType === "delivery" && !deliveryReady) {
      setError("Informe CEP e bairro e aguarde a confirmação da área de entrega.");
      return;
    }
    if (!minimumMet) {
      setError(`O pedido mínimo para esta região é ${currency.format(minimumOrderCents / 100)}.`);
      return;
    }
    setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      const address = fulfillmentType === "delivery" ? {
        street: form.get("street"),
        number: form.get("number"),
        neighborhood: form.get("neighborhood"),
        city: form.get("city"),
        state: form.get("state"),
        postalCode: form.get("postalCode"),
        complement: form.get("complement") || null,
      } : null;
      const response = await fetch("/api/public/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          restaurantSlug: menu.restaurant.slug,
          clientOrderId,
          source: "menu",
          fulfillmentType,
          tableCode: fulfillmentType === "dine_in" ? tableCode : null,
          customer: {
            name: form.get("name"),
            phone: form.get("phone"),
            email: form.get("email") || null,
            whatsappConsent: form.get("consent") === "on",
            address,
          },
          items: entries.map((item) => ({ productId: item.id, quantity: item.quantity, optionIds: item.optionIds })),
          paymentMethod: payment,
        }),
      });
      const payload = await response.json() as OrderResult & { error?: { message?: string } };
      if (!response.ok) throw new Error(payload.error?.message || "Não foi possível enviar o pedido.");
      done(payload);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível enviar o pedido.");
    } finally {
      setBusy(false);
    }
  };

  const modeTitle = fulfillmentType === "delivery" ? "Entrega" : fulfillmentType === "pickup" ? "Retirada no estabelecimento" : `Consumo no local · Mesa ${tableCode}`;
  const paymentMoment = fulfillmentType === "delivery" ? "Na entrega" : fulfillmentType === "pickup" ? "Na retirada" : "No atendimento";
  const submitDisabled = busy || quoteBusy || !deliveryReady || !minimumMet;
  const submitLabel = busy
    ? "Criando pedido seguro…"
    : quoteBusy
      ? "Confirmando área de entrega…"
      : !deliveryReady && fulfillmentType === "delivery"
        ? "Confirme CEP e bairro"
        : !minimumMet
          ? `Faltam ${currency.format((minimumOrderCents - subtotal) / 100)}`
          : `Confirmar · ${currency.format(checkoutTotal / 100)}`;

  return <div className="rm-modal-backdrop" onMouseDown={close}><div className="rm-checkout" onMouseDown={(event) => event.stopPropagation()}><header><div><small>ÚLTIMO PASSO · {modeTitle.toUpperCase()}</small><h2>Finalizar pedido</h2><p>Total de {currency.format(checkoutTotal / 100)}</p></div><button onClick={close}>✕</button></header><form onSubmit={submit}><fieldset><legend>Seus dados</legend><label>Nome<input name="name" required minLength={2} autoComplete="name" /></label><label>WhatsApp<input name="phone" required inputMode="tel" autoComplete="tel" placeholder="(24) 99999-9999" /></label><label className="wide">E-mail <small>{payment === "pix" ? "necessário para gerar o Pix" : "opcional"}</small><input name="email" required={payment === "pix"} type="email" autoComplete="email" /></label></fieldset>{fulfillmentType === "delivery" && <fieldset><legend>Endereço de entrega</legend><label className="wide">Rua<input name="street" required autoComplete="address-line1" /></label><label>Número<input name="number" required /></label><label>Complemento<input name="complement" autoComplete="address-line2" /></label><label>Bairro<input name="neighborhood" required value={neighborhood} onChange={(event) => setNeighborhood(event.target.value)} /></label><label>CEP<input name="postalCode" required inputMode="numeric" pattern="[0-9.\- ]{8,10}" autoComplete="postal-code" value={postalCode} onChange={(event) => setPostalCode(event.target.value)} /></label><label>Cidade<input name="city" required defaultValue={menu.restaurant.city} autoComplete="address-level2" /></label><label>UF<input name="state" required minLength={2} maxLength={2} defaultValue={menu.restaurant.state} autoComplete="address-level1" /></label><div className="wide" role="status" aria-live="polite" style={{ padding: 12, borderRadius: 12, background: quoteError ? "#fff1ef" : "#f5f7f2", border: `1px solid ${quoteError ? "#f3b8ae" : "#dfe4da"}`, lineHeight: 1.5 }}>{quoteBusy ? <><b>Confirmando sua região…</b><br/><small>Calculando taxa, pedido mínimo e previsão.</small></> : quoteError ? <><b>Entrega indisponível para este endereço</b><br/><small>{quoteError}</small></> : deliveryQuote ? <><b>{deliveryQuote.zoneName ? `Entrega confirmada · ${deliveryQuote.zoneName}` : "Entrega confirmada"}</b><br/><small>Taxa {currency.format(deliveryQuote.feeCents / 100)} · mínimo {deliveryQuote.minimumOrderCents ? currency.format(deliveryQuote.minimumOrderCents / 100) : "sem mínimo"} · previsão {deliveryQuote.deliveryMinutes}–{deliveryQuote.deliveryMinutes + 8} min</small></> : <><b>Confirme sua área de entrega</b><br/><small>Informe CEP e bairro para ver a taxa e o mínimo reais antes de pagar.</small></>}</div></fieldset>}{fulfillmentType !== "delivery" && <fieldset><legend>{modeTitle}</legend><p style={{ margin: 0, lineHeight: 1.5 }}>{fulfillmentType === "pickup" ? `Seu pedido será preparado para retirada em ${menu.restaurant.name}. Nenhuma taxa de entrega será cobrada.` : `Este pedido ficará vinculado à mesa ${tableCode}. Nenhum endereço de entrega é necessário.`}</p></fieldset>}<fieldset><legend>Pagamento</legend><div className="rm-payment-options">{menu.restaurant.pixAvailable && <label className={payment === "pix" ? "active" : ""}><input type="radio" name="payment" value="pix" checked={payment === "pix"} onChange={() => setPayment("pix")} /><span>▦</span><b>Pix</b><small>QR Code ou copia e cola</small></label>}<label className={payment === "cash" ? "active" : ""}><input type="radio" name="payment" value="cash" checked={payment === "cash"} onChange={() => setPayment("cash")} /><span>💵</span><b>Dinheiro</b><small>{paymentMoment}</small></label><label className={payment === "card_on_delivery" ? "active" : ""}><input type="radio" name="payment" value="card_on_delivery" checked={payment === "card_on_delivery"} onChange={() => setPayment("card_on_delivery")} /><span>▣</span><b>Cartão</b><small>{paymentMoment}</small></label></div></fieldset><label className="rm-consent"><input name="consent" type="checkbox" /><span>Quero receber novidades e lembretes de recompra pelo WhatsApp. Posso cancelar quando quiser.</span></label>{error && <p className="rm-checkout-error">{error}</p>}<button className="rm-submit-order" disabled={submitDisabled}>{submitLabel}</button></form></div></div>;
}

function OrderSuccess({ result, close }: { result: OrderResult; close: () => void }) {
  const [copied, setCopied] = useState(false); const pix = result.payment?.pixCode;
  const mode = result.order.fulfillmentType === "pickup" ? "Retirada" : result.order.fulfillmentType === "dine_in" ? `Mesa ${result.order.tableCode || ""}`.trim() : "Entrega";
  return <div className="rm-modal-backdrop"><div className="rm-success-modal"><span>✓</span><small>PEDIDO RECEBIDO · {mode.toUpperCase()}</small><h2>Pedido #{result.order.number}</h2><p>{result.order.restaurantName} recebeu seu pedido. Promessa segura: {result.order.promisedFromMinutes}–{result.order.promisedToMinutes} minutos.</p>{result.payment?.qrCodeBase64 && <Image className="rm-pix-qr" src={`data:image/png;base64,${result.payment.qrCodeBase64}`} width={180} height={180} unoptimized alt="QR Code Pix" />}{pix && <div className="rm-pix-code"><input readOnly value={pix} /><button onClick={async () => { await navigator.clipboard.writeText(pix); setCopied(true); }}>{copied ? "Copiado!" : "Copiar Pix"}</button></div>}{result.payment?.ticketUrl && <a className="rm-pix-link" href={result.payment.ticketUrl} target="_blank" rel="noreferrer">Abrir página de pagamento ↗</a>}{result.payment?.error && <p className="rm-payment-warning">{result.payment.error}</p>}<a className="rm-track-link" href={`/acompanhar/${result.order.trackingToken}`}>Acompanhar pedido →</a><button className="rm-success-close" onClick={close}>Voltar ao cardápio</button></div></div>;
}

function configuredPrice(product: Product, selectedIds: string[]) {
  return product.priceCents + product.optionGroups.reduce((sum, group) => {
    const values = group.options.filter((option) => selectedIds.includes(option.id)).map((option) => option.priceDeltaCents);
    if (!values.length || group.pricingStrategy === "included") return sum;
    if (group.pricingStrategy === "highest") return sum + Math.max(...values);
    if (group.pricingStrategy === "average") return sum + Math.round(values.reduce((total, value) => total + value, 0) / values.length);
    return sum + values.reduce((total, value) => total + value, 0);
  }, 0);
}

function configuredSummary(product: Product, selectedIds: string[]) {
  return product.optionGroups.map((group) => {
    const names = group.options.filter((option) => selectedIds.includes(option.id)).map((option) => option.name);
    return names.length ? `${group.name}: ${names.join(", ")}` : "";
  }).filter(Boolean).join(" · ");
}

function selectionRule(group: ProductOptionGroup) {
  if (group.minSelect === group.maxSelect) return `Escolha ${group.minSelect}`;
  if (group.minSelect === 0) return `Opcional · até ${group.maxSelect}`;
  return `Escolha de ${group.minSelect} a ${group.maxSelect}`;
}

function modeButton(active: boolean): React.CSSProperties {
  return {
    border: active ? "2px solid var(--store-accent)" : "1px solid #ddd",
    background: active ? "#fff7f0" : "#fff",
    borderRadius: 999,
    padding: "8px 12px",
    fontWeight: 900,
    cursor: "pointer",
  };
}

function StoreLoading() { return <main className="rm-store-state"><span className="rm-state-logo">⚡</span><i /><p>Abrindo cardápio…</p></main>; }
function StoreError({ message }: { message: string }) { return <main className="rm-store-state"><span className="rm-state-logo">!</span><h1>Não encontramos essa loja.</h1><p>{message}</p><Link href="/">Voltar ao RapidexMenu</Link></main>; }
