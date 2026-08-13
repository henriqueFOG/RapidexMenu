"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import styles from "../../commercial.module.css";

type Category = { id: string; name: string; position?: number; active?: number | boolean };

export default function CategoriesClient() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/categories");
      const payload = await response.json() as { categories?: Category[]; error?: { message?: string } };
      if (!response.ok) throw new Error(payload.error?.message || "Não foi possível carregar as categorias.");
      setCategories(payload.categories || []);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível carregar as categorias."); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy("create"); setError(""); setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      await request("/api/admin/categories", { method: "POST", body: JSON.stringify({ name: form.get("name") }) });
      event.currentTarget.reset(); setMessage("Categoria criada."); await load();
    } catch (reason) { setError(errorMessage(reason)); } finally { setBusy(""); }
  }

  async function rename(category: Category) {
    const next = window.prompt("Novo nome da categoria", category.name)?.trim();
    if (!next || next === category.name) return;
    setBusy(category.id); setError(""); setMessage("");
    try { await request("/api/admin/categories", { method: "PATCH", body: JSON.stringify({ id: category.id, name: next }) }); setMessage("Categoria atualizada."); await load(); }
    catch (reason) { setError(errorMessage(reason)); } finally { setBusy(""); }
  }

  async function toggle(category: Category) {
    const active = category.active === true || category.active === 1;
    setBusy(category.id); setError(""); setMessage("");
    try { await request("/api/admin/categories", { method: "PATCH", body: JSON.stringify({ id: category.id, active: !active }) }); setMessage(active ? "Categoria ocultada." : "Categoria reativada."); await load(); }
    catch (reason) { setError(errorMessage(reason)); } finally { setBusy(""); }
  }

  return <main className={styles.shell}><section className={styles.card}>
    <Link className={styles.brand} href="/admin"><span>⚡</span><b>Rapidex<i>Menu</i></b></Link>
    <small className={styles.kicker}>CARDÁPIO</small>
    <h1 className={styles.title}>Organize suas categorias.</h1>
    <p className={styles.intro}>Crie, renomeie ou oculte seções do cardápio. Para tamanhos, sabores, bordas e adicionais, use o editor de opções.</p>
    {error && <p className={styles.error}>{error}</p>}{message && <p className={styles.success}>{message}</p>}
    <div className={styles.footerActions} style={{ justifyContent: "flex-start", marginBottom: 18 }}><Link className={styles.linkButton} href="/admin/opcoes">Tamanhos, sabores e adicionais →</Link></div>
    <form className={styles.row} onSubmit={create}><label className={styles.field}>Nova categoria<input name="name" minLength={2} maxLength={80} required placeholder="Ex.: Pizzas especiais" /></label><button disabled={Boolean(busy)}>{busy === "create" ? "Criando…" : "+ Criar"}</button></form>
    <section className={styles.panel} style={{ marginTop: 22 }}><h2>Categorias da loja</h2><div className={styles.productList}>
      {categories.length ? categories.map(category => { const active = category.active === true || category.active === 1; return <div className={styles.product} key={category.id}><span><b>{category.name}</b><small style={{ display: "block", color: "#777c72" }}>{active ? "Visível no cardápio" : "Oculta"}</small></span><span style={{ display: "flex", gap: 8 }}><button className={styles.linkButton} disabled={Boolean(busy)} onClick={() => void rename(category)}>Renomear</button><button className={styles.linkButton} disabled={Boolean(busy)} onClick={() => void toggle(category)}>{active ? "Ocultar" : "Reativar"}</button></span></div>; }) : <p>Nenhuma categoria cadastrada.</p>}
    </div></section>
    <div className={styles.footerActions}><Link className={styles.linkButton} href="/admin">← Voltar ao painel</Link><Link className={styles.linkButton} href="/admin/opcoes">Opções de produtos</Link><Link className={styles.linkButton} href="/assinatura">Assinatura</Link></div>
  </section></main>;
}

async function request(url: string, init: RequestInit) { const response = await fetch(url, { ...init, headers: { "content-type": "application/json", ...init.headers } }); const payload = await response.json().catch(() => ({})) as { error?: { message?: string } }; if (!response.ok) throw new Error(payload.error?.message || "Não foi possível concluir."); return payload; }
function errorMessage(reason: unknown) { return reason instanceof Error ? reason.message : "Não foi possível concluir."; }
