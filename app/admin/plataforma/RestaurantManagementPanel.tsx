"use client";

import Link from "next/link";
import { FormEvent, useCallback, useMemo, useState } from "react";
import styles from "./PlatformConsole.module.css";

export type ManagedRestaurant = {
  id: string;
  name: string;
  slug: string;
  ownerEmail: string;
  tenantKind: "live" | "demo" | "test";
  plan: string;
  status: string;
  published: boolean;
  createdAt: number;
  firstOrderAt: number | null;
  activatedWithin48h: boolean;
  trialEndsAt: number | null;
  accessEndsAt: number | null;
  blockedAt: number | null;
  blockReason: string | null;
  subscription: { plan: string; amountCents: number; status: string } | null;
  integrations: Array<{ provider: string; status: string }>;
};

type Member = {
  id: string;
  userId: string | null;
  email: string;
  name: string | null;
  role: "owner" | "manager" | "operator" | "finance";
  active: boolean;
  userStatus: string;
  lastLoginAt: number | null;
};
type Detail = {
  restaurant: ManagedRestaurant & { blockReason: string | null; updatedAt: number };
  counts: { products: number; orders: number; customers: number; deliveredRevenueCents: number };
  members: Member[];
  recentOrders: Array<{ id: string; number: number; status: string; paymentStatus: string; totalCents: number; createdAt: number }>;
};
type SupportNote = { id: string; actorEmail: string; note: string; createdAt: number };

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const dateTime = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

