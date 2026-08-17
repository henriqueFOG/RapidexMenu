"use client";

import Link from "next/link";
import { FormEvent, ReactNode, useCallback, useEffect, useState } from "react";
import RestaurantManagementPanel, { type ManagedRestaurant } from "./RestaurantManagementPanel";
import styles from "./PlatformConsole.module.css";

type Restaurant = ManagedRestaurant;
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
  dataQuality: {
    live: number;
    demo: number;
    test: number;
    excludedFromCommercial: number;
  };
  restaurants: Restaurant[];
};
type ServiceState = "operational" | "attention" | "incident";
type HealthService = { status: ServiceState; label: string; detail: string };
type Health = {
  ok?: boolean;
  status?: ServiceState;
  checkedAt?: number;
  responseTimeMs?: number;
  build?: { sha?: string | null; ref?: string | null; url?: string | null };
  coreServices?: Record<string, HealthService>;
  integrations?: Record<string, unknown> & {
    environment?: string;
    environmentSafe?: boolean;
    environmentIssues?: string[];
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
type AuditEvent = {
  id: string;
  actorEmail: string;
  actorRole: string;
  action: string;
  targetType: string;
  targetId: string | null;
  reason: string | null;
  requestId: string | null;
  createdAt: number;
};
type ProductionReadiness = {
  ready: boolean;
  checks: Array<{ id: string; label: string; ok: boolean; detail: string }>;
};
type CurrentAdmin = Pick<PlatformAdmin, "email" | "role"> & { name: string };
type Tab = "resumo" | "restaurantes" | "administradores" | "auditoria" | "suporte" | "receita" | "operacao" | "infra";
type IconName = Tab | "refresh" | "external" | "shield" | "store" | "money" | "alert" | "check" | "clock" | "database" | "server" | "key" | "upload" | "search";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const dateTime = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });
const num = new Intl.NumberFormat("pt-BR");
const roleNames: Record<PlatformAdmin["role"], string> = {
  owner: "Proprietário",
  admin: "Administrador",
  support: "Suporte",
  viewer: "Somente leitura",
};
const tabs: Array<{ id: Tab; label: string }> = [
  { id: "resumo", label: "Visão geral" },
  { id: "restaurantes", label: "Estabelecimentos" },
  { id: "administradores", label: "Superadmins" },
  { id: "auditoria", label: "Auditoria" },
  { id: "suporte", label: "Suporte" },
  { id: "receita", label: "Receita" },
  { id: "operacao", label: "Operação" },
  { id: "infra", label: "Infraestrutura" },
];
const iconPaths: Record<IconName, ReactNode> = {
  resumo: <><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></>, restaurantes: <><path d="M4 10h16l-2-6H6l-2 6Z"/><path d="M5 10v10h14V10M9 20v-6h6v6"/></>, administradores: <><circle cx="9" cy="8" r="3"/><path d="M3.5 20v-2a5.5 5.5 0 0 1 11 0v2M16 5.5a3 3 0 0 1 0 5.8M17 14a5 5 0 0 1 4 4.9V20"/></>, auditoria: <><path d="M5 4h14v16H5z"/><path d="M8 8h8M8 12h8M8 16h5"/></>, suporte: <><circle cx="12" cy="12" r="9"/><path d="M8.5 9a3.6 3.6 0 1 1 5.7 2.9c-1.4 1-2.2 1.5-2.2 3.1M12 18h.01"/></>, receita: <><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 10h18M8 15h3"/></>, operacao: <><path d="M4 18V9M10 18V5M16 18v-7M22 18V3"/><path d="M2 18h22"/></>, infra: <><rect x="3" y="4" width="18" height="6" rx="2"/><rect x="3" y="14" width="18" height="6" rx="2"/><path d="M7 7h.01M7 17h.01M11 7h6M11 17h6"/></>, refresh: <><path d="M20 11a8 8 0 1 0 1 5"/><path d="M20 4v7h-7"/></>, external: <><path d="M14 4h6v6M20 4l-9 9"/><path d="M18 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h6"/></>, shield: <><path d="M12 3 5 6v5c0 4.5 2.8 8 7 10 4.2-2 7-5.5 7-10V6l-7-3Z"/><path d="m9 12 2 2 4-4"/></>, store: <><path d="M4 10h16l-2-6H6l-2 6ZM5 10v10h14V10"/><path d="M9 20v-6h6v6"/></>, money: <><circle cx="12" cy="12" r="9"/><path d="M15 8.5c-.7-.6-1.7-1-3-1-1.7 0-3 .8-3 2s1.1 1.8 3 2.2 3 1 3 2.3-1.3 2.3-3 2.3c-1.3 0-2.5-.4-3.3-1.1M12 5.5v13"/></>, alert: <><path d="M12 4 3 20h18L12 4Z"/><path d="M12 9v5M12 17h.01"/></>, check: <path d="m5 12 4 4L19 6"/>, clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>, database: <><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/></>, server: <><rect x="3" y="4" width="18" height="6" rx="2"/><rect x="3" y="14" width="18" height="6" rx="2"/><path d="M7 7h.01M7 17h.01"/></>, key: <><circle cx="8" cy="15" r="4"/><path d="m11 12 8-8M16 7l2 2M14 9l2 2"/></>, upload: <><path d="M12 16V4M8 8l4-4 4 4"/><path d="M5 13v6h14v-6"/></>, search: <><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></>,
};

