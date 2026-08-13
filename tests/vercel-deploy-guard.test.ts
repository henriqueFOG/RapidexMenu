import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

const script = new URL("../scripts/vercel-ignore-build.mjs", import.meta.url);
const productionProjectId = "prj_qteZJoZgpPaJGhEnICDqYzkxKxZT";
const hmgProjectId = "prj_zRAZLCCi4dLXN91ZepzNXcaV2euO";

function run(projectId: string, branch: string, rapidexEnv?: string) {
  const env = { ...process.env, VERCEL_PROJECT_ID: projectId, VERCEL_GIT_COMMIT_REF: branch };
  if (rapidexEnv === undefined) delete env.RAPIDEX_ENV;
  else env.RAPIDEX_ENV = rapidexEnv;
  return spawnSync(process.execPath, [script.pathname], { env, encoding: "utf8" });
}

test("HMG project builds hmg even before RAPIDEX_ENV is available", () => {
  const result = run(hmgProjectId, "hmg");
  assert.equal(result.status, 1);
  assert.match(result.stdout, /branch=hmg/);
  assert.match(result.stdout, /build=true/);
});

test("HMG project ignores feature branches", () => {
  const result = run(hmgProjectId, "agent/example", "hmg");
  assert.equal(result.status, 0);
  assert.match(result.stdout, /build=false/);
});

test("production project builds only master", () => {
  assert.equal(run(productionProjectId, "master", "production").status, 1);
  assert.equal(run(productionProjectId, "hmg", "production").status, 0);
});

test("unknown project fails closed even when RAPIDEX_ENV says hmg", () => {
  const result = run("prj_unknown", "hmg", "hmg");
  assert.equal(result.status, 0);
  assert.match(result.stdout, /build=false/);
});
