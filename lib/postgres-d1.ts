import {
  neon,
  type FullQueryResults,
  type NeonQueryFunction,
} from "@neondatabase/serverless";

type Row = Record<string, unknown>;

type CompiledStatement = {
  sql: string;
  params: unknown[];
};

const numericColumn =
  /^(?:ok|count|total|orders|active|available|is_open|stock_control_enabled|signature_valid|whatsapp_consent|remaining|changes|row_count)$|(?:_at|_cents|_minutes|_count|_quantity|_stock|_number|_position|_percent|_revenue|_total|_expires)$/;

let cachedConnectionString: string | null = null;
let cachedDatabase: D1Database | null = null;

/**
 * Presents the small D1 surface used by RapidexMenu on top of Neon Postgres.
 * This keeps the API routes runtime-agnostic while HMG runs on Vercel/Neon.
 */
export function getPostgresDatabase(connectionString: string): D1Database {
  if (!cachedDatabase || cachedConnectionString !== connectionString) {
    cachedConnectionString = connectionString;
    cachedDatabase = new PostgresD1Database(connectionString) as unknown as D1Database;
  }

  return cachedDatabase;
}

class PostgresD1Database {
  readonly sql: NeonQueryFunction<false, true>;

  constructor(connectionString: string) {
    this.sql = neon<false, true>(connectionString, { fullResults: true });
  }

  prepare(query: string) {
    return new PostgresD1PreparedStatement(this, query);
  }

  async batch(statements: D1PreparedStatement[]) {
    const postgresStatements = statements.map((statement) => {
      if (!(statement instanceof PostgresD1PreparedStatement)) {
        throw new Error("A transacao recebeu uma instrucao de outro banco.");
      }
      return statement.compile();
    });

    const startedAt = performance.now();
    const results = await this.sql.transaction(
      (transaction) =>
        postgresStatements.map((statement) =>
          transaction.query(statement.sql, statement.params),
        ),
      { fullResults: true },
    );
    const duration = performance.now() - startedAt;

    return results.map((result) => toD1Result(result, duration));
  }

  async exec(query: string) {
    const compiled = compilePostgresQuery(query);
    const result = await this.execute(compiled.sql, []);
    return {
      count: result.rowCount ?? 0,
      duration: 0,
    };
  }

  async execute(query: string, params: unknown[]) {
    return this.sql.query(query, params);
  }
}

class PostgresD1PreparedStatement {
  constructor(
    private readonly database: PostgresD1Database,
    private readonly query: string,
    private readonly params: unknown[] = [],
  ) {}

  bind(...values: unknown[]) {
    return new PostgresD1PreparedStatement(this.database, this.query, values);
  }

  async first<T = Row>(columnName?: string): Promise<T | null> {
    const result = await this.execute();
    const row = normalizePostgresRows(result.rows as Row[])[0];
    if (!row) return null;
    if (columnName) return (row[columnName] as T | undefined) ?? null;
    return row as T;
  }

  async all<T = Row>() {
    const startedAt = performance.now();
    const result = await this.execute();
    return toD1Result<T>(result, performance.now() - startedAt);
  }

  async run<T = Row>() {
    const startedAt = performance.now();
    const result = await this.execute();
    return toD1Result<T>(result, performance.now() - startedAt);
  }

  async raw<T = unknown[]>(options: { columnNames?: boolean } = {}) {
    const result = await this.execute();
    const rows = normalizePostgresRows(result.rows as Row[]);
    const values = rows.map((row) => result.fields.map((field) => row[field.name])) as T[];
    if (!options.columnNames) return values;
    return [result.fields.map((field) => field.name) as T, ...values];
  }

  compile(): CompiledStatement {
    const compiled = compilePostgresQuery(this.query);
    return { sql: compiled.sql, params: this.params };
  }

  private execute() {
    const statement = this.compile();
    return this.database.execute(statement.sql, statement.params);
  }
}

export function compilePostgresQuery(query: string) {
  let sql = query.trim();
  const ignoreConflicts = /^INSERT\s+OR\s+IGNORE\s+INTO\b/i.test(sql);

  if (ignoreConflicts) {
    sql = sql.replace(/^INSERT\s+OR\s+IGNORE\s+INTO\b/i, "INSERT INTO");
    sql = `${sql.replace(/;\s*$/, "")} ON CONFLICT DO NOTHING`;
  }

  return {
    sql: numberPlaceholders(sql),
    parameterCount: countPlaceholders(query),
  };
}

export function normalizePostgresRows<T extends Row>(rows: T[]): T[] {
  return rows.map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([key, value]) => {
        if (
          typeof value === "string" &&
          numericColumn.test(key) &&
          /^-?\d+$/.test(value)
        ) {
          const parsed = Number(value);
          if (Number.isSafeInteger(parsed)) return [key, parsed];
        }
        return [key, value];
      }),
    ) as T,
  );
}

function toD1Result<T = Row>(result: FullQueryResults<false>, duration: number) {
  const rows = normalizePostgresRows(result.rows as Row[]) as T[];
  const changes = result.rowCount ?? 0;
  return {
    results: rows,
    success: true,
    meta: {
      duration,
      changes,
      last_row_id: 0,
      changed_db: changes > 0,
      size_after: 0,
      rows_read: result.command === "SELECT" ? changes : 0,
      rows_written: result.command === "SELECT" ? 0 : changes,
    },
  };
}

function numberPlaceholders(query: string) {
  let index = 0;
  let result = "";
  let quote: "'" | '"' | null = null;

  for (let position = 0; position < query.length; position += 1) {
    const character = query[position];

    if (quote) {
      result += character;
      if (character === quote) {
        if (query[position + 1] === quote) {
          result += query[position + 1];
          position += 1;
        } else {
          quote = null;
        }
      }
      continue;
    }

    if (character === "'" || character === '"') {
      quote = character;
      result += character;
      continue;
    }

    if (character === "?") {
      index += 1;
      result += `$${index}`;
      continue;
    }

    result += character;
  }

  return result;
}

function countPlaceholders(query: string) {
  const numbered = numberPlaceholders(query);
  const matches = numbered.match(/\$\d+/g);
  return matches?.length ?? 0;
}
