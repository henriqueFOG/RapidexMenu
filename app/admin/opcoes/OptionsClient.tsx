"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import styles from "../../commercial.module.css";

type Product = { id: string; name: string; priceCents: number };
type PricingStrategy = "sum" | "highest" | "average" | "included";
type OptionDraft = { name: string; priceDeltaCents: number; costDeltaCents: number; available: boolean };
type GroupDraft = {
  name: string;
  minSelect: number;
  maxSelect: number;
  pricingStrategy: PricingStrategy;
  options: OptionDraft[];
};
type RawOption = OptionDraft & {
  id?: string;
  finalPriceCents?: number | null;
  finalCostCents?: number | null;
  stockControlEnabled?: boolean;
  stockQuantity?: number | null;
};
type RawGroup = {
  id?: string;
  kind?: "modifier" | "variant";
  name: string;
  minSelect: number;
  maxSelect: number;
  pricingStrategy: PricingStrategy;
  options: RawOption[];
};

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export default function OptionsClient() {
  const [products, setProducts] = useState<Product[]>([]);
  const [productId, setProductId] = useState("");
  const [groups, setGroups] = useState<GroupDraft[]>([]);
  const [variantGroup, setVariantGroup] = useState<RawGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    api<{ products: Product[] }>("/api/admin/products")
      .then((result) => {
        const list = result.products || [];
        setProducts(list);
        if (list[0]) setProductId(list[0].id);
      })
      .catch((reason) => setError(errorMessage(reason)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!productId) { setGroups([]); setVariantGroup(null); return; }
      setMessage(""); setError("");
      api<{ groups: RawGroup[] }>(`/api/admin/products/${encodeURIComponent(productId)}/options`)
        .then((result) => {
          const all = result.groups || [];
          setVariantGroup(all.find((group) => group.kind === "variant") || null);
          setGroups(all.filter((group) => group.kind !== "variant").map((group) => ({
            name: group.name,
            minSelect: group.minSelect,
            maxSelect: group.maxSelect,
            pricingStrategy: group.pricingStrategy,
            options: group.options.map((option) => ({
              name: option.name,
              priceDeltaCents: option.priceDeltaCents,
              costDeltaCents: option.costDeltaCents,
              available: option.available,
            })),
          })));
        })
        .catch((reason) => setError(errorMessage(reason)));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [productId]);

  const selectedProduct = products.find((product) => product.id === productId);

  function addGroup() {
    setGroups((current) => [...current, {
      name: "Novo grupo",
      minSelect: 0,
      maxSelect: 1,
      pricingStrategy: "sum",
      options: [{ name: "Opção", priceDeltaCents: 0, costDeltaCents: 0, available: true }],
    }]);
  }
  function patchGroup(index: number, patch: Partial<GroupDraft>) {
    setGroups((current) => current.map((group, position) => position === index ? { ...group, ...patch } : group));
  }
  function removeGroup(index: number) {
    setGroups((current) => current.filter((_, position) => position !== index));
  }
  function addOption(groupIndex: number) {
    setGroups((current) => current.map((group, position) => position === groupIndex
      ? { ...group, options: [...group.options, { name: "Nova opção", priceDeltaCents: 0, costDeltaCents: 0, available: true }] }
      : group));
  }
  function patchOption(groupIndex: number, optionIndex: number, patch: Partial<OptionDraft>) {
    setGroups((current) => current.map((group, position) => position === groupIndex
      ? { ...group, options: group.options.map((option, optionPosition) => optionPosition === optionIndex ? { ...option, ...patch } : option) }
      : group));
  }
  function removeOption(groupIndex: number, optionIndex: number) {
    setGroups((current) => current.map((group, position) => position === groupIndex
      ? { ...group, options: group.options.filter((_, optionPosition) => optionPosition !== optionIndex) }
      : group));
  }

  async function save() {
    if (!productId) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const payloadGroups = [
        ...(variantGroup ? [variantGroup] : []),
        ...groups.map((group) => ({ ...group, kind: "modifier" as const })),
      ];
      const result = await api<{ groups: RawGroup[] }>(`/api/admin/products/${encodeURIComponent(productId)}/options`, {
        method: "PUT",
        body: JSON.stringify({ groups: payloadGroups }),
      });
      setVariantGroup((result.groups || []).find((group) => group.kind === "variant") || null);
      setMessage("Regras publicadas sem alterar as variações do produto. O servidor valida tudo novamente no checkout.");
    } catch (reason) {
      setError(errorMessage(reason));
    } finally { setBusy(false); }
  }

  if (loading) return <main className={styles.shell}><section className={styles.card}>Carregando produtos…</section></main>;

  return <main className={styles.shell}><section className={styles.card} style={{ maxWidth: 1050 }}>
    <Link className={styles.brand} href="/"><span>⚡</span><b>Rapidex<i>Menu</i></b></Link>
    <small className={styles.kicker}>CARDÁPIO AVANÇADO</small>
    <h1 className={styles.title}>Sabores, adicionais e regras</h1>
    <p className={styles.intro}>Configure modificadores que o servidor valida no checkout. Tamanhos, volumes e porções com preço ou estoque próprios ficam no módulo de variações, sem misturar as duas regras.</p>

    {error && <p className={styles.error}>{error}</p>}
    {message && <p className={styles.success}>{message}</p>}

    <section className={styles.panel}>
      <label className={styles.field}>Produto
        <select value={productId} onChange={(event) => setProductId(event.target.value)}>
          {products.map((product) => <option key={product.id} value={product.id}>{product.name} · {currency.format(product.priceCents / 100)}</option>)}
        </select>
      </label>
      {!products.length && <p>Cadastre pelo menos um produto antes de criar opções.</p>}
      {selectedProduct && <p style={{ marginBottom: 0 }}>{variantGroup ? <>Este produto já possui <b>{variantGroup.name}</b> como variação estrutural. Editar os modificadores aqui não remove nem recria essas variações.</> : <>Precisa de tamanho/volume com preço ou estoque próprios? <Link href="/admin/variantes">Abrir variações →</Link></>}</p>}
    </section>

    {selectedProduct && <>
      {groups.map((group, groupIndex) => <section className={styles.panel} key={`${productId}-${groupIndex}`}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div><small>GRUPO {groupIndex + 1}</small><h2 style={{ margin: "4px 0" }}>{group.name || "Sem nome"}</h2></div>
          <button type="button" onClick={() => removeGroup(groupIndex)}>Remover grupo</button>
        </div>
        <div className={styles.grid}>
          <label className={styles.field}>Nome do grupo<input value={group.name} onChange={(event) => patchGroup(groupIndex, { name: event.target.value })} placeholder="Ex.: Adicionais" /></label>
          <label className={styles.field}>Mínimo<input type="number" min="0" max="20" value={group.minSelect} onChange={(event) => patchGroup(groupIndex, { minSelect: Number(event.target.value) })} /></label>
          <label className={styles.field}>Máximo<input type="number" min="1" max="20" value={group.maxSelect} onChange={(event) => patchGroup(groupIndex, { maxSelect: Number(event.target.value) })} /></label>
          <label className={styles.field}>Como cobrar
            <select value={group.pricingStrategy} onChange={(event) => patchGroup(groupIndex, { pricingStrategy: event.target.value as PricingStrategy })}>
              <option value="sum">Somar adicionais</option>
              <option value="highest">Cobrar o maior preço</option>
              <option value="average">Cobrar média das escolhas</option>
              <option value="included">Opções incluídas no preço base</option>
            </select>
          </label>
        </div>
        <p style={{ marginTop: 14 }}><b>Regra:</b> {ruleText(group)}. {strategyText(group.pricingStrategy)}</p>
        <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
          {group.options.map((option, optionIndex) => <div key={optionIndex} style={{ display: "grid", gridTemplateColumns: "minmax(180px,2fr) 150px 150px 110px 90px", gap: 10, alignItems: "end", padding: 12, border: "1px solid #e7e7e7", borderRadius: 12 }}>
            <label className={styles.field}>Opção<input value={option.name} onChange={(event) => patchOption(groupIndex, optionIndex, { name: event.target.value })} /></label>
            <label className={styles.field}>Acréscimo (R$)<input type="number" min="0" step="0.01" value={(option.priceDeltaCents / 100).toFixed(2)} onChange={(event) => patchOption(groupIndex, optionIndex, { priceDeltaCents: moneyToCents(event.target.value) })} /></label>
            <label className={styles.field}>Custo extra (R$)<input type="number" min="0" step="0.01" value={(option.costDeltaCents / 100).toFixed(2)} onChange={(event) => patchOption(groupIndex, optionIndex, { costDeltaCents: moneyToCents(event.target.value) })} /></label>
            <label style={{ display: "flex", gap: 6, alignItems: "center", paddingBottom: 12 }}><input type="checkbox" checked={option.available} onChange={(event) => patchOption(groupIndex, optionIndex, { available: event.target.checked })} /> Disponível</label>
            <button type="button" onClick={() => removeOption(groupIndex, optionIndex)}>Excluir</button>
          </div>)}
        </div>
        <button type="button" style={{ marginTop: 14 }} onClick={() => addOption(groupIndex)}>+ Adicionar opção</button>
      </section>)}

      <section className={styles.panel}>
        <h2>Modelos rápidos</h2>
        <p>Exemplos: <b>Sabores da pizza</b> (1 a 2, maior preço), <b>Adicionais</b> (0 a 5, somar) e <b>Remover ingredientes</b> (0 a vários, incluído). Para tamanho/volume com preço final próprio, use Variações.</p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}><button type="button" onClick={addGroup}>+ Novo grupo de opções</button><Link className={styles.linkButton} href="/admin/variantes">Gerenciar variações →</Link></div>
      </section>

      <button className={styles.button} disabled={busy} onClick={() => void save()}>{busy ? "Publicando regras…" : "Salvar opções do produto"}</button>
    </>}
    <div className={styles.footerActions}><Link className={styles.linkButton} href="/admin/variantes">Variações</Link><Link className={styles.linkButton} href="/admin/categorias">← Categorias</Link><Link className={styles.linkButton} href="/admin">Voltar ao painel</Link></div>
  </section></main>;
}

function ruleText(group: GroupDraft) {
  if (group.minSelect === group.maxSelect) return `cliente deve escolher ${group.minSelect}`;
  if (group.minSelect === 0) return `opcional, até ${group.maxSelect}`;
  return `cliente escolhe de ${group.minSelect} a ${group.maxSelect}`;
}
function strategyText(strategy: PricingStrategy) {
  if (strategy === "highest") return "Útil para pizza meio a meio: cobra apenas o maior acréscimo.";
  if (strategy === "average") return "Útil quando o preço deve refletir a média das escolhas.";
  if (strategy === "included") return "As escolhas não aumentam o preço base.";
  return "Os acréscimos escolhidos são somados.";
}
function moneyToCents(value: string) { return Math.max(0, Math.round(Number(value || 0) * 100)); }
function errorMessage(reason: unknown) { return reason instanceof Error ? reason.message : "Não foi possível concluir."; }
async function api<T = Record<string, unknown>>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { "content-type": "application/json", ...init?.headers } });
  const payload = await response.json().catch(() => ({})) as { error?: { message?: string } };
  if (!response.ok) throw new Error(payload.error?.message || "Não foi possível concluir.");
  return payload as T;
}
