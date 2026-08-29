import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("bootstrap do estabelecimento demo existe somente para HMG e não expõe senha em texto", async () => {
  const route = await readFile(
    new URL("../app/api/internal/hmg/demo-establishment/route.ts", import.meta.url),
    "utf8",
  );

  assert.match(route, /getRapidexEnvironment\(\) !== "hmg"/);
  assert.match(route, /status: 404/);
  assert.match(route, /estabelecimento\.demo@rapidex-hmg\.test/);
  assert.match(route, /pbkdf2_sha256\$210000\$/);
  assert.match(route, /if \(!existingUser\)/);
  assert.doesNotMatch(route, /RapidexDemo2026/);
});

test("bootstrap entrega uma loja pronta para demonstrar painel e cardápio", async () => {
  const route = await readFile(
    new URL("../app/api/internal/hmg/demo-establishment/route.ts", import.meta.url),
    "utf8",
  );

  assert.match(route, /ensureDemoData\(db\)/);
  assert.match(route, /onboarding_completed = 1/);
  assert.match(route, /plan = 'growth'/);
  assert.match(route, /is_open = 1/);
  assert.match(route, /products/);
  assert.match(route, /orders/);
});
