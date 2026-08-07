import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { neon, neonConfig, Pool } from "@neondatabase/serverless";

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!connectionString) {
  throw new Error("Configure DATABASE_URL antes de executar as migracoes Postgres.");
}

const environment = parseEnvironment(process.env.RAPIDEX_ENV);
if (!environment) {
  throw new Error("RAPIDEX_ENV inválido para migrations. Use development, ci, hmg ou production.");
}

const migrationsDirectory = path.join(process.cwd(), "db", "postgres");
const wsProxy = String(process.env.RAPIDEX_POSTGRES_WS_PROXY || "").trim();
let pool = null;
let sql = null;

if (wsProxy) {
  neonConfig.wsProxy = () => wsProxy;
  neonConfig.useSecureWebSocket = false;
  neonConfig.pipelineConnect = false;
  neonConfig.forceDisablePgSSL = true;
  pool = new Pool({ connectionString });
} else {
  sql = neon(connectionString);
}

async function query(text, params = []) {
  if (pool) {
    const result = await pool.query(text, params);
    return result.rows;
  }
  return sql.query(text, params);
}

async function transaction(statements) {
  if (pool) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      for (const statement of statements) {
        await client.query(statement.text, statement.params || []);
      }
      await client.query("COMMIT");
    } catch (error) {
      try { await client.query("ROLLBACK"); } catch { /* preserve original error */ }
      throw error;
    } finally {
      client.release();
    }
    return;
  }

  await sql.transaction((transactionSql) =>
    statements.map((statement) => transactionSql.query(statement.text, statement.params || [])),
  );
}

try {
  await query(`
    CREATE TABLE IF NOT EXISTS rapidex_environment (
      id integer PRIMARY KEY CHECK (id = 1),
      environment text NOT NULL CHECK (environment IN ('hmg', 'production', 'development', 'ci')),
      created_at double precision NOT NULL DEFAULT (extract(epoch FROM clock_timestamp()) * 1000),
      updated_at double precision NOT NULL DEFAULT (extract(epoch FROM clock_timestamp()) * 1000)
    )
  `);

  const databaseEnvironment = await query("SELECT environment FROM rapidex_environment WHERE id = 1 LIMIT 1");
  if (!databaseEnvironment.length) {
    await query("INSERT INTO rapidex_environment (id, environment) VALUES (1, $1)", [environment]);
    console.log(`database environment initialized: ${environment}`);
  } else if (databaseEnvironment[0].environment !== environment) {
    throw new Error(
      `BLOQUEADO: este banco pertence ao ambiente ${databaseEnvironment[0].environment}, mas o deploy está configurado como ${environment}.`,
    );
  }

  await query(`
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

  const applied = await query(
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
      .filter(Boolean)
      .map((text) => ({ text }));

    statements.push({
      text: "INSERT INTO rapidex_migrations (name, checksum) VALUES ($1, $2)",
      params: [file, checksum],
    });
    await transaction(statements);
    console.log(`applied ${file}`);
  }

  console.log(`Postgres ${environment} pronto: ${files.length} migracao(oes) verificada(s).`);
} finally {
  if (pool) await pool.end();
}

function parseEnvironment(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized || normalized === "development" || normalized === "dev") return "development";
  if (["prod", "production"].includes(normalized)) return "production";
  if (["hmg", "homologation", "homolog", "staging", "stage"].includes(normalized)) return "hmg";
  if (["ci", "test"].includes(normalized)) return "ci";
  return null;
}
