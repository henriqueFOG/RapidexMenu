import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("health público de produção não expõe build, ambiente ou integrações", async () => {
  const source = await readFile(new URL("../app/api/health/route.ts", import.meta.url), "utf8");
  assert.match(source, /getRapidexEnvironment\(\) !== "production"/);
  const productionPayload = source.slice(source.indexOf("return json({", source.indexOf("getRapidexEnvironment")));
  assert.doesNotMatch(productionPayload.slice(0, productionPayload.indexOf("});") + 3), /build|integrations|environmentIssues|databaseEngine/);
});
