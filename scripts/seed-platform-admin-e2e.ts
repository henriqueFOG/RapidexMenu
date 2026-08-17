import { hashPassword } from "../lib/password-hash";
import { CANONICAL_PLATFORM_OWNER_EMAIL } from "../lib/platform-identity-policy";
import { getPostgresDatabase } from "../lib/postgres-d1";

const environment = String(process.env.RAPIDEX_ENV || "").trim().toLowerCase();
if (environment !== "hmg" && environment !== "ci") {
  throw new Error("O seed de superadmin E2E só pode rodar em HMG/CI descartável.");
}
const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!connectionString) throw new Error("DATABASE_URL é obrigatória para o seed E2E.");
const password = String(process.env.RAPIDEX_PLATFORM_E2E_PASSWORD || "");
if (password.length < 10 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
  throw new Error("RAPIDEX_PLATFORM_E2E_PASSWORD deve ter 10+ caracteres, letra e número.");
}

const db = getPostgresDatabase(connectionString);
const now = Date.now();
const userId = crypto.randomUUID();
await db.prepare(
  `INSERT INTO app_users
   (id, email, password_hash, full_name, phone, status, auth_version, created_at, updated_at)
   VALUES (?, ?, ?, 'Henry Francisco', NULL, 'active', 1, ?, ?)
   ON CONFLICT (email) DO UPDATE SET password_hash = excluded.password_hash,
     full_name = excluded.full_name, status = 'active', auth_version = app_users.auth_version + 1,
     updated_at = excluded.updated_at`,
).bind(userId, CANONICAL_PLATFORM_OWNER_EMAIL, await hashPassword(password), now, now).run();

const user = await db.prepare(
  "SELECT id FROM app_users WHERE lower(email) = ? LIMIT 1",
).bind(CANONICAL_PLATFORM_OWNER_EMAIL).first<{ id: string }>();
if (!user) throw new Error("Não foi possível preparar a identidade E2E.");

await db.prepare(
  `INSERT INTO platform_admins
   (id, user_id, role, status, created_by_user_id, created_at, updated_at)
   VALUES (?, ?, 'owner', 'active', ?, ?, ?)
   ON CONFLICT (user_id) DO UPDATE SET role = 'owner', status = 'active', updated_at = excluded.updated_at`,
).bind(crypto.randomUUID(), user.id, user.id, now, now).run();

process.stdout.write("Superadmin canônico preparado no banco E2E descartável.\n");
