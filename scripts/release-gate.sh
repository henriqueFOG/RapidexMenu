#!/usr/bin/env bash
set -euo pipefail

# Um único gate local para fechar o lote antes de autorizar qualquer build
# remoto. O build da aplicação aparece exatamente uma vez nesta rotina.
npm run typecheck
npm run lint
npm run test:unit
node scripts/scan-secrets.mjs
npm audit --omit=dev --audit-level=high
npm run build:vercel
