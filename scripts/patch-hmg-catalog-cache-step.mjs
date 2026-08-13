import { readFileSync, writeFileSync } from "node:fs";

const path = ".github/workflows/hmg-e2e.yml";
let source = readFileSync(path, "utf8");
const marker = `      - name: Run API commercial HMG E2E\n        run: node scripts/hmg-e2e.mjs\n\n      - name: Validate concurrent order numbering`;
const replacement = `      - name: Run API commercial HMG E2E\n        run: node scripts/hmg-e2e.mjs\n\n      - name: Validate versioned public catalog cache\n        run: node scripts/catalog-cache-e2e.mjs\n\n      - name: Validate concurrent order numbering`;
if (!source.includes("Validate versioned public catalog cache")) {
  if (!source.includes(marker)) throw new Error("HMG cache insertion marker not found");
  source = source.replace(marker, replacement);
}
writeFileSync(path, source);
