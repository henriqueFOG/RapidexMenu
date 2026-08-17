import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("limpeza de mídia é diária, preserva referências e possui carência", async () => {
  const source = await readFile(new URL("../lib/media-cleanup.ts", import.meta.url), "utf8");
  assert.match(source, /next_run_at <= \?/);
  assert.match(source, /const GRACE_MS = DAY_MS/);
  assert.match(source, /!referenced\.has\(object\.key\)/);
  assert.match(source, /!referenced\.has\(blob\.pathname\)/);
  assert.match(source, /MAX_DELETE = 500/);
});

test("ciclo único de manutenção inclui limpeza de mídia", async () => {
  const route = await readFile(new URL("../app/api/internal/maintenance/route.ts", import.meta.url), "utf8");
  assert.match(route, /cleanupOrphanMedia\(\)/);
  assert.match(route, /mediaCleanup/);
});
