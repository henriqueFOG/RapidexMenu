import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import manifest from "../app/manifest";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("PWA manifest exposes installable standalone metadata and required icons", () => {
  const value = manifest();
  assert.equal(value.name, "RapidexMenu");
  assert.equal(value.short_name, "Rapidex");
  assert.equal(value.display, "standalone");
  assert.equal(value.start_url, "/admin");
  assert.equal(value.scope, "/");

  const icons = value.icons || [];
  assert.ok(icons.some((icon) => icon.sizes === "192x192" && icon.type === "image/png"));
  assert.ok(icons.some((icon) => icon.sizes === "512x512" && icon.type === "image/png"));
  assert.ok(icons.some((icon) => String(icon.purpose || "").includes("maskable")));
});

test("service worker never intercepts authenticated or API traffic", () => {
  const worker = read("public/sw.js");
  assert.match(worker, /NETWORK_ONLY_PREFIXES/);
  assert.match(worker, /"\/api\/"/);
  assert.match(worker, /"\/admin"/);
  assert.match(worker, /if \(isNetworkOnly\(url\.pathname\)\) return;/);
  assert.doesNotMatch(worker, /caches\.put\([^\n]*\/api\//);
});

test("PWA registration forces service-worker update checks and exposes offline state", () => {
  const lifecycle = read("app/PwaLifecycle.tsx");
  assert.match(lifecycle, /navigator\.serviceWorker\.register\("\/sw\.js"/);
  assert.match(lifecycle, /updateViaCache: "none"/);
  assert.match(lifecycle, /Sem conexão/);
});

test("KDS blocks mutations offline and refreshes on reconnection", () => {
  const kds = read("app/admin/cozinha/KitchenDisplayClient.tsx");
  assert.match(kds, /!navigator\.onLine/);
  assert.match(kds, /disabled=\{busy !== "" \|\| !online\}/);
  assert.match(kds, /rapidex:online/);
  assert.match(kds, /A ação não foi enviada/);
});