export default function RestaurantManagementPanel({ restaurants, onReload, onPasswordReset }: {
  restaurants: ManagedRestaurant[];
  onReload: () => Promise<void>;
  onPasswordReset: (email: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [notes, setNotes] = useState<SupportNote[]>([]);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return restaurants.filter((restaurant) =>
      (status === "all" || restaurant.status === status || (status === "blocked" && Boolean(restaurant.blockedAt))) &&
      (!term || `${restaurant.name} ${restaurant.slug} ${restaurant.ownerEmail} ${restaurant.plan}`.toLowerCase().includes(term)),
    );
  }, [query, restaurants, status]);

  const loadDetail = useCallback(async (id: string) => {
    setError("");
    const [detailResponse, notesResponse] = await Promise.all([
      fetch(`/api/internal/platform/restaurants/${id}`, { cache: "no-store" }),
      fetch(`/api/internal/platform/support-notes?restaurantId=${encodeURIComponent(id)}`, { cache: "no-store" }),
    ]);
    const detailPayload = await detailResponse.json() as Detail & { error?: { message?: string } };
    const notesPayload = await notesResponse.json() as { notes?: SupportNote[]; error?: { message?: string } };
    if (!detailResponse.ok) throw new Error(detailPayload.error?.message || "Não foi possível abrir o estabelecimento.");
    if (!notesResponse.ok) throw new Error(notesPayload.error?.message || "Não foi possível carregar o histórico de suporte.");
    setDetail(detailPayload);
    setNotes(notesPayload.notes || []);
  }, []);

  async function openRestaurant(id: string) {
    setSelectedId(id);
    setDetail(null);
    setNotes([]);
    await run(async () => { await loadDetail(id); });
  }

  function closeRestaurant() {
    setSelectedId(null);
    setDetail(null);
    setNotes([]);
    setReason("");
  }

  async function createRestaurant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    await run(async () => {
      const response = await fetch("/api/internal/platform/restaurants", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(Object.fromEntries(form.entries())),
      });
      const payload = await response.json() as { restaurant?: { id: string }; firstAccess?: { delivery: string; url: string | null }; error?: { message?: string } };
      if (!response.ok) throw new Error(payload.error?.message || "Não foi possível criar o estabelecimento.");
      setMessage(payload.firstAccess?.delivery === "email"
        ? "Estabelecimento criado. O convite seguro foi enviado ao titular."
        : `Estabelecimento criado. Link único para entregar ao titular: ${payload.firstAccess?.url}`);
      formElement.reset();
      setShowCreate(false);
      await onReload();
      if (payload.restaurant?.id) {
        setSelectedId(payload.restaurant.id);
        await loadDetail(payload.restaurant.id);
      }
    });
  }

  async function restaurantAction(action: "pause" | "reactivate" | "block" | "unblock") {
    if (!selectedId) return;
    await run(async () => {
      requireReason();
      const response = await fetch(`/api/internal/platform/restaurants/${selectedId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, reason }),
      });
      const payload = await response.json() as { error?: { message?: string } };
      if (!response.ok) throw new Error(payload.error?.message || "Não foi possível alterar o estabelecimento.");
      setMessage(`Ação “${actionLabel(action)}” concluída e auditada.`);
      setReason("");
      await Promise.all([loadDetail(selectedId), onReload()]);
    });
  }

  async function updateCommercial(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedId) return;
    const form = new FormData(event.currentTarget);
    await run(async () => {
      requireReason();
      const response = await fetch(`/api/internal/platform/restaurants/${selectedId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "update_commercial",
          plan: form.get("plan"),
          status: form.get("status"),
          trialEndsAt: dateInputToTimestamp(form.get("trialEndsAt")),
          accessEndsAt: dateInputToTimestamp(form.get("accessEndsAt")),
          reason,
        }),
      });
      const payload = await response.json() as { error?: { message?: string } };
      if (!response.ok) throw new Error(payload.error?.message || "Não foi possível atualizar as condições comerciais.");
      setMessage("Plano e janela de acesso atualizados com auditoria.");
      setReason("");
      await Promise.all([loadDetail(selectedId), onReload()]);
    });
  }

  async function addMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedId) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    await run(async () => {
      requireReason();
      const response = await fetch(`/api/internal/platform/restaurants/${selectedId}/members`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...Object.fromEntries(form.entries()), reason }),
      });
      const payload = await response.json() as { firstAccess?: { delivery: string; url: string | null }; error?: { message?: string } };
      if (!response.ok) throw new Error(payload.error?.message || "Não foi possível adicionar o membro.");
      setMessage(payload.firstAccess?.delivery === "email" ? "Membro adicionado e convite enviado." : `Membro adicionado. Link único: ${payload.firstAccess?.url}`);
      formElement.reset();
      setReason("");
      await loadDetail(selectedId);
    });
  }

  async function memberAction(member: Member, action: "activate" | "deactivate" | "block" | "unblock") {
    if (!selectedId) return;
    await run(async () => {
      requireReason();
      const isUserAction = action === "block" || action === "unblock";
      if (isUserAction && !member.userId) throw new Error("A pessoa ainda não possui uma conta vinculada.");
      const response = await fetch(isUserAction
        ? `/api/internal/platform/users/${member.userId}`
        : `/api/internal/platform/restaurants/${selectedId}/members`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(isUserAction ? { action, reason } : { memberId: member.id, action, reason }),
      });
      const payload = await response.json() as { error?: { message?: string } };
      if (!response.ok) throw new Error(payload.error?.message || "Não foi possível alterar o acesso.");
      setMessage("Acesso atualizado; sessões anteriores foram invalidadas quando necessário.");
      setReason("");
      await loadDetail(selectedId);
    });
  }

  async function addNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedId) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    await run(async () => {
      const response = await fetch("/api/internal/platform/support-notes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ restaurantId: selectedId, note: form.get("note") }),
      });
      const payload = await response.json() as { error?: { message?: string } };
      if (!response.ok) throw new Error(payload.error?.message || "Não foi possível registrar a nota.");
      formElement.reset();
      setMessage("Nota interna adicionada ao histórico de suporte.");
      await loadDetail(selectedId);
    });
  }

  async function run(operation: () => Promise<void>) {
    setBusy(true); setError(""); setMessage("");
    try { await operation(); } catch (cause) { setError(cause instanceof Error ? cause.message : "A operação falhou."); } finally { setBusy(false); }
  }
  function requireReason() { if (reason.trim().length < 10) throw new Error("Informe um motivo com pelo menos 10 caracteres para manter a auditoria útil."); }

  return <section>
    <header className={styles.pageHeading}><div><span className={styles.eyebrow}>GESTÃO DE TENANTS</span><h1>Estabelecimentos</h1><p>Cadastre, diagnostique e resolva acesso, plano, equipe e suporte sem misturar lojas com superadmins.</p></div><div className={styles.headingActions}><span className={styles.countBadge}>{filtered.length} de {restaurants.length}</span><button className={styles.primaryButton} type="button" onClick={() => setShowCreate((value) => !value)}>{showCreate ? "Fechar cadastro" : "+ Novo estabelecimento"}</button></div></header>
    {message ? <div className={styles.successBanner}>{message}</div> : null}
    {error ? <div className={styles.errorBanner}>{error}</div> : null}
    {showCreate ? <article className={`${styles.panel} ${styles.managementBlock}`}><div className={styles.panelHeader}><div><h2>Criar estabelecimento por convite</h2><p>O titular recebe um link temporário, aceita os documentos legais e cria a própria senha.</p></div></div><form className={styles.managementForm} onSubmit={createRestaurant}><label>Estabelecimento<input name="restaurantName" required minLength={2} /></label><label>Nome do proprietário<input name="ownerName" required minLength={2} /></label><label>E-mail exclusivo<input name="ownerEmail" type="email" required /></label><label>Telefone<input name="phone" required /></label><label>Cidade<input name="city" required /></label><label>UF<input name="state" required minLength={2} maxLength={2} /></label><label>Plano<select name="plan" defaultValue="start"><option value="start">Start</option><option value="growth">Growth</option><option value="scale">Scale</option></select></label><label>Slug opcional<input name="slug" placeholder="minha-loja" /></label><label className={styles.formWide}>Motivo<textarea name="reason" required minLength={10} rows={2} placeholder="Ex.: contrato piloto aprovado no atendimento #..." /></label><button className={`${styles.primaryButton} ${styles.formWide}`} disabled={busy}>Criar e gerar primeiro acesso</button></form></article> : null}
    <article className={styles.panel}><div className={styles.filters}><label className={styles.searchBox}><input aria-label="Buscar estabelecimento" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar nome, slug, e-mail ou plano" /></label><select aria-label="Filtrar status" value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">Todos os status</option><option value="trial">Em teste</option><option value="active">Ativo</option><option value="paused">Pausado</option><option value="blocked">Bloqueado</option><option value="canceled">Cancelado</option></select></div>
      <div className={styles.tableWrap}><table><thead><tr><th>Estabelecimento</th><th>Proprietário</th><th>Plano e status</th><th>Ativação</th><th>Assinatura</th><th>Acesso</th><th>Ações</th></tr></thead><tbody>{filtered.map((restaurant) => <tr key={restaurant.id}><td><div className={styles.entityCell}><span className={styles.entityIcon}>{restaurant.name.slice(0, 1).toUpperCase()}</span><div><b>{restaurant.name} {restaurant.tenantKind !== "live" ? <em className={`${styles.tenantBadge} ${styles[`tenant_${restaurant.tenantKind}`]}`}>{restaurant.tenantKind === "demo" ? "Demonstração" : "Teste"}</em> : null}</b><span>/{restaurant.slug} · {restaurant.published ? "Publicada" : "Não publicada"}</span></div></div></td><td><span className={styles.primaryText}>{restaurant.ownerEmail}</span></td><td><b className={styles.planName}>{restaurant.plan.toUpperCase()}</b><span className={`${styles.inlineStatus} ${restaurant.blockedAt ? styles.status_blocked : styles[`status_${restaurant.status}`]}`}>{restaurant.blockedAt ? "Bloqueado" : restaurant.status}</span></td><td>{restaurant.firstOrderAt ? <><b className={styles.primaryText}>{restaurant.activatedWithin48h ? "Em até 48h" : "Após 48h"}</b><span className={styles.cellNote}>{dateTime.format(new Date(restaurant.firstOrderAt))}</span></> : <span className={styles.muted}>Sem pedido</span>}</td><td>{restaurant.subscription ? <><b className={styles.primaryText}>{money.format(restaurant.subscription.amountCents / 100)}/mês</b><span className={styles.cellNote}>{restaurant.subscription.status}</span></> : <span className={styles.muted}>Sem assinatura</span>}</td><td><span className={styles.cellNote}>Trial: {formatDate(restaurant.trialEndsAt)}</span><span className={styles.cellNote}>Acesso: {formatDate(restaurant.accessEndsAt)}</span></td><td><div className={styles.rowActions}><Link href={`/loja/${restaurant.slug}`} target="_blank">Loja</Link><button type="button" onClick={() => void openRestaurant(restaurant.id)}>Gerenciar</button><button type="button" onClick={() => onPasswordReset(restaurant.ownerEmail)}>Senha</button></div></td></tr>)}</tbody></table></div>
      {!filtered.length ? <div className={styles.emptyState}><b>Nenhum estabelecimento encontrado</b><span>Ajuste a busca ou o filtro.</span></div> : null}
    </article>
    {selectedId ? <section className={styles.managementDetail}><div className={styles.detailTopbar}><div><span className={styles.eyebrow}>OPERAÇÃO DO ESTABELECIMENTO</span><h2>{detail?.restaurant.name || "Carregando…"}</h2></div><button type="button" onClick={closeRestaurant}>Fechar ×</button></div>{detail ? <>
      <div className={styles.detailStats}><div><span>Produtos</span><b>{detail.counts.products}</b></div><div><span>Pedidos</span><b>{detail.counts.orders}</b></div><div><span>Clientes</span><b>{detail.counts.customers}</b></div><div><span>Receita entregue</span><b>{money.format(detail.counts.deliveredRevenueCents / 100)}</b></div></div>
      <label className={styles.reasonBox}>Motivo para ações sensíveis<textarea value={reason} onChange={(event) => setReason(event.target.value)} minLength={10} maxLength={500} rows={2} placeholder="Descreva o chamado, a confirmação do titular e o motivo…" /></label>
      <div className={styles.detailGrid}><article className={styles.panel}><div className={styles.panelHeader}><div><h2>Controle de operação</h2><p>Bloqueio é diferente de pausa e impede o acesso administrativo da loja.</p></div></div><div className={styles.actionButtons}><button disabled={busy || Boolean(detail.restaurant.blockedAt)} onClick={() => void restaurantAction("pause")}>Pausar</button><button disabled={busy || Boolean(detail.restaurant.blockedAt)} onClick={() => void restaurantAction("reactivate")}>Reativar</button>{detail.restaurant.blockedAt ? <button className={styles.safeAction} disabled={busy} onClick={() => void restaurantAction("unblock")}>Desbloquear</button> : <button className={styles.dangerAction} disabled={busy} onClick={() => void restaurantAction("block")}>Bloquear</button>}</div>{detail.restaurant.blockedAt ? <p className={styles.blockReason}>Bloqueado em {formatDate(detail.restaurant.blockedAt)}: {detail.restaurant.blockReason}</p> : null}</article>
      <article className={styles.panel}><div className={styles.panelHeader}><div><h2>Plano e janela de acesso</h2><p>A alteração exige motivo e fica registrada.</p></div></div><form key={`${detail.restaurant.id}:${detail.restaurant.updatedAt}`} className={styles.compactForm} onSubmit={updateCommercial}><label>Plano<select name="plan" defaultValue={detail.restaurant.plan}><option value="start">Start</option><option value="growth">Growth</option><option value="scale">Scale</option></select></label><label>Status<select name="status" defaultValue={detail.restaurant.status}><option value="trial">Trial</option><option value="active">Ativo</option><option value="paused">Pausado</option><option value="canceled">Cancelado</option></select></label><label>Fim do trial<input name="trialEndsAt" type="datetime-local" defaultValue={dateInput(detail.restaurant.trialEndsAt)} /></label><label>Fim do acesso<input name="accessEndsAt" type="datetime-local" defaultValue={dateInput(detail.restaurant.accessEndsAt)} /></label><button className={styles.primaryButton} disabled={busy}>Salvar condições</button></form></article></div>
      <div className={styles.detailGrid}><article className={styles.panel}><div className={styles.panelHeader}><div><h2>Equipe do estabelecimento</h2><p>Identidades separadas da equipe interna RapidexMenu.</p></div></div><div className={styles.memberList}>{detail.members.map((member) => <div className={styles.memberRow} key={member.id}><div><b>{member.name || member.email}</b><span>{member.email} · {member.role} · {member.userStatus}</span></div><div><button disabled={busy} onClick={() => void memberAction(member, member.active ? "deactivate" : "activate")}>{member.active ? "Desativar vínculo" : "Ativar vínculo"}</button>{member.userId ? <button className={member.userStatus === "blocked" ? styles.safeAction : styles.dangerText} disabled={busy} onClick={() => void memberAction(member, member.userStatus === "blocked" ? "unblock" : "block")}>{member.userStatus === "blocked" ? "Desbloquear conta" : "Bloquear conta"}</button> : null}</div></div>)}</div><form className={styles.compactForm} onSubmit={addMember}><label>Nome<input name="name" required /></label><label>E-mail<input name="email" type="email" required /></label><label>Perfil<select name="role" defaultValue="operator"><option value="owner">Proprietário</option><option value="manager">Gerente</option><option value="operator">Operação</option><option value="finance">Financeiro</option></select></label><button className={styles.primaryButton} disabled={busy}>Adicionar membro</button></form></article>
      <article className={styles.panel}><div className={styles.panelHeader}><div><h2>Histórico de suporte</h2><p>Notas internas, autor e horário para continuidade do atendimento.</p></div></div><form className={styles.noteForm} onSubmit={addNote}><textarea name="note" required minLength={3} maxLength={2000} rows={3} placeholder="Registre contexto, diagnóstico e próximo passo…" /><button className={styles.primaryButton} disabled={busy}>Registrar nota</button></form><div className={styles.noteList}>{notes.map((note) => <div key={note.id}><p>{note.note}</p><span>{note.actorEmail} · {dateTime.format(new Date(note.createdAt))}</span></div>)}{!notes.length ? <span className={styles.muted}>Nenhuma nota registrada.</span> : null}</div></article></div>
      <article className={styles.panel}><div className={styles.panelHeader}><div><h2>Pedidos recentes</h2><p>Contexto rápido para suporte operacional.</p></div></div><div className={styles.recentOrders}>{detail.recentOrders.map((order) => <div key={order.id}><b>#{order.number}</b><span>{order.status} · {order.paymentStatus}</span><strong>{money.format(order.totalCents / 100)}</strong><small>{dateTime.format(new Date(order.createdAt))}</small></div>)}{!detail.recentOrders.length ? <span className={styles.muted}>Nenhum pedido registrado.</span> : null}</div></article>
    </> : <div className={styles.emptyState}><b>Carregando dados operacionais…</b></div>}</section> : null}
  </section>;
}

function formatDate(value: number | null) { return value ? dateTime.format(new Date(value)) : "—"; }
function dateInput(value: number | null) { if (!value) return ""; const date = new Date(value - new Date(value).getTimezoneOffset() * 60_000); return date.toISOString().slice(0, 16); }
function dateInputToTimestamp(value: FormDataEntryValue | null) { const text = String(value || ""); return text ? new Date(text).getTime() : null; }
function actionLabel(action: string) { return ({ pause: "pausar", reactivate: "reativar", block: "bloquear", unblock: "desbloquear" } as Record<string, string>)[action] || action; }
