import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

const script = new URL("../scripts/vercel-ignore-build.mjs", import.meta.url);
const productionProjectId = "prj_qteZJoZgpPaJGhEnICDqYzkxKxZT";
const hmgProjectId = "prj_zRAZLCCi4dLXN91ZepzNXcaV2euO";

function run(projectId: string, branch: string, message = "chore: ajuste comum", rapidexEnv?: string) {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    VERCEL_PROJECT_ID: projectId,
    VERCEL_GIT_COMMIT_REF: branch,
    VERCEL_GIT_COMMIT_MESSAGE: message,
  };
  if (rapidexEnv === undefined) delete env.RAPIDEX_ENV;
  else env.RAPIDEX_ENV = rapidexEnv;
  return spawnSync(process.execPath, [script.pathname], { env, encoding: "utf8" });
}

test("HMG project builds one explicitly marked release even before RAPIDEX_ENV is available", () => {
  const result = run(hmgProjectId, "hmg", "feat: lote comercial [deploy:hmg]");
  assert.equal(result.status, 1);
  assert.match(result.stdout, /branch=hmg/);
  assert.match(result.stdout, /approved=true/);
  assert.match(result.stdout, /build=true/);
});

test("HMG project ignores ordinary hmg commits without a release marker", () => {
  const result = run(hmgProjectId, "hmg", "fix: ajuste interno", "hmg");
  assert.equal(result.status, 0);
  assert.match(result.stdout, /approved=false/);
  assert.match(result.stdout, /build=false/);
});

test("HMG project ignores feature branches even with a release marker", () => {
  const result = run(hmgProjectId, "agent/example", "feat: teste [deploy:hmg]", "hmg");
  assert.equal(result.status, 0);
  assert.match(result.stdout, /build=false/);
});

test("production project requires master and its own approval marker", () => {
  assert.equal(run(productionProjectId, "master", "release: produção [deploy:prod]", "production").status, 1);
  assert.equal(run(productionProjectId, "master", "release: sem aprovação", "production").status, 0);
  assert.equal(run(productionProjectId, "hmg", "release: produção [deploy:prod]", "production").status, 0);
  assert.equal(run(productionProjectId, "master", "release: HMG [deploy:hmg]", "production").status, 0);
});

test("unknown project fails closed even when RAPIDEX_ENV says hmg", () => {
  const result = run("prj_unknown", "hmg", "release [deploy:hmg]", "hmg");
  assert.equal(result.status, 0);
  assert.match(result.stdout, /build=false/);
});