export default function PlatformConsoleClient({ currentAdmin }: { currentAdmin: CurrentAdmin }) {
  const [data, setData] = useState<Overview | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [admins, setAdmins] = useState<PlatformAdmin[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [productionReadiness, setProductionReadiness] = useState<ProductionReadiness | null>(null);
  const [tab, setTab] = useState<Tab>("resumo");
  const [error, setError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [actionBusy, setActionBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [supportEmail, setSupportEmail] = useState("");
  const [adminReason, setAdminReason] = useState("");

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setError("");
    try {
      const [overviewResponse, healthResponse, adminsResponse, auditResponse, readinessResponse] = await Promise.all([
        fetch("/api/internal/platform/overview", { cache: "no-store" }),
        fetch("/api/internal/platform/health", { cache: "no-store" }),
        fetch("/api/internal/platform/admins", { cache: "no-store" }),
        fetch("/api/internal/platform/audit?limit=100", { cache: "no-store" }),
        fetch("/api/internal/platform/readiness", { cache: "no-store" }),
      ]);
      const overview = await overviewResponse.json() as Overview & { error?: { message?: string } };
      const healthPayload = await healthResponse.json() as Health & { error?: { message?: string } };
      const adminsPayload = await adminsResponse.json() as { admins?: PlatformAdmin[]; error?: { message?: string } };
      const auditPayload = await auditResponse.json() as { events?: AuditEvent[]; error?: { message?: string } };
      const readinessPayload = await readinessResponse.json() as ProductionReadiness & { error?: { message?: string } };
      if (!overviewResponse.ok) throw new Error(overview.error?.message || "Não foi possível carregar a Central.");
      if (!adminsResponse.ok) throw new Error(adminsPayload.error?.message || "Não foi possível carregar os administradores.");
      if (!auditResponse.ok) throw new Error(auditPayload.error?.message || "Não foi possível carregar a auditoria.");
      if (!readinessResponse.ok) throw new Error(readinessPayload.error?.message || "Não foi possível avaliar o gate de produção.");
      setData(overview);
      setAdmins(adminsPayload.admins || []);
      setAuditEvents(auditPayload.events || []);
      setProductionReadiness(readinessPayload);
      setHealth(healthResponse.ok ? healthPayload : {
        ok: false,
        status: "incident",
        checkedAt: Date.now(),
        coreServices: {
          application: { status: "incident", label: "Aplicação", detail: healthPayload.error?.message || "Health check indisponível" },
        },
      });
      setLastUpdated(Date.now());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Falha ao carregar a Central.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initialTimer = window.setTimeout(() => { void load(); }, 0);
    const refreshTimer = window.setInterval(() => { void load(true); }, 60_000);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(refreshTimer);
    };
  }, [load]);

  function changeTab(next: Tab) {
    setTab(next);
    setError("");
    setActionMessage("");
  }

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
      await load(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível cadastrar o administrador.");
    } finally {
      setActionBusy(false);
    }
  }

  async function updateAdmin(admin: PlatformAdmin, action: "change_role" | "revoke" | "restore", role?: PlatformAdmin["role"]) {
    setActionBusy(true);
    setActionMessage("");
    setError("");
    try {
      if (adminReason.trim().length < 10) throw new Error("Informe um motivo com pelo menos 10 caracteres.");
      const response = await fetch(`/api/internal/platform/admins/${admin.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, role, reason: adminReason }),
      });
      const payload = await response.json() as { error?: { message?: string } };
      if (!response.ok) throw new Error(payload.error?.message || "Não foi possível alterar o superadmin.");
      setActionMessage("Acesso administrativo atualizado e registrado na auditoria.");
      setAdminReason("");
      await load(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível alterar o superadmin.");
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

  if (loading && !data) return <LoadingState />;
  if (!data) return <main className={styles.statePage}><section className={styles.stateCard}><Icon name="alert" /><h1>Central indisponível</h1><p>{error || "Os dados não puderam ser carregados."}</p><button type="button" onClick={() => void load()}>Tentar novamente</button></section></main>;

  const metrics = data.metrics;
  const operations = data.operations;
  const operationalRisks = operations.jobsDead + operations.failedWebhooks24h + operations.stalePendingPayments + operations.dunningFailed;
  const coreAttention = Object.values(health?.coreServices || {}).filter((service) => service.status !== "operational").length;
  const totalRisks = operationalRisks + coreAttention;
  const healthStatus = health?.status || (health?.ok === false ? "incident" : "attention");

  return <main className={styles.shell}>
    <div className={styles.layout}>
      <aside className={styles.sidebar}>
        <Link className={styles.brand} href="/" aria-label="RapidexMenu — início"><span className={styles.brandMark}>R</span><span>Rapidex<b>Menu</b></span></Link>
        <div className={styles.productLabel}>Central administrativa</div>
        <nav className={styles.navigation} aria-label="Seções da Central">
          {tabs.map((item) => <button key={item.id} type="button" className={tab === item.id ? styles.navActive : ""} onClick={() => changeTab(item.id)}><Icon name={item.id} /><span>{item.label}</span>{item.id === "operacao" && operationalRisks > 0 ? <em>{operationalRisks}</em> : null}</button>)}
        </nav>
        <div className={styles.sidebarFooter}>
          <div className={styles.securityNote}><Icon name="shield" /><div><b>Ambiente protegido</b><span>Ações sensíveis são auditadas</span></div></div>
          <div className={styles.profile}>
            <span className={styles.avatar}>{initials(currentAdmin.name)}</span>
            <div><b>{currentAdmin.name}</b><span>{roleNames[currentAdmin.role]}</span></div>
          </div>
        </div>
      </aside>

      <section className={styles.workspace}>
        <header className={styles.topbar}>
          <div><span>RapidexMenu</span><b>/</b><strong>{tabs.find((item) => item.id === tab)?.label}</strong></div>
          <div className={styles.topbarActions}>
            <span className={`${styles.liveStatus} ${styles[healthStatus]}`}><i />{healthStatus === "operational" ? "Sistemas operacionais" : healthStatus === "incident" ? "Incidente detectado" : "Atenção necessária"}</span>
            <button type="button" className={styles.iconButton} onClick={() => void load()} disabled={loading} aria-label="Atualizar dados"><Icon name="refresh" /></button>
            <Link className={styles.iconButton} href="/" target="_blank" aria-label="Abrir aplicação"><Icon name="external" /></Link>
          </div>
        </header>

        <div className={styles.content}>
          {actionMessage ? <div className={styles.successBanner}><Icon name="check" /><span>{actionMessage}</span></div> : null}
          {error ? <div className={styles.errorBanner}><Icon name="alert" /><span>{error}</span></div> : null}

          {tab === "resumo" ? <OverviewPanel currentAdmin={currentAdmin} metrics={metrics} operations={operations} dataQuality={data.dataQuality} totalRisks={totalRisks} healthStatus={healthStatus} lastUpdated={lastUpdated} onTab={changeTab} /> : null}

          {tab === "restaurantes" ? <RestaurantManagementPanel restaurants={data.restaurants} onReload={() => load(true)} onPasswordReset={openPasswordSupport} /> : null}

          {tab === "administradores" ? <section>
            <PageHeading eyebrow="ACESSO INTERNO" title="Superadmins" description="Perfis da equipe RapidexMenu, totalmente independentes das contas de estabelecimentos." aside={<span className={styles.countBadge}>{admins.filter((admin) => admin.status === "active").length} ativos</span>} />
            <div className={styles.twoColumns}>
              <article className={styles.panel}>
                <div className={styles.panelHeader}><div><h2>Equipe administrativa</h2><p>Concessões e acessos ficam registrados na auditoria.</p></div><Icon name="shield" /></div>
                {currentAdmin.role === "owner" ? <label className={styles.reasonBox}>Motivo para alterações de acesso<textarea value={adminReason} onChange={(event) => setAdminReason(event.target.value)} minLength={10} maxLength={500} rows={2} placeholder="Ex.: mudança de função aprovada pelo proprietário…" /></label> : null}
                <div className={styles.adminList}>{admins.map((admin) => <div className={styles.adminRow} key={admin.id}>
                  <span className={styles.avatar}>{initials(admin.fullName)}</span><div className={styles.adminIdentity}><b>{admin.fullName}</b><span>{admin.email}</span></div><div><span className={styles.roleBadge}>{roleNames[admin.role]}</span><span className={styles.lastAccess}>{admin.lastAccessAt ? `Último acesso ${dateTime.format(new Date(admin.lastAccessAt))}` : "Ainda não acessou"}</span></div><StatusPill status={admin.status} />{currentAdmin.role === "owner" ? <div className={styles.adminActions}><select aria-label={`Perfil de ${admin.fullName}`} value={admin.role} onChange={(event) => void updateAdmin(admin, "change_role", event.target.value as PlatformAdmin["role"])} disabled={actionBusy}><option value="owner">Proprietário</option><option value="admin">Administrador</option><option value="support">Suporte</option><option value="viewer">Somente leitura</option></select><button type="button" disabled={actionBusy} onClick={() => void updateAdmin(admin, admin.status === "active" ? "revoke" : "restore")}>{admin.status === "active" ? "Revogar" : "Restaurar"}</button></div> : null}
                </div>)}</div>
              </article>
              {currentAdmin.role === "owner" ? <article className={`${styles.panel} ${styles.formPanel}`}>
                <div className={styles.panelHeader}><div><h2>Novo superadmin</h2><p>A pessoa cria a própria senha por um link temporário.</p></div><Icon name="key" /></div>
                <form onSubmit={createAdmin} className={styles.formGrid}>
                  <label>Nome completo<input name="fullName" required minLength={2} maxLength={120} placeholder="Nome da pessoa" /></label><label>E-mail<input name="email" type="email" required placeholder="email@empresa.com" /></label><label>Perfil<select name="role" defaultValue="support"><option value="owner">Proprietário</option><option value="admin">Administrador</option><option value="support">Suporte</option><option value="viewer">Somente leitura</option></select></label><label>Motivo da concessão<textarea name="reason" required minLength={10} maxLength={500} rows={3} placeholder="Explique por que esse acesso é necessário" /></label><button className={styles.primaryButton} disabled={actionBusy}>{actionBusy ? "Cadastrando…" : "Cadastrar acesso administrativo"}</button>
                </form>
              </article> : null}
            </div>
          </section> : null}

          {tab === "auditoria" ? <section>
            <PageHeading eyebrow="RASTREABILIDADE" title="Auditoria da plataforma" description="Quem fez, o que alterou, quando e por qual motivo. Ações sensíveis não ficam sem contexto." aside={<span className={styles.countBadge}>{auditEvents.length} eventos recentes</span>} />
            <article className={styles.panel}><div className={styles.auditList}>{auditEvents.map((event) => <div className={styles.auditRow} key={event.id}><span className={styles.auditIcon}><Icon name="shield" /></span><div><b>{auditActionLabel(event.action)}</b><span>{event.targetType}{event.targetId ? ` · ${event.targetId.slice(0, 12)}` : ""}</span><p>{event.reason || "Sem motivo legado registrado"}</p></div><div><b>{event.actorEmail}</b><span>{event.actorRole} · {dateTime.format(new Date(event.createdAt))}</span>{event.requestId ? <small>req {event.requestId.slice(0, 12)}</small> : null}</div></div>)}{!auditEvents.length ? <EmptyState title="Auditoria vazia" text="As próximas ações administrativas aparecerão aqui." /> : null}</div></article>
          </section> : null}

          {tab === "suporte" ? <section>
            <PageHeading eyebrow="ATENDIMENTO SEGURO" title="Recuperação de acesso" description="Resolva o acesso sem visualizar, escolher ou compartilhar a senha atual do usuário." />
            <div className={styles.supportGrid}>
              <article className={`${styles.panel} ${styles.formPanel}`}><div className={styles.panelHeader}><div><h2>Gerar redefinição segura</h2><p>O link é individual, temporário e de uso único.</p></div><Icon name="key" /></div><form onSubmit={issueReset} className={styles.formGrid}><label>E-mail da conta<input name="email" type="email" required value={supportEmail} onChange={(event) => setSupportEmail(event.target.value)} placeholder="titular@empresa.com" /></label><label>Motivo do atendimento<textarea name="reason" required minLength={10} maxLength={500} rows={4} placeholder="Ex.: titular confirmou perda de acesso no chamado #123" /></label><button className={styles.primaryButton} disabled={actionBusy}>{actionBusy ? "Gerando…" : "Gerar link de redefinição"}</button></form></article>
              <article className={`${styles.panel} ${styles.safetyPanel}`}><span className={styles.largeIcon}><Icon name="shield" /></span><h2>Proteções deste fluxo</h2><ul><li><Icon name="check" /><span>A senha existente nunca é exibida</span></li><li><Icon name="check" /><span>Links anteriores são invalidados</span></li><li><Icon name="check" /><span>O titular escolhe a nova senha</span></li><li><Icon name="check" /><span>Motivo e operador ficam auditados</span></li></ul></article>
            </div>
          </section> : null}

          {tab === "receita" ? <section>
            <PageHeading eyebrow="SAÚDE FINANCEIRA" title="Receita recorrente" description="Indicadores de crescimento e retenção da RapidexMenu." />
            <div className={styles.kpiGrid}><KpiCard icon="money" label="MRR atual" value={money.format(metrics.mrrCents / 100)} note={`${metrics.payingRestaurants} estabelecimentos pagantes`} tone="orange" /><KpiCard icon="money" label="ARR projetado" value={money.format(metrics.arrRunRateCents / 100)} note="MRR atual multiplicado por 12" tone="blue" /><KpiCard icon="store" label="NRR · 30 dias" value={metrics.nrr30d === null ? "Formando base" : `${metrics.nrr30d}%`} note="Retenção líquida de receita" tone="green" /><KpiCard icon="alert" label="Logo churn · 30 dias" value={metrics.logoChurn30d === null ? "Formando base" : `${metrics.logoChurn30d}%`} note="Estabelecimentos perdidos" tone={metrics.logoChurn30d ? "red" : "neutral"} /></div>
            <div className={styles.twoColumnsWide}><article className={styles.panel}><div className={styles.panelHeader}><div><h2>Movimentação do MRR</h2><p>Últimos 30 dias</p></div></div><div className={styles.movementList}><Movement label="Nova receita" value={metrics.newMrr30dCents} tone="positive" /><Movement label="Expansão" value={metrics.expansionMrr30dCents} tone="positive" /><Movement label="Contração" value={metrics.contractionMrr30dCents} tone="negative" /><Movement label="Churn" value={metrics.churnMrr30dCents} tone="negative" /></div></article><article className={styles.panel}><div className={styles.panelHeader}><div><h2>Conversão e ativação</h2><p>Da criação da conta até o primeiro valor percebido</p></div></div><Funnel metrics={metrics} /></article></div>
          </section> : null}

          {tab === "operacao" ? <section>
            <PageHeading eyebrow="OPERAÇÃO EM TEMPO REAL" title="Fila e incidentes" description="Sinais que podem afetar pedidos, pagamentos, cobrança e automações." aside={<Link className={styles.secondaryButton} href="/central/jobs">Abrir fila detalhada →</Link>} />
            <div className={styles.kpiGrid}><KpiCard icon="clock" label="Jobs ativos" value={num.format(operations.jobsQueued + operations.jobsRunning)} note={`${operations.jobsQueued} aguardando · ${operations.jobsRunning} executando`} tone="blue" /><KpiCard icon="alert" label="Retry e DLQ" value={num.format(operations.jobsRetry + operations.jobsDead)} note={`${operations.jobsRetry} em retry · ${operations.jobsDead} mortos`} tone={operations.jobsRetry + operations.jobsDead ? "red" : "green"} /><KpiCard icon="money" label="Pagamentos parados" value={String(operations.stalePendingPayments)} note="Pendentes há mais de 30 minutos" tone={operations.stalePendingPayments ? "red" : "green"} /><KpiCard icon="server" label="Webhooks falhos" value={String(operations.failedWebhooks24h)} note="Ocorrências nas últimas 24 horas" tone={operations.failedWebhooks24h ? "red" : "green"} /></div>
            <div className={styles.twoColumnsWide}><article className={styles.panel}><div className={styles.panelHeader}><div><h2>Automação e cobrança</h2><p>Processamentos que exigem acompanhamento</p></div></div><div className={styles.signalList}><Signal label="Cobranças em envio" value={operations.dunningSending} healthyNote="Nenhuma cobrança em processamento" /><Signal label="Cobranças com falha" value={operations.dunningFailed} healthyNote="Nenhuma falha de cobrança" danger /><Signal label="Jobs em retry" value={operations.jobsRetry} healthyNote="Nenhum job aguardando nova tentativa" danger /><Signal label="Jobs na DLQ" value={operations.jobsDead} healthyNote="Fila de erros vazia" danger /></div></article><article className={styles.panel}><div className={styles.panelHeader}><div><h2>Uso de inteligência artificial</h2><p>Consumo registrado hoje</p></div><Icon name="operacao" /></div><div className={styles.aiNumbers}><div><b>{num.format(operations.aiResponsesToday)}</b><span>respostas</span></div><div><b>{num.format(operations.aiTranscriptionsToday)}</b><span>transcrições</span></div><div><b>{num.format(operations.aiInputTokensToday + operations.aiOutputTokensToday)}</b><span>tokens</span></div></div></article></div>
          </section> : null}

          {tab === "infra" ? <InfrastructurePanel health={health} operations={operations} productionReadiness={productionReadiness} /> : null}
        </div>
      </section>
    </div>
  </main>;
}

function OverviewPanel({ currentAdmin, metrics, operations, dataQuality, totalRisks, healthStatus, lastUpdated, onTab }: { currentAdmin: CurrentAdmin; metrics: Overview["metrics"]; operations: Overview["operations"]; dataQuality: Overview["dataQuality"]; totalRisks: number; healthStatus: ServiceState; lastUpdated: number | null; onTab: (tab: Tab) => void }) {
  const firstName = currentAdmin.name.trim().split(/\s+/)[0] || "Henrique";
  return <section><div className={styles.hero}><div><span className={styles.eyebrow}>CENTRO DE COMANDO</span><h1>Olá, {firstName}. <span>Visão completa da operação.</span></h1><p>Dados comerciais, suporte e infraestrutura organizados para você decidir rápido e agir com segurança.</p></div><div className={styles.heroMeta}><span>Atualização automática · 60s</span><b>{lastUpdated ? `Atualizado ${dateTime.format(new Date(lastUpdated))}` : "Sincronizando dados"}</b></div></div>
    <div className={styles.qualityStrip}><Icon name="shield" /><div><b>Métricas comerciais protegidas</b><span>{dataQuality.live} reais incluídos · {dataQuality.demo} demonstração e {dataQuality.test} testes excluídos</span></div></div>
    <div className={styles.kpiGrid}><KpiCard icon="store" label="Estabelecimentos reais" value={String(metrics.restaurants)} note={`${metrics.published} publicados`} tone="orange" /><KpiCard icon="check" label="Taxa de ativação" value={`${metrics.activationRate}%`} note={`${metrics.activated} fizeram o primeiro pedido`} tone="green" /><KpiCard icon="money" label="Receita mensal real" value={money.format(metrics.mrrCents / 100)} note={`${metrics.payingRestaurants} pagantes · ${metrics.trials} em teste`} tone="blue" /><KpiCard icon="alert" label="Pontos de atenção" value={String(totalRisks)} note={totalRisks ? "Itens aguardando análise" : "Nenhum risco imediato"} tone={totalRisks ? "red" : "green"} /></div>
    <div className={`${styles.healthStrip} ${styles[healthStatus]}`}><span className={styles.healthIcon}><Icon name={healthStatus === "operational" ? "check" : "alert"} /></span><div><b>{healthStatus === "operational" ? "Núcleo da plataforma operacional" : healthStatus === "incident" ? "Incidente técnico detectado" : "Configuração exige atenção"}</b><span>{healthStatus === "operational" ? "Aplicação, banco, autenticação e armazenamento responderam normalmente." : "Abra Infraestrutura para identificar exatamente o componente afetado."}</span></div><button type="button" onClick={() => onTab("infra")}>Ver infraestrutura →</button></div>
    <div className={styles.dashboardGrid}><article className={styles.panel}><div className={styles.panelHeader}><div><h2>Funil de ativação</h2><p>Jornada dos estabelecimentos até o primeiro pedido</p></div><button type="button" className={styles.textButton} onClick={() => onTab("restaurantes")}>Ver estabelecimentos →</button></div><Funnel metrics={metrics} /></article><article className={styles.panel}><div className={styles.panelHeader}><div><h2>Radar operacional</h2><p>O que precisa da sua atenção agora</p></div><Icon name="alert" /></div><div className={styles.signalList}><Signal label="Jobs na fila de erro" value={operations.jobsDead} healthyNote="Nenhum job morto" danger /><Signal label="Webhooks falhos · 24h" value={operations.failedWebhooks24h} healthyNote="Webhooks saudáveis" danger /><Signal label="Pagamentos parados" value={operations.stalePendingPayments} healthyNote="Pagamentos processando normalmente" danger /><Signal label="Trials vencendo · 72h" value={metrics.trialsExpiring72h} healthyNote="Nenhum trial vencendo em breve" /></div></article></div>
    <article className={styles.quickPanel}><div><span className={styles.eyebrow}>ATALHOS OPERACIONAIS</span><h2>Resolva sem procurar em vários lugares</h2></div><div className={styles.quickActions}><button type="button" onClick={() => onTab("suporte")}><Icon name="key" /><span><b>Redefinir acesso</b><small>Gerar link seguro</small></span></button><button type="button" onClick={() => onTab("administradores")}><Icon name="shield" /><span><b>Superadmins</b><small>Gerenciar equipe</small></span></button><Link href="/central/jobs"><Icon name="operacao" /><span><b>Fila e DLQ</b><small>Reprocessar jobs</small></span></Link><button type="button" onClick={() => onTab("infra")}><Icon name="server" /><span><b>Infraestrutura</b><small>Ver saúde técnica</small></span></button></div></article>
  </section>;
}

function InfrastructurePanel({ health, operations, productionReadiness }: { health: Health | null; operations: Overview["operations"]; productionReadiness: ProductionReadiness | null }) {
  const readiness = health?.integrations;
  const overall = health?.status || (health?.ok === false ? "incident" : "attention");
  const serviceEntries = Object.entries(health?.coreServices || {});
  const fallbackServices: Array<[string, HealthService]> = [["application", { status: health?.ok === false ? "incident" : "attention", label: "Aplicação", detail: health?.ok === false ? "Health check indisponível" : "Aguardando verificação" }]];
  const services = serviceEntries.length ? serviceEntries : fallbackServices;
  const integrations = [
    integrationConfig("Cobrança da plataforma", "Mercado Pago da RapidexMenu", Boolean(readiness?.billing), readiness?.environment !== "production" ? "standby" : "optional"),
    integrationConfig("E-mail transacional", "Convites e recuperação de senha", Boolean(readiness?.email), "optional"),
    integrationConfig("Pix dos estabelecimentos", "OAuth do Mercado Pago por loja", Boolean(readiness?.sellerPayments), "optional"),
    integrationConfig("Reconciliação automática", "Conferência periódica de pagamentos", Boolean(readiness?.reconciliation), readiness?.billing ? "required" : "standby"),
    integrationConfig("WhatsApp Embedded Signup", "Conexão oficial por estabelecimento", Boolean(readiness?.metaEmbeddedSignup), "optional"),
    integrationConfig("OpenAI", "Atendimento e transcrição assistidos", Boolean(readiness?.openai), "optional"),
    integrationConfig("WhatsApp", "Canal de pedidos e atendimento", Boolean(readiness?.whatsapp), "optional"),
  ];
  return <section><PageHeading eyebrow="STATUS TÉCNICO" title="Infraestrutura" description="Leitura correta do núcleo da aplicação e das integrações opcionais, sem confundir ausência de configuração com indisponibilidade." aside={<span className={`${styles.overallBadge} ${styles[overall]}`}><i />{stateLabel(overall)}</span>} />
    <div className={`${styles.infrastructureHero} ${styles[overall]}`}><div className={styles.infrastructurePulse}><span><Icon name={overall === "operational" ? "check" : "alert"} /></span></div><div><span className={styles.eyebrow}>SAÚDE DO NÚCLEO</span><h2>{overall === "operational" ? "Tudo funcionando normalmente" : overall === "incident" ? "Existe um incidente ativo" : "Há configurações para revisar"}</h2><p>{overall === "operational" ? "A aplicação realizou verificações reais de banco, ambiente, autenticação e armazenamento." : "Os detalhes abaixo mostram exatamente o que está afetado."}</p></div><dl><div><dt>Ambiente</dt><dd>{String(readiness?.environment || "local").toUpperCase()}</dd></div><div><dt>Verificação</dt><dd>{health?.responseTimeMs !== undefined ? `${health.responseTimeMs} ms` : "—"}</dd></div><div><dt>Última leitura</dt><dd>{health?.checkedAt ? dateTime.format(new Date(health.checkedAt)) : "—"}</dd></div></dl></div>
    <article className={styles.panel}><div className={styles.panelHeader}><div><h2>Serviços essenciais</h2><p>Testes e configurações necessários para a aplicação funcionar.</p></div><span className={styles.legend}><i className={styles.legendGreen} />Operacional <i className={styles.legendAmber} />Atenção <i className={styles.legendRed} />Incidente</span></div><div className={styles.serviceGrid}>{services.map(([key, service]) => <ServiceCard key={key} serviceKey={key} service={service} />)}<ServiceCard serviceKey="build" service={{ status: health?.build?.sha ? "operational" : "attention", label: "Versão publicada", detail: health?.build?.sha ? `${health.build.ref || "branch"} · ${health.build.sha.slice(0, 8)}` : "Build local ou versão não identificada" }} /></div></article>
    <article className={styles.panel}><div className={styles.panelHeader}><div><h2>Integrações e recursos</h2><p>“Não configurado” significa recurso opcional ainda não ativado — não uma queda da plataforma.</p></div><span className={styles.countBadge}>{integrations.filter((item) => item.state === "configured").length} configuradas</span></div><div className={styles.integrationGrid}>{integrations.map((item) => <div className={styles.integrationCard} key={item.name}><span className={`${styles.configDot} ${styles[item.state]}`}><Icon name={item.state === "configured" ? "check" : item.state === "required" ? "alert" : "clock"} /></span><div><b>{item.name}</b><p>{item.description}</p></div><span className={`${styles.configBadge} ${styles[item.state]}`}>{configLabel(item.state)}</span></div>)}</div></article>
    <div className={styles.twoColumnsWide}><article className={styles.panel}><div className={styles.panelHeader}><div><h2>Identificação da versão</h2><p>Rastreabilidade do código em execução.</p></div><Icon name="server" /></div><dl className={styles.buildDetails}><div><dt>Commit</dt><dd>{health?.build?.sha?.slice(0, 12) || "Build local"}</dd></div><div><dt>Branch</dt><dd>{health?.build?.ref || "Não informada"}</dd></div><div><dt>Banco</dt><dd>{readiness?.databaseEngine === "postgres" ? "PostgreSQL" : readiness?.databaseEngine || "Não identificado"}</dd></div><div><dt>Ambiente seguro</dt><dd>{readiness?.environmentSafe ? "Sim" : "Requer revisão"}</dd></div></dl></article><article className={styles.panel}><div className={styles.panelHeader}><div><h2>Sinais operacionais</h2><p>Problemas de processamento não são escondidos pelo status geral.</p></div><Icon name="alert" /></div><div className={styles.signalList}><Signal label="Jobs em retry" value={operations.jobsRetry} healthyNote="Nenhum retry pendente" danger /><Signal label="Jobs na DLQ" value={operations.jobsDead} healthyNote="Fila de erro vazia" danger /><Signal label="Webhooks falhos · 24h" value={operations.failedWebhooks24h} healthyNote="Nenhuma falha recente" danger /></div></article></div>
    <article className={`${styles.panel} ${styles.readinessPanel}`}><div className={styles.panelHeader}><div><h2>Gate para produção</h2><p>O sistema só deve receber clientes pagantes quando todos os requisitos obrigatórios estiverem verdes.</p></div><span className={`${styles.overallBadge} ${productionReadiness?.ready ? styles.operational : styles.attention}`}><i />{productionReadiness?.ready ? "Pronto" : "Pendente"}</span></div><div className={styles.readinessGrid}>{productionReadiness?.checks.map((item) => <div key={item.id} className={item.ok ? styles.readinessOk : styles.readinessPending}><span><Icon name={item.ok ? "check" : "clock"} /></span><div><b>{item.label}</b><p>{item.detail}</p></div><strong>{item.ok ? "Concluído" : "Pendente"}</strong></div>)}</div></article>
  </section>;
}

function PageHeading({ eyebrow, title, description, aside }: { eyebrow: string; title: string; description: string; aside?: ReactNode }) { return <header className={styles.pageHeading}><div><span className={styles.eyebrow}>{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>{aside}</header>; }
function KpiCard({ icon, label, value, note, tone }: { icon: IconName; label: string; value: string; note: string; tone: "orange" | "green" | "blue" | "red" | "neutral" }) { return <article className={styles.kpiCard}><div className={`${styles.kpiIcon} ${styles[tone]}`}><Icon name={icon} /></div><span>{label}</span><b>{value}</b><p>{note}</p></article>; }

function Funnel({ metrics }: { metrics: Overview["metrics"] }) {
  const rows = [{ label: "Cadastrados", value: metrics.restaurants, percent: metrics.restaurants ? 100 : 0 }, { label: "Publicados", value: metrics.published, percent: metrics.restaurants ? (metrics.published / metrics.restaurants) * 100 : 0 }, { label: "Primeiro pedido", value: metrics.activated, percent: metrics.restaurants ? (metrics.activated / metrics.restaurants) * 100 : 0 }, { label: "Pagantes", value: metrics.payingRestaurants, percent: metrics.restaurants ? (metrics.payingRestaurants / metrics.restaurants) * 100 : 0 }];
  return <div className={styles.funnel}>{rows.map((row) => <div key={row.label}><div><span>{row.label}</span><b>{row.value}</b></div><div className={styles.progressTrack}><span style={{ width: `${Math.max(0, Math.min(100, row.percent))}%` }} /></div><small>{Math.round(row.percent)}%</small></div>)}</div>;
}

function Signal({ label, value, healthyNote, danger = false }: { label: string; value: number; healthyNote: string; danger?: boolean }) { const active = value > 0; return <div className={styles.signal}><span className={`${styles.signalIcon} ${active && danger ? styles.signalDanger : active ? styles.signalAttention : styles.signalHealthy}`}><Icon name={active ? "alert" : "check"} /></span><div><b>{label}</b><span>{active ? `${value} ocorrência${value === 1 ? "" : "s"}` : healthyNote}</span></div><strong>{value}</strong></div>; }
function Movement({ label, value, tone }: { label: string; value: number; tone: "positive" | "negative" }) { return <div className={styles.movement}><span className={styles[tone]}>{tone === "positive" ? "↗" : "↘"}</span><b>{label}</b><strong className={styles[tone]}>{tone === "negative" && value ? "−" : "+"}{money.format(value / 100)}</strong></div>; }
function ServiceCard({ serviceKey, service }: { serviceKey: string; service: HealthService }) { const icon: IconName = serviceKey === "database" ? "database" : serviceKey === "authentication" ? "key" : serviceKey === "uploads" ? "upload" : serviceKey === "environment" ? "shield" : "server"; return <div className={styles.serviceCard}><span className={`${styles.serviceIcon} ${styles[service.status]}`}><Icon name={icon} /></span><div><b>{service.label}</b><p>{service.detail}</p></div><span className={`${styles.serviceBadge} ${styles[service.status]}`}><i />{stateLabel(service.status)}</span></div>; }
function StatusPill({ status }: { status: string }) { return <span className={`${styles.statusPill} ${styles[`status_${status}`] || styles.status_neutral}`}><i />{statusLabel(status)}</span>; }
function EmptyState({ title, text }: { title: string; text: string }) { return <div className={styles.emptyState}><Icon name="search" /><b>{title}</b><span>{text}</span></div>; }
function LoadingState() { return <main className={styles.loadingPage}><div className={styles.loadingBrand}><span>R</span>Rapidex<b>Menu</b></div><div className={styles.loadingBar}><i /></div><p>Preparando o centro de comando…</p></main>; }

function Icon({ name }: { name: IconName }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true">{iconPaths[name]}</svg>;
}

function integrationConfig(name: string, description: string, enabled: boolean, mode: "required" | "optional" | "standby") { return { name, description, state: enabled ? "configured" : mode } as const; }
function configLabel(state: "configured" | "required" | "optional" | "standby") { if (state === "configured") return "Configurado"; if (state === "required") return "Ação necessária"; if (state === "standby") return "Inativo neste ambiente"; return "Não configurado"; }
function stateLabel(state: ServiceState) { if (state === "operational") return "Operacional"; if (state === "incident") return "Incidente"; return "Atenção"; }
function statusLabel(status: string) { return ({ active: "Ativo", trial: "Em teste", paused: "Pausado", canceled: "Cancelado", blocked: "Bloqueado", revoked: "Revogado", authorized: "Autorizada", pending: "Pendente", connected: "Conectado", disabled: "Desativado", error: "Com erro" } as Record<string, string>)[status] || status; }
function initials(name: string) { const parts = name.trim().split(/\s+/).filter(Boolean); return `${parts[0]?.[0] || "R"}${parts.length > 1 ? parts.at(-1)?.[0] || "" : ""}`.toUpperCase(); }
function auditActionLabel(action: string) { return ({
  "restaurant.created": "Estabelecimento criado",
  "restaurant.pause": "Estabelecimento pausado",
  "restaurant.reactivate": "Estabelecimento reativado",
  "restaurant.block": "Estabelecimento bloqueado",
  "restaurant.unblock": "Estabelecimento desbloqueado",
  "restaurant.commercial_terms_updated": "Condições comerciais alteradas",
  "restaurant.member_created": "Membro adicionado",
  "restaurant.member_updated": "Membro alterado",
  "user.block": "Usuário bloqueado",
  "user.unblock": "Usuário desbloqueado",
  "platform_admin.created": "Superadmin criado",
  "platform_admin.updated": "Superadmin alterado",
  "user.password_reset_issued": "Redefinição de senha emitida",
  "support.note_created": "Nota de suporte registrada",
  "platform.job_requeued": "Job reenfileirado",
} as Record<string, string>)[action] || action; }
