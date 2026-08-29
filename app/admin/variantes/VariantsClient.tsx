"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import styles from "../../commercial.module.css";

type Product = { id: string; name: string; priceCents: number; costCents: number };
type Group = {
  id?: string;
  kind?: "modifier" | "variant";
  name: string;
  minSelect: number;
  maxSelect: number;
  pricingStrategy: "sum" | "highest" | "average" | "included";
  options: Array<{
    id?: string;
    name: string;
    priceDeltaCents: number;
    costDeltaCents: number;
    finalPriceCents?: number | null;
    finalCostCents?: number | null;
    available: boolean;
    stockControlEnabled?: boolean;
    stockQuantity?: number | null;
  }>;
};
type Variant = {
  id?: string;
  name: string;
  price: number;
  cost: number;
  available: boolean;
  controlStock: boolean;
  stock: number;
};

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export default function VariantsClient() {
  const [products, setProducts] = useState<Product[]>([]);
  const [productId, setProductId] = useState("");
  const [groups, setGroups] = useState<Group[]>([]);
  const [variantGroupId, setVariantGroupId] = useState<string | undefined>();
  const [groupName, setGroupName] = useState("Tamanho");
  const [variants, setVariants] = useState<Variant[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    request<{ products: Product[] }>("/api/admin/products")
      .then((data) => {
        const list = data.products || [];
        setProducts(list);
        if (list[0]) setProductId(list[0].id);
      })
      .catch((reason) => setError(toMessage(reason)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!productId) return;
    setError("");
    setMessage("");
    request<{ groups: Group[] }>(`/api/admin/products/${encodeURIComponent(productId)}/options`)
      .then((data) => {
        const next = data.groups || [];
        setGroups(next);
        const variant = next.find((group) => group.kind === "variant");
        setVariantGroupId(variant?.id);
        setGroupName(variant?.name || "Tamanho");
        setVariants((variant?.options || []).map((option) => ({
          id: option.id,
          name: option.name,
          price: Number(option.finalPriceCents || 0),
          cost: Number(option.finalCostCents || 0),
          available: option.available !== false,
          controlStock: Boolean(option.stockControlEnabled),
          stock: Number(option.stockQuantity || 0),
        })));
      })
      .catch((reason) => setError(toMessage(reason)));
  }, [productId]);

  const product = products.find((item) => item.id === productId);

  function addVariant() {
    if (!product) return;
    const previous = variants[variants.length - 1];
    setVariants((current) => [...current, {
      name: current.length ? `Variação ${current.length + 1}` : "Padrão",
      price: previous?.price ?? product.priceCents,
      cost: previous?.cost ?? product.costCents,
      available: true,
      controlStock: false,
      stock: 0,
    }]);
  }

  function patch(index: number, changes: Partial<Variant>) {
    setVariants((current) => current.map((variant, position) => position === index ? { ...variant, ...changes } : variant));
  }

  function removeVariant(index: number) {
    setVariants((current) => current.filter((_, position) => position !== index));
  }

  async function save() {
    if (!productId) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const modifiers = groups.filter((group) => group.kind !== "variant");
      const variantGroup: Group | null = variants.length ? {
        id: variantGroupId,
        kind: "variant",
        name: groupName,
        minSelect: 1,
        maxSelect: 1,
        pricingStrategy: "sum",
        options: variants.map((variant) => ({
          id: variant.id,
          name: variant.name,
          priceDeltaCents: 0,
          costDeltaCents: 0,
          finalPriceCents: variant.price,
          finalCostCents: variant.cost,
          available: variant.available,
          stockControlEnabled: variant.controlStock,
          stockQuantity: variant.controlStock ? variant.stock : null,
        })),
      } : null;
      const data = await request<{ groups: Group[] }>(`/api/admin/products/${encodeURIComponent(productId)}/options`, {
        method: "PUT",
        body: JSON.stringify({ groups: [...(variantGroup ? [variantGroup] : []), ...modifiers] }),
      });
      const next = data.groups || [];
      setGroups(next);
      const savedVariant = next.find((group) => group.kind === "variant");
      setVariantGroupId(savedVariant?.id);
      setVariants((savedVariant?.options || []).map((option) => ({
        id: option.id,
        name: option.name,
        price: Number(option.finalPriceCents || 0),
        cost: Number(option.finalCostCents || 0),
        available: option.available !== false,
        controlStock: Boolean(option.stockControlEnabled),
        stock: Number(option.stockQuantity || 0),
      })));
      setMessage(savedVariant
        ? "Variações publicadas. Preço, disponibilidade e estoque serão validados novamente no servidor."
        : "Variações removidas. O histórico de pedidos continua preservado.");
    } catch (reason) {
      setError(toMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <main className={styles.shell}><section className={styles.card}>Carregando produtos…</section></main>;

  return <main className={styles.shell}><section className={styles.card} style={{ maxWidth: 1000 }}>
    <Link className={styles.brand} href="/"><span>⚡</span><b>Rapidex<i>Menu</i></b></Link>
    <small className={styles.kicker}>CARDÁPIO UNIVERSAL</small>
    <h1 className={styles.title}>Variações com preço e estoque próprios</h1>
    <p className={styles.intro}>Use para tamanho, volume ou porção. Cada variação pode ter preço, custo, disponibilidade e estoque independentes, sem perder o histórico dos pedidos já vendidos.</p>
    {error && <p className={styles.error}>{error}</p>}
    {message && <p className={styles.success}>{message}</p>}

    <section className={styles.panel}>
      <label className={styles.field}>Produto
        <select value={productId} onChange={(event) => setProductId(event.target.value)}>
          {products.map((item) => <option value={item.id} key={item.id}>{item.name} · {brl.format(item.priceCents / 100)}</option>)}
        </select>
      </label>
      {!products.length && <p>Cadastre pelo menos um produto antes de criar variações.</p>}
      {product && <p style={{ marginBottom: 0 }}>Preço base atual: <b>{brl.format(product.priceCents / 100)}</b> · custo: <b>{brl.format(product.costCents / 100)}</b></p>}
    </section>

    {product && <>
      <section className={styles.panel}>
        <label className={styles.field}>Nome do grupo<input value={groupName} onChange={(event) => setGroupName(event.target.value)} placeholder="Ex.: Tamanho" /></label>
        <p style={{ marginBottom: 0 }}>O cliente deverá escolher exatamente uma variação. O menor preço publicado vira o valor “a partir de”.</p>
      </section>

      {variants.map((variant, index) => <section className={styles.panel} key={variant.id || `${productId}-nova-${index}`}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
          <small>VARIAÇÃO {index + 1}</small>
          <button type="button" onClick={() => removeVariant(index)}>Remover</button>
        </div>
        <div className={styles.grid}>
          <label className={styles.field}>Nome<input value={variant.name} onChange={(event) => patch(index, { name: event.target.value })} placeholder="Grande" /></label>
          <label className={styles.field}>Preço final<input type="number" min="0.01" step="0.01" value={(variant.price / 100).toFixed(2)} onChange={(event) => patch(index, { price: cents(event.target.value) })} /></label>
          <label className={styles.field}>Custo final<input type="number" min="0" step="0.01" value={(variant.cost / 100).toFixed(2)} onChange={(event) => patch(index, { cost: cents(event.target.value) })} /></label>
          <label className={styles.field}>Estoque<input type="number" min="0" step="1" disabled={!variant.controlStock} value={variant.controlStock ? variant.stock : ""} onChange={(event) => patch(index, { stock: Math.max(0, Math.floor(Number(event.target.value || 0))) })} /></label>
        </div>
        <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginTop: 14 }}>
          <label><input type="checkbox" checked={variant.available} onChange={(event) => patch(index, { available: event.target.checked })} /> Disponível</label>
          <label><input type="checkbox" checked={variant.controlStock} onChange={(event) => patch(index, { controlStock: event.target.checked })} /> Controlar estoque</label>
        </div>
        {variant.controlStock && variant.stock === 0 && <p><b>Esgotada:</b> essa variação ficará fora das escolhas compráveis do cardápio.</p>}
      </section>)}

      <section className={styles.panel}>
        <button type="button" onClick={addVariant}>+ Adicionar variação</button>
        {!variants.length && <p style={{ marginBottom: 0 }}>Sem variações estruturais. Salvar neste estado remove o grupo de variações sem apagar o histórico de vendas.</p>}
      </section>
      <button className={styles.button} disabled={busy} onClick={() => void save()}>{busy ? "Salvando…" : "Salvar variações"}</button>
    </>}

    <div className={styles.footerActions}>
      <Link className={styles.linkButton} href="/admin/opcoes">Adicionais e regras</Link>
      <Link className={styles.linkButton} href="/admin">Voltar ao painel</Link>
    </div>
  </section></main>;
}

function cents(value: string) { return Math.max(0, Math.round(Number(value || 0) * 100)); }
function toMessage(reason: unknown) { return reason instanceof Error ? reason.message : "Não foi possível concluir."; }
async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { "content-type": "application/json", ...init?.headers } });
  const data = await response.json().catch(() => ({})) as { error?: { message?: string } };
  if (!response.ok) throw new Error(data.error?.message || "Não foi possível concluir.");
  return data as T;
}
