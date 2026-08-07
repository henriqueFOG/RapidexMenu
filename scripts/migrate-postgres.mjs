import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { neon } from "@neondatabase/serverless";

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!connectionString) {
  throw new Error("Configure DATABASE_URL antes de executar as migracoes Postgres.");
}

const environment = normalizeEnvironment(process.env.RAPIDEX_ENV);
if (!["hmg", "production", "development", "ci"].includes(environment)) {
  throw new Error("RAPIDEX_ENV inválido para migrations.");
}

const migrationsDirectory = path.join(process.cwd(), "db", "postgres");
const sql = neon(connectionString);

await sql.query(`
  CREATE TABLE IF NOT EXISTS rapidex_environment (
    id integer PRIMARY KEY CHECK (id = 1),
    environment text NOT NULL CHECK (environment IN ('hmg', 'production', 'development', 'ci')),
    created_at double precision NOT NULL DEFAULT (extract(epoch FROM clock_timestamp()) * 1000),
    updated_at double precision NOT NULL DEFAULT (extract(epoch FROM clock_timestamp()) * 1000)
  )
`);

const databaseEnvironment = await sql.query("SELECT environment FROM rapidex_environment WHERE id = 1 LIMIT 1");
if (!databaseEnvironment.length) {
  await sql.query("INSERT INTO rapidex_environment (id, environment) VALUES (1, $1)", [environment]);
  console.log(`database environment initialized: ${environment}`);
} else if (databaseEnvironment[0].environment !== environment) {
  throw new Error(
    `BLOQUEADO: este banco pertence ao ambiente ${databaseEnvironment[0].environment}, mas o deploy está configurado como ${environment}.`,
  );
}

await sql.query(`
  CREATE TABLE IF NOT EXISTS rapidex_migrations (
    name text PRIMARY KEY,
    checksum text NOT NULL,
    applied_at double precision NOT NULL
      DEFAULT (extract(epoch FROM clock_timestamp()) * 1000)
  )
`);

const files = (await readdir(migrationsDirectory))
  .filter((file) => /^\d+.*\.sql$/.test(file))
  .sort();

const applied = await sql.query(
  "SELECT name, checksum FROM rapidex_migrations ORDER BY name",
);
const appliedByName = new Map(applied.map((migration) => [migration.name, migration.checksum]));

for (const file of files) {
  const source = await readFile(path.join(migrationsDirectory, file), "utf8");
  const checksum = createHash("sha256").update(source).digest("hex");
  const previousChecksum = appliedByName.get(file);

  if (previousChecksum) {
    if (previousChecksum !== checksum) {
      throw new Error(`A migracao aplicada ${file} foi alterada. Crie uma nova migracao.`);
    }
    console.log(`skip ${file}`);
    continue;
  }

  const statements = source
    .split(/\n\s*--\s*statement-breakpoint\s*\n/g)
    .map((statement) => statement.trim())
    .filter(Boolean);

  await sql.transaction((transaction) => [
    ...statements.map((statement) => transaction.query(statement)),
    transaction.query(
      "INSERT INTO rapidex_migrations (name, checksum) VALUES ($1, $2)",
      [file, checksum],
    ),
  ]);
  console.log(`applied ${file}`);
}

console.log(`Postgres ${environment} pronto: ${files.length} migracao(oes) verificada(s).`);

function normalizeEnvironment(value) {
  const normalized = String(value || "development").trim().toLowerCase();
  if (["prod", "production"].includes(normalized)) return "production";
  if (["hmg", "homologation", "homolog", "staging", "stage"].includes(normalized)) return "hmg";
  if (["ci", "test"].includes(normalized)) return "ci";
  return "development";
}
