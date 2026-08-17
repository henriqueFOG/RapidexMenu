"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import styles from "../../commercial.module.css";

type Integration = { provider: string; status: string };
type Restaurant = {
  id: string;
  name: string;
  slug: string;
  ownerEmail: string;
  plan: string;
  status: string;
  published: boolean;
  createdAt: number;
  firstOrderAt: number | null;
  activatedWithin48h: boolean;
  trialEndsAt: number | null;
  accessEndsAt: number | null;
  subscription: { plan: string; amountCents: number; status: string } | null;
  integrations: Integration[];
};
type Overview = {
  metrics: {
    restaurants: number;
    published: number;
    activated: number;
    activationRate: number;
    activation48hRate: number;
    trials: number;
    trialsExpiring72h: number;
    payingRestaurants: number;
    mrrCents: number;
    arrRunRateCents: number;
    has30dSubscriptionHistory: boolean;
    newMrr30dCents: number;
    expansionMrr30dCents: number;
    contractionMrr30dCents: number;
    churnMrr30dCents: number;
    nrr30d: number | null;
    logoChurn30d: number | null;
  };
  operations: {
    jobsQueued: number;
    jobsRunning: number;
    jobsRetry: number;
    jobsDead: number;
    failedWebhooks24h: number;
    stalePendingPayments: number;
    dunningFailed: number;
    dunningSending: number;
    aiResponsesToday: number;
    aiTranscriptionsToday: number;
    aiInputTokensToday: number;
    aiOutputTokensToday: number;
  };
  restaurants: Restaurant[];
};
type Health = {
  build?: { sha?: string | null; ref?: string | null };
  integrations?: Record<string, unknown> & {
    environment?: string;
    environmentSafe?: boolean;
    database?: boolean;
    databaseEngine?: string | null;
    nativeAuth?: boolean;
    uploads?: boolean;
    billing?: boolean;
    email?: boolean;
    sellerPayments?: boolean;
    reconciliation?: boolean;
    metaEmbeddedSignup?: boolean;
    openai?: boolean;
    whatsapp?: boolean;
  };
};
type PlatformAdmin = {
  id: string;
  userId: string;
  email: string;
  fullName: string;
  role: "owner" | "admin" | "support" | "viewer";
  status: string;
  userStatus: string;
  lastAccessAt: number | null;
  createdAt: number;
};
type CurrentAdmin = Pick<PlatformAdmin, "email" | "role"> & { name: string };
type Tab = "resumo" | "restaurantes" | "administradores" | "suporte" | "receita" | "operacao" | "infra";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const dateTime = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });
const num = new Intl.NumberFormat("pt-BR");
const roleNames: Record<PlatformAdmin["role"], string> = {
  owner: "Proprietário",
  admin: "Administrador",
  support: "Suporte",
  viewer: "Somente leitura",
};

