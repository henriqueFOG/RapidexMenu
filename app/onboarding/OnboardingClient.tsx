"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import styles from "../commercial.module.css";

type Restaurant = {
  id: string;
  name: string;
  slug: string;
  phone?: string | null;
  whatsapp?: string | null;
  city?: string | null;
  state?: string | null;
  delivery_fee_cents?: number;
  minimum_order_cents?: number;
  average_prep_minutes?: number;
  delivery_minutes?: number;
  onboarding_completed?: number;
  published_at?: number | null;
  trial_ends_at?: number | null;
};
type Readiness = { hasLocation: boolean; hasWhatsapp: boolean; hasCategory: boolean; hasProduct: boolean; published: boolean };
type Category = { id: string; name: string };
type Product = { id: string; name: string; priceCents: number; available: boolean; categoryName?: string | null };

export default function OnboardingClient({ userName }: { userName: string }) {
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const [setup, menu] = await Promise.all([
        api<{ restaurant: Restaurant; readiness: Readiness }>("/api/admin/onboarding"),
        api<{ categories: Category[]; products: Product[] }>("/api/admin/products"),
      ]);
      setRestaurant(setup.restaurant);
      setReadiness(setup.readiness);
      setCategories(menu.categories || []);
      setProducts(menu.products || []);
      if (setup.readiness.published) window.location.replace("/admin");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível carregar sua ativação.");
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const progress = useMemo(() => {
    if (!readiness) return 0;
    return [readiness.hasLocation, readiness.hasWhatsapp, readiness.hasCategory, readiness.hasProduct].filter(Boolean).length;
  }, [readiness]);

  async function saveOperation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy("operation"); setError(""); setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      await api("/api/admin/settings", { method: "PATCH", body: JSON.stringify({
        name: form.get("name"), city: form.get("city"), state: form.get("state"),
        phone: form.get("whatsapp"), whatsapp: form.get("whatsapp"),
        deliveryFeeCents: moneyToCents(form.get("deliveryFee")),
        minimumOrderCents: moneyToCents(form.get("minimumOrder")),
        averagePrepMinutes: Number(form.get("prep")), deliveryMinutes: Number(form.get("delivery")),
      }) });
      setMessage("Dados da operação salvos."); await load();
    } catch (reason) { setError(errorMessage(reason)); } finally { setBusy(""); }
  }

  async function addCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy("category"); setError(""); setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      await api("/api/admin/categories", { method: "POST", body: JSON.stringify({ name: form.get("category") }) });
      event.currentTarget.reset(); setMessage("Categoria criada."); await load();
    } catch (reason) { setError(errorMessage(reason)); } finally { setBusy(""); }
  }

  async function addProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy("product"); setError(""); setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      await api("/api/admin/products", { method: "POST", body: JSON.stringify({
        name: form.get("product"), description: form.get("description"), emoji: form.get("emoji") || "🍽️",
        categoryId: form.get("categoryId") || null, priceCents: moneyToCents(form.get("price")),
        costCents: moneyToCents(form.get("cost")), prepMinutes: Number(form.get("productPrep")),
      }) });
      event.currentTarget.reset(); setMessage("Produto cadastrado. Seu cardápio já tem conteúdo real."); await load();
    } catch (reason) { setError(errorMessage(reason)); } finally { setBusy(""); }
  }

  async function publish() {
    setBusy("publish"); setError(""); setMessage("");
    try {
      const result = await api<{ next: string; store: string }>("/api/admin/onboarding", { method: "PATCH", body: "{}" });
      window.location.assign(result.next || "/admin");
    } catch (reason) { setError(errorMessage(reason)); setBusy(""); }
  }

  return <main className={styles.shell}>
    <section className={styles.card}>
      <Link className={styles.brand} href="/"><span>⚡</span><b>Rapidex<i>Menu</i></b></Link>
      <small className={styles.kicker}>ATIVAÇÃO DA SUA LOJA</small>
      <h1 className={styles.title}>Vamos colocar {restaurant?.name || "seu restaurante"} no ar.</h1>
      <p className={styles.intro}>Olá, {userName}. São três passos. No final você terá um link público pronto para receber o primeiro pedido.</p>
      <div className={styles.steps}>
        <div className={`${styles.step} ${readiness?.hasLocation && readiness?.hasWhatsapp ? styles.done : ""}`}>01<strong>Operação</strong></div>
        <div className={`${styles.step} ${readiness?.hasProduct ? styles.done : ""}`}>02<strong>Cardápio</strong></div>
        <div className={`${styles.step} ${progress === 4 ? styles.done : ""}`}>03<strong>Publicar</strong></div>
      </div>
      {error && <p className={styles.error}>{error}</p>}
      {message && <p className={styles.success}>{message}</p>}

      {restaurant && <form className={styles.panel} onSubmit={saveOperation}>
        <h2>1. Como sua operação funciona?</h2><p>Esses dados alimentam o cardápio e a previsão de entrega.</p>
        <div className={styles.grid}>
          <label className={styles.field}>Nome da loja<input name="name" required defaultValue={restaurant.name} /></label>
          <label className={styles.field}>WhatsApp<input name="whatsapp" required defaultValue={restaurant.whatsapp || restaurant.phone || ""} /></label>
          <label className={styles.field}>Cidade<input name="city" required defaultValue={restaurant.city || ""} /></label>
          <label className={styles.field}>UF<input name="state" required maxLength={2} defaultValue={restaurant.state || ""} /></label>
          <label className={styles.field}>Taxa de entrega (R$)<input name="deliveryFee" type="number" step="0.01" min="0" defaultValue={((restaurant.delivery_fee_cents || 0) / 100).toFixed(2)} /></label>
          <label className={styles.field}>Pedido mínimo (R$)<input name="minimumOrder" type="number" step="0.01" min="0" defaultValue={((restaurant.minimum_order_cents || 0) / 100).toFixed(2)} /></label>
          <label className={styles.field}>Preparo médio (min)<input name="prep" type="number" min="1" max="240" defaultValue={restaurant.average_prep_minutes || 18} /></label>
          <label className={styles.field}>Entrega média (min)<input name="delivery" type="number" min="1" max="240" defaultValue={restaurant.delivery_minutes || 24} /></label>
        </div>
        <button className={styles.button} disabled={Boolean(busy)}>{busy === "operation" ? "Salvando…" : "Salvar operação"}</button>
      </form>}

      <section className={styles.panel}>
        <h2>2. Monte o primeiro cardápio</h2><p>Uma categoria e um produto disponível já são suficientes para publicar. Depois você adiciona o restante pelo painel.</p>
        <form className={styles.row} onSubmit={addCategory}>
          <label className={styles.field}>Nova categoria<input name="category" minLength={2} required placeholder="Ex.: Hambúrgueres" /></label>
          <button disabled={Boolean(busy)}>{busy === "category" ? "Criando…" : "+ Categoria"}</button>
        </form>
        <form className={styles.grid} onSubmit={addProduct} style={{ marginTop: 18 }}>
          <label className={styles.field}>Emoji<input name="emoji" defaultValue="🍽️" maxLength={8} /></label>
          <label className={styles.field}>Produto<input name="product" minLength={2} required placeholder="Ex.: Smash clássico" /></label>
          <label className={styles.field}>Categoria<select name="categoryId"><option value="">Sem categoria</option>{categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
          <label className={styles.field}>Preço (R$)<input name="price" type="number" step="0.01" min="1" required /></label>
          <label className={styles.field}>Custo (R$)<input name="cost" type="number" step="0.01" min="0" required /></label>
          <label className={styles.field}>Preparo (min)<input name="productPrep" type="number" min="1" max="180" defaultValue="10" required /></label>
          <label className={`${styles.field} ${styles.wide}`}>Descrição<input name="description" maxLength={500} placeholder="Ingredientes, tamanho e diferenciais" /></label>
          <button className={`${styles.button} ${styles.wide}`} disabled={Boolean(busy)}>{busy === "product" ? "Salvando produto…" : "+ Adicionar produto"}</button>
        </form>
        {products.length > 0 && <div className={styles.productList}>{products.slice(0, 8).map(product => <div className={styles.product} key={product.id}><span><b>{product.name}</b>{product.categoryName ? ` · ${product.categoryName}` : ""}</span><strong>{formatMoney(product.priceCents)}</strong></div>)}</div>}
      </section>

      <section className={styles.panel}>
        <h2>3. Publique e receba pedidos</h2>
        <p>Seu endereço será <b>/loja/{restaurant?.slug || "sua-loja"}</b>. A publicação abre a loja e libera o cardápio para pedidos reais.</p>
        <button className={styles.button} disabled={Boolean(busy) || progress < 4} onClick={publish}>{busy === "publish" ? "Publicando…" : progress < 4 ? "Conclua os itens acima" : "Publicar minha loja →"}</button>
      </section>
      <p className={styles.note}>Depois da publicação você continua no painel para editar produtos, acompanhar clientes e receber pedidos.</p>
    </section>
  </main>;
}

function moneyToCents(value: FormDataEntryValue | null) { return Math.round(Number(value || 0) * 100); }
function formatMoney(value: number) { return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value || 0) / 100); }
function errorMessage(reason: unknown) { return reason instanceof Error ? reason.message : "Não foi possível concluir."; }
async function api<T = Record<string, unknown>>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { "content-type": "application/json", ...init?.headers } });
  const payload = await response.json().catch(() => ({})) as { error?: { message?: string } };
  if (!response.ok) throw new Error(payload.error?.message || "Não foi possível concluir.");
  return payload as T;
}
