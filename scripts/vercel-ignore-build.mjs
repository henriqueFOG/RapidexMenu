const productionProjectId = "prj_qteZJoZgpPaJGhEnICDqYzkxKxZT";
const hmgProjectId = "prj_zRAZLCCi4dLXN91ZepzNXcaV2euO";
const retiredProjectIds = new Set([
  "prj_aVc1xdFF4aUM1TOCgTkCUrRolkc2",
  "prj_9YXJVWpIK0RGWWPrWjUmcfZ5lCnq",
]);

const projectId = process.env.VERCEL_PROJECT_ID || "";
const branch = process.env.VERCEL_GIT_COMMIT_REF || "";
const environment = normalizeEnvironment(process.env.RAPIDEX_ENV);

let shouldBuild = false;

if (retiredProjectIds.has(projectId)) {
  shouldBuild = false;
} else if (projectId === productionProjectId) {
  // O projeto oficial de produção nunca recebe branches de HMG/feature.
  shouldBuild = branch === "master";
} else if (projectId === hmgProjectId) {
  // O projeto HMG é identificado pelo próprio Vercel Project ID.
  // O Ignore Build Step roda antes de depender de variáveis customizadas de runtime,
  // portanto RAPIDEX_ENV não pode ser a única autoridade para decidir o deploy.
  shouldBuild = branch === "hmg";
} else {
  // Projetos desconhecidos ficam bloqueados por padrão, mesmo que recebam RAPIDEX_ENV=hmg.
  shouldBuild = false;
}

console.log(
  `[rapidex deploy guard] project=${projectId || "unknown"} branch=${branch || "unknown"} env=${environment} build=${shouldBuild}`,
);

// Vercel: exit 1 = continuar build; exit 0 = ignorar deployment.
process.exit(shouldBuild ? 1 : 0);

function normalizeEnvironment(value) {
  const normalized = String(value || "development").trim().toLowerCase();
  if (["prod", "production"].includes(normalized)) return "production";
  if (["hmg", "homologation", "homolog", "staging", "stage"].includes(normalized)) return "hmg";
  if (["ci", "test"].includes(normalized)) return "ci";
  return "development";
}
