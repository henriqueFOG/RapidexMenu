import { execFileSync } from "node:child_process";

const productionProjectId = "prj_qteZJoZgpPaJGhEnICDqYzkxKxZT";
const hmgProjectId = "prj_zRAZLCCi4dLXN91ZepzNXcaV2euO";
const retiredProjectIds = new Set([
  "prj_aVc1xdFF4aUM1TOCgTkCUrRolkc2",
  "prj_9YXJVWpIK0RGWWPrWjUmcfZ5lCnq",
]);

const projectId = process.env.VERCEL_PROJECT_ID || "";
const branch = process.env.VERCEL_GIT_COMMIT_REF || "";
const environment = normalizeEnvironment(process.env.RAPIDEX_ENV);
const commitMessage = currentCommitMessage();

let shouldBuild = false;
let requiredMarker = "";

if (retiredProjectIds.has(projectId)) {
  shouldBuild = false;
} else if (projectId === productionProjectId) {
  // Produção só compila um lote explicitamente aprovado. Um push comum em
  // master continua protegido e não consome uma compilação completa.
  requiredMarker = "[deploy:prod]";
  shouldBuild = branch === "master" && hasReleaseMarker(commitMessage, requiredMarker);
} else if (projectId === hmgProjectId) {
  // HMG recebe vários commits de trabalho, mas só o commit que fecha o lote
  // com o marcador abaixo dispara a compilação remota.
  requiredMarker = "[deploy:hmg]";
  shouldBuild = branch === "hmg" && hasReleaseMarker(commitMessage, requiredMarker);
} else {
  // Projetos desconhecidos ficam bloqueados por padrão, mesmo que recebam RAPIDEX_ENV=hmg.
  shouldBuild = false;
}

console.log(
  `[rapidex deploy guard] project=${projectId || "unknown"} branch=${branch || "unknown"} env=${environment} marker=${requiredMarker || "none"} approved=${requiredMarker ? hasReleaseMarker(commitMessage, requiredMarker) : false} build=${shouldBuild}`,
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

function hasReleaseMarker(message, marker) {
  return String(message || "").toLowerCase().includes(marker);
}

function currentCommitMessage() {
  const provided = String(process.env.VERCEL_GIT_COMMIT_MESSAGE || "").trim();
  if (provided) return provided;
  try {
    return execFileSync("git", ["log", "-1", "--pretty=%B"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
}
