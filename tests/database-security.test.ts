import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("runtime e migração possuem contratos de credencial separados", async () => {
  const [migrator, buildScript, roleSql, packageJson] = await Promise.all([
    readFile(new URL("../scripts/migrate-postgres.mjs", import.meta.url), "utf8"),
    readFile(new URL("../scripts/build-vercel.sh", import.meta.url), "utf8"),
    readFile(new URL("../db/postgres/production-app-role.sql", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);
  assert.match(migrator, /RAPIDEX_MIGRATION_DATABASE_URL \|\| process\.env\.DATABASE_URL/);
  assert.match(buildScript, /check-production-readiness\.ts/);
  assert.match(buildScript, /production_project_id="prj_qteZJoZgpPaJGhEnICDqYzkxKxZT"/);
  assert.match(buildScript, /RAPIDEX_RUN_MIGRATIONS_DURING_BUILD/);
  assert.match(roleSql, /REVOKE CREATE ON SCHEMA public FROM rapidex_app/);
  assert.match(roleSql, /GRANT SELECT, INSERT, UPDATE, DELETE/);
  assert.match(packageJson, /bash scripts\/build-vercel\.sh/);
});