export default function PlatformConsoleClient({ currentAdmin }: { currentAdmin: CurrentAdmin }) {
  const [data, setData] = useState<Overview | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [admins, setAdmins] = useState<PlatformAdmin[]>([]);
  const [tab, setTab] = useState<Tab>("resumo");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [error, setError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [actionBusy, setActionBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [supportEmail, setSupportEmail] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [overviewResponse, healthResponse, adminsResponse] = await Promise.all([
        fetch("/api/internal/platform/overview", { cache: "no-store" }),
        fetch("/api/health", { cache: "no-store" }),
        fetch("/api/internal/platform/admins", { cache: "no-store" }),
      ]);
      const overview = await overviewResponse.json() as Overview & { error?: { message?: string } };
      const healthPayload = await healthResponse.json() as Health;
      const adminsPayload = await adminsResponse.json() as { admins?: PlatformAdmin[]; error?: { message?: string } };
      if (!overviewResponse.ok) throw new Error(overview.error?.message || "Não foi possível carregar a Central.");
      if (!adminsResponse.ok) throw new Error(adminsPayload.error?.message || "Não foi possível carregar os administradores.");
      setData(overview);
      setHealth(healthPayload);
      setAdmins(adminsPayload.admins || []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Falha ao carregar a Central.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const filtered = useMemo(() => {
    if (!data) return [];
    const term = query.trim().toLowerCase();
    return data.restaurants.filter((restaurant) =>
      (status === "all" || restaurant.status === status) &&
      (!term || `${restaurant.name} ${restaurant.slug} ${restaurant.ownerEmail} ${restaurant.plan}`.toLowerCase().includes(term)),
    );
  }, [data, query, status]);

  function openPasswordSupport(email: string) {
    setSupportEmail(email);
    setActionMessage("");
    setTab("suporte");
  }

  async function createAdmin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setActionBusy(true);
    setActionMessage("");
    setError("");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      const response = await fetch("/api/internal/platform/admins", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fullName: form.get("fullName"),
          email: form.get("email"),
          role: form.get("role"),
          reason: form.get("reason"),
        }),
      });
      const payload = await response.json() as {
        error?: { message?: string };
        firstAccess?: { delivery: "email" | "manual"; url: string | null; expiresAt: number } | null;
      };
      if (!response.ok) throw new Error(payload.error?.message || "Não foi possível cadastrar o administrador.");
      formElement.reset();
      if (payload.firstAccess?.delivery === "manual" && payload.firstAccess.url) {
        setActionMessage(`Administrador criado. Link único de primeiro acesso: ${payload.firstAccess.url}`);
      } else if (payload.firstAccess?.delivery === "email") {
        setActionMessage("Administrador criado e instruções de primeiro acesso enviadas por e-mail.");
      } else {
        setActionMessage("Perfil administrativo concedido à conta existente.");
      }
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível cadastrar o administrador.");
    } finally {
      setActionBusy(false);
    }
  }

  async function issueReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setActionBusy(true);
    setActionMessage("");
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/internal/platform/password-resets", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: form.get("email"), reason: form.get("reason") }),
      });
      const payload = await response.json() as {
        error?: { message?: string };
        delivery?: "email" | "manual";
        resetUrl?: string | null;
      };
      if (!response.ok) throw new Error(payload.error?.message || "Não foi possível iniciar a redefinição.");
      setActionMessage(payload.delivery === "email"
        ? "Link seguro enviado ao e-mail cadastrado. A senha atual não foi exibida nem alterada pela Central."
        : `E-mail transacional indisponível. Link único para entregar ao titular: ${payload.resetUrl}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível iniciar a redefinição.");
    } finally {
      setActionBusy(false);
    }
  }

  if (loading && !data) return <main className={styles.shell}><section className={styles.card}>Carregando central administrativa…</section></main>;
  if (!data) return <main className={styles.shell}><section className={styles.card}><p className={styles.error}>{error || "Dados indisponíveis."}</p></section></main>;

  const metrics = data.metrics;
  const operations = data.operations;
  const readiness = health?.integrations;
  const risks = operations.jobsDead + operations.failedWebhooks24h + operations.stalePendingPayments + operations.dunningFailed;

  return <main className={styles.shell}><section className={styles.card} style={{ maxWidth: 1280 }}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
      <div>
        <Link className={styles.brand} href="/"><span>⚡</span><b>Rapidex<i>Menu</i></b></Link>
        <small className={styles.kicker}>ADMINISTRAÇÃO DA PLATAFORMA</small>
        <h1 className={styles.title}>Central de gerenciamento</h1>
        <p className={styles.intro}>Controle executivo, comercial, operacional e técnico do SaaS. Senhas e segredos nunca são exibidos.</p>
        <small>Conectado como <b>{currentAdmin.name}</b> · {roleNames[currentAdmin.role]} · {currentAdmin.email}</small>
      </div>
      <button onClick={() => void load()} disabled={loading} style={button}>{loading ? "Atualizando…" : "↻ Atualizar"}</button>
    </div>

    <nav aria-label="Seções da Central" style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "22px 0", paddingBottom: 12, borderBottom: "1px solid #e5e5e5" }}>
      <TabButton active={tab === "resumo"} click={() => setTab("resumo")}>Visão geral</TabButton>
      <TabButton active={tab === "restaurantes"} click={() => setTab("restaurantes")}>Estabelecimentos</TabButton>
      <TabButton active={tab === "administradores"} click={() => setTab("administradores")}>Superadmins</TabButton>
      <TabButton active={tab === "suporte"} click={() => setTab("suporte")}>Suporte</TabButton>
      <TabButton active={tab === "receita"} click={() => setTab("receita")}>Receita</TabButton>
      <TabButton active={tab === "operacao"} click={() => setTab("operacao")}>Operação</TabButton>
      <TabButton active={tab === "infra"} click={() => setTab("infra")}>Infraestrutura</TabButton>
    </nav>

    {tab === "resumo" && <>
      <div style={grid}>
        <Metric label="Estabelecimentos" value={String(metrics.restaurants)} note={`${metrics.published} publicados`} />
        <Metric label="Ativação" value={`${metrics.activationRate}%`} note={`${metrics.activated} com primeiro pedido`} />
        <Metric label="Pagantes" value={String(metrics.payingRestaurants)} note={`${metrics.trials} em trial`} />
        <Metric label="MRR" value={money.format(metrics.mrrCents / 100)} note={`ARR ${money.format(metrics.arrRunRateCents / 100)}`} />
        <Metric label="Riscos" value={String(risks)} note={risks ? "exigem atenção" : "operação saudável"} />
        <Metric label="Ambiente" value={String(readiness?.environment || "—")} note={readiness?.environmentSafe ? "configuração segura" : "revisar configuração"} />
      </div>
      <section className={styles.panel}><h2>Acesso rápido</h2><div style={actions}>
        <Link className={styles.linkButton} href="/central/jobs">Fila e DLQ</Link>
        <button style={button} onClick={() => setTab("suporte")}>Redefinir acesso</button>
        <button style={button} onClick={() => setTab("administradores")}>Gerenciar superadmins</button>
      </div></section>
    </>}

    {tab === "restaurantes" && <section className={styles.panel}>
      <h2>Estabelecimentos</h2>
      <p>Acompanhe onboarding, publicação, trial, ativação, plano e integrações sem misturar o acesso do estabelecimento com a Central.</p>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(220px,1fr) 180px", gap: 10, margin: "14px 0" }}>
        <input aria-label="Buscar estabelecimento" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar nome, endereço ou proprietário…" style={input} />
        <select aria-label="Filtrar status" value={status} onChange={(event) => setStatus(event.target.value)} style={input}>
          <option value="all">Todos</option><option value="trial">Trial</option><option value="active">Ativo</option><option value="paused">Pausado</option><option value="canceled">Cancelado</option>
        </select>
      </div>
      <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1080 }}>
        <thead><tr><Th>Loja</Th><Th>Proprietário</Th><Th>Plano/status</Th><Th>Ativação</Th><Th>Assinatura</Th><Th>Integrações</Th><Th>Trial/acesso</Th><Th>Ações</Th></tr></thead>
        <tbody>{filtered.map((restaurant) => <tr key={restaurant.id} style={{ borderTop: "1px solid #e8e8e8" }}>
          <Td><b>{restaurant.name}</b><small style={sub}>/{restaurant.slug} · {restaurant.published ? "publicada" : "não publicada"}</small></Td>
          <Td>{restaurant.ownerEmail}</Td>
          <Td><b>{restaurant.plan}</b><small style={sub}>{restaurant.status}</small></Td>
          <Td>{restaurant.firstOrderAt ? <><b>{restaurant.activatedWithin48h ? "≤48h" : ">48h"}</b><small style={sub}>{dateTime.format(new Date(restaurant.firstOrderAt))}</small></> : <b>Sem pedido</b>}</Td>
          <Td>{restaurant.subscription ? <><b>{money.format(restaurant.subscription.amountCents / 100)}/mês</b><small style={sub}>{restaurant.subscription.status}</small></> : "Sem assinatura"}</Td>
          <Td>{restaurant.integrations.length ? restaurant.integrations.map((integration) => <small key={integration.provider} style={{ display: "block" }}>{integration.provider}: <b>{integration.status}</b></small>) : "—"}</Td>
          <Td><small style={{ display: "block" }}>Trial: {restaurant.trialEndsAt ? dateTime.format(new Date(restaurant.trialEndsAt)) : "—"}</small><small style={{ display: "block" }}>Acesso: {restaurant.accessEndsAt ? dateTime.format(new Date(restaurant.accessEndsAt)) : "—"}</small></Td>
          <Td><div style={{ ...actions, alignItems: "flex-start" }}><Link href={`/loja/${restaurant.slug}`} target="_blank">Abrir ↗</Link><button style={textButton} onClick={() => openPasswordSupport(restaurant.ownerEmail)}>Redefinir acesso</button></div></Td>
        </tr>)}</tbody>
      </table></div>
      <small>{filtered.length} resultado(s)</small>
    </section>}

    {tab === "administradores" && <>
      <section className={styles.panel}><h2>Superadmins da plataforma</h2><p>Perfis internos independentes dos estabelecimentos. Toda concessão de acesso fica registrada na auditoria.</p>
        <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
          <thead><tr><Th>Nome</Th><Th>E-mail</Th><Th>Perfil</Th><Th>Status</Th><Th>Último acesso</Th></tr></thead>
          <tbody>{admins.map((admin) => <tr key={admin.id} style={{ borderTop: "1px solid #e8e8e8" }}><Td><b>{admin.fullName}</b></Td><Td>{admin.email}</Td><Td>{roleNames[admin.role]}</Td><Td>{admin.status}</Td><Td>{admin.lastAccessAt ? dateTime.format(new Date(admin.lastAccessAt)) : "Nunca"}</Td></tr>)}</tbody>
        </table></div>
      </section>
      {currentAdmin.role === "owner" && <section className={styles.panel}><h2>Cadastrar novo superadmin</h2><p>O novo usuário receberá um link de primeiro acesso para criar a própria senha.</p>
        <form onSubmit={createAdmin} className={styles.grid}>
          <label className={styles.field}>Nome<input name="fullName" required minLength={2} maxLength={120} /></label>
          <label className={styles.field}>E-mail<input name="email" type="email" required /></label>
          <label className={styles.field}>Perfil<select name="role" defaultValue="support"><option value="owner">Proprietário</option><option value="admin">Administrador</option><option value="support">Suporte</option><option value="viewer">Somente leitura</option></select></label>
          <label className={`${styles.field} ${styles.wide}`}>Motivo da concessão<textarea name="reason" required minLength={10} maxLength={500} rows={3} /></label>
          <button className={`${styles.button} ${styles.wide}`} disabled={actionBusy}>{actionBusy ? "Cadastrando…" : "Cadastrar acesso administrativo"}</button>
        </form>
      </section>}
    </>}

    {tab === "suporte" && <section className={styles.panel}><h2>Recuperação segura de acesso</h2><p>A Central nunca mostra nem escolhe a senha do usuário. Ela emite um link individual, temporário e de uso único, invalida links anteriores e registra o motivo.</p>
      <form onSubmit={issueReset} className={styles.grid}>
        <label className={`${styles.field} ${styles.wide}`}>E-mail da conta<input name="email" type="email" required value={supportEmail} onChange={(event) => setSupportEmail(event.target.value)} /></label>
        <label className={`${styles.field} ${styles.wide}`}>Motivo do atendimento<textarea name="reason" required minLength={10} maxLength={500} rows={3} placeholder="Ex.: titular confirmou perda de acesso no chamado #123" /></label>
        <button className={`${styles.button} ${styles.wide}`} disabled={actionBusy}>{actionBusy ? "Gerando…" : "Gerar redefinição segura"}</button>
      </form>
    </section>}

    {tab === "receita" && <>
      <section className={styles.panel}><h2>Receita recorrente</h2><div style={grid}>
        <Metric label="MRR" value={money.format(metrics.mrrCents / 100)} note={`${metrics.payingRestaurants} clientes`} />
        <Metric label="ARR run-rate" value={money.format(metrics.arrRunRateCents / 100)} note="MRR × 12" />
        <Metric label="New MRR · 30d" value={money.format(metrics.newMrr30dCents / 100)} note="nova receita" />
        <Metric label="Expansion · 30d" value={money.format(metrics.expansionMrr30dCents / 100)} note="expansão" />
        <Metric label="Contraction · 30d" value={money.format(metrics.contractionMrr30dCents / 100)} note="redução" />
        <Metric label="Churned · 30d" value={money.format(metrics.churnMrr30dCents / 100)} note="receita perdida" />
      </div></section>
      <section className={styles.panel}><h2>Retenção</h2><div style={grid}>
        <Metric label="NRR" value={metrics.nrr30d === null ? "Formando janela" : `${metrics.nrr30d}%`} note="retenção líquida" />
        <Metric label="Logo churn" value={metrics.logoChurn30d === null ? "Formando janela" : `${metrics.logoChurn30d}%`} note="clientes perdidos" />
        <Metric label="Ativação ≤48h" value={`${metrics.activation48hRate}%`} note="time-to-value" />
        <Metric label="Trials vencendo" value={String(metrics.trialsExpiring72h)} note="próximas 72h" />
      </div></section>
    </>}

    {tab === "operacao" && <section className={styles.panel}><h2>Operação e incidentes</h2><div style={grid}>
      <Metric label="Jobs ativos" value={num.format(operations.jobsQueued + operations.jobsRunning)} note={`${operations.jobsRetry} retry · ${operations.jobsDead} DLQ`} />
      <Metric label="Webhooks falhos" value={String(operations.failedWebhooks24h)} note="24 horas" />
      <Metric label="Pagamentos pendentes" value={String(operations.stalePendingPayments)} note="> 30 min" />
      <Metric label="Dunning" value={String(operations.dunningSending)} note={`${operations.dunningFailed} falho(s)`} />
      <Metric label="IA hoje" value={num.format(operations.aiResponsesToday)} note={`${num.format(operations.aiTranscriptionsToday)} transcrições`} />
      <Metric label="Tokens IA" value={num.format(operations.aiInputTokensToday + operations.aiOutputTokensToday)} note="consumo de hoje" />
    </div><div className={styles.footerActions}><Link className={styles.linkButton} href="/central/jobs">Abrir fila e DLQ →</Link></div></section>}

    {tab === "infra" && <>
      <section className={styles.panel}><h2>Infraestrutura</h2><div style={grid}>
        <Metric label="Banco" value={readiness?.database ? String(readiness.databaseEngine || "conectado") : "Indisponível"} note="conexão da aplicação" />
        <Metric label="Build" value={health?.build?.sha ? health.build.sha.slice(0, 8) : "—"} note={health?.build?.ref || "ref indisponível"} />
        <Metric label="Autenticação" value={readiness?.nativeAuth ? "Pronta" : "Pendente"} note="sessões comerciais" />
        <Metric label="Uploads" value={readiness?.uploads ? "Prontos" : "Pendentes"} note="mídia" />
      </div></section>
      <section className={styles.panel}><h2>Integrações</h2><div style={grid}>
        <Flag label="Billing" value={readiness?.billing} /><Flag label="E-mail" value={readiness?.email} /><Flag label="Pix vendedor" value={readiness?.sellerPayments} /><Flag label="Reconciliação" value={readiness?.reconciliation} /><Flag label="Meta" value={readiness?.metaEmbeddedSignup} /><Flag label="OpenAI" value={readiness?.openai} /><Flag label="WhatsApp" value={readiness?.whatsapp} />
      </div></section>
    </>}

    {actionMessage && <p className={styles.success} style={{ overflowWrap: "anywhere" }}>{actionMessage}</p>}
    {error && <p className={styles.error}>{error}</p>}
  </section></main>;
}

function Metric({ label, value, note }: { label: string; value: string; note: string }) {
  return <div style={card}><small style={{ fontWeight: 900 }}>{label}</small><strong style={{ display: "block", fontSize: 24, margin: "5px 0" }}>{value}</strong><span style={{ fontSize: 12, color: "#6d716a" }}>{note}</span></div>;
}
function Flag({ label, value }: { label: string; value: unknown }) { return <Metric label={label} value={value ? "✓ Configurado" : "○ Pendente"} note="status do ambiente" />; }
function TabButton({ active, click, children }: { active: boolean; click: () => void; children: React.ReactNode }) { return <button onClick={click} aria-current={active ? "page" : undefined} style={{ ...button, background: active ? "#191b18" : "#fff", color: active ? "#fff" : "#191b18" }}>{children}</button>; }
function Th({ children }: { children: React.ReactNode }) { return <th style={{ textAlign: "left", padding: "10px 8px", fontSize: 12 }}>{children}</th>; }
function Td({ children }: { children: React.ReactNode }) { return <td style={{ padding: "12px 8px", verticalAlign: "top", fontSize: 13 }}>{children}</td>; }

const grid = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12, margin: "18px 0" } as const;
const card = { border: "1px solid #e5e5e5", borderRadius: 14, padding: 16, background: "#fff" } as const;
const button = { border: "1px solid #d8d8d8", borderRadius: 999, padding: "10px 14px", background: "#fff", fontWeight: 900, cursor: "pointer" } as const;
const textButton = { border: 0, padding: 0, background: "transparent", color: "#1f5cc1", cursor: "pointer", textDecoration: "underline", font: "inherit" } as const;
const input = { border: "1px solid #d8d8d8", borderRadius: 12, padding: "11px 12px", background: "#fff", font: "inherit" } as const;
const sub = { display: "block", color: "#6d716a", marginTop: 3 } as const;
const actions = { display: "flex", gap: 10, flexWrap: "wrap" } as const;
