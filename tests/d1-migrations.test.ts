import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");

test("histórico D1 cria um banco vazio compatível com os fluxos atuais", async () => {
  const directory = path.join(root, "drizzle");
  const files = (await readdir(directory))
    .filter((file) => file.endsWith(".sql"))
    .sort();
  const database = new DatabaseSync(":memory:");
  database.exec("PRAGMA foreign_keys = ON");

  for (const file of files) {
    const migration = await readFile(path.join(directory, file), "utf8");
    database.exec(migration.replaceAll("--> statement-breakpoint", ""));
  }

  const tables = database
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
    .all()
    .map((row) => String(row.name));
  for (const table of [
    "app_users",
    "platform_admins",
    "platform_admin_mfa",
    "platform_support_notes",
    "product_option_groups",
    "delivery_zones",
    "job_queue",
    "maintenance_schedules",
  ]) {
    assert.ok(tables.includes(table), `tabela ausente após migrations: ${table}`);
  }

  const restaurantColumns = database
    .prepare("PRAGMA table_info(restaurants)")
    .all()
    .map((row) => String(row.name));
  for (const column of ["trial_ends_at", "access_ends_at", "catalog_version", "platform_blocked_at"]) {
    assert.ok(restaurantColumns.includes(column), `coluna ausente após migrations: restaurants.${column}`);
  }

  const orderColumns = database
    .prepare("PRAGMA table_info(orders)")
    .all()
    .map((row) => String(row.name));
  for (const column of ["fulfillment_type", "scheduled_for", "delivery_zone_id"]) {
    assert.ok(orderColumns.includes(column), `coluna ausente após migrations: orders.${column}`);
  }

  const schedule = database
    .prepare("SELECT status FROM maintenance_schedules WHERE task = 'orphan_media'")
    .get();
  assert.equal(schedule?.status, "idle");
});
