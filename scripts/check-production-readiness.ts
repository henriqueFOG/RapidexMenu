import { productionReadinessChecks } from "../lib/production-readiness";
import type { RapidexBindings } from "../lib/runtime";

const bindings = {
  ...process.env,
  BUCKET: process.env.RAPIDEX_OBJECT_STORAGE_CONFIGURED === "true" ? {} : undefined,
} as unknown as RapidexBindings;
const checks = productionReadinessChecks(bindings);
for (const item of checks) {
  process.stdout.write(`${item.ok ? "PASS" : "FAIL"}  ${item.label}: ${item.detail}\n`);
}
const failures = checks.filter((item) => !item.ok);
if (failures.length) {
  process.stderr.write(`\nProdução bloqueada: ${failures.length} requisito(s) pendente(s).\n`);
  process.exitCode = 1;
} else {
  process.stdout.write("\nGate técnico de produção aprovado.\n");
}
