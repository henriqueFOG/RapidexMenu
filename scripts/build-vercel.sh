#!/usr/bin/env bash
set -euo pipefail

production_project_id="prj_qteZJoZgpPaJGhEnICDqYzkxKxZT"
project_id="${VERCEL_PROJECT_ID:-}"
rapidex_environment="${RAPIDEX_ENV:-}"
migration_url="${RAPIDEX_MIGRATION_DATABASE_URL:-${DATABASE_URL:-${POSTGRES_URL:-}}}"

# O domínio oficial nunca pode receber uma compilação com configuração de HMG
# ou com qualquer evidência obrigatória de produção ausente.
if [[ "${project_id}" == "${production_project_id}" ]]; then
  node --import tsx scripts/check-production-readiness.ts
fi

# HMG/CI pode migrar o banco descartável automaticamente. Produção exige uma
# etapa de migração controlada e separada, salvo autorização explícita.
if [[ -n "${migration_url}" ]] && {
  [[ "${rapidex_environment}" == "hmg" ]] ||
  [[ "${rapidex_environment}" == "ci" ]] ||
  [[ "${RAPIDEX_RUN_MIGRATIONS_DURING_BUILD:-false}" == "true" ]]
}; then
  node scripts/migrate-postgres.mjs
fi

RAPIDEX_RUNTIME=vercel exec next build --webpack
