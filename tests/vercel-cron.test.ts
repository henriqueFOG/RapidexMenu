import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Vercel mantém uma execução diária compatível e autentica o ciclo de manutenção", async () => {
  const config = JSON.parse(await readFile(new URL("../vercel.json", import.meta.url), "utf8"));
  assert.deepEqual(config.crons, [{ path: "/api/internal/maintenance", schedule: "0 4 * * *" }]);
  const route = await readFile(new URL("../app/api/internal/maintenance/route.ts", import.meta.url), "utf8");
  assert.match(route, /authorizeInternalJob\(request\)/);
  assert.match(route, /Promise\.all/);
});

test("HMG sem segredo não gera falso incidente, mas produção continua fail-closed", async () => {
  const route = await readFile(new URL("../app/api/internal/maintenance/route.ts", import.meta.url), "utf8");
  assert.match(route, /reconciliationSecret\(\)\.length >= 32/);
  assert.match(route, /environment !== "production"/);
  assert.match(route, /maintenance\.skipped/);
  assert.match(route, /internal_jobs_not_configured/);

  const skipPosition = route.indexOf('environment !== "production"');
  const authPosition = route.indexOf("authorizeInternalJob(request)");
  assert.ok(skipPosition >= 0 && authPosition > skipPosition, "produção deve alcançar a autenticação fail-closed");
});

test("produção só libera clientes após comprovar um agendador de cinco minutos", async () => {
  const readiness = await readFile(new URL("../lib/production-readiness.ts", import.meta.url), "utf8");
  assert.match(readiness, /RAPIDEX_SCHEDULER_READY/);
  assert.match(readiness, /ciclo de 5 minutos/);
});
