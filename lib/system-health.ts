import { getDatabase, integrationReadiness } from "./runtime";

export async function systemHealth() {
  const startedAt = Date.now();
  await getDatabase().prepare("SELECT 1 AS ok").first();
  const integrations = integrationReadiness();
  const coreServices = {
    application: { status: "operational", label: "Aplicação", detail: "API respondendo normalmente" },
    database: {
      status: "operational",
      label: integrations.databaseEngine === "postgres" ? "PostgreSQL" : "Banco de dados",
      detail: "Consulta de conexão concluída",
    },
    environment: {
      status: integrations.environmentSafe ? "operational" : "attention",
      label: "Ambiente",
      detail: integrations.environmentSafe
        ? `${String(integrations.environment).toUpperCase()} configurado com segurança`
        : "Configuração do ambiente exige revisão",
    },
    authentication: {
      status: integrations.nativeAuth ? "operational" : "attention",
      label: "Autenticação",
      detail: integrations.nativeAuth ? "Sessões protegidas e configuradas" : "Segredo de sessão ausente ou inválido",
    },
    uploads: {
      status: integrations.uploads ? "operational" : "attention",
      label: "Arquivos e imagens",
      detail: integrations.uploads ? "Armazenamento disponível" : "Armazenamento não configurado",
    },
  } as const;
  const requiresAttention = Object.values(coreServices).some((service) => service.status === "attention");
  return {
    ok: true,
    service: "rapidexmenu",
    status: requiresAttention ? "attention" as const : "operational" as const,
    checkedAt: Date.now(),
    responseTimeMs: Date.now() - startedAt,
    build: {
      sha: process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || null,
      ref: process.env.VERCEL_GIT_COMMIT_REF || null,
      url: process.env.VERCEL_URL || null,
    },
    coreServices,
    integrations,
  };
}
