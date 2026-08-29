import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("relatório de resultados usa visual próprio com contraste explícito", async () => {
  const [source, css] = await Promise.all([
    readFile(new URL("app/admin/lucro/ProfitClient.tsx", root), "utf8"),
    readFile(new URL("app/admin/lucro/ProfitClient.module.css", root), "utf8"),
  ]);

  assert.match(source, /ProfitClient\.module\.css/);
  assert.doesNotMatch(source, /commercial\.module\.css/);
  assert.match(source, /Vendas no mês/);
  assert.match(source, /Margem de contribuição/);
  assert.match(source, /O que fazer agora/);
  assert.match(source, /Guardião de margem/);

  assert.match(css, /\.metric\{[^}]*background:#fff/);
  assert.match(css, /\.metricValue\{[^}]*color:#161916/);
  assert.match(css, /\.metricDetail\{[^}]*color:#73786f/);
});

test("API entrega contexto mensal para relatório não parecer vazio antes da primeira venda do dia", async () => {
  const route = await readFile(new URL("app/api/admin/profit/route.ts", root), "utf8");

  assert.match(route, /const \[restaurant, day, month,/);
  assert.match(route, /created_at >= \? AND status <> 'canceled'/);
  assert.match(route, /month: \{/);
  assert.match(route, /revenueCents: monthRevenue/);
  assert.match(route, /contributionMarginPercent: monthRevenue > 0/);
});
