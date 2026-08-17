import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");

test("toda rota administrativa de estabelecimento exige contexto autenticado", async () => {
  const routes = await routeFiles(path.join(root, "app/api/admin"));
  assert.ok(routes.length >= 20, "a varredura deve cobrir as rotas administrativas");
  for (const route of routes) {
    const source = await readFile(route, "utf8");
    assert.match(source, /requireAdminContext\(/, `${path.relative(root, route)} não exige contexto do tenant`);
  }
});

test("toda rota da Central exige superadmin e toda mutação valida a origem", async () => {
  const routes = await routeFiles(path.join(root, "app/api/internal/platform"));
  assert.ok(routes.length >= 10, "a varredura deve cobrir as rotas da Central");
  for (const route of routes) {
    const source = await readFile(route, "utf8");
    const relative = path.relative(root, route);
    if (relative.endsWith("platform/mfa/route.ts")) {
      assert.match(source, /firstFactorAdmin\(/, `${relative} não exige o primeiro fator administrativo`);
    } else {
      assert.match(source, /requirePlatformAdmin\(/, `${relative} não exige autorização da Central`);
    }
    if (/export async function (?:POST|PATCH|PUT|DELETE)\(/.test(source)) {
      assert.match(source, /assertSameOrigin\(request\)/, `${relative} não valida a origem da mutação`);
    }
  }
});

test("mutações por identificador continuam vinculadas ao restaurant_id autenticado", async () => {
  const sensitiveRoutes = [
    "app/api/admin/orders/[id]/route.ts",
    "app/api/admin/products/[id]/route.ts",
    "app/api/admin/customers/[id]/privacy/route.ts",
    "app/api/admin/privacy/[id]/route.ts",
    "app/api/admin/automations/[id]/route.ts",
  ];
  for (const relative of sensitiveRoutes) {
    const source = await readFile(path.join(root, relative), "utf8");
    assert.match(source, /restaurant_id\s*=\s*\?/, `${relative} perdeu o predicado de isolamento`);
    assert.match(source, /context\.restaurantId/, `${relative} não usa o tenant da sessão`);
  }
});

test("mudança de pedido exige estado esperado para impedir avanço concorrente", async () => {
  const route = await readFile(path.join(root, "app/api/admin/orders/[id]/route.ts"), "utf8");
  const admin = await readFile(path.join(root, "app/admin/AdminClient.tsx"), "utf8");
  const kitchen = await readFile(path.join(root, "app/admin/cozinha/KitchenDisplayClient.tsx"), "utf8");
  assert.match(route, /requiredString\(body\.expectedStatus/);
  assert.match(route, /current\.status\s*!==\s*expectedStatus/);
  assert.match(route, /AND status = \?/);
  assert.match(admin, /expectedStatus:\s*order\.status/);
  assert.match(kitchen, /expectedStatus:\s*order\.status/);
});

test("identidade proibida é revogada apenas na Central, sem apagar loja ou conta", async () => {
  const migration = await readFile(path.join(root, "db/postgres/0030_platform_identity_invariant.sql"), "utf8");
  assert.match(migration, /UPDATE platform_admins/);
  assert.match(migration, /heloisa\.gall@gmail\.com/);
  assert.doesNotMatch(migration, /DELETE\s+FROM\s+(?:app_users|restaurants|members)/i);
});

async function routeFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return routeFiles(target);
    return entry.name === "route.ts" ? [target] : [];
  }));
  return nested.flat();
}
