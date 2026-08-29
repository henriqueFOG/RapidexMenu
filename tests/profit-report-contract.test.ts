import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("relatório de resultados usa visual próprio com contraste WCAG nos indicadores", async () => {
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

  const background = css.match(/\.metric\{[^}]*background:(#[0-9a-f]+)/i)?.[1];
  const valueColor = css.match(/\.metricValue\{[^}]*color:(#[0-9a-f]+)/i)?.[1];
  const detailColor = css.match(/\.metricDetail\{[^}]*color:(#[0-9a-f]+)/i)?.[1];
  assert.ok(background && valueColor && detailColor, "cores dos cards principais precisam ser explícitas");
  assert.ok(contrast(valueColor, background) >= 4.5, `valor principal sem contraste WCAG: ${valueColor} em ${background}`);
  assert.ok(contrast(detailColor, background) >= 4.5, `detalhe sem contraste WCAG: ${detailColor} em ${background}`);
});

test("API entrega contexto mensal para relatório não parecer vazio antes da primeira venda do dia", async () => {
  const route = await readFile(new URL("app/api/admin/profit/route.ts", root), "utf8");

  assert.match(route, /const \[restaurant, day, month,/);
  assert.match(route, /created_at >= \? AND status <> 'canceled'/);
  assert.match(route, /month: \{/);
  assert.match(route, /revenueCents: monthRevenue/);
  assert.match(route, /contributionMarginPercent: monthRevenue > 0/);
});

function contrast(foreground: string, background: string) {
  const a = luminance(foreground);
  const b = luminance(background);
  const light = Math.max(a, b);
  const dark = Math.min(a, b);
  return (light + 0.05) / (dark + 0.05);
}

function luminance(hex: string) {
  const normalized = hex.slice(1).length === 3
    ? hex.slice(1).split("").map((part) => part + part).join("")
    : hex.slice(1);
  const channels = [0, 2, 4].map((index) => Number.parseInt(normalized.slice(index, index + 2), 16) / 255);
  const [red, green, blue] = channels.map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}
