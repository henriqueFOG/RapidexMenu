import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("estabelecimento não recebe nem renderiza status técnico da plataforma", async () => {
  const [adminClient, overviewRoute] = await Promise.all([
    readFile(new URL("app/admin/AdminClient.tsx", root), "utf8"),
    readFile(new URL("app/api/admin/overview/route.ts", root), "utf8"),
  ]);

  assert.doesNotMatch(adminClient, /Status técnico/i);
  assert.doesNotMatch(adminClient, /data\.integrations/);
  assert.doesNotMatch(adminClient, /integrationName\(/);

  assert.doesNotMatch(overviewRoute, /integrationReadiness/);
  assert.doesNotMatch(overviewRoute, /integrations\s*:/);
});
