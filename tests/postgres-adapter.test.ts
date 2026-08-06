import assert from "node:assert/strict";
import test from "node:test";
import {
  compilePostgresQuery,
  normalizePostgresRows,
} from "../lib/postgres-d1";

test("converte placeholders D1 sem alterar textos", () => {
  const compiled = compilePostgresQuery(
    "SELECT '?' AS literal, id FROM products WHERE restaurant_id = ? AND id IN (?, ?)",
  );

  assert.equal(
    compiled.sql,
    "SELECT '?' AS literal, id FROM products WHERE restaurant_id = $1 AND id IN ($2, $3)",
  );
  assert.equal(compiled.parameterCount, 3);
});

test("converte INSERT OR IGNORE para Postgres idempotente", () => {
  const compiled = compilePostgresQuery(
    "INSERT OR IGNORE INTO members (id, email) VALUES (?, ?)",
  );

  assert.equal(
    compiled.sql,
    "INSERT INTO members (id, email) VALUES ($1, $2) ON CONFLICT DO NOTHING",
  );
});

test("normaliza agregacoes bigint sem alterar telefones", () => {
  const [row] = normalizePostgresRows([
    { total: "12", revenue_cents: "5680", phone: "5524988880001" },
  ]);

  assert.equal(row.total, 12);
  assert.equal(row.revenue_cents, 5680);
  assert.equal(row.phone, "5524988880001");
});
